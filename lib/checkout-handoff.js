// Signs the checkout handoff token Elixpo Pay (payouts.elixpo.com) verifies.
// The token is the only trusted source for the amount/uid — so a user can't
// tamper with the price in the redirect URL. Edge-runtime safe (Web Crypto).
//
// Contract (must match payouts.elixpo verifyHandoff):
//   token = base64url(JSON(payload)) + "." + hex(HMAC-SHA256(body, secret))
//   payload = { app, plan, uid, currency, amount(minor units), return, email?, iat, exp }

import { hmacHex } from './hmac';

const encoder = new TextEncoder();

function base64url(str) {
  const bytes = encoder.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base URL of the central payments service (override locally via env).
export function payoutsBase() {
  return (process.env.PAYOUTS_URL || 'https://payouts.elixpo.com').replace(/\/$/, '');
}

/**
 * @param {string} secret  shared ELIXPO_PAY_HANDOFF_SECRET
 * @param {{app:string, plan:string, uid:string, currency:string, amount:number, return?:string, email?:string}} payload
 * @param {number} ttlSeconds  default 30 min
 * @returns {Promise<string>} signed token
 */
export async function signHandoff(secret, payload, ttlSeconds = 1800) {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + ttlSeconds };
  const body = base64url(JSON.stringify(full));
  const sig = await hmacHex(body, secret);
  return `${body}.${sig}`;
}
