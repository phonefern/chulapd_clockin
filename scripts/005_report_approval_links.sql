-- Supervisor approval links + delivery tracking for certified reports.

-- A shareable link that lets a supervisor (no admin account) approve a month's reports.
-- Only the SHA-256 of the token is stored; the token itself exists only in the shared URL.
create table if not exists attendance.report_approval_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  report_month text not null check (report_month ~ '^\d{4}-\d{2}$'),
  employee_ids uuid[] not null,
  approver_name text not null,
  approver_role text not null,
  created_by uuid not null,
  created_by_email text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists report_approval_links_month_idx
  on attendance.report_approval_links (report_month);

alter table attendance.report_approval_links enable row level security;
grant select, insert, update, delete on attendance.report_approval_links to service_role;

-- Link approvals have no admin user; record which link (and request metadata) was used instead.
alter table attendance.attendance_report_approvals
  alter column approved_by drop not null,
  add column if not exists approved_via text not null default 'admin'
    check (approved_via in ('admin', 'link')),
  add column if not exists approval_link_id uuid references attendance.report_approval_links(id),
  add column if not exists approver_user_agent text,
  -- Last time this approved version was pushed to the employee on LINE.
  add column if not exists sent_to_employee_at timestamptz;
