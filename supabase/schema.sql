-- =====================================================================
-- CK Technical Video — Supabase schema (Phase 1)
-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- customers  (แทนชีต Customers)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  phone           text,
  company         text,
  note            text,
  active          boolean not null default true,
  -- ค่าเริ่มต้น: หมดอายุ 1 ปีหลังสร้าง (null = ไม่หมดอายุ)
  expires_at      timestamptz default (now() + interval '1 year'),
  -- เพิ่มค่านี้เมื่อต้องการเตะลูกค้าออกจากทุกเครื่องทันที
  session_version integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint customers_code_normalized check (code = upper(btrim(code))),
  constraint customers_code_length     check (char_length(code) between 1 and 64),
  constraint customers_name_not_blank  check (btrim(name) <> '')
);

create unique index if not exists customers_code_key on public.customers (code);
create index if not exists customers_active_idx on public.customers (active, expires_at);

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- categories  (มาจากคอลัมน์ C ของชีต Videos)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint categories_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists categories_name_key on public.categories (name);

-- ---------------------------------------------------------------------
-- videos  (แทนชีต Videos)
-- source = 'drive' ตอนนี้ / 'bunny' หลังทำเฟส 3
-- ---------------------------------------------------------------------
create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  category_id     bigint references public.categories (id) on delete set null,
  source          text not null default 'drive',
  drive_file_id   text,
  bunny_video_id  text,
  status          text not null default 'ready',
  is_published    boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint videos_title_not_blank check (btrim(title) <> ''),
  constraint videos_source_check    check (source in ('drive', 'bunny')),
  constraint videos_status_check    check (status in ('processing', 'ready', 'failed')),
  constraint videos_source_has_id   check (
    (source = 'drive' and drive_file_id  is not null) or
    (source = 'bunny' and bunny_video_id is not null)
  ),
  constraint videos_drive_file_id_key  unique (drive_file_id),
  constraint videos_bunny_video_id_key unique (bunny_video_id)
);

create index if not exists videos_listing_idx
  on public.videos (is_published, status, category_id, sort_order);

drop trigger if exists videos_updated_at on public.videos;
create trigger videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- admins  (ผูกกับ Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  role        text not null default 'staff',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint admins_role_check check (role in ('owner', 'staff'))
);

-- ---------------------------------------------------------------------
-- login_logs  (แทนชีต Logs)
-- เก็บ code/name ณ เวลานั้นไว้ด้วย เผื่อลูกค้าถูกแก้ชื่อหรือปิดภายหลัง
-- legacy = true คือข้อมูลที่ย้ายมาจาก Google Sheet
-- ---------------------------------------------------------------------
create table if not exists public.login_logs (
  id             bigint generated always as identity primary key,
  customer_id    uuid references public.customers (id) on delete set null,
  code_snapshot  text not null,
  name_snapshot  text,
  ip             text,
  user_agent     text,
  legacy         boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists login_logs_created_idx  on public.login_logs (created_at desc);
create index if not exists login_logs_customer_idx on public.login_logs (customer_id, created_at desc);

-- ---------------------------------------------------------------------
-- watch_logs  (แทนชีต WatchLogs)
-- ---------------------------------------------------------------------
create table if not exists public.watch_logs (
  id                    bigint generated always as identity primary key,
  customer_id           uuid references public.customers (id) on delete set null,
  video_id              uuid references public.videos (id) on delete set null,
  code_snapshot         text not null,
  name_snapshot         text,
  video_title_snapshot  text,
  legacy                boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists watch_logs_created_idx  on public.watch_logs (created_at desc);
create index if not exists watch_logs_customer_idx on public.watch_logs (customer_id, created_at desc);
create index if not exists watch_logs_video_idx    on public.watch_logs (video_id, created_at desc);

-- ---------------------------------------------------------------------
-- admin_actions  (ใครทำอะไรในหลังบ้าน)
-- ---------------------------------------------------------------------
create table if not exists public.admin_actions (
  id           bigint generated always as identity primary key,
  admin_id     uuid references public.admins (user_id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

-- ---------------------------------------------------------------------
-- Security: เปิด RLS ทุกตาราง และไม่ให้ anon / authenticated เข้าถึงตรงๆ
-- API บน Cloudflare ใช้ service_role key (ข้าม RLS) และตรวจสิทธิ์เอง
-- ---------------------------------------------------------------------
alter table public.customers     enable row level security;
alter table public.categories    enable row level security;
alter table public.videos        enable row level security;
alter table public.admins        enable row level security;
alter table public.login_logs    enable row level security;
alter table public.watch_logs    enable row level security;
alter table public.admin_actions enable row level security;

revoke all on public.customers, public.categories, public.videos, public.admins,
              public.login_logs, public.watch_logs, public.admin_actions
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- Report views (ใช้ในหลังบ้านเฟส 4) — security_invoker เพื่อไม่ข้าม RLS
-- ---------------------------------------------------------------------
create or replace view public.video_stats
with (security_invoker = true) as
select
  v.id,
  v.title,
  c.name                                   as category,
  count(w.id)                              as total_views,
  count(distinct w.customer_id)            as unique_viewers,
  max(w.created_at)                        as last_viewed_at
from public.videos v
left join public.categories c on c.id = v.category_id
left join public.watch_logs w on w.video_id = v.id
group by v.id, v.title, c.name;

create or replace view public.customer_activity
with (security_invoker = true) as
select
  cu.id,
  cu.code,
  cu.name,
  cu.active,
  cu.expires_at,
  (select max(l.created_at) from public.login_logs l where l.customer_id = cu.id) as last_login_at,
  (select count(*)          from public.watch_logs w where w.customer_id = cu.id) as total_views
from public.customers cu;

revoke all on public.video_stats, public.customer_activity from anon, authenticated;
