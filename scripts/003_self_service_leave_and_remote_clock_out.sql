-- Employees can now file their own leave from the LIFF app; keep track of who created each row.
alter table attendance.employee_leaves
  add column if not exists created_by text not null default 'admin'
    check (created_by in ('admin', 'employee'));

-- How the clock-out was recorded: 'geofence' = pressed inside a work location,
-- 'remote' = self-reported time from outside the geofence (forgot to clock out; limited per month).
alter table attendance.attendance
  add column if not exists clock_out_method text
    check (clock_out_method in ('geofence', 'remote')),
  add column if not exists clock_out_note text;

create index if not exists attendance_remote_clock_out_idx
  on attendance.attendance (employee_id, work_date)
  where clock_out_method = 'remote';
