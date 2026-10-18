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
      return NextResponse.json({ data: [], warning: error.message }, { status: 200 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// In-memory mutex map to serialize concurrent booking operations for the same vehicle
const vehicleLocks = new Map<string, Promise<void>>();

async function withVehicleLock<T>(vehicleReg: string, fn: () => Promise<T>): Promise<T> {
  const current = vehicleLocks.get(vehicleReg) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  vehicleLocks.set(vehicleReg, current.then(() => next));

  await current;
  try {
    return await fn();
  } finally {
    release!();
    if (vehicleLocks.get(vehicleReg) === next) {
      vehicleLocks.delete(vehicleReg);
    }
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

    const lockKey = (vehicle_reg || "default_vehicle_lock").trim().toUpperCase();

    return await withVehicleLock(lockKey, async () => {
      // Helper to calculate journey date intervals
      const parseDurationDays = (durationStr?: string): number => {
        if (!durationStr) return 1;
        const match = durationStr.match(/(\d+)\s*(?:days?|d|nights?|n)/i);
        return match ? parseInt(match[1], 10) : 1;
      };

      // Determine journey start and return dates
      const startStr = pickup_date || new Date().toISOString().split("T")[0];
      const startDateObj = new Date(startStr);
    const tripDays = Math.max(1, parseDurationDays(duration));
    const returnDateObj = new Date(startDateObj.getTime() + (tripDays - 1) * 86400000);
    const returnStr = returnDateObj.toISOString().split("T")[0];

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

    // Concurrency Check 2: Multi-day overlapping interval check for the same commercial vehicle
    if (vehicle_reg) {
      try {
        const { data: activeVehicleBookings, error: fetchErr } = await supabase
          .from("bookings")
          .select("id, booking_code, pickup_date, duration, journey_status")
          .eq("vehicle_reg", vehicle_reg)
          .neq("journey_status", "Cancelled");

        if (fetchErr) {
          console.warn("Active booking query warning:", fetchErr.message);
        }

        if (activeVehicleBookings && activeVehicleBookings.length > 0) {
          for (const b of activeVehicleBookings) {
            const bStart = b.pickup_date || startStr;
            const bDays = Math.max(1, parseDurationDays(b.duration));
            const bStartObj = new Date(bStart);
            const bEnd = new Date(bStartObj.getTime() + (bDays - 1) * 86400000).toISOString().split("T")[0];

            // Interval overlap condition: (StartA <= EndB) and (EndA >= StartB)
            if (startStr <= bEnd && returnStr >= bStart) {
              return NextResponse.json(
                {
                  error: `Vehicle ${vehicle_reg} is already confirmed for booking ${b.booking_code} spanning ${bStart} to ${bEnd}. Overlapping multi-day reservations are prohibited.`,
                  conflict: {
                    existing_booking: b.booking_code,
                    existing_start: bStart,
                    existing_return: bEnd,
                    requested_start: startStr,
                    requested_return: returnStr,
                  },
                },
                { status: 409 }
              );
            }
          }
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
      duration: duration || `${tripDays} Day${tripDays > 1 ? "s" : ""}`,
      total_amount: Number(total_amount),
      per_person_amount: Number(per_person_amount),
      escrow_status: "Rate Lock Guaranteed",
      journey_status: "Confirmed",
      contract_signed: true,
      pickup_date: startStr,
    };

    const { data, error } = await supabase.from("bookings").insert([newBooking]).select().single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 }
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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const vehicleReg = searchParams.get("vehicle_reg");

    if (id) {
      await supabase.from("bookings").delete().eq("id", id);
      await supabase.from("bookings").update({ journey_status: "Cancelled" }).eq("id", id);
    } else if (vehicleReg) {
      await supabase.from("bookings").delete().eq("vehicle_reg", vehicleReg);
      await supabase.from("bookings").update({ journey_status: "Cancelled" }).eq("vehicle_reg", vehicleReg);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
