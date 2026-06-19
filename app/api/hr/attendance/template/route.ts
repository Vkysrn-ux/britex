import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as XLSX from 'xlsx'

export async function GET() {
  const wb = XLSX.utils.book_new()

  // Sample data matching common biometric exports
  const data = [
    ['Employee Code', 'Employee Name', 'Date',       'In Time', 'Out Time', 'Status'],
    ['EMP001',        'Arjun Sharma',  '2025-06-19', '09:05',   '18:02',    'P'],
    ['EMP002',        'Priya Nair',    '2025-06-19', '09:30',   '17:45',    'P'],
    ['EMP003',        'Rahul Verma',   '2025-06-19', '',        '',         'A'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [18, 22, 14, 10, 10, 10].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')

  // Info sheet
  const info = [
    ['Column',         'Accepted Names (case-insensitive)'],
    ['Employee Code',  'Employee Code, Emp Code, Emp ID, Staff ID, Card No, Badge No, User ID, Enrollment No'],
    ['Employee Name',  'Employee Name, Emp Name, Name, Full Name, Staff Name'],
    ['Date',           'Date, Attendance Date, Att Date, Punch Date, Work Date'],
    ['Check In',       'In Time, Check In, Checkin, Punch In, Time In, First In, Arrival'],
    ['Check Out',      'Out Time, Check Out, Checkout, Punch Out, Time Out, Last Out, Departure'],
    ['Status',         'Status, Remark — P/Present, A/Absent, H/Half Day, L/Late, LV/Leave'],
    [''],
    ['Notes'],
    ['- Dates accepted: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or Excel date serial'],
    ['- Times accepted: HH:MM or HH:MM:SS (24-hour or Excel time fraction)'],
    ['- Rows without a matching Employee Code/Name are skipped'],
    ['- Existing records for the same date are updated (not duplicated)'],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(info)
  wsInfo['!cols'] = [20, 80].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Column Guide')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="biometric_attendance_template.xlsx"',
    },
  })
}
