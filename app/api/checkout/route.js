export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { pricingForCountry } from '../../../lib/pricing';
import { payoutsBase, signHandoff } from '../../../lib/checkout-handoff';

// GET /api/checkout?plan=member
//
// Server-side handoff to Elixpo Pay. We resolve the buyer (session), the
// region-adjusted price (cf-ipcountry), sign a short-lived handoff token with
// the shared secret, and redirect to the hosted checkout. The amount is signed
// into the token so it can't be tampered with in the URL.
export async function GET(request) {
  const url = new URL(request.url);
  const plan = (url.searchParams.get('plan') || '').toLowerCase();

  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  if (!plan || plan === 'free') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Region-adjusted price (same source the pricing page shows).
  let cc = request.headers.get('cf-ipcountry') || '';
  if (!cc) {
    try { cc = request.cf?.country || ''; } catch {}
  }
  const pricing = pricingForCountry(cc);
  const major = pricing.prices?.[plan];
  if (!major) {
    return NextResponse.redirect(new URL('/pricing?error=unknown_plan', request.url));
  }
  const amountMinor = Math.round(Number(major) * 100);

  const secret = process.env.ELIXPO_PAY_HANDOFF_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'billing_unconfigured', error_description: 'ELIXPO_PAY_HANDOFF_SECRET not set' },
      { status: 500 },
    );
  }

  const token = await signHandoff(secret, {
    app: 'lixblogs',
    plan,
    uid: session.userId,
    currency: pricing.currency,
    amount: amountMinor,
    return: `${url.origin}/settings`,
    email: session.profile?.email || session.email || undefined,
  });

  return NextResponse.redirect(`${payoutsBase()}/checkout?token=${encodeURIComponent(token)}`);
}
