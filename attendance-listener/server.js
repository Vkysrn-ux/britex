const express = require('express')
const { Pool } = require('pg')

const app  = express()
const PORT          = process.env.PORT          || 8085
const DEVICE_PREFIX = process.env.DEVICE_PREFIX || 'BT'
const SHIFT_START   = process.env.SHIFT_START   || '09:00'
const GRACE_MINS    = parseInt(process.env.GRACE_MINS || '10')
const DEBOUNCE_MINS = parseInt(process.env.DEBOUNCE_MINS || '3')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'postgres-db',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'mattress_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

pool.on('error', function(err) { console.error('[DB]', err.message) })

function toMins(t) {
  var parts = t.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}
function morningLateMins(timeStr) {
  var punchMins = toMins(timeStr.slice(0, 5))
  var dueMins   = toMins(SHIFT_START) + GRACE_MINS
  return Math.max(0, punchMins - dueMins)
}
function log(msg) {
  console.log('[' + new Date().toISOString() + '] ' + msg)
}

app.use(express.text({ type: '*/*', limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Log ALL incoming requests
app.use(function(req, res, next) {
  log('[REQUEST] ' + req.method + ' ' + req.url + ' from ' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress))
  var qKeys = Object.keys(req.query)
  if (qKeys.length > 0) log('[PARAMS] ' + JSON.stringify(req.query))
  var body = (typeof req.body === 'string' && req.body.length > 0) ? req.body.slice(0, 300) : ''
  if (body) log('[BODY] ' + body)
  next()
})

// Set to 0 once to force device to re-send all user records; will auto-advance after first OPERLOG push
var operlogStamp = 0

// ── Server→device command queue (user sync) ─────────────────────────────────
// Commands are handed to the device when it polls /iclock/getrequest.aspx,
// device ACKs each one on POST /iclock/devicecmd with ID=<n>&Return=<code>.
var ADMIN_TOKEN    = process.env.ADMIN_TOKEN || 'britex-sync-2026'
var CMDS_PER_POLL  = parseInt(process.env.CMDS_PER_POLL || '3')
var cmdQueue  = []   // { id, pin, name, cmd, status: pending|sent|ok|failed, return_code }
var nextCmdId = 1

function checkToken(req, res) {
  var token = req.query.token || req.headers['x-admin-token'] || ''
  if (token !== ADMIN_TOKEN) { res.status(403).json({ error: 'bad token' }); return false }
  return true
}

function queueUserCmd(pin, name, mode) {
  name = String(name || '').replace(/[\t\r\n]/g, ' ').trim().slice(0, 24)
  var body = (mode === 'userinfo')
    ? 'DATA UPDATE USERINFO PIN=' + pin + '\tName=' + name + '\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ='
    : 'DATA USER PIN=' + pin + '\tName=' + name + '\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000000000000'
  var item = { id: nextCmdId++, pin: pin, name: name, cmd: body, status: 'pending', return_code: null }
  cmdQueue.push(item)
  return item
}

function pendingCmds() {
  return cmdQueue.filter(function(c) { return c.status === 'pending' })
}

// Device timezone in minutes east of UTC (330 = IST +5:30).
// The device syncs its clock from the server on connect; without this it
// falls back to its internal (post-format, wrong) timezone setting.
var DEVICE_TZ_MINS = parseInt(process.env.DEVICE_TZ_MINS || '330')

function sendHandshake(res, sn) {
  res.set('Content-Type', 'text/plain')
  res.send(
    'GET OPTION FROM: ' + sn + '\r\n' +
    'ATTLOGStamp=0\r\n' +
    'OPERLOGStamp=' + operlogStamp + '\r\n' +
    'ATTPHOTOStamp=None\r\n' +
    'ErrorDelay=30\r\n' +
    'Delay=10\r\n' +
    'TransTimes=00:00;14:05\r\n' +
    'TransInterval=1\r\n' +
    'TransFlag=TransData AttLog OpLog\r\n' +
    'TimeZone=' + DEVICE_TZ_MINS + '\r\n' +
    'Realtime=1\r\n' +
    'Encrypt=None\r\n'
  )
}

// Handshake — ESSL K30 Pro polls /iclock/getrequest.aspx + /iclock/cdata.aspx
app.get(['/iclock/cdata', '/iclock/cdata.aspx', '/iclock/getrequest.aspx'], function(req, res) {
  var sn = req.query.SN || req.query.sn || 'UNKNOWN'
  // getrequest is the command poll: deliver queued user-sync commands if any
  if (req.path.indexOf('getrequest') !== -1) {
    var batch = pendingCmds().slice(0, CMDS_PER_POLL)
    if (batch.length > 0) {
      var lines = batch.map(function(c) {
        c.status = 'sent'
        return 'C:' + c.id + ':' + c.cmd
      })
      log('Sending ' + batch.length + ' cmd(s) to SN=' + sn + ' (ids ' + batch.map(function(c){return c.id}).join(',') + ')')
      res.set('Content-Type', 'text/plain')
      return res.send(lines.join('\r\n') + '\r\n')
    }
  }
  log('Handshake SN=' + sn + ' path=' + req.path)
  sendHandshake(res, sn)
})

// Device ACKs commands here: body lines like  ID=12&Return=0&CMD=DATA
app.post(['/iclock/devicecmd', '/iclock/devicecmd.aspx'], function(req, res) {
  var body  = typeof req.body === 'string' ? req.body : ''
  var lines = body.split(/\r?\n/).map(function(l) { return l.trim() }).filter(Boolean)
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/ID=(\d+).*?Return=(-?\d+)/i)
    if (!m) continue
    var id = parseInt(m[1]), ret = parseInt(m[2])
    for (var j = 0; j < cmdQueue.length; j++) {
      if (cmdQueue[j].id === id) {
        cmdQueue[j].status      = (ret === 0) ? 'ok' : 'failed'
        cmdQueue[j].return_code = ret
        log('CMD ' + id + ' (PIN=' + cmdQueue[j].pin + ') -> ' + cmdQueue[j].status + ' Return=' + ret)
      }
    }
  }
  res.send('OK')
})

