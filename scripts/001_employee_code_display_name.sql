alter table attendance.employees add column if not exists display_name text;

create sequence if not exists attendance.employee_code_seq;

alter table attendance.employees
  alter column employee_code set default ('EMP' || lpad(nextval('attendance.employee_code_seq')::text, 4, '0'));

update attendance.employees
set employee_code = 'EMP' || lpad(nextval('attendance.employee_code_seq')::text, 4, '0')
where employee_code is null;
