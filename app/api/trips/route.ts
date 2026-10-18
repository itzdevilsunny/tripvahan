import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const travelerId = searchParams.get("traveler_id");
    const status = searchParams.get("status");

    let query = supabase.from("trip_requests").select("*").order("created_at", { ascending: false });

    if (travelerId) {
      query = query.eq("traveler_id", travelerId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      traveler_id,
      traveler_name,
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

    // Server-side validation
    if (!origin || !destination) {
      return NextResponse.json({ error: "Origin and destination are required" }, { status: 400 });
    }

    if (!start_date) {
      return NextResponse.json({ error: "Travel start date is required" }, { status: 400 });
    }

    if (!travellers_count || travellers_count < 1) {
      return NextResponse.json({ error: "At least 1 passenger is required" }, { status: 400 });
    }

    const tripCode = `TRP-${Math.floor(1000 + Math.random() * 9000)}`;
    const tripId = `trp_${Date.now()}`;

    const newTrip = {
      id: tripId,
      trip_code: tripCode,
      traveler_id: traveler_id || "guest_traveller",
      traveler_name: traveler_name || "Traveller",
      circuit_title: circuit_title || `${origin} → ${destination}`,
      origin,
      destination,
      stops,
      circuit_type: circuit_type || "Outstation Trip",
      distance_km: Number(distance_km) || 350,
      start_date,
      end_date: end_date || null,
      duration: duration || "1 Day",
      pickup_time: pickup_time || "06:00 AM",
      pickup_address: pickup_address || origin,
      travellers_count: Number(travellers_count),
      adults_count: Number(adults_count),
      seniors_count: Number(seniors_count),
      luggage_bags: Number(luggage_bags),
      matched_vehicle_class: matched_vehicle_class || "Innova / Tempo Traveller",
      indicative_budget_min: Number(indicative_budget_min) || null,
      indicative_budget_max: Number(indicative_budget_max) || null,
      target_budget: Number(target_budget) || 15000,
      amenities,
      status: "open",
      quotes_count: 0,
    };

    const { data, error } = await supabase.from("trip_requests").insert([newTrip]).select().single();

    if (error) {
      // If table not found or db error, return the validated trip request with notification
      return NextResponse.json(
        { data: newTrip, warning: error.message, database_synced: false },
        { status: 201 }
      );
    }

    return NextResponse.json({ data, database_synced: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
