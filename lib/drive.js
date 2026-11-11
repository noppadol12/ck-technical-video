// รับได้ทั้ง File ID ตรงๆ และลิงก์ Google Drive (กติกาเดียวกับ Apps Script เดิม)
export function extractDriveFileId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  const byPath = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (byPath) return byPath[1];
  const byParam = s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (byParam) return byParam[1];
  const any = s.match(/[-\w]{25,}/);
  return any ? any[0] : null;
}
