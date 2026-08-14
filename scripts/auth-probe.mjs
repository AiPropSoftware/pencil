/**
 * Auth probe — end-to-end check of the forgot-password flow, run from a
 * GitHub runner (workflow_dispatch). Steps:
 *   1. deployed app answers on /reset-password
 *   2. public auth settings sanity (signup on, email provider on)
 *   3. pick the FOUNDER account (earliest created user) via the admin API —
 *      no email address ever hardcoded in this public repo; logs mask them
 *   4. fire a real recovery email at it — the human then clicks the link
 *      and sets a new password, completing the loop this probe can't click.
 */
const URL = process.env.SUPABASE_URL || "https://hhhpochstmzjglzyyvoj.supabase.co";
const ANON = "sb_publishable_IjXg9NzzGLbOyquTP-S21A_MCtBOmyP";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL || "https://pencil-aipropsoftwares-projects.vercel.app";
const mask = (e) => (e ? e.replace(/^(.).*?(@.*)$/, "$1***$2") : "?");

// 1. Deployed page (SPA shell — proves the domain serves; retry through deploys)
let pageOk = false;
for (let i = 0; i < 10 && !pageOk; i++) {
  try {
    const p = await fetch(`${APP}/reset-password`);
    if (p.ok) { pageOk = true; console.log(`page: ${APP}/reset-password → HTTP ${p.status}`); break; }
    console.log(`page attempt ${i + 1}: HTTP ${p.status}`);
  } catch (e) {
    console.log(`page attempt ${i + 1}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
if (!pageOk) { console.log("FAIL: app not reachable"); process.exit(1); }

// 2. Public auth settings
const s = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: ANON } });
const settings = await s.json().catch(() => ({}));
console.log("auth settings:", s.status, JSON.stringify({
  disable_signup: settings.disable_signup,
  mailer_autoconfirm: settings.mailer_autoconfirm,
  email_enabled: settings.external?.email,
}));

// 3. Earliest-created account = the founder
if (!SERVICE) { console.log("FAIL: SUPABASE_SERVICE_ROLE_KEY secret missing"); process.exit(1); }
const u = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=50`, {
  headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
});
if (!u.ok) { console.log(`FAIL: admin users HTTP ${u.status}: ${(await u.text()).slice(0, 200)}`); process.exit(1); }
const users = ((await u.json()).users || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
console.log(`users: ${users.length}`);
for (const x of users.slice(0, 10)) {
  console.log(`  ${mask(x.email)} · created ${String(x.created_at).slice(0, 10)} · last sign-in ${String(x.last_sign_in_at ?? "never").slice(0, 10)}`);
}
const target = users[0];
if (!target?.email) { console.log("FAIL: no users found"); process.exit(1); }

// 4. Real recovery email, exactly as the sign-in page sends it (anon key)
const r = await fetch(`${URL}/auth/v1/recover?redirect_to=${encodeURIComponent(`${APP}/reset-password`)}`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email: target.email, gotrue_meta_security: {} }),
});
const body = (await r.text()).slice(0, 200);
console.log(`recover → ${mask(target.email)}: HTTP ${r.status} ${body}`);
if (r.status === 429) { console.log("RATE LIMITED — built-in SMTP allows only a few emails/hour; retry later."); process.exit(1); }
if (!r.ok) { console.log("FAIL: recovery email not accepted"); process.exit(1); }
console.log("RESET EMAIL DISPATCHED — open the founder inbox and click the link to finish the live test.");
