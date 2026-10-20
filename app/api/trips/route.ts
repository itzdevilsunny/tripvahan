import { NextResponse } from "next/server";
import { serverSupabase as supabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const travelerId = searchParams.get("traveler_id");
    const status = searchParams.get("status");

    // If querying by specific traveler_id, enforce authentication and tenant isolation
    if (travelerId) {
      const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!token) {
        return NextResponse.json(
          { error: "Unauthorized: Valid authentication token required to access traveller trip records" },
          { status: 401 }
        );
      }

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);

      if (authErr || !user) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or expired authentication session" },
          { status: 401 }
        );
      }

      if (user.id !== travelerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role !== "admin") {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to access another traveller's trip records" },
            { status: 403 }
          );
        }
      }
    }

    let query = supabase.from("trip_requests").select("*").order("created_at", { ascending: false });

    if (travelerId) {
      query = query.eq("traveler_id", travelerId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Valid authentication token required to create trip requests" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired authentication session" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Malformed request payload" }, { status: 400 });
    }

    const {
      traveler_id: clientTravelerId,
      circuit_title,
      origin,
      destination,
      stops = [],
      circuit_type,
      distance_km,
      start_date,
      end_date,
      duration,
      pickup_time,
      pickup_address,
      travellers_count,
      adults_count = 0,
      seniors_count = 0,
      luggage_bags = 0,
      matched_vehicle_class,
      indicative_budget_min,
      indicative_budget_max,
      target_budget,
      amenities = [],
    } = body;

    // Reject attempts to create trips under another user's identity
    if (clientTravelerId && clientTravelerId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot create trip requests on behalf of another user identity" },
        { status: 403 }
      );
    }

    // Server-side field validations
    if (!origin || typeof origin !== "string" || !origin.trim()) {
      return NextResponse.json({ error: "Trip origin is required" }, { status: 400 });
    }

    if (!destination || typeof destination !== "string" || !destination.trim()) {
      return NextResponse.json({ error: "Trip destination is required" }, { status: 400 });
    }

    if (!start_date || isNaN(Date.parse(start_date))) {
      return NextResponse.json({ error: "Valid travel start date is required" }, { status: 400 });
    }

    if (end_date && (isNaN(Date.parse(end_date)) || new Date(end_date) < new Date(start_date))) {
      return NextResponse.json({ error: "Travel end date cannot precede start date" }, { status: 400 });
    }

    const parsedPax = Number(travellers_count);
    if (isNaN(parsedPax) || parsedPax < 1) {
      return NextResponse.json({ error: "At least 1 passenger is required" }, { status: 400 });
    }

    const parsedAdults = Number(adults_count) || 0;
    const parsedSeniors = Number(seniors_count) || 0;
    const parsedBags = Number(luggage_bags) || 0;

    if (parsedAdults < 0 || parsedSeniors < 0 || parsedBags < 0) {
      return NextResponse.json({ error: "Passenger and luggage counts must be non-negative" }, { status: 400 });
    }

    if (target_budget !== undefined && target_budget !== null) {
      const parsedBudget = Number(target_budget);
      if (isNaN(parsedBudget) || parsedBudget <= 0) {
        return NextResponse.json({ error: "Target budget must be a positive number" }, { status: 400 });
      }
    }

    // Resolve authoritative traveller name from profile or metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const authoritativeName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Traveller";

    const tripCode = `TRP-${Math.floor(1000 + Math.random() * 9000)}`;
    const tripId = `trp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const newTrip = {
      id: tripId,
      trip_code: tripCode,
      traveler_id: user.id, // Strictly derived from validated session
      traveler_name: authoritativeName,
      circuit_title: circuit_title?.trim() || `${origin.trim()} → ${destination.trim()}`,
      origin: origin.trim(),
      destination: destination.trim(),
      stops: Array.isArray(stops) ? stops : [],
      circuit_type: circuit_type || "Outstation Trip",
      distance_km: Number(distance_km) || 350,
      start_date,
      end_date: end_date || null,
      duration: duration || "1 Day",
      pickup_time: pickup_time || "06:00 AM",
      pickup_address: pickup_address?.trim() || origin.trim(),
      travellers_count: parsedPax,
      adults_count: parsedAdults,
      seniors_count: parsedSeniors,
      luggage_bags: parsedBags,
      matched_vehicle_class: matched_vehicle_class || "Innova / Tempo Traveller",
      indicative_budget_min: Number(indicative_budget_min) || null,
      indicative_budget_max: Number(indicative_budget_max) || null,
      target_budget: Number(target_budget) || 15000,
      amenities: Array.isArray(amenities) ? amenities : [],
      status: "open",
      quotes_count: 0,
    };

    const { data, error } = await supabase.from("trip_requests").insert([newTrip]).select().single();

    if (error) {
      return NextResponse.json(
        { error: `Database insertion failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, database_synced: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
