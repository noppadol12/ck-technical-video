-- =====================================================================
-- CK Technical Video — เพิ่มสำหรับเฟส 3 (Bunny Stream) · รันซ้ำได้
-- =====================================================================

alter table public.videos add column if not exists bunny_status text;
alter table public.videos add column if not exists bunny_error text;
alter table public.videos add column if not exists bunny_requested_at timestamptz;

do $$ begin
  alter table public.videos add constraint videos_bunny_status_check
    check (bunny_status is null or bunny_status in ('fetching', 'processing', 'ready', 'failed'));
exception when duplicate_object then null; end $$;

create index if not exists videos_bunny_pending_idx on public.videos (bunny_status)
  where bunny_status in ('fetching', 'processing');
