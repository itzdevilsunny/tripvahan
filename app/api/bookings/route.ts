import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const travelerId = searchParams.get("traveler_id");

    let query = supabase.from("bookings").select("*").order("created_at", { ascending: false });

    if (travelerId) {
      query = query.eq("traveler_id", travelerId);
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
      trip_request_id,
      quotation_id,
      traveler_id,
      traveler_name,
      operator_name,
      vehicle_name,
      vehicle_reg,
      circuit_title,
      duration,
      total_amount,
      per_person_amount,
      pickup_date,
    } = body;

    if (!trip_request_id || !quotation_id) {
      return NextResponse.json(
        { error: "trip_request_id and quotation_id are required" },
        { status: 400 }
      );
    }

    // Concurrency Check 1: Check if quotation has already been accepted or trip is already booked
    try {
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id, booking_code")
        .eq("trip_request_id", trip_request_id)
        .maybeSingle();

      if (existingBooking) {
        return NextResponse.json(
          {
            error: `This trip request has already been booked (Booking Ref: ${existingBooking.booking_code})`,
          },
          { status: 409 }
        );
      }
    } catch {
      // In case table not yet created
    }

    // Concurrency Check 2: Check if vehicle is already booked for the same pickup date
    if (vehicle_reg && pickup_date) {
      try {
        const { data: conflictingVehicleBooking } = await supabase
          .from("bookings")
          .select("id, booking_code, pickup_date")
          .eq("vehicle_reg", vehicle_reg)
          .eq("pickup_date", pickup_date)
          .maybeSingle();

        if (conflictingVehicleBooking) {
          return NextResponse.json(
            {
              error: `Vehicle ${vehicle_reg} is already confirmed for another booking on ${pickup_date}. Please select another offer.`,
            },
            { status: 409 }
          );
        }
      } catch {
        // Continue if table not yet created
      }
    }

    const bookingCode = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const bookingId = `bk_${Date.now()}`;

    const newBooking = {
      id: bookingId,
      booking_code: bookingCode,
      trip_request_id,
      quotation_id,
      traveler_id: traveler_id || "guest_traveller",
      traveler_name: traveler_name || "Traveller",
      operator_name: operator_name || "Commercial Fleet Partner",
      vehicle_name: vehicle_name || "Commercial Cab",
      vehicle_reg: vehicle_reg || "DL 01 TA 0000",
      circuit_title: circuit_title || "Group Outstation Journey",
      duration: duration || "Multi-day",
      total_amount: Number(total_amount),
      per_person_amount: Number(per_person_amount),
      escrow_status: "Secured in Escrow",
      journey_status: "Confirmed",
      contract_signed: true,
      pickup_date: pickup_date || null,
    };

    const { data, error } = await supabase.from("bookings").insert([newBooking]).select().single();

    if (error) {
      return NextResponse.json(
        { data: newBooking, warning: error.message, database_synced: false },
        { status: 201 }
      );
    }

    // Update quotation status to accepted
    try {
      await supabase.from("quotations").update({ status: "accepted" }).eq("id", quotation_id);
      // Update other quotations for the same trip to declined
      await supabase
        .from("quotations")
        .update({ status: "declined" })
        .eq("trip_request_id", trip_request_id)
        .neq("id", quotation_id);
      // Update trip_requests status to confirmed
      await supabase.from("trip_requests").update({ status: "confirmed" }).eq("id", trip_request_id);
    } catch {
      // Continue
    }

    return NextResponse.json({ data, database_synced: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
