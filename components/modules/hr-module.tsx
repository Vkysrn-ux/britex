"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Users, Building2, CalendarCheck, FileText, DollarSign,
  Plus, Search, Clock, Edit2, BarChart3, RefreshCw
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type Employee = {
  id: number; employee_code: string; first_name: string; last_name: string
  email?: string; phone?: string; gender?: string; date_of_birth?: string
  date_of_joining: string; department_id?: number; department_name?: string
  job_title?: string; employment_type: string; basic_salary: number
  status: string
}

type Department = { id: number; name: string; code: string; description?: string; employee_count: number; head_name?: string }
type LeaveType = { id: number; name: string; code: string; days_per_year: number; paid: boolean }
type LeaveRequest = {
  id: number; employee_id: number; employee_name: string; employee_code: string
  leave_type_name: string; start_date: string; end_date: string; days: number
  reason?: string; status: string; created_at: string; department_name?: string
}
type Payroll = { id: number; month: number; year: number; status: string; total_gross: number; total_net: number; employee_count: number }
type HRStats = {
  employees: { active: number; inactive: number; terminated: number; total: number }
  departments: number
  leave: { pending: number; approved: number; rejected: number }
  today_attendance: { present: number; absent: number; on_leave: number }
  ytd_payroll: number
  department_breakdown: { name: string; count: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-600',
    terminated: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-600', processed: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700', present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700', half_day: 'bg-yellow-100 text-yellow-700',
    late: 'bg-orange-100 text-orange-700', on_leave: 'bg-blue-100 text-blue-700',
    full_time: 'bg-indigo-100 text-indigo-700', part_time: 'bg-purple-100 text-purple-700',
    contract: 'bg-orange-100 text-orange-700', intern: 'bg-pink-100 text-pink-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status.replace(/_/g,' ')}</span>
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="border-orange-100">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color || 'bg-orange-50'}`}>
          <Icon className={`w-5 h-5 ${color ? 'text-white' : 'text-orange-600'}`} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

function HRDashboard() {
  const [stats, setStats] = useState<HRStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hr/stats').then(r => r.json()).then(d => { setStats(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading HR overview…</div>
  if (!stats) return <div className="text-red-500 p-4">Failed to load HR stats.</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">HR Overview</h2>
        <p className="text-sm text-gray-500">Real-time workforce snapshot</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Employees" value={stats.employees.active} sub={`${stats.employees.total} total`} />
        <StatCard icon={Building2} label="Departments" value={stats.departments} />
        <StatCard icon={Clock} label="Pending Leaves" value={stats.leave.pending} sub="awaiting approval" color="bg-yellow-400" />
        <StatCard icon={DollarSign} label="YTD Payroll" value={fmt(stats.ytd_payroll)} color="bg-green-500" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-orange-100">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Today's Attendance</p>
            <div className="flex gap-4 mt-2">
              <div className="text-center"><p className="text-2xl font-bold text-green-600">{stats.today_attendance.present}</p><p className="text-xs text-gray-400">Present</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-red-500">{stats.today_attendance.absent}</p><p className="text-xs text-gray-400">Absent</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-blue-500">{stats.today_attendance.on_leave}</p><p className="text-xs text-gray-400">On Leave</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Leave Status</p>
            <div className="flex gap-4 mt-2">
              <div className="text-center"><p className="text-2xl font-bold text-yellow-500">{stats.leave.pending}</p><p className="text-xs text-gray-400">Pending</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-green-600">{stats.leave.approved}</p><p className="text-xs text-gray-400">Approved</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-red-500">{stats.leave.rejected}</p><p className="text-xs text-gray-400">Rejected</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-3">Dept. Headcount</p>
            <div className="space-y-1">
              {(stats.department_breakdown || []).slice(0, 4).map(d => (
                <div key={d.name} className="flex justify-between items-center">
                  <span className="text-xs text-gray-600 truncate">{d.name}</span>
                  <span className="text-xs font-semibold text-orange-600">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Employees ────────────────────────────────────────────────────────────────

function EmployeesSection({ departments }: { departments: Department[] }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [deptFilter, setDeptFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [form, setForm] = useState<Record<string, any>>({
    employee_code: '', first_name: '', last_name: '', email: '', phone: '',
    gender: '', date_of_birth: '', date_of_joining: new Date().toISOString().slice(0, 10),
    department_id: '', job_title: '', employment_type: 'full_time', basic_salary: '',
    bank_account: '', bank_name: '', address: '', emergency_contact: '', emergency_phone: ''
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ status: statusFilter, ...(search ? { search } : {}), ...(deptFilter ? { department_id: deptFilter } : {}) })
    fetch(`/api/hr/employees?${q}`).then(r => r.json()).then(d => { setEmployees(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter, search, deptFilter])

  useEffect(() => { load() }, [load])

  const openEdit = (e: Employee) => {
    setEditEmp(e)
    setForm({
      employee_code: e.employee_code, first_name: e.first_name, last_name: e.last_name,
      email: e.email || '', phone: e.phone || '', gender: e.gender || '',
      date_of_birth: e.date_of_birth ? e.date_of_birth.slice(0, 10) : '',
      date_of_joining: e.date_of_joining.slice(0, 10),
      department_id: e.department_id || '', job_title: e.job_title || '',
      employment_type: e.employment_type, basic_salary: e.basic_salary,
      bank_account: '', bank_name: '', address: '', emergency_contact: '', emergency_phone: ''
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setEditEmp(null)
    setForm({ employee_code: '', first_name: '', last_name: '', email: '', phone: '',
      gender: '', date_of_birth: '', date_of_joining: new Date().toISOString().slice(0, 10),
      department_id: '', job_title: '', employment_type: 'full_time', basic_salary: '',
      bank_account: '', bank_name: '', address: '', emergency_contact: '', emergency_phone: '' })
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      const url = editEmp ? `/api/hr/employees/${editEmp.id}` : '/api/hr/employees'
      const method = editEmp ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMsg({ text: editEmp ? 'Employee updated.' : 'Employee added.', type: 'success' })
      resetForm(); load()
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const handleBiometricImport = async () => {
    setImporting(true); setMsg(null); setImportResult(null)
    try {
      const res = await fetch('/api/hr/employees/import-biometric', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportResult(data)
      setMsg({ text: `Import complete: ${data.summary.created} employees created, ${data.summary.skipped} skipped.`, type: 'success' })
      load()
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' })
    } finally { setImporting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-500">{employees.length} records</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBiometricImport} disabled={importing} variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50">
            {importing
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Importing…</>
              : <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Import Biometric</>
            }
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />Add Employee
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {importResult && (
        <Card className="border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 mb-3">
              <div className="text-center"><p className="text-2xl font-bold text-green-600">{importResult.summary.created}</p><p className="text-xs text-gray-500">Created</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-400">{importResult.summary.skipped}</p><p className="text-xs text-gray-500">Skipped</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-blue-600">{importResult.summary.departments_created}</p><p className="text-xs text-gray-500">Departments</p></div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 mb-1">Departments created:</p>
                <div className="flex flex-wrap gap-1">
                  {importResult.departments.map((d: string) => (
                    <span key={d} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">{d}</span>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 self-start">✕</Button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-gray-50">
                  <th className="px-2 py-1.5 text-left text-gray-500">Code</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Name</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Department</th>
                  <th className="px-2 py-1.5 text-left text-gray-500">Result</th>
                </tr></thead>
                <tbody>
                  {importResult.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1 font-mono">{d.code}</td>
                      <td className="px-2 py-1">{d.name}</td>
                      <td className="px-2 py-1 text-gray-500">{d.dept}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${d.action === 'created' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.action}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">{editEmp ? 'Edit Employee' : 'New Employee'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Employee Code*</label>
                  <Input value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="EMP001" required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">First Name*</label>
                  <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Last Name*</label>
                  <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Email</label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Phone</label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Gender</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select></div>
                <div><label className="text-xs font-medium text-gray-600">Date of Birth</label>
                  <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Date of Joining*</label>
                  <Input type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Department</label>
                  <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></div>
                <div><label className="text-xs font-medium text-gray-600">Job Title</label>
                  <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Employment Type</label>
                  <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                    <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                    <option value="contract">Contract</option><option value="intern">Intern</option>
                  </select></div>
                <div><label className="text-xs font-medium text-gray-600">Basic Salary (₹)</label>
                  <Input type="number" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} className="mt-1" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving ? 'Saving…' : editEmp ? 'Update Employee' : 'Add Employee'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name, code or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm min-w-[160px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
          <option value="all">All Status</option>
        </select>
      </div>

      <Card className="border-orange-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-orange-100 bg-orange-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Job Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Salary</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading…</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No employees found</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-orange-50/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{emp.employee_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.first_name} {emp.last_name}<div className="text-xs text-gray-400">{emp.email}</div></td>
                  <td className="px-4 py-3 text-gray-600">{emp.department_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.job_title || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={emp.employment_type} /></td>
                  <td className="px-4 py-3 text-gray-600">{fmt(emp.basic_salary)}</td>
                  <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(emp)} className="h-7 w-7 p-0 text-gray-400 hover:text-orange-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Attendance helpers ────────────────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`
}

