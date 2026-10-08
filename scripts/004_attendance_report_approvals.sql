-- Monthly attendance certification reports (PLAN-011).

-- Shown in the report header ("หน่วยงาน"); falls back to the centre name when empty.
alter table attendance.employees add column if not exists department text;

-- One row per digital approval of an employee's monthly report. Re-approving after the data
-- changed creates a new version; older versions stay for history and still resolve on /verify.
create table if not exists attendance.attendance_report_approvals (
  id uuid primary key default gen_random_uuid(),
  verification_id text not null unique,
  employee_id uuid not null references attendance.employees(id) on delete cascade,
  report_month text not null check (report_month ~ '^\d{4}-\d{2}$'),
  report_version integer not null check (report_version >= 1),
  document_hash text not null,
  -- The exact report content that was certified, so /verify can show what was signed even
  -- after attendance rows are edited later.
  snapshot jsonb not null,
  approved_by uuid not null,
  approver_email text,
  approver_name text not null,
  approver_role text not null,
  approved_at timestamptz not null default now(),
  unique (employee_id, report_month, report_version)
);

create index if not exists attendance_report_approvals_month_idx
  on attendance.attendance_report_approvals (report_month, employee_id);

alter table attendance.attendance_report_approvals enable row level security;
grant select, insert, update, delete on attendance.attendance_report_approvals to service_role;
