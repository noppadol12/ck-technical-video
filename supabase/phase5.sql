-- =====================================================================
-- CK Technical Video — เพิ่มสำหรับเฟส 5 (แผนผังวงจร CK Wiring)
-- รันต่อจาก phase4.sql · รันซ้ำได้ · เพิ่มเฉพาะของใหม่ ไม่แก้ข้อมูลเดิม
-- =====================================================================

-- ---------------------------------------------------------------------
-- diagrams  แผนผังที่วาดในหลังบ้าน (/admin/wiring)
--   data       ฉบับที่กำลังแก้ (บันทึกอัตโนมัติ)
--   published  ฉบับที่ลูกค้าเห็น (คัดลอกจาก data ตอนกด "เผยแพร่")
--   revision   เลขรุ่น กันการบันทึกทับกันเมื่อเปิดงานเดียวกันหลายหน้าต่าง
-- ---------------------------------------------------------------------
create table if not exists public.diagrams (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  category_id         bigint references public.categories (id) on delete set null,
  data                jsonb not null default '{}'::jsonb,
  revision            integer not null default 1,
  published           jsonb,
  published_revision  integer,
  published_at        timestamptz,
  is_published        boolean not null default false,
  replaces_video_id   uuid references public.videos (id) on delete set null,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint diagrams_title_not_blank check (btrim(title) <> ''),
  constraint diagrams_published_has_data check (not is_published or published is not null)
);

create index if not exists diagrams_listing_idx on public.diagrams (is_published, category_id, sort_order);

drop trigger if exists diagrams_updated_at on public.diagrams;
create trigger diagrams_updated_at
  before update on public.diagrams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- wiring_assets  รูปในแผนผัง (รูปสินค้า / โลโก้ / รูปที่วาง)
--   id = sha256 ของไฟล์ (ไฟล์เดียวกันเก็บครั้งเดียว และ id เดาไม่ได้)
-- ---------------------------------------------------------------------
create table if not exists public.wiring_assets (
  id          text primary key,
  mime        text not null,
  data        text not null,            -- base64
  size        integer not null,
  created_at  timestamptz not null default now(),
  constraint wiring_assets_id_format check (id ~ '^[0-9a-f]{64}$'),
  constraint wiring_assets_mime_check check (mime in ('image/webp', 'image/png', 'image/jpeg')),
  constraint wiring_assets_size_check check (size between 1 and 2000000)
);

-- ---------------------------------------------------------------------
-- wiring_settings  คลังอุปกรณ์ และค่าเริ่มต้นกรอบชื่อบริษัท
-- ---------------------------------------------------------------------
create table if not exists public.wiring_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint wiring_settings_key_check check (key in ('library', 'title_default'))
);

drop trigger if exists wiring_settings_updated_at on public.wiring_settings;
create trigger wiring_settings_updated_at
  before update on public.wiring_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- บันทึกการเปิดดูแผนผังลงตาราง watch_logs เดิม (คอลัมน์ใหม่ เป็น null ได้)
-- ---------------------------------------------------------------------
alter table public.watch_logs
  add column if not exists diagram_id uuid references public.diagrams (id) on delete set null;

create index if not exists watch_logs_diagram_idx on public.watch_logs (diagram_id, created_at desc)
  where diagram_id is not null;

-- ---------------------------------------------------------------------
-- Security: เหมือนตารางอื่น — เข้าถึงผ่าน API (service_role) เท่านั้น
-- ---------------------------------------------------------------------
alter table public.diagrams        enable row level security;
alter table public.wiring_assets   enable row level security;
alter table public.wiring_settings enable row level security;

revoke all on public.diagrams, public.wiring_assets, public.wiring_settings from anon, authenticated;