function fmtWH(hours: number): string {
  if (!hours || hours <= 0) return '00h 00m'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  present:  { label: 'On Time',  cls: 'bg-green-100 text-green-700 border-green-200' },
  late:     { label: 'Late',     cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  half_day: { label: 'Half Day', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  on_leave: { label: 'On Leave', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  absent:   { label: 'Absent',   cls: 'bg-red-100 text-red-600 border-red-200' },
}

// ─── Attendance ───────────────────────────────────────────────────────────────

function AttendanceSection() {
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [departments, setDepts] = useState<Department[]>([])
  const [view, setView]         = useState<'list' | 'import' | 'mark'>('list')
  const [msg, setMsg]           = useState<{ text: string; type: 'success'|'error' } | null>(null)

  // Import state
  const [importFile, setImportFile]   = useState<File | null>(null)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<any | null>(null)

  // Mark attendance state
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [markMap, setMarkMap]     = useState<Record<number, string>>({})
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    fetch('/api/hr/departments').then(r => r.json()).then(d => setDepts(d.data || []))
    fetch('/api/hr/employees?status=active').then(r => r.json()).then(d => {
      const emps: Employee[] = d.data || []
      setAllEmployees(emps)
      setMarkMap(Object.fromEntries(emps.map(e => [e.id, 'present'])))
    })
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ date, ...(deptFilter ? { department_id: deptFilter } : {}), ...(search ? { search } : {}), ...(statusFilter ? { status: statusFilter } : {}) })
    fetch(`/api/hr/attendance/daily?${q}`).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [date, deptFilter, search, statusFilter])

  useEffect(() => { load() }, [load])

  // Reload mark map when date changes
  useEffect(() => {
    if (!date) return
    fetch(`/api/hr/attendance?date=${date}`).then(r => r.json()).then(d => {
      const m: Record<number,string> = {}
      for (const r of (d.data || [])) m[r.employee_id] = r.status
      setMarkMap(prev => { const u = { ...prev }; for (const [k,v] of Object.entries(m)) u[Number(k)] = v; return u })
    })
  }, [date])

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      const records = allEmployees.map(e => ({ employee_id: e.id, status: markMap[e.id] || 'absent' }))
      const res = await fetch('/api/hr/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, records }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setMsg({ text: `Attendance saved for ${result.count} employees.`, type: 'success' })
      setView('list'); load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const handleExport = () => {
    if (!data?.employees) return
    const rows = data.employees.map((e: any, i: number) => [
      i+1, e.employee_code, e.name, e.department_name || '',
      fmtTime(e.check_in), fmtTime(e.check_out),
      fmtWH(Number(e.work_hours)), Number(e.work_hours) > 9 ? fmtWH(Number(e.work_hours) - 9) : '—',
      e.status ? (STATUS_BADGE[e.status]?.label || e.status) : 'Absent'
    ])
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([['S.No','Emp ID','Name','Department','Check In','Check Out','Work Hours','OT','Status'], ...rows])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Attendance ${date}`)
      XLSX.writeFile(wb, `Attendance_${date}.xlsx`)
    })
  }

  const summary = data?.summary || {}
  const employees = data?.employees || []

  const reportMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Biometric Attendance</h2>
          <p className="text-xs text-gray-400 mt-0.5">All times in IST · Last device push: {data ? new Date().toLocaleTimeString() : 'Never'}</p>
        </div>
        <div className="flex gap-2">
          {view !== 'list' && (
            <Button variant="outline" size="sm" onClick={() => setView('list')} className="border-gray-200 text-gray-600">
              ← Back
            </Button>
          )}
          <Button size="sm" onClick={() => { setView('mark') }} className={view === 'mark' ? 'bg-gray-700 hover:bg-gray-800 text-white' : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}>
            Mark Attendance
          </Button>
          <Button size="sm" onClick={() => { setView('import'); setImportResult(null); setImportFile(null) }} className={view === 'import' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border border-orange-300 text-orange-700 bg-white hover:bg-orange-50'}>
            Import Biometric
          </Button>
          {view === 'list' && (
            <Button size="sm" onClick={handleExport} className="bg-red-600 hover:bg-red-700 text-white">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              Export
            </Button>
          )}
        </div>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {/* ── BIOMETRIC LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'TOTAL',    value: summary.total    ?? 0, cls: 'text-gray-800' },
              { label: 'PRESENT',  value: summary.present  ?? 0, cls: 'text-green-600' },
              { label: 'LATE',     value: summary.late     ?? 0, cls: 'text-yellow-600' },
              { label: 'ABSENT',   value: summary.absent   ?? 0, cls: 'text-red-600' },
              { label: 'HALF DAY', value: summary.half_day ?? 0, cls: 'text-orange-500' },
            ].map(s => (
              <div key={s.label} className="border border-gray-200 rounded-xl p-4 bg-white">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest">{s.label}</p>
                <p className={`text-4xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap bg-gray-50 rounded-xl px-4 py-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by Emp ID or Name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm bg-white" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400 font-semibold px-1">SELECT DATE</span>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm bg-white w-40" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400 font-semibold px-1">DEPARTMENT</span>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white min-w-[150px]">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-400 font-semibold px-1">STATUS</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm bg-white w-32">
                <option value="">All Statuses</option>
                <option value="present">On Time</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-20">EMP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">NAME</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DEPARTMENT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 text-green-600">CHECK IN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-red-500">CHECK OUT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">WORK HRS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600">OT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="py-16 text-center text-gray-400">Loading…</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center text-gray-400">No records for {date}</td></tr>
                  ) : employees.map((emp: any, i: number) => {
                    const wh = Number(emp.work_hours) || 0
                    const ot = wh > 9 ? wh - 9 : 0
                    const badge = emp.status ? STATUS_BADGE[emp.status] : STATUS_BADGE['absent']
                    return (
                      <tr key={emp.id} className={`border-b border-gray-100 hover:bg-orange-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 font-semibold">{emp.employee_code}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{emp.department_name || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{fmtTime(emp.check_in)}</td>
                        <td className="px-4 py-3 font-semibold text-red-500">{fmtTime(emp.check_out)}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{fmtWH(wh)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-600">{ot > 0 ? fmtWH(ot) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">
                          {badge ? (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>{badge.label}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MARK ATTENDANCE VIEW ── */}
      {view === 'mark' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div><label className="text-xs font-medium text-gray-600">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-48" /></div>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMPLOYEE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DEPARTMENT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">STATUS</th>
              </tr></thead>
              <tbody>
                {allEmployees.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400">No active employees</td></tr>
                ) : allEmployees.map((emp, i) => (
                  <tr key={emp.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{emp.employee_code}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{emp.first_name} {emp.last_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{emp.department_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <select value={markMap[emp.id] || 'present'} onChange={e => setMarkMap(m => ({ ...m, [emp.id]: e.target.value }))} className="border rounded-lg px-2 py-1 text-xs bg-white">
                        <option value="present">On Time</option>
                        <option value="late">Late</option>
                        <option value="half_day">Half Day</option>
                        <option value="on_leave">On Leave</option>
                        <option value="absent">Absent</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={handleSave} disabled={saving || allEmployees.length === 0} className="bg-orange-600 hover:bg-orange-700 text-white">
            {saving ? 'Saving…' : `Save Attendance (${allEmployees.length} employees)`}
          </Button>
        </div>
      )}

      {/* ── IMPORT VIEW ── */}
      {view === 'import' && (
        <div className="space-y-5">
          <Card className="border-orange-100 bg-orange-50/40">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-800">Import Attendance from Biometric Device</h3>
                <a href="/api/hr/attendance/template" download className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50">
                  Download Template
                </a>
              </div>
              <p className="text-sm text-gray-500">Supports ZKTeco <strong>.xls</strong> export (reads <em>Att.log report</em> sheet automatically) and generic <strong>.xlsx / .csv</strong> files.</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <label htmlFor="bio-file-input2" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg text-sm text-orange-700 hover:bg-orange-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {importFile ? importFile.name : 'Choose Excel / CSV file'}
                </label>
                <input id="bio-file-input2" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null) }} />
                {importFile && <span className="text-xs text-gray-400">{(importFile.size / 1024).toFixed(1)} KB</span>}
              </div>
              <Button onClick={async () => {
                if (!importFile) return
                setImporting(true); setImportResult(null)
                try {
                  const fd = new FormData(); fd.append('file', importFile)
                  const res = await fetch('/api/hr/attendance/import', { method: 'POST', body: fd })
                  const d = await res.json()
                  if (!res.ok) throw new Error(d.error)
                  setImportResult(d); load()
                } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
                finally { setImporting(false) }
              }} disabled={!importFile || importing} className="mt-4 bg-orange-600 hover:bg-orange-700 text-white">
                {importing ? 'Importing…' : 'Upload & Import'}
              </Button>
            </CardContent>
          </Card>

          {importResult && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                Source: {importResult.source} {importResult.date_range ? `· Range: ${importResult.date_range}` : ''}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Imported',  value: importResult.summary?.imported  ?? 0, cls: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'Skipped',   value: importResult.summary?.skipped   ?? 0, cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                  { label: 'No Match',  value: importResult.summary?.unmatched ?? 0, cls: 'bg-red-50 border-red-200 text-red-700' },
                  { label: 'Employees', value: importResult.summary?.total_employees ?? '—', cls: 'bg-gray-50 border-gray-200 text-gray-700' },
                ].map(s => (
                  <div key={s.label} className={`border rounded-xl p-3 text-center ${s.cls}`}>
                    <p className="text-3xl font-bold">{s.value}</p>
                    <p className="text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {importResult.unmatched_employees?.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Unmatched employees ({importResult.unmatched_employees.length}):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {importResult.unmatched_employees.map((n: string, i: number) => <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-mono">{n}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Leave Management ─────────────────────────────────────────────────────────

function LeaveSection({ employees }: { employees: Employee[] }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadRequests = useCallback(() => {
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
    fetch(`/api/hr/leave/requests${q}`).then(r => r.json()).then(d => setRequests(d.data || []))
  }, [statusFilter])

  useEffect(() => {
    loadRequests()
    fetch('/api/hr/leave/types').then(r => r.json()).then(d => setLeaveTypes(d.data || []))
  }, [loadRequests])

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/hr/leave/requests/${id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: `Leave request ${action}d successfully.`, type: 'success' })
      loadRequests()
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const s = new Date(start), e = new Date(end)
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setMsg(null)
    try {
      const days = calcDays(form.start_date, form.end_date)
      const res = await fetch('/api/hr/leave/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Leave request submitted.', type: 'success' })
      setShowForm(false)
      setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' })
      loadRequests()
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Leave Management</h2></div>
        <Button onClick={() => setShowForm(s => !s)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />New Request
        </Button>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">Submit Leave Request</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Employee*</label>
                <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">Select employee</option>
                  {employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-gray-600">Leave Type*</label>
                <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))} required className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">Select type</option>
                  {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-gray-600">Start Date*</label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required className="mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-600">End Date*</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required className="mt-1" />
                {form.start_date && form.end_date && <p className="text-xs text-orange-600 mt-1">{calcDays(form.start_date, form.end_date)} day(s)</p>}</div>
              <div className="col-span-2"><label className="text-xs font-medium text-gray-600">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none" /></div>
              <div className="col-span-2 flex gap-3">
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">{saving ? 'Submitting…' : 'Submit Request'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}
            className={statusFilter === s ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <Card className="border-orange-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-orange-100 bg-orange-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">From</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">To</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Days</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
            </tr></thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No leave requests</td></tr>
              ) : requests.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-orange-50/30">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.employee_name}<div className="text-xs text-gray-400">{r.employee_code}</div></td>
                  <td className="px-4 py-3 text-gray-600">{r.leave_type_name}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.start_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.end_date)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.days}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.reason || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleAction(r.id, 'approve')} className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs">Approve</Button>
                        <Button size="sm" onClick={() => handleAction(r.id, 'reject')} className="h-7 px-2 bg-red-500 hover:bg-red-600 text-white text-xs">Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

function PayrollSection() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(() => { const d = new Date(); return { month: String(d.getMonth()+1), year: String(d.getFullYear()), notes: '' } })
  const [processing, setProcessing] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadPayrolls = () => {
    fetch('/api/hr/payroll').then(r => r.json()).then(d => setPayrolls(d.data || []))
  }

  const loadItems = (id: number) => {
    setSelectedId(id)
    fetch(`/api/hr/payroll/${id}/items`).then(r => r.json()).then(d => setItems(d.data || []))
  }

  useEffect(() => { loadPayrolls() }, [])

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/hr/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Payroll run created.', type: 'success' })
      setShowForm(false); loadPayrolls()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const handleProcess = async (id: number) => {
    setProcessing(id); setMsg(null)
    try {
      const res = await fetch(`/api/hr/payroll/${id}/process`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: `Payroll processed for ${data.employees_count} employees.`, type: 'success' })
      loadPayrolls(); if (selectedId === id) loadItems(id)
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setProcessing(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Payroll</h2></div>
        <Button onClick={() => setShowForm(s => !s)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />New Payroll Run
        </Button>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">Create Payroll Run</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div><label className="text-xs font-medium text-gray-600">Month</label>
                <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="mt-1 border rounded-md px-3 py-2 text-sm">
                  {MONTHS.map((m, i) => <option key={i} value={String(i+1)}>{m}</option>)}
                </select></div>
              <div><label className="text-xs font-medium text-gray-600">Year</label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="mt-1 w-24" /></div>
              <div className="flex-1"><label className="text-xs font-medium text-gray-600">Notes</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" /></div>
              <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">{saving ? 'Creating…' : 'Create'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-orange-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Payroll Runs</CardTitle></CardHeader>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-orange-100 bg-orange-50">
                <th className="px-3 py-2 text-left font-medium text-gray-600">Period</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Net</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
              </tr></thead>
              <tbody>
                {payrolls.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400">No payroll runs yet</td></tr>
                ) : payrolls.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 cursor-pointer hover:bg-orange-50/30 ${selectedId === p.id ? 'bg-orange-50' : ''}`} onClick={() => loadItems(p.id)}>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{MONTHS[p.month-1]} {p.year}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmt(p.total_net)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5">
                      {p.status === 'draft' && (
                        <Button size="sm" disabled={processing === p.id} onClick={ev => { ev.stopPropagation(); handleProcess(p.id) }}
                          className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                          {processing === p.id ? 'Processing…' : 'Process'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-orange-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">
            {selectedId ? `Payslips — ${MONTHS[(payrolls.find(p => p.id === selectedId)?.month || 1)-1]} ${payrolls.find(p => p.id === selectedId)?.year}` : 'Select a payroll run'}
          </CardTitle></CardHeader>
          <div className="overflow-y-auto max-h-80">
            {!selectedId ? (
              <div className="py-12 text-center text-gray-400 text-sm">Click a payroll run to view payslips</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-orange-100 bg-orange-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Gross</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Net</th>
                </tr></thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">Not processed yet</td></tr>
                  ) : items.map(it => (
                    <tr key={it.id} className="border-b border-gray-50 hover:bg-orange-50/30">
                      <td className="px-3 py-2.5"><div className="font-medium text-gray-900">{it.employee_name}</div><div className="text-xs text-gray-400">{it.employee_code}</div></td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(it.gross_salary)}</td>
                      <td className="px-3 py-2.5 text-right text-red-500">-{fmt(it.tax_deduction)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-600">{fmt(it.net_salary)}</td>
                    </tr>
                  ))}
                  {items.length > 0 && (
                    <tr className="bg-orange-50 font-semibold">
                      <td className="px-3 py-2 text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right">{fmt(items.reduce((s, i) => s + +i.gross_salary, 0))}</td>
                      <td className="px-3 py-2 text-right text-red-500">-{fmt(items.reduce((s, i) => s + +i.tax_deduction, 0))}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmt(items.reduce((s, i) => s + +i.net_salary, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Departments ──────────────────────────────────────────────────────────────

function DepartmentsSection({ departments, reload }: { departments: Department[]; reload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/hr/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Department created.', type: 'success' })
      setForm({ name: '', code: '', description: '' }); setShowForm(false); reload()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Departments</h2><p className="text-sm text-gray-500">{departments.length} departments</p></div>
        <Button onClick={() => setShowForm(s => !s)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Add Department
        </Button>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">New Department</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <div className="flex-1"><label className="text-xs font-medium text-gray-600">Department Name*</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-600">Code*</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required maxLength={20} className="mt-1 w-28" placeholder="HR" /></div>
              <div className="flex-1"><label className="text-xs font-medium text-gray-600">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
              <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">{saving ? 'Creating…' : 'Create'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-400">No departments yet. Add one above.</div>
        ) : departments.map(d => (
          <Card key={d.id} className="border-orange-100 hover:border-orange-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-orange-100 text-orange-700 font-bold text-xs px-2 py-1 rounded">{d.code}</div>
                <span className="text-2xl font-bold text-orange-600">{d.employee_count}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-400 mt-1">{d.description}</p>}
              {d.head_name && <p className="text-xs text-gray-500 mt-2">Head: <span className="font-medium">{d.head_name}</span></p>}
              <p className="text-xs text-gray-400 mt-1">{d.employee_count} active employee{d.employee_count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Attendance Sheet ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { code: string; bg: string; text: string }> = {
  present:  { code: 'P',  bg: 'bg-green-100',  text: 'text-green-700'  },
  late:     { code: 'L',  bg: 'bg-orange-100', text: 'text-orange-700' },
  absent:   { code: 'A',  bg: 'bg-red-100',    text: 'text-red-600'    },
  half_day: { code: 'HD', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  on_leave: { code: 'CL', bg: 'bg-blue-100',   text: 'text-blue-700'   },
}

function DayCell({ rec, isSunday }: { rec: any; isSunday: boolean }) {
  if (isSunday) return <td className="px-0 py-1 text-center bg-orange-50 text-orange-400 text-[11px] font-semibold">Sun</td>
  // Future date — no data yet, show blank
  if (rec === 'future') return <td className="px-0 py-1 text-center text-gray-200 text-[11px]">—</td>
  // Past date, no record = absent
  if (!rec) return (
    <td className="px-0 py-1 text-center">
      <span className="inline-block w-7 rounded text-[11px] font-bold bg-red-50 text-red-400">A</span>
    </td>
  )
  // Single punch = amber
  const isSingle = Number(rec.punch_count) === 1
  let m = STATUS_META[rec.status] || { code: rec.status, bg: 'bg-gray-100', text: 'text-gray-600' }
  if (isSingle && rec.status !== 'absent') m = { code: 'P', bg: 'bg-amber-100', text: 'text-amber-700' }
  return (
    <td className="px-0 py-1 text-center relative">
      <span className={`inline-block w-7 rounded text-[11px] font-bold ${m.bg} ${m.text}`}>{m.code}</span>
      {rec.is_late_lunch && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-500" title="Lunch late" />}
    </td>
  )
}

function AttendanceSheetSection({ departments }: { departments: Department[] }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear]   = useState(today.getFullYear())
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null)

  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ month: String(month), year: String(year), ...(deptFilter ? { department_id: deptFilter } : {}), ...(search ? { search } : {}) })
    fetch(`/api/hr/attendance/sheet?${q}`).then(r => r.json()).then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [month, year, deptFilter, search])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const handleExport = async () => {
    if (!data) return
    const XLSX = await import('xlsx')
    const header = ['S.No', 'Emp ID', 'Name', 'Department',
      ...(data.days || []).map((d: any) => `${d.day}\n${d.dow}`),
      'P', 'A', 'HD', 'CL', 'Sun', 'Late', 'L.Ln', 'Total']
    const rows = (data.employees || []).map((emp: any, i: number) => [
      i + 1, emp.employee_code, emp.name, emp.department_name,
      ...(data.days || []).map((d: any) => {
        if (d.is_sunday) return 'Sun'
        const r = emp.attendance[d.day]
        if (!r) return 'A'
        const code = STATUS_META[r.status]?.code || r.status
        return r.punch_count === 1 ? 'P*' : code
      }),
      emp.summary.present, emp.summary.absent, emp.summary.half_day,
      emp.summary.on_leave, emp.summary.sundays,
      emp.summary.late_morning ?? 0, emp.summary.late_lunch ?? 0, data.total_days,
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Attendance ${MONTHS_FULL[month-1]} ${year}`)
    XLSX.writeFile(wb, `Attendance_${MONTHS_FULL[month-1]}_${year}.xlsx`)
  }

  const handlePrint = () => window.print()

  const employees: any[] = data?.employees || []
  const days: any[] = data?.days || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Attendance Sheet</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            Export Excel
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Month nav */}
        <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
          <button onClick={prevMonth} className="px-2 py-2 hover:bg-gray-100 text-gray-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <span className="px-3 py-2 font-semibold text-sm min-w-[140px] text-center">{MONTHS_FULL[month-1]} {year}</span>
          <button onClick={nextMonth} className="px-2 py-2 hover:bg-gray-100 text-gray-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
        </div>

        {/* Department */}
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[160px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name or Emp ID…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
        </div>

        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>

        <span className="text-sm text-gray-500 ml-auto">{employees.length} employees</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2">
        {[
          ['P','Present (2 punches)','text-green-700'],
          ['P','Single punch','text-amber-700'],
          ['L','Late arrival','text-orange-700'],
          ['A','Absent','text-red-500'],
          ['HD','Half Day','text-yellow-700'],
          ['CL','Leave','text-blue-700'],
          ['Sun','Sunday','text-orange-400'],
        ].map(([c,l,t],i) => (
          <span key={i}><span className={`font-bold ${t}`}>{c}</span> = {l}</span>
        ))}
        <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />= Lunch late (&gt;30 min)</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading attendance sheet…</div>
      ) : (
        <div className="border border-orange-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${120 + days.length * 32 + 200}px` }}>
              {/* Company header */}
              <thead>
                <tr>
                  <th colSpan={4} className="border border-gray-200 bg-orange-600 text-white px-3 py-2 text-left text-sm font-bold">
                    ATTENDANCE — {MONTHS_FULL[month-1].toUpperCase()} {year}
                  </th>
                  <th colSpan={days.length} className="border border-gray-200 bg-orange-600 text-white px-3 py-2 text-center text-sm font-bold">
                    {MONTHS_FULL[month-1].toUpperCase()} {year}
                  </th>
                  <th colSpan={8} className="border border-gray-200 bg-orange-600 text-white px-3 py-2 text-center text-sm font-bold">SUMMARY</th>
                </tr>
                {/* Column headers row 1 — day numbers */}
                <tr className="bg-orange-50">
                  <th className="border border-gray-200 px-2 py-1.5 text-gray-600 w-10">S.No</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-gray-600 w-16">Emp ID</th>
                  <th className="border border-gray-200 px-3 py-1.5 text-gray-600 text-left w-36">Name</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-gray-600 text-left w-24">Department</th>
                  {days.map(d => (
                    <th key={d.day} className={`border border-gray-200 py-1.5 text-center w-8 font-bold ${d.is_sunday ? 'bg-orange-100 text-orange-500' : 'text-gray-700'}`}>
                      {d.day}
                    </th>
                  ))}
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-green-700 font-bold w-8">P</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-red-600 font-bold w-8">A</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-yellow-700 font-bold w-9">HD</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-blue-700 font-bold w-8">CL</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-orange-500 font-bold w-9">Sun</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-orange-700 font-bold w-9" title="Morning Late Count">Late</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-purple-600 font-bold w-9" title="Lunch Late Count">L.Ln</th>
                  <th className="border border-gray-200 px-1 py-1.5 text-center text-gray-700 font-bold w-10">Total</th>
                </tr>
                {/* Column headers row 2 — day of week */}
                <tr className="bg-gray-50">
                  <th colSpan={4} className="border border-gray-200 px-2 py-1 text-gray-400 text-left">Day →</th>
                  {days.map(d => (
                    <th key={d.day} className={`border border-gray-200 py-1 text-center text-[10px] font-medium ${d.is_sunday ? 'bg-orange-50 text-orange-400' : 'text-gray-400'}`}>
                      {d.dow}
                    </th>
                  ))}
                  <th colSpan={8} className="border border-gray-200" />
                </tr>
              </thead>

              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={4 + days.length + 8} className="py-16 text-center text-gray-400">No employees found</td></tr>
                ) : employees.map((emp, idx) => (
                  <React.Fragment key={emp.id}>
                    <tr
                      className={`cursor-pointer hover:bg-orange-50/50 ${expandedEmp === emp.id ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      onClick={() => setExpandedEmp(expandedEmp === emp.id ? null : emp.id)}
                    >
                      <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                      <td className="border border-gray-100 px-2 py-1.5 text-center font-mono text-gray-600">{emp.employee_code}</td>
                      <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-900">{emp.name}</td>
                      <td className="border border-gray-100 px-2 py-1.5 text-gray-500 text-[11px]">{emp.department_name}</td>
                      {days.map(d => (
                        <DayCell key={d.day} rec={emp.attendance[d.day]} isSunday={d.is_sunday} />
                      ))}
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-green-700">{emp.summary.present}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-red-600">{emp.summary.absent}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-yellow-700">{emp.summary.half_day}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-blue-700">{emp.summary.on_leave}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-orange-500">{emp.summary.sundays}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-orange-700">{emp.summary.late_morning ?? 0}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-purple-600">{emp.summary.late_lunch ?? 0}</td>
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-gray-700">{data.total_days}</td>
                    </tr>

                    {/* Expanded detail table — morning late / lunch late */}
                    {expandedEmp === emp.id && (
                      <tr key={`${emp.id}-expanded`}>
                        <td colSpan={4 + days.length + 8} className="border border-orange-200 bg-orange-50/50 p-0">
                          <div className="px-4 pt-3 pb-4">
                            <p className="text-xs font-semibold text-orange-700 mb-2">
                              {emp.name} — {MONTHS_FULL[month-1]} {year} · punch detail
                              <span className="ml-4 text-[10px] font-normal text-gray-400">
                                Late arrivals: <strong className="text-orange-600">{emp.summary.late_morning ?? 0}</strong>
                                &nbsp;·&nbsp;Lunch late: <strong className="text-purple-600">{emp.summary.late_lunch ?? 0}</strong>
                              </span>
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-white border-b border-gray-200">
                                    <th className="px-2 py-1.5 text-left font-semibold text-gray-500 w-10">Day</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-gray-500 w-10">DOW</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500 w-16">Punches</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-green-600 w-16">Entry</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-yellow-600 w-16">Lunch Out</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-yellow-600 w-16">Lunch In</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-red-500 w-16">Exit</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-orange-600 w-24">Morning Late</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-purple-600 w-24">Lunch Late</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500 w-16">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {days.map(d => {
                                    if (d.is_sunday) return (
                                      <tr key={d.day} className="bg-orange-50">
                                        <td className="px-2 py-1 font-bold text-orange-400">{d.day}</td>
                                        <td className="px-2 py-1 text-orange-300">{d.dow}</td>
                                        <td colSpan={8} className="px-2 py-1 text-orange-300">Sunday</td>
                                      </tr>
                                    )
                                    if (d.is_future) return (
                                      <tr key={d.day} className="bg-gray-50/30">
                                        <td className="px-2 py-1 font-semibold text-gray-300">{d.day}</td>
                                        <td className="px-2 py-1 text-gray-300">{d.dow}</td>
                                        <td colSpan={8} className="px-2 py-1 text-gray-200 text-[10px]">— upcoming —</td>
                                      </tr>
                                    )
                                    const rec = emp.attendance[d.day] === 'future' ? null : emp.attendance[d.day]
                                    const isLateM = rec?.status === 'late'
                                    const isLateL = rec?.is_late_lunch
                                    const rowCls = isLateM && isLateL
                                      ? 'bg-purple-50'
                                      : isLateM ? 'bg-orange-50'
                                      : isLateL ? 'bg-purple-50/50'
                                      : !rec ? 'bg-red-50/30'
                                      : 'bg-white'
                                    return (
                                      <tr key={d.day} className={`border-b border-gray-100 ${rowCls}`}>
                                        <td className="px-2 py-1 font-semibold text-gray-700">{d.day}</td>
                                        <td className="px-2 py-1 text-gray-400">{d.dow}</td>
                                        <td className="px-2 py-1 text-center">
                                          {rec ? (
                                            <span className={`font-bold ${
                                              rec.punch_count === 1 ? 'text-amber-600' :
                                              rec.punch_count >= 4 ? 'text-blue-600' : 'text-gray-700'
                                            }`}>{rec.punch_count}</span>
                                          ) : <span className="text-gray-300">0</span>}
                                        </td>
                                        <td className="px-2 py-1 text-center font-mono text-green-700">{rec?.check_in ? rec.check_in.slice(0,5) : '—'}</td>
                                        <td className="px-2 py-1 text-center font-mono text-yellow-700">{rec?.lunch_out ? rec.lunch_out.slice(0,5) : '—'}</td>
                                        <td className="px-2 py-1 text-center font-mono text-yellow-700">{rec?.lunch_in  ? rec.lunch_in.slice(0,5)  : '—'}</td>
                                        <td className="px-2 py-1 text-center font-mono text-red-500">{rec?.check_out ? rec.check_out.slice(0,5) : '—'}</td>
                                        <td className="px-2 py-1 text-center">
                                          {isLateM ? (
                                            <span className="text-orange-600 font-semibold">+{rec.late_morning_mins} min</span>
                                          ) : rec?.check_in ? (
                                            <span className="text-green-600">On time</span>
                                          ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                          {isLateL ? (
                                            <span className="text-purple-600 font-semibold">+{rec.late_lunch_mins} min</span>
                                          ) : rec?.lunch_out && rec?.lunch_in ? (
                                            <span className="text-green-600">OK</span>
                                          ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                          {rec ? (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              STATUS_META[rec.status]?.bg || 'bg-gray-100'
                                            } ${STATUS_META[rec.status]?.text || 'text-gray-500'}`}>
                                              {STATUS_META[rec.status]?.code || rec.status}
                                            </span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-400">A</span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shifts ────────────────────────────────────────────────────────────────────

interface Shift {
  id: number; name: string; start_time: string; end_time: string
  break_minutes: number; grace_minutes: number; is_active: boolean
  net_hours: number; employee_count: number
}

function fmt12(t: string | null) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function netHrs(start: string, end: string, brk: number) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm) - brk
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function ShiftsSection() {
  const [tab, setTab]         = useState<'settings' | 'allocation'>('settings')
  const [shifts, setShifts]   = useState<Shift[]>([])
  const [allocRows, setAllocRows] = useState<any[]>([])
  const [departments, setDepts] = useState<Department[]>([])
  const [search, setSearch]   = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [msg, setMsg]         = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [saving, setSaving]   = useState(false)

  // Shift settings form
  const blankForm = { name: '', start_time: '09:00', end_time: '17:30', break_minutes: 30, grace_minutes: 10 }
  const [form, setForm]       = useState(blankForm)
  const [editId, setEditId]   = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Allocation state
  const [bulkShiftId, setBulkShiftId]   = useState('')
  const [bulkEffFrom, setBulkEffFrom]   = useState(new Date().toISOString().slice(0, 10))
  const [selected, setSelected]         = useState<number[]>([])
  const [allocating, setAllocating]     = useState(false)

  const loadShifts = useCallback(() => {
    fetch('/api/hr/shifts').then(r => r.json()).then(d => setShifts(d.data || []))
  }, [])

  const loadAlloc = useCallback(() => {
    const qs = new URLSearchParams()
    if (deptFilter) qs.set('department_id', deptFilter)
    if (search)     qs.set('search', search)
    fetch(`/api/hr/shift-allocations?${qs}`).then(r => r.json()).then(d => setAllocRows(d.data || []))
  }, [deptFilter, search])

  useEffect(() => {
    fetch('/api/hr/departments').then(r => r.json()).then(d => setDepts(d.data || []))
    loadShifts()
  }, [loadShifts])

  useEffect(() => { if (tab === 'allocation') loadAlloc() }, [tab, loadAlloc])

  const saveShift = async () => {
    setSaving(true); setMsg(null)
    try {
      const url = editId ? `/api/hr/shifts/${editId}` : '/api/hr/shifts'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMsg({ text: editId ? 'Shift updated.' : 'Shift created.', type: 'success' })
      setShowForm(false); setEditId(null); setForm(blankForm); loadShifts()
    } catch (e: any) { setMsg({ text: e.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const deactivateShift = async (id: number) => {
    await fetch(`/api/hr/shifts/${id}`, { method: 'DELETE' }); loadShifts()
  }

  const applyAllocation = async () => {
    if (!bulkShiftId) return setMsg({ text: 'Select a shift to assign.', type: 'error' })
    const ids = selected.length ? selected : allocRows.map(r => r.employee_id)
    setAllocating(true); setMsg(null)
    try {
      const res = await fetch('/api/hr/shift-allocations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: Number(bulkShiftId), employee_ids: ids, effective_from: bulkEffFrom })
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMsg({ text: `Assigned ${d.assigned} employees to shift.`, type: 'success' })
      setSelected([]); loadAlloc()
    } catch (e: any) { setMsg({ text: e.message, type: 'error' }) }
    finally { setAllocating(false) }
  }

  const toggleSelect = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shift Management</h2>
          <p className="text-xs text-gray-400 mt-0.5">Configure work shifts and assign employees</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'settings' ? 'bg-orange-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Shift Settings
          </button>
          <button onClick={() => setTab('allocation')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'allocation' ? 'bg-orange-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Shift Allocation
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ── SHIFT SETTINGS ── */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowForm(true); setEditId(null); setForm(blankForm) }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">
              + Add Shift
            </button>
          </div>

          {/* Add/Edit form */}
          {showForm && (
            <div className="border border-orange-200 rounded-xl bg-orange-50/30 p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">{editId ? 'Edit Shift' : 'New Shift'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Shift Name</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. General Shift, Night Shift" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Start Time</label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">End Time</label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Lunch Break (minutes)</label>
                  <Input type="number" min={0} max={120} value={form.break_minutes} onChange={e => setForm(f => ({ ...f, break_minutes: Number(e.target.value) }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Grace Period (minutes)</label>
                  <Input type="number" min={0} max={60} value={form.grace_minutes} onChange={e => setForm(f => ({ ...f, grace_minutes: Number(e.target.value) }))} className="mt-1" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Check-in within this many minutes of start time = On Time</p>
                </div>
              </div>
              {/* Preview */}
              {form.start_time && form.end_time && (
                <div className="bg-white border border-orange-100 rounded-lg px-4 py-3 text-sm text-gray-600 flex gap-6">
                  <span><strong>Work hours:</strong> {netHrs(form.start_time, form.end_time, form.break_minutes)}</span>
                  <span><strong>On Time till:</strong> {fmt12(`${form.start_time}:00`).replace(':00 ', ' ').replace('00 ', ' ')} + {form.grace_minutes} min</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveShift} disabled={saving || !form.name || !form.start_time || !form.end_time} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving ? 'Saving…' : editId ? 'Update Shift' : 'Create Shift'}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(blankForm) }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Shifts table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">SHIFT NAME</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">START</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">END</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">LUNCH BREAK</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">NET HOURS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">GRACE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMPLOYEES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">STATUS</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No shifts defined yet</td></tr>
                ) : shifts.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-sm text-green-700">{fmt12(s.start_time)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-red-600">{fmt12(s.end_time)}</td>
                    <td className="px-4 py-3 text-gray-600">{s.break_minutes} min</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{netHrs(s.start_time, s.end_time, s.break_minutes)}</td>
                    <td className="px-4 py-3 text-gray-500">{s.grace_minutes} min</td>
                    <td className="px-4 py-3 text-gray-700">{s.employee_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditId(s.id); setForm({ name: s.name, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5), break_minutes: s.break_minutes, grace_minutes: s.grace_minutes }); setShowForm(true) }}
                          className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">Edit</button>
                        {s.is_active && (
                          <button onClick={() => deactivateShift(s.id)}
                            className="px-2 py-1 text-xs border border-red-200 rounded hover:bg-red-50 text-red-600">Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SHIFT ALLOCATION ── */}
      {tab === 'allocation' && (
        <div className="space-y-4">
          {/* Bulk assign bar */}
          <div className="flex flex-wrap items-end gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <div>
              <label className="text-[10px] font-semibold text-orange-600 uppercase">Assign Shift</label>
              <select value={bulkShiftId} onChange={e => setBulkShiftId(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 text-sm bg-white min-w-[180px]">
                <option value="">— Select shift —</option>
                {shifts.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({fmt12(s.start_time)} – {fmt12(s.end_time)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-orange-600 uppercase">Effective From</label>
              <Input type="date" value={bulkEffFrom} onChange={e => setBulkEffFrom(e.target.value)} className="mt-1 bg-white w-40" />
            </div>
            <Button onClick={applyAllocation} disabled={allocating || !bulkShiftId} className="bg-orange-600 hover:bg-orange-700 text-white">
              {allocating ? 'Assigning…' : selected.length ? `Assign (${selected.length} selected)` : 'Assign to All'}
            </Button>
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear selection</button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Employee-shift table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={selected.length === allocRows.length && allocRows.length > 0}
                      onChange={e => setSelected(e.target.checked ? allocRows.map(r => r.employee_id) : [])}
                      className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMP ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMPLOYEE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DEPARTMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">CURRENT SHIFT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TIMING</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">SINCE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {allocRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400">No employees found</td></tr>
                ) : allocRows.map((row, i) => (
                  <tr key={row.employee_id} className={`border-b border-gray-100 ${selected.includes(row.employee_id) ? 'bg-orange-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={selected.includes(row.employee_id)} onChange={() => toggleSelect(row.employee_id)} className="rounded" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 font-semibold">{row.employee_code}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{row.department_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      {row.shift_name
                        ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{row.shift_name}</span>
                        : <span className="text-gray-300 text-xs">Not assigned</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      {row.start_time ? `${fmt12(row.start_time)} – ${fmt12(row.end_time)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {row.effective_from ? new Date(row.effective_from).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        defaultValue={row.shift_id || ''}
                        onChange={async e => {
                          if (!e.target.value) return
                          await fetch('/api/hr/shift-allocations', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ employee_id: row.employee_id, shift_id: Number(e.target.value), effective_from: bulkEffFrom })
                          })
                          loadAlloc()
                        }}
                        className="border rounded-lg px-2 py-1 text-xs bg-white"
                      >
                        <option value="">— Change —</option>
                        {shifts.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            {allocRows.filter(r => !r.shift_id).length > 0
              ? `${allocRows.filter(r => !r.shift_id).length} employees have no shift assigned yet.`
              : 'All employees have a shift assigned.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main HR Module ───────────────────────────────────────────────────────────

export default function HRModule({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const loadDepartments = useCallback(() => {
    fetch('/api/hr/departments').then(r => r.json()).then(d => setDepartments(d.data || []))
  }, [])

  const loadAllEmployees = useCallback(() => {
    fetch('/api/hr/employees?status=active').then(r => r.json()).then(d => setEmployees(d.data || []))
  }, [])

  useEffect(() => { loadDepartments(); loadAllEmployees() }, [loadDepartments, loadAllEmployees])

  return (
    <div>
        {activeTab === 'dashboard' && <HRDashboard />}
        {activeTab === 'employees' && <EmployeesSection departments={departments} />}
        {activeTab === 'attendance' && <AttendanceSection />}
        {activeTab === 'attendance-sheet' && <AttendanceSheetSection departments={departments} />}
        {activeTab === 'shifts' && <ShiftsSection />}
        {activeTab === 'leave' && <LeaveSection employees={employees} />}
        {activeTab === 'payroll' && <PayrollSection />}
        {activeTab === 'departments' && <DepartmentsSection departments={departments} reload={loadDepartments} />}
    </div>
  )
}