// Catch-all GET
app.get('*', function(req, res, next) {
  if (req.path === '/health' || req.path.indexOf('/admin') === 0) return next()
  var sn = req.query.SN || req.query.sn || 'UNKNOWN'
  log('[ALT-GET] SN=' + sn + ' path=' + req.url)
  sendHandshake(res, sn)
})

// Attendance push — ESSL K30 Pro uses /iclock/cdata.aspx
app.post(['/iclock/cdata', '/iclock/cdata.aspx'], async function(req, res) {
  var table = req.query.table || req.query.Table || ''
  var sn    = req.query.SN || req.query.sn || 'UNKNOWN'
  log('POST ' + req.path + ' table=' + table + ' SN=' + sn)
  if (table.toUpperCase() === 'ATTLOG')  return await handleAttlog(req, res, sn)
  if (table.toUpperCase() === 'OPERLOG') return await handleOperlog(req, res, sn)
  res.send('OK')
})

// Catch-all POST
app.post('*', async function(req, res, next) {
  if (req.path.indexOf('/admin') === 0) return next()
  var table = req.query.table || req.query.Table || ''
  var sn    = req.query.SN || req.query.sn || 'UNKNOWN'
  log('[ALT-POST] path=' + req.url + ' table=' + table + ' SN=' + sn)
  if (table.toUpperCase() === 'ATTLOG')  return await handleAttlog(req, res, sn)
  if (table.toUpperCase() === 'OPERLOG') return await handleOperlog(req, res, sn)
  res.send('OK')
})

async function handleOperlog(req, res, sn) {
  var body  = typeof req.body === 'string' ? req.body : ''
  var lines = body.split(/\r?\n/).map(function(l) { return l.trim() }).filter(Boolean)
  log('OPERLOG SN=' + sn + ' lines=' + lines.length)
  var saved = 0
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!line.toUpperCase().startsWith('USER')) continue
    // Format: USER\tPIN=5\tName=Kalaiselvi.S\tPri=0\tPasswd=\tCard=...\t...
    var pin = '', name = '', pri = 0, card = ''
    var parts = line.split('\t')
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j]
      if (p.toUpperCase().startsWith('PIN='))  pin  = p.slice(4).trim()
      if (p.toUpperCase().startsWith('NAME=')) name = p.slice(5).trim()
      if (p.toUpperCase().startsWith('PRI='))  pri  = parseInt(p.slice(4)) || 0
      if (p.toUpperCase().startsWith('CARD=')) card = p.slice(5).trim()
    }
    if (!pin) continue
    try {
      await pool.query(
        'INSERT INTO device_users(pin,name,privilege,card,synced_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(pin) DO UPDATE SET name=$2,privilege=$3,card=$4,synced_at=NOW()',
        [pin, name, pri, card]
      )
      log('  USER PIN=' + pin + ' Name=' + name)
      saved++
    } catch(e) { log('  Error saving user: ' + e.message) }
  }
  // Advance stamp so device won't re-send same records
  operlogStamp = 9999
  log('  OPERLOG saved=' + saved + ' users')
  res.send('OK')
}

