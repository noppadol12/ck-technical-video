export const CUSTOMER_ADMIN_FIELDS = 'id,code,name,phone,company,note,active,expires_at,session_version,created_at,updated_at';
export const CODE_RE = /^[A-Z0-9][A-Z0-9._-]{2,63}$/;

export function customerState(c) {
  if (!c.active) return 'disabled';
  if (c.expires_at && Date.parse(c.expires_at) <= Date.now()) return 'expired';
  return 'active';
}
