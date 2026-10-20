import { NextResponse } from "next/server";
import { serverSupabase as supabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get("operator_id");

    let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });

    if (operatorId) {
      query = query.eq("operator_id", operatorId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ data: [], warning: error.message }, { status: 200 });
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
      operator_id,
      operator_name,
      name,
      category,
      registration_number,
      seating_capacity,
      luggage_capacity,
      model_year,
      features = [],
      compliance_status,
      speed_governor_status,
      image_url,
    } = body;

    if (!operator_id || !name || !registration_number) {
      return NextResponse.json(
        { error: "Operator ID, vehicle name, and registration number are required" },
        { status: 400 }
      );
    }

    const seats = Number(seating_capacity);
    if (!seats || seats < 1) {
      return NextResponse.json(
        { error: "Seating capacity must be at least 1" },
        { status: 400 }
      );
    }

    let isOperatorVerified = false;
    // Verify operator profile exists and verification status
    try {
      const { data: operatorProfile } = await supabase
        .from("profiles")
        .select("id, role, operator_name, verified")
        .eq("id", operator_id)
        .maybeSingle();

      if (!operatorProfile) {
        return NextResponse.json(
          { error: "Operator profile not found. Please complete operator registration first." },
          { status: 404 }
        );
      }
      isOperatorVerified = operatorProfile.verified === true;
    } catch {
      // Continue if table query fails
    }

    const vehicleId = body.id || `veh_${Date.now()}`;
    const newVehicle = {
      id: vehicleId,
      operator_id,
      operator_name: operator_name || "Commercial Fleet Partner",
      name,
      category: category || "Urbania / Tempo",
      registration_number: registration_number.toUpperCase().trim(),
      seating_capacity: seats,
      luggage_capacity: Number(luggage_capacity) || Math.round(seats * 0.8),
      model_year: Number(model_year) || 2023,
      features,
      compliance_status: isOperatorVerified
        ? (compliance_status || "Commercial Yellow Board Valid")
        : "Pending Operator Verification",
      speed_governor_status: speed_governor_status || "Speed-Gov: 80 km/h Active",
      status: isOperatorVerified ? "Available" : "Pending Verification",
      image_url: image_url || null,
    };

    const { data, error } = await supabase.from("vehicles").insert([newVehicle]).select().single();

    if (error) {
      return NextResponse.json(
        { data: newVehicle, warning: error.message, database_synced: false },
        { status: 201 }
      );
    }

    return NextResponse.json({ data, database_synced: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