async function handleAttlog(req, res, sn) {
  var body  = typeof req.body === 'string' ? req.body : ''
  var lines = body.split(/\r?\n/).map(function(l) { return l.trim() }).filter(Boolean)
  log('SN=' + sn + ' pushed ' + lines.length + ' punch(es)')

  var saved = 0, skipped = 0
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    try {
      var parts = line.split('\t')
      if (parts.length < 2) continue
      var pin      = parts[0].trim()
      var datetime = parts[1].trim()
      var spIdx    = datetime.indexOf(' ')
      var dateStr  = datetime.slice(0, spIdx)
      var timeStr  = datetime.slice(spIdx + 1)
      if (!dateStr || !timeStr) continue

      var empCode = DEVICE_PREFIX + '-' + pin.padStart(2, '0')
      var empRes  = await pool.query(
        'SELECT id FROM hr_employees WHERE employee_code=$1 OR employee_code=$2 OR employee_code=$3 LIMIT 1',
        [empCode, pin.padStart(2,'0'), pin]
      )
      if (empRes.rows.length === 0) {
        log('  No employee for PIN=' + pin + ' (tried ' + empCode + ')')
        skipped++; continue
      }
      var empId     = empRes.rows[0].id
      var punchTime = timeStr.slice(0, 8)

      var attRes = await pool.query(
        'SELECT id,check_in,check_out,lunch_out,lunch_in,punch_count,late_morning_mins FROM hr_attendance WHERE employee_id=$1 AND date=$2',
        [empId, dateStr]
      )

      if (attRes.rows.length === 0) {
        var lateMins = morningLateMins(punchTime)
        await pool.query(
          'INSERT INTO hr_attendance(employee_id,date,check_in,punch_count,status,late_morning_mins) VALUES($1,$2,$3,1,$4,$5)',
          [empId, dateStr, punchTime, lateMins > 0 ? 'late' : 'present', lateMins]
        )
        log('  CHECK-IN  PIN=' + pin + ' ' + dateStr + ' ' + punchTime + (lateMins > 0 ? ' LATE+' + lateMins + 'm' : ''))
      } else {
        // Two-punch model: first punch = check_in, latest punch = check_out.
        var att = attRes.rows[0]

        // Ignore duplicate re-sends of punches we already have
        if (punchTime === (att.check_in || '').slice(0,8) || punchTime === (att.check_out || '').slice(0,8)) {
          log('  DUP       PIN=' + pin + ' ' + punchTime + ' (ignored)')
          saved++; continue
        }

        // Debounce accidental double-taps: ignore punches within a few minutes
        // of the recorded check-in or check-out (real entry/exit are hours apart)
        var punchM = toMins(punchTime.slice(0,5))
        var nearIn  = att.check_in  && Math.abs(punchM - toMins(att.check_in.slice(0,5)))  <= DEBOUNCE_MINS
        var nearOut = att.check_out && Math.abs(punchM - toMins(att.check_out.slice(0,5))) <= DEBOUNCE_MINS
        if (nearIn || nearOut) {
          log('  DEBOUNCE  PIN=' + pin + ' ' + punchTime + ' (within ' + DEBOUNCE_MINS + 'min of previous punch, ignored)')
          saved++; continue
        }

        var newCount = (att.punch_count || 1) + 1
        var checkOut = att.check_out
        // Latest punch of the day wins as check_out
        if (!checkOut || punchTime > checkOut.slice(0,8)) checkOut = punchTime
        log('  CHECK-OUT PIN=' + pin + ' ' + punchTime)

        var lmm = att.late_morning_mins || morningLateMins((att.check_in || '00:00:00').slice(0,8))

        // Half day: less than 4 hours between check-in and check-out
        var workedMins = toMins(checkOut.slice(0,5)) - toMins((att.check_in || checkOut).slice(0,5))
        var status = workedMins < 240 ? 'half_day' : (lmm > 0 ? 'late' : 'present')

        await pool.query(
          'UPDATE hr_attendance SET check_out=$1,punch_count=$2,late_morning_mins=$3,status=$4 WHERE id=$5',
          [checkOut, newCount, lmm, status, att.id]
        )
      }
      saved++
    } catch (err) {
      log('  Error: ' + err.message)
      skipped++
    }
  }
  log('  saved=' + saved + ' skipped=' + skipped)
  res.send('OK')
}

