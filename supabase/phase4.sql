-- =====================================================================
-- CK Technical Video — เพิ่มสำหรับเฟส 4 (หลังบ้านแอดมิน)
-- รันต่อจาก schema.sql และ phase2.sql · รันซ้ำได้
-- =====================================================================

-- เรียงลำดับวิดีโอ / หมวดหมู่ ตามลำดับ id ที่ส่งมา (เรียกจาก API ด้วย service_role เท่านั้น)
create or replace function public.reorder_videos(ids uuid[])
returns void
language sql
as $$
  update public.videos v
     set sort_order = o.ord
    from unnest(ids) with ordinality as o(id, ord)
   where v.id = o.id;
$$;

create or replace function public.reorder_categories(ids bigint[])
returns void
language sql
as $$
  update public.categories c
     set sort_order = o.ord
    from unnest(ids) with ordinality as o(id, ord)
   where c.id = o.id;
$$;

revoke all on function public.reorder_videos(uuid[])       from public, anon, authenticated;
revoke all on function public.reorder_categories(bigint[]) from public, anon, authenticated;
grant execute on function public.reorder_videos(uuid[])       to service_role;
grant execute on function public.reorder_categories(bigint[]) to service_role;
