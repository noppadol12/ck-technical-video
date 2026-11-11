export const VIDEO_ADMIN_FIELDS = 'id,title,description,source,drive_file_id,bunny_video_id,status,is_published,sort_order,category_id,created_at,updated_at,category:categories(name)';

export function shapeVideo(v, stats) {
  return {
    ...v,
    category: v.category?.name ?? null,
    thumbnail: v.drive_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(v.drive_file_id)}&sz=w400` : null,
    total_views: stats?.total_views ?? 0,
    unique_viewers: stats?.unique_viewers ?? 0,
    last_viewed_at: stats?.last_viewed_at ?? null,
  };
}