// ── Admin: push all active employees to the device as users ─────────────────
// POST /admin/push-users?token=...           (old ESSL format, default)
// POST /admin/push-users?token=...&mode=userinfo   (newer PUSH SDK format)
// PIN is derived from employee_code: BT-09 -> 9
app.post('/admin/push-users', async function(req, res) {
  if (!checkToken(req, res)) return
  var mode = (req.query.mode === 'userinfo') ? 'userinfo' : 'user'
  try {
    var r = await pool.query(
      "SELECT employee_code, TRIM(first_name || ' ' || COALESCE(last_name,'')) AS name FROM hr_employees WHERE status='active' ORDER BY employee_code"
    )
    var queued = [], skipped = [], seen = {}
    for (var i = 0; i < r.rows.length; i++) {
      var code   = r.rows[i].employee_code || ''
      var digits = code.replace(/\D/g, '')
      var pin    = digits ? String(parseInt(digits, 10)) : ''
      if (!pin || seen[pin]) { skipped.push(code); continue }
      seen[pin] = true
      queueUserCmd(pin, r.rows[i].name, mode)
      queued.push({ pin: pin, code: code, name: r.rows[i].name })
    }
    log('ADMIN queued ' + queued.length + ' user cmds (mode=' + mode + '), skipped ' + skipped.length)
    res.json({ queued: queued.length, skipped: skipped, mode: mode,
               note: 'Device picks these up on its next polls (' + CMDS_PER_POLL + ' per poll). Watch GET /admin/queue' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Queue status / results
app.get('/admin/queue', function(req, res) {
  if (!checkToken(req, res)) return
  var counts = { pending: 0, sent: 0, ok: 0, failed: 0 }
  cmdQueue.forEach(function(c) { counts[c.status] = (counts[c.status] || 0) + 1 })
  res.json({ counts: counts, commands: cmdQueue.map(function(c) {
    return { id: c.id, pin: c.pin, name: c.name, status: c.status, return_code: c.return_code }
  }) })
})

// Queue a SET OPTION command for the device, e.g. to fix its timezone:
//   POST /admin/set-option?token=...&key=TimeZone&value=330
// Or force the clock directly (some firmware ignores TimeZone):
//   POST /admin/set-option?token=...&key=DateTime&value=<encoded>
app.post('/admin/set-option', function(req, res) {
  if (!checkToken(req, res)) return
  var key = (req.query.key || '').trim(), value = (req.query.value || '').trim()
  if (!key) return res.status(400).json({ error: 'key required' })
  var item = { id: nextCmdId++, pin: null, name: key + '=' + value,
               cmd: 'SET OPTION ' + key + '=' + value, status: 'pending', return_code: null }
  cmdQueue.push(item)
  log('ADMIN queued SET OPTION ' + key + '=' + value + ' (cmd ' + item.id + ')')
  res.json({ queued: item.id, cmd: item.cmd, note: 'Device applies it on next poll; check GET /admin/queue' })
})

// Clear the queue (e.g. before retrying with the other mode)
app.post('/admin/clear-queue', function(req, res) {
  if (!checkToken(req, res)) return
  var n = cmdQueue.length
  cmdQueue = []
  res.json({ cleared: n })
})

app.get('/health', async function(_req, res) {
  try {
    var r = await pool.query('SELECT NOW() AS ts, COUNT(*) AS emp FROM hr_employees')
    res.json({ status: 'ok', db: 'connected', server_time: r.rows[0].ts, employees: r.rows[0].emp })
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message })
  }
})

app.listen(PORT, '0.0.0.0', function() {
  log('ADMS listener on port ' + PORT + '  prefix=' + DEVICE_PREFIX + '  shift=' + SHIFT_START + '  grace=' + GRACE_MINS + 'm')
})
