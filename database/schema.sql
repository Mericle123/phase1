create table if not exists roles (
  name text primary key,
  description text not null,
  permissions jsonb not null default '[]'::jsonb
);

create table if not exists users (
  id uuid primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null references roles(name),
  designation text,
  phone text,
  location text,
  work_id text unique,
  avatar text,
  joined text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key,
  client_name text not null,
  client_type text not null,
  citizenship text not null check (citizenship in ('Bhutanese', 'Foreigner')),
  cid text,
  passport text,
  country text,
  location text,
  organization_name text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key,
  client_id uuid references clients(id),
  journal_no text not null unique,
  invoice_date date not null,
  invoice_amount numeric(14, 2) not null check (invoice_amount > 0),
  currency text not null default 'BTN',
  description text,
  payment_status text not null default 'Pending' check (payment_status in ('Pending', 'Unpaid', 'Paid')),
  admin_review_status text not null default 'Pending Review' check (admin_review_status in ('Pending Review', 'Approved', 'Rejected', 'Verified', 'Flagged')),
  admin_review_remarks text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  entered_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_journal_no on invoices(journal_no);
create index if not exists idx_invoices_payment_status on invoices(payment_status);
create index if not exists idx_invoices_invoice_date on invoices(invoice_date);

create table if not exists financial_data (
  invoice_id uuid primary key references invoices(id) on delete cascade,
  capital_cost numeric(14, 2),
  long_term_amortization text,
  financing_cost numeric(8, 2),
  working_capital numeric(14, 2),
  pnl_revenue numeric(14, 2),
  pnl_cogs numeric(14, 2),
  pnl_opex numeric(14, 2),
  cash_flow_opening numeric(14, 2),
  cash_flow_inflow numeric(14, 2),
  cash_flow_outflow numeric(14, 2),
  debt_percent numeric(5, 2),
  equity_percent numeric(5, 2),
  cash_flow_analysis text
);

create table if not exists payments (
  id uuid primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_sender text,
  payment_method text,
  payment_reference text,
  amount_received numeric(14, 2),
  payment_date date,
  verification_remarks text,
  verified_by uuid references users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists blockchain_transactions (
  id uuid primary key,
  invoice_id uuid not null references invoices(id),
  journal_no text not null unique,
  transaction_id text not null unique,
  block_number bigint,
  chaincode_response text,
  submitted_by uuid not null references users(id),
  submitted_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key,
  actor_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_log(entity_type, entity_id);
create index if not exists idx_audit_created_at on audit_log(created_at desc);

create table if not exists employee_sessions (
  id uuid primary key,
  user_id uuid not null references users(id),
  ip_address text,
  office_status text not null,
  user_agent text,
  device_fingerprint text,
  active boolean not null default true,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists idx_employee_sessions_user_last_seen on employee_sessions(user_id, last_seen desc);

create table if not exists employee_activity (
  id uuid primary key,
  employee_id uuid references users(id),
  employee_name text not null,
  role text not null,
  role_label text not null,
  department text not null,
  action text not null,
  action_performed text not null,
  activity_type text not null,
  record_id text,
  entry_time timestamptz not null default now(),
  office_status text not null,
  device_session_status text not null,
  active_status text not null,
  last_seen timestamptz,
  status text not null,
  remarks text,
  ip_address text,
  user_agent text,
  session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_activity_entry_time on employee_activity(entry_time desc);
create index if not exists idx_employee_activity_employee on employee_activity(employee_id);
create index if not exists idx_employee_activity_filters on employee_activity(role, department, office_status, activity_type);

create table if not exists correction_records (
  id uuid primary key,
  invoice_id uuid not null references invoices(id),
  journal_no text not null,
  correction_type text not null,
  reason text not null,
  corrected_fields jsonb not null default '{}'::jsonb,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
