-- Per-employee opt-out for LINE push reminders (for people who don't actually use the system),
-- and a leave calendar so cron reminders skip employees who are on leave that day.

alter table attendance.employees
  add column if not exists reminders_enabled boolean not null default true;

create table if not exists attendance.employee_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references attendance.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  -- full = whole day, morning = skip the 08:20 reminder only, afternoon = skip the 16:20 reminder only
  period text not null default 'full' check (period in ('full', 'morning', 'afternoon')),
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists employee_leaves_employee_dates_idx
  on attendance.employee_leaves (employee_id, start_date, end_date);

-- Same access model as the other attendance tables: RLS on, no policies, server-only via service_role.
alter table attendance.employee_leaves enable row level security;
grant select, insert, update, delete on attendance.employee_leaves to service_role;
