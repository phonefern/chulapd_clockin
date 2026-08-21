import type { getSupabaseAdmin } from "./supabaseAdmin";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export type GeofenceResult = {
  allowed: boolean;
  distanceMeters: number | null;
  location: { id: string; name: string } | null;
};

export async function resolveGeofence(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  lat: number,
  lng: number
): Promise<GeofenceResult> {
  const { data: locations, error } = await supabase
    .from("work_locations")
    .select("id, name, latitude, longitude, allowed_radius_meters")
    .eq("active", true);

  if (error) throw error;

  let nearest: (typeof locations)[number] | null = null;
  let nearestDistance = Infinity;

  for (const loc of locations ?? []) {
    const distance = haversineDistanceMeters(lat, lng, loc.latitude, loc.longitude);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = loc;
    }
  }

  return {
    allowed: nearest !== null && nearestDistance <= nearest.allowed_radius_meters,
    distanceMeters: nearest ? Math.round(nearestDistance) : null,
    location: nearest ? { id: nearest.id, name: nearest.name } : null,
  };
}
