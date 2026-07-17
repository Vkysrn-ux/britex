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
  job_title?: string; employment_type: string; basic_salary: number; status: string
  address?: string; emergency_contact?: string; emergency_phone?: string
  bank_account?: string; bank_name?: string
  father_name?: string; blood_group?: string; contribution_type?: string
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

const AVATAR_PALETTE = [
  'bg-orange-500','bg-blue-500','bg-green-500','bg-purple-500',
  'bg-pink-500','bg-teal-500','bg-indigo-500','bg-red-500',
  'bg-yellow-500','bg-cyan-600','bg-rose-500','bg-emerald-500',
]

function avatarColor(name: string) {
  let hash = 0; for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function avatarInitials(first: string, last: string) {
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?'
}

function EmployeeCard({ emp, onView, onEdit }: { emp: Employee; onView: () => void; onEdit: () => void }) {
  const initials = avatarInitials(emp.first_name, emp.last_name)
  const color    = avatarColor(emp.first_name + emp.last_name)
  const isActive = emp.status === 'active'
  return (
    <div onClick={onView} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer relative flex flex-col gap-3">
      {/* ID badge top-right */}
      <span className="absolute top-4 right-4 text-xs font-mono text-gray-400">{emp.employee_code}</span>

      {/* Avatar + status dot */}
      <div className="relative w-fit">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg ${color}`}>
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
      </div>

      {/* Name + designation */}
      <div>
        <p className="font-bold text-gray-900 text-sm leading-tight">{emp.first_name} {emp.last_name}</p>
        <p className="text-xs text-orange-600 font-medium mt-0.5">{emp.job_title || '—'}</p>
      </div>

      {/* Meta rows */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{emp.department_name || 'No Department'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          <span className="font-mono">{emp.employment_type?.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-auto">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {emp.status.toUpperCase()}
        </span>
        <button onClick={e => { e.stopPropagation(); onEdit() }} className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded hover:bg-gray-50">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function EmployeeProfilePage({
  emp: initialEmp, onBack, departments, onReload,
}: {
  emp: Employee; onBack: () => void; departments: Department[]; onReload: () => void
}) {
  const [emp, setEmp]           = useState<Employee>(initialEmp)
  const [tab, setTab]           = useState<'personal' | 'bank' | 'education' | 'documents' | 'payroll'>('personal')
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState<Record<string, any>>({})
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const initials = avatarInitials(emp.first_name, emp.last_name)
  const color    = avatarColor(emp.first_name + emp.last_name)
  const isActive = emp.status === 'active'

  const startEdit = () => {
    setForm({
      first_name: emp.first_name, last_name: emp.last_name || '',
      email: emp.email || '', phone: emp.phone || '',
      gender: emp.gender || '', date_of_birth: emp.date_of_birth?.slice(0,10) || '',
      date_of_joining: emp.date_of_joining?.slice(0,10) || '',
      department_id: emp.department_id || '', job_title: emp.job_title || '',
      employment_type: emp.employment_type, basic_salary: emp.basic_salary,
      address: emp.address || '', emergency_contact: emp.emergency_contact || '',
      emergency_phone: emp.emergency_phone || '', father_name: emp.father_name || '',
      blood_group: emp.blood_group || '', contribution_type: emp.contribution_type || '',
      bank_account: emp.bank_account || '', bank_name: emp.bank_name || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true); setMsg(null)
    try {
      const res  = await fetch(`/api/hr/employees/${emp.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmp(data.data); setEditing(false)
      setMsg({ text: 'Employee updated successfully.', type: 'success' })
      onReload()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`${newStatus === 'inactive' ? 'Deactivate' : 'Activate'} ${emp.first_name}?`)) return
    const res  = await fetch(`/api/hr/employees/${emp.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus })
    })
    const data = await res.json()
    if (res.ok) { setEmp(data.data); onReload() }
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently terminate ${emp.first_name} ${emp.last_name}?`)) return
    await fetch(`/api/hr/employees/${emp.id}`, { method: 'DELETE' })
    onReload(); onBack()
  }

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )

  const EditField = ({ label, name, type = 'text', children }: { label: string; name: string; type?: string; children?: React.ReactNode }) => (
    <div>
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">{label}</label>
      {children ?? (
        <Input type={type} value={form[name] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))} className="text-sm" />
      )}
    </div>
  )

  const TABS = [
    { id: 'personal',   label: 'Personal',        icon: '👤' },
    { id: 'education',  label: 'Education',        icon: '🎓' },
    { id: 'bank',       label: 'Bank & Statutory', icon: '🏦' },
    { id: 'documents',  label: 'Documents',        icon: '📄' },
    { id: 'payroll',    label: 'Payroll',          icon: '💰' },
  ] as const

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-gray-400 hover:text-orange-600 transition-colors">Directory</button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{emp.first_name} {emp.last_name}</span>
      </div>

      {/* Profile header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${color}`}>
              {initials}
            </div>
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{emp.first_name} {emp.last_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
              <span className="font-mono text-gray-400">{emp.employee_code}</span>
              <span className="text-orange-600 font-semibold">{emp.job_title || '—'}</span>
              <span className="flex items-center gap-1 text-gray-500">
                <Building2 className="w-3.5 h-3.5" />{emp.department_name || '—'}
              </span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {emp.status}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded uppercase bg-purple-100 text-purple-700">
                {emp.employment_type?.replace(/_/g,' ')}
              </span>
              {emp.contribution_type && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded uppercase bg-blue-100 text-blue-700">
                  {emp.contribution_type}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            {isActive ? (
              <button onClick={() => handleStatusChange('inactive')} className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg text-sm hover:bg-orange-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                Deactivate
              </button>
            ) : (
              <button onClick={() => handleStatusChange('active')} className="flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-600 rounded-lg text-sm hover:bg-green-50">
                Activate
              </button>
            )}
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
          </div>
        </div>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── PERSONAL TAB ── */}
      {tab === 'personal' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Personal & Employment Details</h2>
            {editing ? (
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button onClick={() => setEditing(false)} size="sm" variant="outline">Cancel</Button>
              </div>
            ) : (
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg text-sm hover:bg-orange-50">
                <Edit2 className="w-3.5 h-3.5" />Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-5">
              {/* Personal fields in edit mode */}
              <div className="grid grid-cols-3 gap-4">
                <EditField label="First Name" name="first_name" />
                <EditField label="Last Name" name="last_name" />
                <EditField label="Phone" name="phone" />
                <EditField label="Email" name="email" type="email" />
                <EditField label="Date of Birth" name="date_of_birth" type="date" />
                <EditField label="Gender" name="gender">
                  <select value={form.gender || ''} onChange={e => setForm((f: any) => ({ ...f, gender: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </EditField>
                <EditField label="Father's Name" name="father_name" />
                <EditField label="Blood Group" name="blood_group">
                  <select value={form.blood_group || ''} onChange={e => setForm((f: any) => ({ ...f, blood_group: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </EditField>
                <EditField label="Emergency Contact" name="emergency_contact" />
              </div>
              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employment Information</p>
              <div className="grid grid-cols-3 gap-4">
                <EditField label="Department" name="department_id">
                  <select value={form.department_id || ''} onChange={e => setForm((f: any) => ({ ...f, department_id: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </EditField>
                <EditField label="Designation" name="job_title" />
                <EditField label="Date of Joining" name="date_of_joining" type="date" />
                <EditField label="Employment Type" name="employment_type">
                  <select value={form.employment_type || 'full_time'} onChange={e => setForm((f: any) => ({ ...f, employment_type: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                    <option value="contract">Contract</option><option value="intern">Intern</option>
                  </select>
                </EditField>
                <EditField label="Contribution Type" name="contribution_type">
                  <select value={form.contribution_type || ''} onChange={e => setForm((f: any) => ({ ...f, contribution_type: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">None</option>
                    <option value="ESI+PF">ESI + PF</option>
                    <option value="PF Only">PF Only</option>
                    <option value="ESI Only">ESI Only</option>
                    <option value="BOTH">Both</option>
                  </select>
                </EditField>
                <EditField label="Basic Salary (₹)" name="basic_salary" type="number" />
                <div className="col-span-3">
                  <EditField label="Address" name="address">
                    <textarea value={form.address || ''} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} rows={2} className="w-full border rounded-md px-3 py-2 text-sm" />
                  </EditField>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Read-only view */}
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <Field label="Full Name"         value={`${emp.first_name} ${emp.last_name}`.trim()} />
                <Field label="Employee Code"     value={emp.employee_code} />
                <Field label="Phone"             value={emp.phone} />
                <Field label="Email"             value={emp.email} />
                <Field label="Date of Birth"     value={emp.date_of_birth ? fmtDate(emp.date_of_birth) : undefined} />
                <Field label="Gender"            value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                <Field label="Father's Name"     value={emp.father_name} />
                <Field label="Blood Group"       value={emp.blood_group} />
                <Field label="Emergency Contact" value={emp.emergency_contact} />
              </div>

              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employment Information</p>

              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <Field label="Department"       value={emp.department_name} />
                <Field label="Designation"      value={emp.job_title} />
                <Field label="Date of Joining"  value={emp.date_of_joining ? fmtDate(emp.date_of_joining) : undefined} />
                <Field label="Employee Type"    value={emp.employment_type?.replace(/_/g,' ')} />
                <Field label="Contribution Type" value={emp.contribution_type} />
                <Field label="Status"           value={emp.status?.charAt(0).toUpperCase() + emp.status?.slice(1)} />
              </div>
              {emp.address && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-sm text-gray-900">{emp.address}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BANK & STATUTORY TAB ── */}
      {tab === 'bank' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Bank & Statutory Details</h2>
            {!editing && <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg text-sm hover:bg-orange-50"><Edit2 className="w-3.5 h-3.5" />Edit</button>}
            {editing && (
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">{saving ? 'Saving…' : 'Save'}</Button>
                <Button onClick={() => setEditing(false)} size="sm" variant="outline">Cancel</Button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-3 gap-4">
              <EditField label="Bank Account No." name="bank_account" />
              <EditField label="Bank Name" name="bank_name" />
              <EditField label="Contribution Type" name="contribution_type">
                <select value={form.contribution_type || ''} onChange={e => setForm((f: any) => ({ ...f, contribution_type: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">None</option>
                  <option value="ESI+PF">ESI + PF</option>
                  <option value="PF Only">PF Only</option>
                  <option value="ESI Only">ESI Only</option>
                  <option value="BOTH">Both</option>
                </select>
              </EditField>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-8 gap-y-5">
              <Field label="Bank Account No." value={emp.bank_account} />
              <Field label="Bank Name"         value={emp.bank_name} />
              <Field label="Contribution Type" value={emp.contribution_type} />
            </div>
          )}
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {tab === 'payroll' && <EmployeePayrollTab emp={emp} onEmpUpdate={setEmp} />}

      {/* ── OTHER TABS — PLACEHOLDERS ── */}
      {(tab === 'education' || tab === 'documents') && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">{tab === 'education' ? '🎓' : '📄'}</p>
          <p className="font-semibold text-gray-600">{tab.charAt(0).toUpperCase() + tab.slice(1)} section coming soon</p>
          <p className="text-sm mt-1">This section will be available in a future update.</p>
        </div>
      )}
    </div>
  )
}

function EmployeePayrollTab({ emp, onEmpUpdate }: { emp: any; onEmpUpdate: (e: any) => void }) {
  const today = new Date()
  const [dayRate, setDayRate] = useState(String(emp.day_rate ?? 0))
  const [esiAmount, setEsiAmount] = useState(String(emp.esi_amount ?? 0))
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [advance, setAdvance] = useState('0')
  const [permHours, setPermHours] = useState('0')
  const [esiOverride, setEsiOverride] = useState('0')
  const [history, setHistory] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Load fresh salary settings (directory list rows don't carry day_rate/esi_amount)
  useEffect(() => {
    fetch(`/api/hr/employees/${emp.id}`).then(r => r.json()).then(d => {
      if (d.data) {
        setDayRate(String(Number(d.data.day_rate) || 0))
        setEsiAmount(String(Number(d.data.esi_amount) || 0))
      }
    })
  }, [emp.id])

  // Load this month's inputs + payroll history
  useEffect(() => {
    fetch(`/api/hr/payroll/inputs?month=${month}&year=${year}`).then(r => r.json()).then(d => {
      const row = (d.data || []).find((r: any) => Number(r.employee_id) === Number(emp.id))
      setAdvance(String(Number(row?.advance) || 0))
      setPermHours(String(Number(row?.permission_hours) || 0))
      setEsiOverride(String(Number(row?.esi) || 0))
    })
  }, [month, year, emp.id])
  useEffect(() => {
    fetch(`/api/hr/payroll/history?employee_id=${emp.id}`).then(r => r.json()).then(d => setHistory(d.data || []))
  }, [emp.id])

  const saveSettings = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_rate: Number(dayRate) || 0, esi_amount: Number(esiAmount) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onEmpUpdate(data.data)
      setMsg({ text: 'Salary settings saved. They apply automatically from the next salary calculation.', type: 'success' })
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const saveMonthInputs = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/hr/payroll/inputs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, entries: [{
          employee_id: emp.id, advance: Number(advance) || 0,
          permission_hours: Number(permHours) || 0, esi: Number(esiOverride) || 0,
        }] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: `Saved for ${MONTHS[month-1]} ${year}. Regenerate that month's payroll to apply.`, type: 'success' })
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const hourRate = (Number(dayRate) || 0) / 8

  return (
    <div className="space-y-4">
      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      <div className="grid grid-cols-2 gap-4">
        {/* Standing salary settings */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Salary Settings</h3>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Per Day Salary (₹)</label>
            <Input type="number" min="0" value={dayRate} onChange={e => setDayRate(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">1 hour = ₹{hourRate.toFixed(2)} (day ÷ 8) — used for permission deduction</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">ESI per month (₹)</label>
            <Input type="number" min="0" value={esiAmount} onChange={e => setEsiAmount(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Deducted every month automatically. 0 = no ESI.</p>
          </div>
          <Button onClick={saveSettings} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>

        {/* This month's extras */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Monthly Extras</h3>
            <div className="flex gap-2">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-md px-2 py-1 text-sm">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-20 h-8 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Advance Given (₹)</label>
            <Input type="number" min="0" value={advance} onChange={e => setAdvance(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Permission (hours)</label>
            <Input type="number" min="0" step="0.5" value={permHours} onChange={e => setPermHours(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Deduction: {permHours || 0} × ₹{hourRate.toFixed(2)} = ₹{((Number(permHours) || 0) * hourRate).toFixed(2)}</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">ESI override for this month (₹, 0 = use default)</label>
            <Input type="number" min="0" value={esiOverride} onChange={e => setEsiOverride(e.target.value)} />
          </div>
          <Button onClick={saveMonthInputs} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? 'Saving…' : `Save for ${MONTHS[month-1]}`}
          </Button>
        </div>
      </div>

      {/* Salary history */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Salary History</h3></div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No salary generated yet for this employee</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-orange-50 border-b border-orange-100">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Month</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                  <th className="px-3 py-2 text-center font-semibold text-green-700">Present</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-700">Half</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-500">Sun</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Working ₹</th>
                  <th className="px-3 py-2 text-right font-semibold text-green-700">Incentive</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">ESI</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Advance</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Permission</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900">Net</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-900">{MONTHS[h.month-1]} {h.year}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(h.day_rate)}</td>
                    <td className="px-3 py-2 text-center text-green-700 font-semibold">{h.present_days}/{h.working_days}</td>
                    <td className="px-3 py-2 text-center">{Number(h.half_days) || '—'}</td>
                    <td className="px-3 py-2 text-center">{Number(h.sunday_days) || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(h.working_salary)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{Number(h.incentive) ? fmt(h.incentive) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{Number(h.esi) ? fmt(h.esi) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{Number(h.advance) ? fmt(h.advance) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{Number(h.permission_amount) ? fmt(h.permission_amount) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmt(h.net_salary)}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={h.payroll_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeesSection({ departments }: { departments: Department[] }) {
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [typeFilter, setTypeFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid')
  const [showForm, setShowForm]     = useState(false)
  const [editEmp, setEditEmp]       = useState<Employee | null>(null)
  const [profileEmp, setProfileEmp] = useState<Employee | null>(null)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting]   = useState(false)
  const [xlFile, setXlFile]         = useState<File | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [syncingBT, setSyncingBT]     = useState(false)
  const [syncResult, setSyncResult]   = useState<any>(null)
  const [resetting, setResetting]     = useState(false)
  const [resetResult, setResetResult] = useState<any>(null)
  const [importingDat, setImportingDat] = useState(false)
  const [datResult, setDatResult]       = useState<any>(null)

  const blankForm = {
    employee_code: '', first_name: '', last_name: '', email: '', phone: '',
    gender: '', date_of_birth: '', date_of_joining: new Date().toISOString().slice(0, 10),
    department_id: '', job_title: '', employment_type: 'full_time', basic_salary: '',
  }
  const [form, setForm] = useState<Record<string, any>>(blankForm)

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(search      ? { search }                       : {}),
      ...(deptFilter  ? { department_id: deptFilter }    : {}),
    })
    fetch(`/api/hr/employees?${q}`).then(r => r.json())
      .then(d => { setEmployees(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter, search, deptFilter])

  useEffect(() => { load() }, [load])

  const openEdit = (e: Employee) => {
    setEditEmp(e)
    setForm({
      employee_code: e.employee_code, first_name: e.first_name, last_name: e.last_name,
      email: e.email || '', phone: e.phone || '', gender: e.gender || '',
      date_of_birth: e.date_of_birth ? e.date_of_birth.slice(0, 10) : '',
      date_of_joining: e.date_of_joining ? e.date_of_joining.slice(0, 10) : '',
      department_id: e.department_id || '', job_title: e.job_title || '',
      employment_type: e.employment_type, basic_salary: e.basic_salary,
    })
    setShowForm(true)
  }

  const resetForm = () => { setEditEmp(null); setForm(blankForm); setShowForm(false) }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setMsg(null)
    try {
      const url    = editEmp ? `/api/hr/employees/${editEmp.id}` : '/api/hr/employees'
      const method = editEmp ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMsg({ text: editEmp ? 'Employee updated.' : 'Employee added.', type: 'success' })
      resetForm(); load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const handleExcelImport = async () => {
    if (!xlFile) return
    setImporting(true); setMsg(null); setImportResult(null)
    try {
      const fd = new FormData(); fd.append('file', xlFile)
      const res  = await fetch('/api/hr/employees/import-excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportResult(data)
      setMsg({ text: `Import complete: ${data.summary.created} created, ${data.summary.updated} updated.`, type: 'success' })
      setXlFile(null); load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setImporting(false) }
  }

  const handleResetImport = async () => {
    const ok = confirm(
      '⚠️ WARNING: This will DELETE all existing employees and ALL attendance except June 2026, then re-import all 57 employees from the master Excel.\n\nJune attendance will be re-linked by employee name.\n\nType OK to proceed.'
    )
    if (!ok) return
    setResetting(true); setResetResult(null); setMsg(null)
    try {
      const res  = await fetch('/api/hr/employees/reset-import', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResetResult(data)
      setMsg({ text: `Reset complete: ${data.summary.employees_created} employees imported, June attendance: ${data.summary.june_attendance_restored} restored.`, type: 'success' })
      load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setResetting(false) }
  }

  const handleSyncBT = async () => {
    if (!confirm('This will update all employee codes to BT-XX format using the master Excel. Continue?')) return
    setSyncingBT(true); setSyncResult(null); setMsg(null)
    try {
      const res  = await fetch('/api/hr/employees/sync-bt-codes', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncResult(data)
      setMsg({ text: `BT code sync done: ${data.summary.updated} updated, ${data.summary.skipped} skipped.`, type: 'success' })
      load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSyncingBT(false) }
  }

  const handleDatImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportingDat(true); setDatResult(null); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/hr/attendance/import-dat', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDatResult(data)
      setMsg({ text: `DAT import done: ${data.summary.saved} records saved, ${data.summary.skipped} skipped.`, type: 'success' })
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setImportingDat(false) }
  }

  // Filtered employees (client-side type filter)
  const visible = typeFilter
    ? employees.filter(e => e.employment_type === typeFilter)
    : employees

  const totalActive   = employees.filter(e => e.status === 'active').length
  const totalInactive = employees.filter(e => e.status !== 'active').length

  if (profileEmp) {
    return (
      <EmployeeProfilePage
        emp={profileEmp}
        onBack={() => setProfileEmp(null)}
        departments={departments}
        onReload={load}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Centralized management for all <strong>{employees.length}</strong> employees across <strong>{departments.length}</strong> departments.
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="xl-upload" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Upload Excel
          </label>
          <input id="xl-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { setXlFile(e.target.files?.[0] || null); setShowImport(true) }} />

          <button onClick={handleSyncBT} disabled={syncingBT}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg font-medium disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {syncingBT ? 'Syncing…' : 'Sync BT Codes'}
          </button>

          <button onClick={handleResetImport} disabled={resetting}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-sm rounded-lg font-medium disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            {resetting ? 'Resetting…' : 'Reset & Import All'}
          </button>

          <label htmlFor="dat-upload" className={`cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm rounded-lg font-medium ${importingDat ? 'opacity-50 pointer-events-none' : ''}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            {importingDat ? 'Importing…' : 'Import Device .dat'}
          </label>
          <input id="dat-upload" type="file" accept=".dat,.txt" className="hidden" onChange={handleDatImport} />

          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`px-3 py-2 flex items-center gap-1.5 text-sm ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Grid
            </button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-2 flex items-center gap-1.5 text-sm ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              List
            </button>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-gray-900 hover:bg-gray-800 text-white">
            <Plus className="w-4 h-4 mr-1" />Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL EMPLOYEES', value: employees.length,   cls: 'text-gray-900' },
          { label: 'ACTIVE',          value: totalActive,         cls: 'text-green-600' },
          { label: 'INACTIVE',        value: totalInactive,       cls: 'text-gray-400' },
          { label: 'DEPARTMENTS',     value: departments.length,  cls: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Excel import panel */}
      {showImport && (
        <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Import Employee List from Excel</p>
              <p className="text-xs text-gray-500 mt-0.5">Auto-detects columns: Name, Emp Code, Department, Designation, Phone, Email, Joining Date, Salary…</p>
            </div>
            <button onClick={() => { setShowImport(false); setXlFile(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="xl-upload2" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg text-sm text-orange-700 hover:bg-orange-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {xlFile ? xlFile.name : 'Choose file'}
            </label>
            <input id="xl-upload2" type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => setXlFile(e.target.files?.[0] || null)} />
            {xlFile && <span className="text-xs text-gray-400">{(xlFile.size/1024).toFixed(1)} KB</span>}
            <Button onClick={handleExcelImport} disabled={!xlFile || importing} className="bg-orange-600 hover:bg-orange-700 text-white">
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </div>

          {importResult && (
            <div className="space-y-3">
              {/* Detected columns */}
              {importResult.detected_columns && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <strong>Detected columns:</strong>{' '}
                  {Object.entries(importResult.detected_columns).map(([k, v]) => `${k} → "${v}"`).join(' · ')}
                </div>
              )}
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Created',     value: importResult.summary.created,  cls: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'Updated',     value: importResult.summary.updated,  cls: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { label: 'Skipped',     value: importResult.summary.skipped,  cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                  { label: 'Depts',       value: importResult.summary.departments_created, cls: 'bg-orange-50 border-orange-200 text-orange-700' },
                ].map(s => (
                  <div key={s.label} className={`border rounded-xl p-3 text-center ${s.cls}`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Detail table */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 sticky top-0">
                    <th className="px-3 py-2 text-left text-gray-500">Code</th>
                    <th className="px-3 py-2 text-left text-gray-500">Name</th>
                    <th className="px-3 py-2 text-left text-gray-500">Department</th>
                    <th className="px-3 py-2 text-left text-gray-500">Result</th>
                  </tr></thead>
                  <tbody>
                    {importResult.details.map((d: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-mono">{d.code}</td>
                        <td className="px-3 py-1.5">{d.name}</td>
                        <td className="px-3 py-1.5 text-gray-400">{d.dept}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${d.action === 'created' ? 'bg-green-100 text-green-700' : d.action === 'updated' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{d.action}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BT code sync result */}
      {syncResult && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-blue-800">
              BT Code Sync — {syncResult.summary.updated} updated · {syncResult.summary.skipped} skipped
            </p>
            <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {syncResult.updated?.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-blue-100 rounded-lg bg-white">
              <table className="w-full text-xs">
                <thead><tr className="bg-blue-50 sticky top-0">
                  <th className="px-3 py-2 text-left text-blue-600">Change</th>
                </tr></thead>
                <tbody>
                  {syncResult.updated.map((line: string, i: number) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 font-mono text-gray-700">{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {syncResult.skipped?.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 space-y-0.5">
              <p className="font-semibold mb-1">Unmatched (need manual fix):</p>
              {syncResult.skipped.map((line: string, i: number) => <p key={i}>{line}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Reset & Import result */}
      {resetResult && (
        <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-green-800">Reset & Import Complete</p>
              <p className="text-xs text-green-700 mt-0.5">
                {resetResult.summary.employees_created} employees imported ·{' '}
                {resetResult.summary.employees_skipped} skipped ·{' '}
                June attendance: {resetResult.summary.june_attendance_restored} restored
                {resetResult.summary.june_attendance_unmatched > 0 && `, ${resetResult.summary.june_attendance_unmatched} unmatched`}
              </p>
            </div>
            <button onClick={() => setResetResult(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {resetResult.details?.some((d: any) => d.action?.startsWith('error')) && (
            <div className="max-h-48 overflow-y-auto border border-red-100 rounded-lg bg-white">
              <table className="w-full text-xs">
                <thead><tr className="bg-red-50 sticky top-0">
                  <th className="px-3 py-2 text-left text-red-600">Code</th>
                  <th className="px-3 py-2 text-left text-red-600">Name</th>
                  <th className="px-3 py-2 text-left text-red-600">Error</th>
                </tr></thead>
                <tbody>
                  {resetResult.details.filter((d: any) => d.action?.startsWith('error')).map((d: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 font-mono">{d.code}</td>
                      <td className="px-3 py-1.5">{d.name}</td>
                      <td className="px-3 py-1.5 text-red-600">{d.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DAT import result */}
      {datResult && (
        <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-purple-800">Device .dat Import Complete</p>
              <p className="text-xs text-purple-700 mt-0.5">
                {datResult.summary.total_punch_lines} punch lines · {datResult.summary.employee_days_processed} employee-days processed · {datResult.summary.saved} saved · {datResult.summary.skipped} skipped
              </p>
            </div>
            <button onClick={() => setDatResult(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {datResult.errors?.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs text-red-600 bg-white border border-red-100 rounded p-2 space-y-0.5">
              {datResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{editEmp ? 'Edit Employee' : 'New Employee'}</CardTitle>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">✕</button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Employee Code*</label>
                  <Input value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="EMP001" required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">First Name*</label>
                  <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Last Name</label>
                  <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="mt-1" /></div>
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
                <div><label className="text-xs font-medium text-gray-600">Designation</label>
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name, code or designation…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white text-sm" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[130px]">
          <option value="">All Types</option>
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white w-28">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All Status</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">{visible.length} employee{visible.length !== 1 ? 's' : ''} shown</p>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading employees…</div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No employees found</div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(emp => (
            <EmployeeCard
              key={emp.id}
              emp={emp}
              onView={() => setProfileEmp(emp)}
              onEdit={() => openEdit(emp)}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMP ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">NAME</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DEPARTMENT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DESIGNATION</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TYPE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">STATUS</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {visible.map((emp, i) => (
                <tr key={emp.id} className={`border-b border-gray-100 hover:bg-orange-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 font-semibold">{emp.employee_code}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(emp.first_name + emp.last_name)}`}>
                        {avatarInitials(emp.first_name, emp.last_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-gray-400">{emp.email || emp.phone || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{emp.department_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{emp.job_title || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={emp.employment_type} /></td>
                  <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setProfileEmp(emp)} className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50">Profile</button>
                      <button onClick={() => openEdit(emp)} className="text-gray-400 hover:text-orange-600 p-1 rounded hover:bg-gray-50"><Edit2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  const [sortCol, setSortCol]   = useState<'employee_code' | 'name' | null>(null)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: 'employee_code' | 'name') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

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

  // Auto-refresh every 30 seconds when viewing today
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (date !== today) return
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [date, load])

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
  const rawEmployees: any[] = data?.employees || []
  const employees = sortCol
    ? [...rawEmployees].sort((a, b) => {
        const av = (a[sortCol] || '').toString().toLowerCase()
        const bv = (b[sortCol] || '').toString().toLowerCase()
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rawEmployees

  const reportMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Biometric Attendance</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            All times in IST
            {date === new Date().toISOString().slice(0,10) && <span className="ml-2 text-green-600">● Live – auto-refreshes every 30s</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {view === 'list' && (
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-gray-200 text-gray-600">
              <svg className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </Button>
          )}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-20">
                      <button type="button" onClick={() => handleSort('employee_code')} className="inline-flex items-center gap-1 hover:text-orange-600 transition-colors group">
                        EMP ID
                        <span className="flex flex-col leading-none">
                          <svg className={`w-2.5 h-2.5 ${sortCol === 'employee_code' && sortDir === 'asc' ? 'text-orange-600' : 'text-gray-300 group-hover:text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z"/></svg>
                          <svg className={`w-2.5 h-2.5 ${sortCol === 'employee_code' && sortDir === 'desc' ? 'text-orange-600' : 'text-gray-300 group-hover:text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z"/></svg>
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                      <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-orange-600 transition-colors group">
                        NAME
                        <span className="flex flex-col leading-none">
                          <svg className={`w-2.5 h-2.5 ${sortCol === 'name' && sortDir === 'asc' ? 'text-orange-600' : 'text-gray-300 group-hover:text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z"/></svg>
                          <svg className={`w-2.5 h-2.5 ${sortCol === 'name' && sortDir === 'desc' ? 'text-orange-600' : 'text-gray-300 group-hover:text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z"/></svg>
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DEPT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-600">IN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-red-500">OUT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">HRS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">PUNCHES</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="py-16 text-center text-gray-400">Loading…</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={10} className="py-16 text-center text-gray-400">No records for {date}</td></tr>
                  ) : employees.map((emp: any, i: number) => {
                    const wh = Number(emp.work_hours) || 0
                    const badge = emp.status ? STATUS_BADGE[emp.status] : STATUS_BADGE['absent']
                    return (
                      <tr key={emp.id} className={`border-b border-gray-100 hover:bg-orange-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 font-semibold">{emp.employee_code}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{emp.department_name || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-green-600 font-mono text-xs">{fmtTime(emp.check_in)}</td>
                        <td className="px-4 py-3 font-semibold text-red-500 font-mono text-xs">{fmtTime(emp.check_out)}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{wh > 0 ? fmtWH(wh) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono text-gray-500">{emp.punch_count ?? '—'}</td>
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

// Searchable employee picker — type name or BT number to filter
function EmployeeSearchSelect({
  employees, value, onChange, disabled, required,
}: {
  employees: Employee[]; value: string; onChange: (id: string) => void; disabled?: boolean; required?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = employees.find(e => String(e.id) === value)
  const label = selected ? `${selected.first_name} ${selected.last_name || ''} (${selected.employee_code})`.replace(/\s+/g, ' ') : ''

  const q = query.trim().toLowerCase()
  const filtered = employees
    .filter(e => e.status === 'active' || String(e.id) === value)
    .filter(e => !q ||
      `${e.first_name} ${e.last_name || ''}`.toLowerCase().includes(q) ||
      (e.employee_code || '').toLowerCase().includes(q) ||
      (e.employee_code || '').toLowerCase().replace('bt-', '').includes(q))
    .slice(0, 30)

  return (
    <div className="relative">
      <Input
        value={open ? query : label}
        placeholder="Type name or BT number…"
        disabled={disabled}
        required={required && !value}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="mt-1"
      />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-orange-200 rounded-md shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No employee found</div>
          ) : filtered.map(e => (
            <button
              key={e.id}
              type="button"
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => { onChange(String(e.id)); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${String(e.id) === value ? 'bg-orange-50 font-semibold' : ''}`}
            >
              {e.first_name} {e.last_name || ''} <span className="text-xs text-gray-400 font-mono">({e.employee_code})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaveSection({ employees }: { employees: Employee[] }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
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

  // Days excluding Sundays (factory works Saturdays) — matches server calculation
  const calcDays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0
    const s = new Date(start + 'T00:00:00Z'), e = new Date(end + 'T00:00:00Z')
    let n = 0
    for (const d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0) n++
    }
    return n
  }

  const startEdit = (r: any) => {
    setEditId(r.id)
    setForm({
      employee_id: String(r.employee_id), leave_type_id: String(r.leave_type_id),
      start_date: String(r.start_date).slice(0, 10), end_date: String(r.end_date).slice(0, 10),
      reason: r.reason || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (r: any) => {
    const note = r.status === 'approved' ? ' Its leave marks in attendance will also be removed.' : ''
    if (!confirm(`Delete this leave request of ${r.employee_name}?${note}`)) return
    try {
      const res = await fetch(`/api/hr/leave/requests/${r.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Leave request deleted.', type: 'success' })
      loadRequests()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setMsg(null)
    try {
      const days = calcDays(form.start_date, form.end_date)
      const res = editId
        ? await fetch(`/api/hr/leave/requests/${editId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leave_type_id: Number(form.leave_type_id), start_date: form.start_date, end_date: form.end_date, reason: form.reason })
          })
        : await fetch('/api/hr/leave/requests', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, days, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id) })
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: editId ? 'Leave request updated.' : 'Leave request submitted.', type: 'success' })
      setShowForm(false); setEditId(null)
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
        <Button onClick={() => { setShowForm(s => !s); setEditId(null); setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' }) }} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />New Request
        </Button>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">{editId ? 'Edit Leave Request' : 'Submit Leave Request'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600">Employee*</label>
                <EmployeeSearchSelect
                  employees={employees}
                  value={form.employee_id}
                  onChange={id => setForm(f => ({ ...f, employee_id: id }))}
                  disabled={!!editId}
                  required
                /></div>
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
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">{saving ? 'Saving…' : editId ? 'Save Changes' : 'Submit Request'}</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
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
                    <div className="flex gap-1">
                      {r.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleAction(r.id, 'approve')} className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs">Approve</Button>
                          <Button size="sm" onClick={() => handleAction(r.id, 'reject')} className="h-7 px-2 bg-red-500 hover:bg-red-600 text-white text-xs">Reject</Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(r)} className="h-7 px-2 text-xs">Edit</Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleDelete(r)} className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">Delete</Button>
                    </div>
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
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [run, setRun] = useState<any>(null)          // hr_payroll row for month/year
  const [items, setItems] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const locked = run?.status === 'paid'

  const load = useCallback(async () => {
    const d = await fetch('/api/hr/payroll').then(r => r.json())
    const found = (d.data || []).find((p: any) => Number(p.month) === month && Number(p.year) === year) || null
    setRun(found)
    if (found) {
      const it = await fetch(`/api/hr/payroll/${found.id}/items`).then(r => r.json())
      setItems(it.data || [])
    } else setItems([])
    setDirty(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Create run (if needed) + compute from attendance
  const generate = async () => {
    setBusy(true); setMsg(null)
    try {
      let id = run?.id
      if (!id) {
        const res = await fetch('/api/hr/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, year }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        id = data.id
      }
      const res2 = await fetch(`/api/hr/payroll/${id}/process`, { method: 'POST' })
      const data2 = await res2.json()
      if (!res2.ok) throw new Error(data2.error)
      setMsg({ text: `Salary computed for ${data2.employees_count} employees (${data2.working_days} working days).`, type: 'success' })
      await load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setBusy(false) }
  }

  // Save edited advance/permission/ESI, then recompute
  const saveAndRecalc = async () => {
    if (!run) return
    setBusy(true); setMsg(null)
    try {
      const entries = items.map(it => ({
        employee_id: it.employee_id,
        advance: Number(it.advance) || 0,
        permission_hours: Number(it.permission_hours) || 0,
        esi: Number(it.esi) || 0,
      }))
      const res = await fetch('/api/hr/payroll/inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, year, entries }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const res2 = await fetch(`/api/hr/payroll/${run.id}/process`, { method: 'POST' })
      if (!res2.ok) throw new Error((await res2.json()).error)
      setMsg({ text: 'Inputs saved and salary recalculated.', type: 'success' })
      await load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setBusy(false) }
  }

  const approve = async () => {
    if (!run) return
    if (!confirm(`Approve and LOCK salary for ${MONTHS[month-1]} ${year}? After this no changes are possible.`)) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/hr/payroll/${run.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Payroll approved and locked.', type: 'success' })
      await load()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setBusy(false) }
  }

  const editItem = (idx: number, field: string, value: string) => {
    setItems(list => list.map((it, i) => i === idx ? { ...it, [field]: value } : it))
    setDirty(true)
  }

  const num = (v: any) => Number(v) || 0
  const totals = items.reduce((t, it) => ({
    working: t.working + num(it.working_salary), sunday: t.sunday + num(it.sunday_salary),
    incentive: t.incentive + num(it.incentive), perm: t.perm + num(it.permission_amount),
    advance: t.advance + num(it.advance), esi: t.esi + num(it.esi), net: t.net + num(it.net_salary),
  }), { working: 0, sunday: 0, incentive: 0, perm: 0, advance: 0, esi: 0, net: 0 })

  const inputCls = "w-16 px-1 py-0.5 border rounded text-right text-xs disabled:bg-gray-50 disabled:text-gray-400"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payroll</h2>
          <p className="text-xs text-gray-500">Salary = day rate × attendance · 5% incentive on full attendance · permission = 1 hr</p>
        </div>
        <div className="flex items-end gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" />
          {!locked && (
            <Button onClick={generate} disabled={busy} className="bg-orange-600 hover:bg-orange-700 text-white">
              {busy ? 'Working…' : run ? 'Recalculate from Attendance' : 'Generate Salary'}
            </Button>
          )}
          {run && !locked && dirty && (
            <Button onClick={saveAndRecalc} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">Save Inputs & Recalculate</Button>
          )}
          {run?.status === 'processed' && !dirty && (
            <Button onClick={approve} disabled={busy} className="bg-green-600 hover:bg-green-700 text-white">Approve & Lock</Button>
          )}
        </div>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {run && (
        <div className="flex items-center gap-4 text-sm">
          <StatusBadge status={run.status} />
          {locked && <span className="text-xs text-gray-500">Locked — approved payroll cannot be changed</span>}
          {!locked && items.length > 0 && <span className="text-xs text-gray-500">Type advance / permission hours / ESI directly in the table, then Save & Recalculate</span>}
        </div>
      )}

      {!run ? (
        <div className="py-16 text-center text-gray-400 border border-dashed border-orange-200 rounded-xl">
          No salary generated for {MONTHS[month-1]} {year} yet — press <strong>Generate Salary</strong>
        </div>
      ) : (
        <div className="border border-orange-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="bg-orange-50 border-b border-orange-100">
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Code</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600">Rate</th>
                  <th className="px-2 py-2 text-center font-semibold text-green-700" title="Full present days">P</th>
                  <th className="px-2 py-2 text-center font-semibold text-yellow-700" title="Half days">H</th>
                  <th className="px-2 py-2 text-center font-semibold text-orange-500" title="Sundays worked">Sun</th>
                  <th className="px-2 py-2 text-center font-semibold text-red-500" title="Absent days">Abs</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600">Working ₹</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600">Sunday ₹</th>
                  <th className="px-2 py-2 text-right font-semibold text-green-700" title="5% full attendance">Incentive</th>
                  <th className="px-2 py-2 text-right font-semibold text-blue-700" title="Permission hours (1 = 1 hr)">Perm hrs</th>
                  <th className="px-2 py-2 text-right font-semibold text-red-500">Perm ₹</th>
                  <th className="px-2 py-2 text-right font-semibold text-red-500">Advance</th>
                  <th className="px-2 py-2 text-right font-semibold text-red-500">ESI</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-900">Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id} className={`border-b border-gray-100 hover:bg-orange-50/30 ${num(it.day_rate) === 0 ? 'bg-red-50/40' : idx % 2 ? 'bg-gray-50/30' : 'bg-white'}`}>
                    <td className="px-2 py-1.5 font-mono text-gray-500">{it.employee_code}</td>
                    <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{it.employee_name}
                      {num(it.day_rate) === 0 && <span className="ml-1 text-[10px] text-red-500 font-semibold">no rate!</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{num(it.day_rate)}</td>
                    <td className="px-2 py-1.5 text-center text-green-700 font-semibold">{num(it.present_days)}</td>
                    <td className="px-2 py-1.5 text-center text-yellow-700">{num(it.half_days) || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-orange-500">{num(it.sunday_days) || '—'}</td>
                    <td className="px-2 py-1.5 text-center text-red-500">{num(it.absent_days) || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(it.working_salary)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{num(it.sunday_salary) ? fmt(it.sunday_salary) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-green-700">{num(it.incentive) ? fmt(it.incentive) : '—'}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" step="0.5" min="0" disabled={locked} value={it.permission_hours ?? 0}
                        onChange={e => editItem(idx, 'permission_hours', e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-red-500">{num(it.permission_amount) ? '-' + fmt(it.permission_amount) : '—'}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" step="100" min="0" disabled={locked} value={it.advance ?? 0}
                        onChange={e => editItem(idx, 'advance', e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" step="1" min="0" disabled={locked} value={it.esi ?? 0}
                        onChange={e => editItem(idx, 'esi', e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-gray-900">{fmt(it.net_salary)}</td>
                  </tr>
                ))}
                {items.length > 0 && (
                  <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                    <td colSpan={7} className="px-2 py-2 text-gray-700">TOTAL — {items.length} employees</td>
                    <td className="px-2 py-2 text-right font-mono">{fmt(totals.working)}</td>
                    <td className="px-2 py-2 text-right font-mono">{fmt(totals.sunday)}</td>
                    <td className="px-2 py-2 text-right font-mono text-green-700">{fmt(totals.incentive)}</td>
                    <td />
                    <td className="px-2 py-2 text-right font-mono text-red-500">-{fmt(totals.perm)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-500">-{fmt(totals.advance)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-500">-{fmt(totals.esi)}</td>
                    <td className="px-2 py-2 text-right font-mono text-lg">{fmt(totals.net)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Departments ──────────────────────────────────────────────────────────────

function DepartmentsSection({ departments, reload }: { departments: Department[]; reload: () => void }) {
  const blankForm = { name: '', code: '', description: '' }
  const [showForm, setShowForm]   = useState(false)
  const [editDept, setEditDept]   = useState<Department | null>(null)
  const [form, setForm]           = useState(blankForm)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<number | null>(null)
  const [msg, setMsg]             = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const openEdit = (d: Department) => {
    setEditDept(d)
    setForm({ name: d.name, code: d.code, description: d.description || '' })
    setShowForm(true)
  }

  const openAdd = () => {
    setEditDept(null)
    setForm(blankForm)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      const url    = editDept ? `/api/hr/departments/${editDept.id}` : '/api/hr/departments'
      const method = editDept ? 'PUT' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: editDept ? 'Department updated.' : 'Department created.', type: 'success' })
      setShowForm(false); setEditDept(null); setForm(blankForm); reload()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (d: Department) => {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return
    setDeleting(d.id)
    try {
      const res  = await fetch(`/api/hr/departments/${d.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: 'Department deleted.', type: 'success' }); reload()
    } catch (err: any) { setMsg({ text: err.message, type: 'error' }) }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Departments</h2>
          <p className="text-sm text-gray-500">{departments.length} departments</p>
        </div>
        <Button onClick={openAdd} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Add Department
        </Button>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{editDept ? `Edit — ${editDept.name}` : 'New Department'}</CardTitle>
            <button onClick={() => { setShowForm(false); setEditDept(null) }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-600">Department Name*</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Code*</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required maxLength={20} className="mt-1 w-28" placeholder="HR" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-600">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Optional" />
              </div>
              <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                {saving ? 'Saving…' : editDept ? 'Update' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditDept(null) }}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-400">No departments yet. Add one above.</div>
        ) : departments.map(d => (
          <Card key={d.id} className="border-orange-100 hover:border-orange-300 transition-colors group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-orange-100 text-orange-700 font-bold text-xs px-2 py-1 rounded">{d.code}</div>
                <div className="flex items-center gap-2">
                  {/* Edit + Delete — always visible */}
                  <button
                    onClick={() => openEdit(d)}
                    className="p-1 rounded text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                    title="Edit department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    disabled={deleting === d.id}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete department"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <span className="text-2xl font-bold text-orange-600 ml-1">{d.employee_count}</span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{d.name}</h3>
              {d.description && <p className="text-xs text-orange-400 mt-0.5">{d.description}</p>}
              <p className="text-xs text-gray-500 mt-2">Head: <span className="font-medium">{d.head_name || '—'}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">{d.employee_count} active employee{d.employee_count !== 1 ? 's' : ''}</p>
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
      'P', 'A', 'HD', 'CL', 'Sun', 'Late', 'Total']
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
      emp.summary.late_morning ?? 0, data.total_days,
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
                  <th colSpan={7} className="border border-gray-200 bg-orange-600 text-white px-3 py-2 text-center text-sm font-bold">SUMMARY</th>
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
                  <th colSpan={7} className="border border-gray-200" />
                </tr>
              </thead>

              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={4 + days.length + 7} className="py-16 text-center text-gray-400">No employees found</td></tr>
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
                      <td className="border border-gray-100 px-1 py-1.5 text-center font-bold text-gray-700">{data.total_days}</td>
                    </tr>

                    {/* Expanded detail table — morning late / lunch late */}
                    {expandedEmp === emp.id && (
                      <tr key={`${emp.id}-expanded`}>
                        <td colSpan={4 + days.length + 7} className="border border-orange-200 bg-orange-50/50 p-0">
                          <div className="px-4 pt-3 pb-4">
                            <p className="text-xs font-semibold text-orange-700 mb-2">
                              {emp.name} — {MONTHS_FULL[month-1]} {year} · punch detail
                              <span className="ml-4 text-[10px] font-normal text-gray-400">
                                Late arrivals: <strong className="text-orange-600">{emp.summary.late_morning ?? 0}</strong>
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
                                    <th className="px-2 py-1.5 text-center font-semibold text-red-500 w-16">Exit</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-orange-600 w-24">Morning Late</th>
                                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500 w-16">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {days.map(d => {
                                    if (d.is_sunday) return (
                                      <tr key={d.day} className="bg-orange-50">
                                        <td className="px-2 py-1 font-bold text-orange-400">{d.day}</td>
                                        <td className="px-2 py-1 text-orange-300">{d.dow}</td>
                                        <td colSpan={5} className="px-2 py-1 text-orange-300">Sunday</td>
                                      </tr>
                                    )
                                    if (d.is_future) return (
                                      <tr key={d.day} className="bg-gray-50/30">
                                        <td className="px-2 py-1 font-semibold text-gray-300">{d.day}</td>
                                        <td className="px-2 py-1 text-gray-300">{d.dow}</td>
                                        <td colSpan={5} className="px-2 py-1 text-gray-200 text-[10px]">— upcoming —</td>
                                      </tr>
                                    )
                                    const rec = emp.attendance[d.day] === 'future' ? null : emp.attendance[d.day]
                                    const isLateM = rec?.status === 'late'
                                    const rowCls = isLateM ? 'bg-orange-50'
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
                                        <td className="px-2 py-1 text-center font-mono text-red-500">{rec?.check_out ? rec.check_out.slice(0,5) : '—'}</td>
                                        <td className="px-2 py-1 text-center">
                                          {isLateM ? (
                                            <span className="text-orange-600 font-semibold">+{rec.late_morning_mins} min</span>
                                          ) : rec?.check_in ? (
                                            <span className="text-green-600">On time</span>
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
