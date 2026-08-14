/**
 * Live-site smoke test — drives the PRODUCTION app in a real browser from a
 * GitHub runner: sign in with a throwaway beta account, open the map, search
 * an address, and assert the X-ray + "What's selling nearby" + mini
 * underwrite render without a crash. The webinar-insurance test.
 *
 * Requires: npx playwright + a chromium/chrome binary (runner has Chrome).
 */
import { chromium } from "playwright";

const APP = process.env.APP_URL || "https://pencil-aipropsoftwares-projects.vercel.app";
const SUPA = "https://hhhpochstmzjglzyyvoj.supabase.co";
const ANON = "sb_publishable_IjXg9NzzGLbOyquTP-S21A_MCtBOmyP";
// Unique throwaway account per run — mailer_autoconfirm is on, so it works
// instantly and needs no inbox. Runner-only; never a real person's address.
const EMAIL = `pencil.smoke+${Date.now()}@example.com`;
const PASSWORD = `Smoke-${Date.now()}!aA1`;

const fails = [];
const ok = (name, detail = "") => console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
const bad = (name, detail) => { fails.push(name); console.log(`❌ ${name} — ${detail}`); };

// 1. Create the throwaway account server-side (fast, deterministic).
{
  const r = await fetch(`${SUPA}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, data: { full_name: "Smoke Test", phone: "0000000000" } }),
  });
  if (r.ok) ok("signup API", EMAIL.replace(/\+\d+/, "+…"));
  else bad("signup API", `HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

async function shot(name) {
  try { await page.screenshot({ path: `smoke-${name}.png`, fullPage: false }); } catch { /* non-fatal */ }
}

try {
  // 2. Landing page renders.
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  const landingText = await page.textContent("body");
  if (/pencil/i.test(landingText ?? "")) ok("landing renders");
  else bad("landing renders", (landingText ?? "").slice(0, 120));
  await shot("landing");

  // 3. Sign-in page shows the new Forgot password link.
  await page.goto(`${APP}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const signInText = (await page.textContent("body")) ?? "";
  if (/forgot password/i.test(signInText)) ok("forgot-password link present");
  else bad("forgot-password link present", signInText.slice(0, 160));

  // 4. Sign in with the throwaway account.
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForTimeout(4000);
  if (!page.url().includes("/sign-in")) ok("sign-in works", page.url().replace(APP, ""));
  else { bad("sign-in works", `still on ${page.url()}`); await shot("signin-stuck"); }

  // 5. Map loads with permit pins data (construction layer).
  await page.goto(`${APP}/map`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000); // live permit feeds fan-in
  const mapText = (await page.textContent("body")) ?? "";
  const permitCount = mapText.match(/(\d[\d,]*) real permits/);
  if (permitCount && parseInt(permitCount[1].replace(/,/g, "")) > 100) ok("map + live permits", `${permitCount[1]} permits`);
  else if (/sign up|sign in/i.test(mapText) && !/real permits/.test(mapText)) bad("map + live permits", "bounced to auth gate");
  else bad("map + live permits", `permit count not found: ${mapText.slice(0, 200)}`);
  await shot("map");

  // 6. Address search → X-ray drawer + nearby sales + mini underwrite.
  //    Nashville address (recorded-sales coverage verified there today).
  const searchBox = page.locator('input[placeholder*="Search a city"]');
  await searchBox.fill("2100 West End Ave, Nashville, TN");
  await searchBox.press("Enter");
  await page.waitForTimeout(12000); // geocode + zoning + parcel + sales fetches
  const drawerText = (await page.textContent("body")) ?? "";
  if (/What can be built here\?/i.test(drawerText)) ok("X-ray drawer opens");
  else bad("X-ray drawer opens", drawerText.slice(0, 200));
  if (/What's selling nearby/i.test(drawerText)) {
    const m = drawerText.match(/What's selling nearby(.{0,400})/s);
    const hasPrice = /\$[\d,]{6,}/.test(m?.[1] ?? "");
    if (hasPrice) ok("nearby sales show real prices");
    else if (/Checking recorded sales/i.test(m?.[1] ?? "")) bad("nearby sales show real prices", "still loading after 12s");
    else ok("nearby sales section honest-empty", (m?.[1] ?? "").slice(0, 140).replace(/\s+/g, " "));
  } else bad("nearby sales section", "section absent");
  if (/Mini underwrite/i.test(drawerText)) ok("mini underwrite present");
  else bad("mini underwrite present", "card absent");
  await shot("xray");

  // 7. Deal analyzer renders with the land-cost row.
  await page.goto(`${APP}/deal-analyzer?arv=1000000&costPerSqft=200&totalSqft=2500&mode=sell`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const dealText = (await page.textContent("body")) ?? "";
  if (/Land cost/.test(dealText) && /before/i.test(dealText)) ok("analyzer + land-cost row + $0-land note");
  else bad("analyzer land-cost", dealText.slice(0, 200));
  await shot("analyzer");

  // 8. Reset-password page states.
  await page.goto(`${APP}/reset-password`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  const resetText = (await page.textContent("body")) ?? "";
  // Arriving with no token: the honest invalid state must show (not a crash).
  // NOTE: we're still signed in from step 4, so a session exists → form shows.
  if (/Set a new password/i.test(resetText)) ok("reset-password page renders");
  else bad("reset-password page renders", resetText.slice(0, 160));
} catch (e) {
  bad("smoke run", String(e).slice(0, 300));
  await shot("crash");
} finally {
  if (pageErrors.length) bad("zero page JS errors", pageErrors.slice(0, 3).join(" | "));
  else ok("zero page JS errors");
  await browser.close();
}

console.log(fails.length ? `\nSMOKE FAILED: ${fails.join(", ")}` : "\nSMOKE PASSED — all live-site checks green");
process.exit(fails.length ? 1 : 0);
