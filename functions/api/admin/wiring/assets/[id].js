import { assetResponse } from '../../../../../lib/wiring.js';

export async function onRequestGet({ env, params }) {
  return assetResponse(env, params.id);
}
