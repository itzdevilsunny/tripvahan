import { NextResponse } from "next/server";

interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${cleanQuery}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "Tripvahan-TravelApp/1.0",
        },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Great-circle fallback distance in km if OSRM is unreachable
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply by road winding factor ~ 1.25 for highway driving
  return Math.round(R * c * 1.25);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { origin, destination, stops = [] } = body;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origin and destination are required" },
        { status: 400 }
      );
    }

    // Geocode origin and destination
    const originGeo = await geocodeLocation(origin);
    const destGeo = await geocodeLocation(destination);

    if (!originGeo || !destGeo) {
      return NextResponse.json({
        distance_km: null,
        duration_hours: null,
        formatted_duration: null,
        source: "geocoding_unresolved",
        message: "Could not geocode specific addresses accurately. Please verify location names.",
      });
    }

    // Try OSRM routing
    let drivingDistanceKm: number | null = null;
    let drivingDurationHours: number | null = null;

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originGeo.lon},${originGeo.lat};${destGeo.lon},${destGeo.lat}?overview=false`;
      const osrmRes = await fetch(osrmUrl, { next: { revalidate: 3600 } });
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes.length > 0) {
          const route = osrmData.routes[0];
          drivingDistanceKm = Math.round(route.distance / 1000);
          drivingDurationHours = Math.round((route.duration / 3600) * 10) / 10;
        }
      }
    } catch {
      // OSRM down or unreachable
    }

    // Fallback to Haversine road estimation
    if (!drivingDistanceKm) {
      drivingDistanceKm = haversineDistanceKm(
        originGeo.lat,
        originGeo.lon,
        destGeo.lat,
        destGeo.lon
      );
      // Average 60 km/h driving speed
      drivingDurationHours = Math.round((drivingDistanceKm / 60) * 10) / 10;
    }

    const safeDuration = drivingDurationHours ?? (drivingDistanceKm ? drivingDistanceKm / 60 : 4);
    const hours = Math.floor(safeDuration);
    const minutes = Math.round((safeDuration - hours) * 60);
    const formatted_duration = `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`.trim();

    return NextResponse.json({
      distance_km: drivingDistanceKm,
      duration_hours: safeDuration,
      formatted_duration,
      origin_resolved: originGeo.display_name,
      destination_resolved: destGeo.display_name,
      source: "osrm_routing",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to calculate route" },
      { status: 500 }
    );
  }
}
