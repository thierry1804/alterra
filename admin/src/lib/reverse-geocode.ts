interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

/** Nom de ville le plus proche d'un point — via Nominatim (OpenStreetMap), sans clé requise. */
export async function reverseGeocodeCityName(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Échec de la géolocalisation inverse");

  const data = (await response.json()) as NominatimReverseResponse;
  const address = data.address;
  return (
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    address?.state ??
    data.display_name ??
    null
  );
}

export interface GeocodeSearchResult {
  lat: number;
  lng: number;
}

/** Coordonnées du premier résultat pour un nom de lieu — recherche restreinte à Madagascar. */
export async function geocodeLocationText(query: string): Promise<GeocodeSearchResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=mg&limit=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Échec de la recherche de localisation");

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}
