import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tripRequestId = searchParams.get("trip_request_id");
    const operatorId = searchParams.get("operator_id");

    let query = supabase.from("quotations").select("*").order("total_quote", { ascending: true });

    if (tripRequestId) {
      query = query.eq("trip_request_id", tripRequestId);
    }
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
      trip_request_id,
      trip_code,
      operator_id,
      operator_name,
      operator_rating = 4.9,
      reviews_count = 120,
      vehicle_id,
      vehicle_name,
      vehicle_category,
      vehicle_reg,
      vehicle_image,
      model_year = 2023,
      badge,
      base_vehicle_fuel_rate,
      driver_night_allowance,
      tolls_state_permit_taxes,
      travellers_count = 1,
      inclusions = [],
      exclusions = [],
      validity_hours = 48,
      operator_note = "",
    } = body;

    if (!trip_request_id || !operator_id || !vehicle_id) {
      return NextResponse.json(
        { error: "trip_request_id, operator_id, and vehicle_id are required" },
        { status: 400 }
      );
    }

    // Server-side strict numeric calculation (avoiding floating point errors)
    const baseRate = Math.round(Number(base_vehicle_fuel_rate) || 0);
    const driverAllowance = Math.round(Number(driver_night_allowance) || 0);
    const tollsTaxes = Math.round(Number(tolls_state_permit_taxes) || 0);

    const calculatedTotal = baseRate + driverAllowance + tollsTaxes;

    if (calculatedTotal <= 0) {
      return NextResponse.json(
        { error: "Quotation total must be greater than zero" },
        { status: 400 }
      );
    }

    const passengerCount = Math.max(1, Number(travellers_count));
    const perPersonFare = Math.round(calculatedTotal / passengerCount);

    // Verify vehicle ownership and capacity
    try {
      const { data: vehicleRecord } = await supabase
        .from("vehicles")
        .select("id, operator_id, seating_capacity, luggage_capacity, status")
        .eq("id", vehicle_id)
        .maybeSingle();

      if (vehicleRecord) {
        // 1. Authorization & Ownership Check
        if (vehicleRecord.operator_id !== operator_id) {
          return NextResponse.json(
            { error: "Forbidden: You are not authorized to quote using another operator's vehicle" },
            { status: 403 }
          );
        }

        // 2. Capacity Validation Check
        if (vehicleRecord.seating_capacity < passengerCount) {
          return NextResponse.json(
            {
              error: `Vehicle seating capacity (${vehicleRecord.seating_capacity} seats) is insufficient for ${passengerCount} passengers`,
            },
            { status: 400 }
          );
        }
      }
    } catch {
      // Continue if table query fails
    }

    // Prevent duplicate quote for the same vehicle on the same trip
    try {
      const { data: existingQuote } = await supabase
        .from("quotations")
        .select("id")
        .eq("trip_request_id", trip_request_id)
        .eq("vehicle_id", vehicle_id)
        .maybeSingle();

      if (existingQuote) {
        return NextResponse.json(
          { error: "A quotation with this vehicle has already been submitted for this trip" },
          { status: 409 }
        );
      }
    } catch {
      // In case tables are not yet loaded
    }

    let isOperatorVerified = false;
    try {
      const { data: operatorProfile } = await supabase
        .from("profiles")
        .select("verified")
        .eq("id", operator_id)
        .maybeSingle();

      if (operatorProfile && operatorProfile.verified === true) {
        isOperatorVerified = true;
      }
    } catch {
      // Continue
    }

    const assignedBadge = isOperatorVerified
      ? (badge || "Tier-1 Verified Partner")
      : "Pending Verification";

    const quoteId = `quo_${Date.now()}`;
    const newQuotation = {
      id: quoteId,
      trip_request_id,
      trip_code: trip_code || "TRP",
      operator_id,
      operator_name: operator_name || "Commercial Fleet Partner",
      operator_rating: Number(operator_rating),
      reviews_count: Number(reviews_count),
      vehicle_id,
      vehicle_name,
      vehicle_category,
      vehicle_reg,
      vehicle_image: vehicle_image || null,
      model_year: Number(model_year),
      badge: assignedBadge,
      base_vehicle_fuel_rate: baseRate,
      driver_night_allowance: driverAllowance,
      tolls_state_permit_taxes: tollsTaxes,
      total_quote: calculatedTotal,
      per_person_fare: perPersonFare,
      inclusions,
      exclusions,
      validity_hours: Number(validity_hours) || 48,
      operator_note,
      status: "pending",
    };

    const { data, error } = await supabase.from("quotations").insert([newQuotation]).select().single();

    if (error) {
      return NextResponse.json(
        { data: newQuotation, warning: error.message, database_synced: false },
        { status: 201 }
      );
    }

    // Increment quotes_count on trip_requests
    try {
      await supabase.rpc("increment_quotes_count", { target_trip_id: trip_request_id });
    } catch {
      // rpc optional
    }

    return NextResponse.json({ data, database_synced: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
