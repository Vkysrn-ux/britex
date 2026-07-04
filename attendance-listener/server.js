const express = require('express')
const { Pool } = require('pg')

const app  = express()
const PORT          = process.env.PORT          || 8085
const DEVICE_PREFIX = process.env.DEVICE_PREFIX || 'BT'
const SHIFT_START   = process.env.SHIFT_START   || '09:00'
const GRACE_MINS    = parseInt(process.env.GRACE_MINS || '10')

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
function lunchLateMins(lunchOut, lunchIn) {
  if (!lunchOut || !lunchIn) return 0
  var taken = toMins(lunchIn.slice(0, 5)) - toMins(lunchOut.slice(0, 5))
  return Math.max(0, taken - 30)
}
function log(msg) {
  console.log('[' + new Date().toISOString() + '] ' + msg)
}

app.use(express.text({ type: '*/*', limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Log ALL incoming requests
app.use(function(req, res, next) {
  log('[REQUEST] ' + req.method + ' ' + req.url + ' from ' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress))
  var body = (typeof req.body === 'string' && req.body.length > 0) ? req.body.slice(0, 300) : ''
  if (body) log('[BODY] ' + body)
  next()
})

// Set to 0 once to force device to re-send all user records; will auto-advance after first OPERLOG push
var operlogStamp = 0

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
    'TimeZone=5.5\r\n' +
    'Realtime=1\r\n' +
    'Encrypt=None\r\n'
  )
}

// Handshake — ESSL K30 Pro polls /iclock/getrequest.aspx + /iclock/cdata.aspx
app.get(['/iclock/cdata', '/iclock/cdata.aspx', '/iclock/getrequest.aspx'], function(req, res) {
  var sn = req.query.SN || req.query.sn || 'UNKNOWN'
  log('Handshake SN=' + sn + ' path=' + req.path)
  sendHandshake(res, sn)
})

// Catch-all GET
app.get('*', function(req, res, next) {
  if (req.url === '/health') return next()
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
app.post('*', async function(req, res) {
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

      var btNum   = parseInt(pin, 10) - 4
      var empCode = DEVICE_PREFIX + '-' + String(btNum).padStart(2, '0')
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
        var att      = attRes.rows[0]
        var newCount = (att.punch_count || 1) + 1
        var lunchOut = att.lunch_out
        var lunchIn  = att.lunch_in
        var checkOut = att.check_out

        // If 2nd punch is after 14:00, it's check_out (most staff punch only twice)
        // If before 14:00, it's lunch_out
        var punchHour = parseInt(punchTime.slice(0, 2), 10)
        if (newCount === 2 && punchHour < 14) {
          lunchOut = punchTime; log('  LUNCH-OUT PIN=' + pin + ' ' + punchTime)
        } else if (newCount === 2 && punchHour >= 14) {
          checkOut = punchTime; log('  CHECK-OUT PIN=' + pin + ' ' + punchTime)
        } else if (newCount === 3 && !lunchOut) {
          checkOut = punchTime; log('  CHECK-OUT PIN=' + pin + ' ' + punchTime)
        } else if (newCount === 3 && lunchOut) {
          lunchIn  = punchTime; log('  LUNCH-IN  PIN=' + pin + ' ' + punchTime)
        } else {
          checkOut = punchTime; log('  CHECK-OUT PIN=' + pin + ' ' + punchTime)
        }

        var llm = lunchLateMins(lunchOut, lunchIn)
        var lmm = att.late_morning_mins || morningLateMins((att.check_in || '00:00:00').slice(0,8))
        await pool.query(
          'UPDATE hr_attendance SET check_out=$1,lunch_out=$2,lunch_in=$3,punch_count=$4,is_late_lunch=$5,late_lunch_mins=$6,late_morning_mins=$7 WHERE id=$8',
          [checkOut, lunchOut, lunchIn, newCount, llm>0, llm, lmm, att.id]
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
