import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveGeofence } from "@/lib/geofence";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lat, lng } = await req.json().catch(() => ({}));

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const result = await resolveGeofence(supabase, lat, lng);

  return NextResponse.json(result);
}
