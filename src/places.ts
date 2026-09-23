import type { Place } from "./settings";

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  population?: number;
}

const RESULTS = 8;

async function query(name: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({ name, count: "20", language: "ar", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const body = (await res.json()) as { results?: GeoResult[] };
  return body.results ?? [];
}

/**
 * City search through Open-Meteo's free geocoder, answering in Arabic.
 *
 * The geocoder indexes Arabic names inconsistently with and without the
 * article — Egypt's Mansoura is stored as "منصورة", so "المنصورة" only finds
 * the villages of the same name. Both spellings are searched, and the results
 * are ranked by population so the city people mean comes first.
 */
export async function searchPlaces(input: string, signal?: AbortSignal): Promise<Place[]> {
  const q = input.trim();
  if (q.length < 2) return [];

  const variants = [q];
  if (q.startsWith("ال") && q.length > 3) variants.push(q.slice(2));

  const batches = await Promise.all(variants.map((v) => query(v, signal)));
  const seen = new Set<number>();
  const merged: GeoResult[] = [];
  for (const r of batches.flat()) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  merged.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  return merged.slice(0, RESULTS).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join("، "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}
