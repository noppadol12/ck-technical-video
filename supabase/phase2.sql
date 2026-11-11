-- =====================================================================
-- CK Technical Video — เพิ่มสำหรับเฟส 2 (รันต่อจาก schema.sql)
-- ตารางนับครั้งที่ใส่รหัสผิด เพื่อกันการเดารหัส
-- =====================================================================

create table if not exists public.login_attempts (
  id          bigint generated always as identity primary key,
  ip          text not null,
  created_at  timestamptz not null default now()
);

create index if not exists login_attempts_ip_idx on public.login_attempts (ip, created_at desc);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
