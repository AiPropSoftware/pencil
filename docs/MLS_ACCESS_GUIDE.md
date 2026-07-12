# Getting real MLS listings into Pencil (Bridge / Trestle)

Pencil's MLS connector (`supabase/functions/listings-mls`) is built and
deployed. It turns on the moment two secrets exist:

```
BRIDGE_TOKEN    — your Bridge Data Output server token
BRIDGE_DATASET  — the dataset slug for the MLS (e.g. "actris")
```

This guide is how you get that token. It's an application process with a
human approval step — typically **1–6 weeks per MLS** — because active
listings are licensed data owned by each regional MLS, not public records.
This is the same gate Zillow and Redfin pass through; there is no legal
shortcut around it.

---

## The one concept that matters: sponsorship

Every MLS requires your data license to be **sponsored by a participating
broker** — a licensed real-estate broker who is a member of that MLS and
signs the agreement alongside you. If you are not a broker, you need one
of:

1. **A partner brokerage** — any broker you know (Developer Launch's
   audience is full of them). They sign as sponsor; common arrangements are
   a small monthly fee, revenue share, or simply being featured in the app.
2. **Your own license** — become an agent, join the local association/MLS,
   then self-sponsor (slow: months).
3. **A "back office / analytics" license** — some MLSs offer non-IDX data
   licenses for analytics tools; still generally needs a member sponsor.

Start asking around for a broker partner **today** — it's the long pole.

---

## Step-by-step: Bridge Data Output (recommended first)

Bridge is owned by Zillow Group and is free to developers (the MLS may
charge its own data fee, typically $0–$100/mo).

1. Go to **bridgedataoutput.com** → *Get started* → create a developer
   account (company = your entity, e.g. "Pencil / AiProp Software").
2. In the dashboard, open the **Data marketplace / MLS list** and request
   access to your target MLS (see table below).
3. The application asks for a **use-case description**. Paste-ready blurb:

   > Pencil is a development-analysis platform for real-estate investors.
   > We display active listings (price, status, days on market, photos,
   > attribution) to authenticated users alongside public-record permit
   > data, so investors can evaluate ground-up development opportunities.
   > Listings are shown with full MLS attribution, refreshed at the
   > required interval, never commingled across MLSs, and never resold.

4. Provide your **sponsoring broker's** name, license #, and brokerage.
   Bridge routes the data license to the MLS for signature/approval.
5. On approval, the dashboard issues a **server token** and shows the
   **dataset slug**. Send both to be wired in (they go in Supabase
   secrets — never in the repo).

## Target-market cheat sheet

| Market | MLS | Typical route |
|---|---|---|
| Austin | Unlock MLS (ACTRIS) | Bridge — slug historically `actris` |
| Miami | MIAMI Association of Realtors | Bridge / MLS's own RESO API |
| Nashville | RealTracs | Trestle (CoreLogic) |
| Chicago | MRED | MLS Grid |
| San Francisco | SFAR / BAREIS | Bridge or direct RESO |
| Seattle | NWMLS | Direct license (restrictive; apply directly) |
| New York | REBNY RLS | Direct (RLS Data Service) |

Platform lineups change — the Bridge dashboard shows the authoritative
list. If a target MLS is on **Trestle** instead: trestle.corelogic.com,
same RESO field names; our connector swaps with a base-URL change.
**MLS Grid** (mlsgrid.com) likewise.

## Costs to expect

- Bridge developer account: **free**
- MLS data license: **$0–$100+/mo per MLS** (varies)
- Trestle: usually **~$50–200/mo per MLS** + possible setup fee
- Broker sponsor: whatever you negotiate

## Compliance notes (what the MLS will check)

- **Attribution**: show listing brokerage name on each listing (the feed
  includes it; UI slot already planned).
- **Refresh**: our 5-minute cycle exceeds every MLS's freshness rule.
- **No commingling**: don't blend two MLSs' listings in one result set
  without both agreements — per-city layers keep this clean.
- **Login-gated display** counts as VOW in some MLSs — say so in the
  application if asked; it's usually *easier* to approve than public IDX.

## While the application runs

- **ATTOM's listing add-on** is a stopgap (thinner than MLS, no real-time
  DOM) — the ATTOM trial key also unlocks real *sold* comps, which feeds
  the sell-side $/sf.
- Permits (already live) keep the construction layer fully real meanwhile.

## Hand-off checklist (what to send back)

1. `BRIDGE_TOKEN` (server token — treat like a password)
2. `BRIDGE_DATASET` slug(s), one per approved MLS
3. Which cities they cover

Wiring time on our side: ~10 minutes per MLS. Listings, real photos, and
true days-on-market then flow straight into the map's Listings layer.
