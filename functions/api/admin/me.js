import { json } from '../../../lib/http.js';

export async function onRequestGet({ data }) {
  return json({ name: data.admin.name, role: data.admin.role });
}
