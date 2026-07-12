/**
 * National permit self-discovery — the answer to "cover everything."
 *
 * Thousands of cities/counties publish on two platforms that expose PUBLIC
 * catalog-search APIs (CORS-open, no keys):
 *   - Socrata Discovery  (api.us.socrata.com/api/catalog/v1)
 *   - ArcGIS Online      (www.arcgis.com/sharing/rest/search)
 *
 * When the user searches a place we don't have a curated feed for, this
 * module searches both catalogs for that place's permit datasets, queries
 * the hits through the existing Socrata/ArcGIS normalizers, and returns
 * real pins. Guards: results must reference the searched place (domain/name
 * token match), and returned pins must be geographically coherent (within
 * ~0.7° of their own median) so a same-named town elsewhere can't leak in.
 *
 * Ceiling, stated honestly: towns that publish nothing machine-readable
 * (many sub-10k municipalities) are unreachable by ANY legal automation —
 * that long tail is what commercial aggregators sell.
 */
import type { Development } from "@/data/developments";
import { fetchCityDevelopments, type CitySource } from "./socrata";
import { fetchArcgisCity, type ArcgisCitySource } from "./arcgis";

export interface DiscoveredResult {
  items: Development[];
  sources: string[];
  notes: string[];
}

function placeParts(place: string): { city: string; state: string; token: string } {
  const [rawCity, rawState] = place.split(",").map((s) => s.trim());
  const city = (rawCity ?? place).replace(/\s+/g, " ").trim();
  const state = (rawState ?? "").slice(0, 2).toUpperCase();
  const token = city.toLowerCase().replace(/[^a-z]/g, "");
  return { city, state, token };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Keep only pins consistent with their own median location. */
function coherent(items: Development[]): Development[] {
  if (items.length < 3) return items;
  const lats = items.map((i) => i.lat).sort((a, b) => a - b);
  const lngs = items.map((i) => i.lng).sort((a, b) => a - b);
  const mlat = lats[Math.floor(lats.length / 2)];
  const mlng = lngs[Math.floor(lngs.length / 2)];
  return items.filter((i) => Math.abs(i.lat - mlat) <= 0.7 && Math.abs(i.lng - mlng) <= 0.7);
}

async function searchSocrataCatalog(place: string, notes: string[]): Promise<CitySource[]> {
  const { city, state, token } = placeParts(place);
  const out: CitySource[] = [];
  try {
    const q = encodeURIComponent(`${city} building permits`);
    const res = await fetch(`https://api.us.socrata.com/api/catalog/v1?only=datasets&limit=10&q=${q}`);
    if (!res.ok) { notes.push(`socrata catalog HTTP ${res.status}`); return out; }
    const cat = (await res.json()) as { results?: { resource?: { id?: string; name?: string }; metadata?: { domain?: string } }[] };
    for (const r of cat.results ?? []) {
      const dom = r.metadata?.domain ?? "";
      const id = r.resource?.id ?? "";
      const name = r.resource?.name ?? "";
      if (!dom || !id || !/permit/i.test(name)) continue;
      // Precision guard: dataset must plausibly belong to the searched place.
      const domToken = dom.toLowerCase().replace(/[^a-z]/g, "");
      if (!domToken.includes(token) && !name.toLowerCase().includes(city.toLowerCase())) continue;
      out.push({
        city: titleCase(city), state, url: `https://${dom}/resource/${id}.json`,
        metroPpsf: 380, lat: NaN, lng: NaN, limit: 3000,
      });
      if (out.length >= 3) break;
    }
    if (out.length === 0) notes.push("socrata catalog: no matching permit datasets");
  } catch (e) {
    notes.push(`socrata catalog: ${(e as Error).message}`);
  }
  return out;
}

async function searchArcgisOnline(place: string, notes: string[]): Promise<ArcgisCitySource[]> {
  const { city, state } = placeParts(place);
  const out: ArcgisCitySource[] = [];
  try {
    const q = encodeURIComponent(`"${city}" building permits type:"Feature Service"`);
    const res = await fetch(`https://www.arcgis.com/sharing/rest/search?f=json&num=10&q=${q}`);
    if (!res.ok) { notes.push(`agol search HTTP ${res.status}`); return out; }
    const data = (await res.json()) as { results?: { url?: string; title?: string }[] };
    const layerUrls: string[] = [];
    for (const r of data.results ?? []) {
      if (!r.url || !/FeatureServer/i.test(r.url)) continue;
      if (!/permit/i.test(r.title ?? "")) continue;
      layerUrls.push(`${r.url.replace(/\/$/, "")}/0`);
      if (layerUrls.length >= 3) break;
    }
    if (layerUrls.length === 0) notes.push("agol search: no matching permit layers");
    else out.push({ city: titleCase(city), state, candidates: layerUrls, metroPpsf: 380, lat: NaN, lng: NaN, limit: 2000 });
  } catch (e) {
    notes.push(`agol search: ${(e as Error).message}`);
  }
  return out;
}

export async function discoverCityPermits(place: string): Promise<DiscoveredResult> {
  const notes: string[] = [];
  const sources: string[] = [];
  const items: Development[] = [];

  const [socrataSrcs, arcgisSrcs] = await Promise.all([
    searchSocrataCatalog(place, notes),
    searchArcgisOnline(place, notes),
  ]);

  const fetches = [
    ...socrataSrcs.map((s) => fetchCityDevelopments(s).then((r) => ({ url: s.url, r }))),
    ...arcgisSrcs.map((s) => fetchArcgisCity(s).then((r) => ({ url: s.candidates[0], r }))),
  ];
  const settled = await Promise.allSettled(fetches);
  for (const s of settled) {
    if (s.status !== "fulfilled") { notes.push(String(s.reason)); continue; }
    const { url, r } = s.value;
    if (r.items.length > 0) {
      sources.push(url);
      items.push(...r.items);
    } else if (r.error) {
      notes.push(`${url}: ${r.error.slice(0, 120)}`);
    }
  }

  // Dedupe by id, enforce geographic coherence, cap.
  const seen = new Set<string>();
  const unique = items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  return { items: coherent(unique).slice(0, 300), sources, notes };
}
