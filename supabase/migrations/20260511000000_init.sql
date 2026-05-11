-- Field Radar: initial schema
create extension if not exists "pgcrypto";

create table events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  label        text,
  start_date   date not null,
  end_date     date,
  tier         text not null check (tier in ('tier-1','tier-2','tier-3')),
  location     text not null check (location in ('loc-chi','loc-cin','loc-cmh','loc-ind','loc-rec')),
  notes        text,
  url          text,
  source       text not null default 'manual' check (source in ('manual','scout')),
  scout_run_id uuid,
  confirmed    boolean not null default false,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint end_date_after_start check (end_date is null or end_date >= start_date)
);

create index events_start_date_idx on events (start_date);
create index events_active_idx on events (dismissed_at) where dismissed_at is null;

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

alter table events enable row level security;

create policy "anon can read active events"
  on events for select
  to anon
  using (dismissed_at is null);

create policy "service_role full access"
  on events for all
  to service_role
  using (true)
  with check (true);
