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

    // Resolve caller identity: prioritize authenticated user token if supplied
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let verifiedCallerId = traveler_id || null;

    if (token) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (!authErr && authData?.user) {
          verifiedCallerId = authData.user.id;
        }
      } catch {
        // Fall back to body traveler_id if auth service unavailable
      }
    }

    // 1. Attempt PostgreSQL atomic booking confirmation transaction if installed
    try {
      const { data: rpcBooking, error: rpcErr } = await supabase.rpc("confirm_booking_transaction", {
        p_trip_request_id: trip_request_id,
        p_quotation_id: quotation_id,
        p_caller_id: verifiedCallerId,
      });

      if (!rpcErr && rpcBooking) {
        return NextResponse.json({ data: rpcBooking, database_synced: true, atomic: true }, { status: 201 });
      }

      // If RPC returned a known business logic or constraint error from PostgreSQL, map to HTTP status
      if (rpcErr && rpcErr.code !== "PGRST202") {
        const isConflict =
          rpcErr.code === "23P01" ||
          rpcErr.code === "23505" ||
          (rpcErr.message && (
            rpcErr.message.includes("already") ||
            rpcErr.message.includes("Overlapping") ||
            rpcErr.message.includes("booked")
          ));

        const isForbidden =
          rpcErr.code === "42501" ||
          (rpcErr.message && (
            rpcErr.message.includes("Forbidden") ||
            rpcErr.message.includes("Unauthorized") ||
            rpcErr.message.includes("verified")
          ));

        return NextResponse.json(
          { error: rpcErr.message, code: rpcErr.code },
          { status: isConflict ? 409 : (isForbidden ? 403 : 400) }
        );
      }
    } catch {
      // Fall through to application-layer mutex lock
    }

    const lockKey = (vehicle_reg || "default_vehicle_lock").trim().toUpperCase();

    return await withVehicleLock(lockKey, async () => {
      // Helper to calculate journey date intervals
      const parseDurationDays = (durationStr?: string): number => {
        if (!durationStr) return 1;
        const match = durationStr.match(/(\d+)\s*(?:days?|d|nights?|n)/i);
        return match ? parseInt(match[1], 10) : 1;
      };

      // Authoritative Data Binding: Look up quotation and trip_request from database
      let authTravelerId = traveler_id || "guest_traveller";
      let authTravelerName = traveler_name || "Traveller";
      let authOperatorName = operator_name || "Commercial Fleet Partner";
      let authVehicleName = vehicle_name || "Commercial Cab";
      let authVehicleReg = (vehicle_reg || "DL 01 TA 0000").trim().toUpperCase();
      let authCircuitTitle = circuit_title || "Group Outstation Journey";
      let authDuration = duration || "1 Day";
      let authTotalAmount = Number(total_amount) || 0;
      let authPerPersonAmount = Number(per_person_amount) || 0;
      let authPickupDate = pickup_date || new Date().toISOString().split("T")[0];

      try {
        // Fetch quotation to get authentic price and vehicle specifications
        const { data: dbQuotation } = await supabase
          .from("quotations")
          .select("*")
          .eq("id", quotation_id)
          .maybeSingle();

        if (!dbQuotation) {
          return NextResponse.json(
            { error: "Quotation record not found in database" },
            { status: 404 }
          );
        }

        if (dbQuotation.status !== "pending") {
          return NextResponse.json(
            { error: `This quotation is no longer available (Status: ${dbQuotation.status})` },
            { status: 409 }
          );
        }
        if (dbQuotation.trip_request_id !== trip_request_id) {
          return NextResponse.json(
            { error: "Quotation does not match the specified trip request" },
            { status: 400 }
          );
        }
        // Bind authoritative server-verified values
        authOperatorName = dbQuotation.operator_name || authOperatorName;
        authVehicleName = dbQuotation.vehicle_name || authVehicleName;
        authVehicleReg = (dbQuotation.vehicle_reg || authVehicleReg).trim().toUpperCase();
        authTotalAmount = Number(dbQuotation.total_quote) || authTotalAmount;
        authPerPersonAmount = Number(dbQuotation.per_person_fare) || authPerPersonAmount;

        // Fetch trip_request to get authentic traveller, dates, and itinerary
        const { data: dbTrip } = await supabase
          .from("trip_requests")
          .select("*")
          .eq("id", trip_request_id)
          .maybeSingle();

        if (!dbTrip) {
          return NextResponse.json(
            { error: "Trip request record not found in database" },
            { status: 404 }
          );
        }

        if (dbTrip.status === "confirmed" || dbTrip.status === "completed") {
          return NextResponse.json(
            { error: `This trip request has already been booked (Status: ${dbTrip.status})` },
            { status: 409 }
          );
        }
        authTravelerId = dbTrip.traveler_id || authTravelerId;
        authTravelerName = dbTrip.traveler_name || authTravelerName;
        authCircuitTitle = dbTrip.circuit_title || authCircuitTitle;
        authPickupDate = dbTrip.start_date || authPickupDate;
        authDuration = dbTrip.duration || authDuration;
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Failed to verify quotation and trip request" },
          { status: 500 }
        );
      }

      // Determine journey start and return dates
      const startStr = authPickupDate;
      const startDateObj = new Date(startStr);
      const tripDays = Math.max(1, parseDurationDays(authDuration));
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
      if (authVehicleReg) {
        try {
          const { data: activeVehicleBookings, error: fetchErr } = await supabase
            .from("bookings")
            .select("id, booking_code, pickup_date, duration, journey_status")
            .eq("vehicle_reg", authVehicleReg)
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
                    error: `Vehicle ${authVehicleReg} is already confirmed for booking ${b.booking_code} spanning ${bStart} to ${bEnd}. Overlapping multi-day reservations are prohibited.`,
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
        traveler_id: authTravelerId,
        traveler_name: authTravelerName,
        operator_name: authOperatorName,
        vehicle_name: authVehicleName,
        vehicle_reg: authVehicleReg,
        circuit_title: authCircuitTitle,
        duration: authDuration || `${tripDays} Day${tripDays > 1 ? "s" : ""}`,
        total_amount: authTotalAmount,
        per_person_amount: authPerPersonAmount,
        escrow_status: "Rate Lock Guaranteed",
        journey_status: "Confirmed",
        contract_signed: true,
        pickup_date: startStr,
      };

      const { data, error } = await supabase.from("bookings").insert([newBooking]).select().single();

      if (error) {
        // Map PostgreSQL exclusion violations and unique constraints to HTTP 409 Conflict
        const isConflict =
          error.code === "23P01" ||
          error.code === "23505" ||
          (error.message && (
            error.message.includes("already confirmed") ||
            error.message.includes("Overlapping") ||
            error.message.includes("unique_trip_booking") ||
            error.message.includes("unique_vehicle_pickup_date")
          ));

        if (isConflict) {
          return NextResponse.json(
            {
              error: error.message || `Vehicle ${authVehicleReg} is already confirmed for another booking during overlapping dates.`,
              code: error.code || "409_CONFLICT",
            },
            { status: 409 }
          );
        }

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

/**
 * Pure authorization and state-machine validator for booking deletion/cancellation operations.
 * Returns { authorized: boolean, statusCode?: number, error?: string, action?: 'cancel' | 'hard_delete' }
 */
function validateBookingDeleteAuth(
  user: { id: string } | null,
  profile: { role?: string; operator_name?: string } | null,
  booking: BookingRecord | null,
  bookingOperatorId?: string | null,
  hardDelete: boolean = false
): { authorized: boolean; statusCode?: number; error?: string; action?: "cancel" | "hard_delete" } {
  if (!user) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Valid authentication session required for booking deletion or cancellation",
    };
  }

  if (!booking) {
    return {
      authorized: false,
      statusCode: 404,
      error: "Booking record not found",
    };
  }

  const isTravelerOwner = booking.traveler_id === user.id;
  const isAssignedOperator =
    (Boolean(bookingOperatorId) && bookingOperatorId === user.id) ||
    (Boolean(profile?.operator_name) && profile?.operator_name === booking.operator_name);
  const isAdmin = profile?.role === "admin";

  if (!isTravelerOwner && !isAssignedOperator && !isAdmin) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: You are not authorized to modify or remove this booking",
    };
  }

  if (hardDelete && !isAdmin) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: Only platform administrators are permitted to perform hard deletion of booking records",
    };
  }

  if (!hardDelete || !isAdmin) {
    if (booking.journey_status === "Completed") {
      return {
        authorized: false,
        statusCode: 409,
        error: "Conflict: Cannot cancel or delete a completed journey",
      };
    }

    if (booking.journey_status === "Cancelled") {
      return {
        authorized: false,
        statusCode: 409,
        error: "Conflict: Booking is already cancelled. Historical records are preserved for audit and compliance.",
      };
    }

    return { authorized: true, action: "cancel" };
  }

  return { authorized: true, action: "hard_delete" };
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Valid authentication token required for booking operations" },
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hard_delete") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "Malformed request: Booking ID is required" },
        { status: 400 }
      );
    }

    // Fetch existing booking
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("id, traveler_id, quotation_id, trip_request_id, operator_name, vehicle_reg, journey_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json(
        { error: "Booking record not found" },
        { status: 404 }
      );
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, operator_name")
      .eq("id", user.id)
      .maybeSingle();

    // Look up assigned operator id from quotation
    let bookingOperatorId: string | null = null;
    if (booking.quotation_id) {
      const { data: qData } = await supabase
        .from("quotations")
        .select("operator_id")
        .eq("id", booking.quotation_id)
        .maybeSingle();
      if (qData) bookingOperatorId = qData.operator_id;
    }

    const authCheck = validateBookingDeleteAuth(user, profile, booking, bookingOperatorId, hardDelete);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.statusCode || 403 }
      );
    }

    // Prefer cancellation workflow over hard deletion
    if (authCheck.action === "cancel") {
      // ATOMIC TRANSACTION FIRST: Attempt PostgreSQL stored procedure public.cancel_booking_transaction(...)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_booking_transaction", {
          p_booking_id: id,
          p_reason: searchParams.get("reason") || "Cancelled via booking management",
          p_caller_id: user.id,
        });

        if (!rpcError && rpcData) {
          return NextResponse.json({
            success: true,
            action: "cancelled",
            message: "Booking successfully cancelled in accordance with platform policy (atomic transaction)",
            data: rpcData,
            transaction_guaranteed: true,
          });
        }
        if (rpcError && rpcError.code === "42501") {
          return NextResponse.json({ error: rpcError.message }, { status: 403 });
        }
        if (rpcError && rpcError.code === "22023") {
          return NextResponse.json({ error: rpcError.message }, { status: 409 });
        }
      } catch {
        // Fallback to application-level mutex when RPC not installed
      }

      const lockKey = (booking.vehicle_reg || id).trim().toUpperCase();
      return await withVehicleLock(lockKey, async () => {
        const { data: updatedBooking, error: cancelErr } = await supabase
          .from("bookings")
          .update({ journey_status: "Cancelled" })
          .eq("id", id)
          .select()
          .single();

        if (cancelErr) {
          return NextResponse.json(
            { error: cancelErr.message, code: cancelErr.code },
            { status: 422 }
          );
        }

        // Cascade reset trip and quote
        try {
          if (booking.trip_request_id) {
            await supabase
              .from("trip_requests")
              .update({ status: "open" })
              .eq("id", booking.trip_request_id)
              .eq("status", "confirmed");
          }
          if (booking.quotation_id) {
            await supabase
              .from("quotations")
              .update({ status: "pending" })
              .eq("id", booking.quotation_id)
              .eq("status", "accepted");
          }
        } catch (cascadeErr) {
          console.warn("Cascade reset error during cancellation:", cascadeErr);
        }

        return NextResponse.json({
          success: true,
          action: "cancelled",
          message: "Booking successfully cancelled in accordance with platform policy",
          data: updatedBooking,
        });
      });
    }

    if (authCheck.action === "hard_delete") {
      const { error: delErr } = await supabase.from("bookings").delete().eq("id", id);
      if (delErr) {
        return NextResponse.json(
          { error: delErr.message, code: delErr.code },
          { status: 422 }
        );
      }
      return NextResponse.json({
        success: true,
        action: "deleted",
        message: "Booking record purged by platform administrator",
      });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

interface BookingAuthContext {
  userId: string;
  role?: string;
  operatorName?: string;
}

interface BookingRecord {
  id: string;
  traveler_id: string;
  quotation_id: string;
  trip_request_id: string;
  operator_name: string;
  vehicle_reg: string;
  journey_status: string;
}

/**
 * Pure authorization and state-machine validator for booking transitions.
 * Returns { authorized: boolean, statusCode?: number, error?: string }
 */
function validateBookingTransitionAuth(
  user: { id: string },
  profile: { role?: string; operator_name?: string } | null,
  booking: BookingRecord,
  targetStatus: string,
  bookingOperatorId?: string | null
): { authorized: boolean; statusCode?: number; error?: string } {
  const validStatuses = ["Confirmed", "Dispatched", "Ongoing", "Completed", "Cancelled"];
  if (!validStatuses.includes(targetStatus)) {
    return {
      authorized: false,
      statusCode: 400,
      error: `Invalid journey_status '${targetStatus}'. Allowed: ${validStatuses.join(", ")}`,
    };
  }

  // Identity checks
  const isTravelerOwner = booking.traveler_id === user.id;
  const isAssignedOperator =
    (Boolean(bookingOperatorId) && bookingOperatorId === user.id) ||
    (Boolean(profile?.operator_name) && profile?.operator_name === booking.operator_name);
  const isAdmin = profile?.role === "admin";

  if (!isTravelerOwner && !isAssignedOperator && !isAdmin) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: You are not authorized to modify this booking",
    };
  }

  // Idempotency & terminal state checks
  if (booking.journey_status === targetStatus) {
    return {
      authorized: false,
      statusCode: 409,
      error: `Booking is already in '${targetStatus}' status`,
    };
  }

  if (booking.journey_status === "Cancelled") {
    return {
      authorized: false,
      statusCode: 409,
      error: "Conflict: Cannot modify a cancelled booking",
    };
  }

  if (booking.journey_status === "Completed") {
    return {
      authorized: false,
      statusCode: 409,
      error: "Conflict: Cannot modify a completed journey",
    };
  }

  // Role-based operational action permissions
  if (targetStatus === "Cancelled") {
    // Both traveler owner, assigned operator, and admin can cancel
    return { authorized: true };
  }

  // Operational status transitions (Dispatched, Ongoing, Completed)
  if (!isAssignedOperator && !isAdmin) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: Only the assigned fleet operator or administrator can update journey dispatch status",
    };
  }

  // State machine sequence rules
  const VALID_NEXT_STATES: Record<string, string[]> = {
    Confirmed: ["Dispatched", "Ongoing", "Cancelled"],
    Dispatched: ["Ongoing", "Cancelled"],
    Ongoing: ["Completed", "Cancelled"],
  };

  const allowedTransitions = VALID_NEXT_STATES[booking.journey_status] || [];
  if (!allowedTransitions.includes(targetStatus)) {
    return {
      authorized: false,
      statusCode: 409,
      error: `Conflict: Invalid status transition from '${booking.journey_status}' to '${targetStatus}'`,
    };
  }

  return { authorized: true };
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Valid authentication token required" },
        { status: 401 }
      );
    }

    // Resolve user identity server-side via Supabase Auth
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

    const body = await req.json();
    const { id, journey_status, reason } = body;

    if (!id || !journey_status) {
      return NextResponse.json(
        { error: "Malformed input: Booking ID and journey_status are required" },
        { status: 400 }
      );
    }

    // Fetch existing booking record
    const { data: existingBooking, error: fetchErr } = await supabase
      .from("bookings")
      .select("id, traveler_id, quotation_id, trip_request_id, operator_name, vehicle_reg, journey_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existingBooking) {
      return NextResponse.json(
        { error: "Booking record not found" },
        { status: 404 }
      );
    }

    // Fetch profile of the authenticated user to verify role & operator name
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, operator_name")
      .eq("id", user.id)
      .maybeSingle();

    // Look up assigned operator id from the quotation
    let bookingOperatorId: string | null = null;
    if (existingBooking.quotation_id) {
      const { data: qData } = await supabase
        .from("quotations")
        .select("operator_id")
        .eq("id", existingBooking.quotation_id)
        .maybeSingle();
      if (qData) bookingOperatorId = qData.operator_id;
    }

    // Server-side authorization & state machine validation
    const authResult = validateBookingTransitionAuth(
      user,
      profile,
      existingBooking,
      journey_status,
      bookingOperatorId
    );

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode || 403 }
      );
    }

    // If transitioning to Cancelled, attempt PostgreSQL stored procedure public.cancel_booking_transaction(...)
    if (journey_status === "Cancelled") {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_booking_transaction", {
          p_booking_id: id,
          p_reason: reason || "Cancelled via booking status update",
          p_caller_id: user.id,
        });

        if (!rpcError && rpcData) {
          return NextResponse.json({
            data: rpcData,
            success: true,
            message: `Booking successfully transitioned to Cancelled (atomic transaction)`,
            transaction_guaranteed: true,
          });
        }
        if (rpcError && rpcError.code === "42501") {
          return NextResponse.json({ error: rpcError.message }, { status: 403 });
        }
        if (rpcError && rpcError.code === "22023") {
          return NextResponse.json({ error: rpcError.message }, { status: 409 });
        }
      } catch {
        // Fallback to application mutex
      }
    }

    // Serialize concurrent booking modifications via vehicle mutex lock
    const lockKey = (existingBooking.vehicle_reg || id).trim().toUpperCase();

    return await withVehicleLock(lockKey, async () => {
      // Re-fetch under lock to guarantee concurrency safety
      const { data: freshBooking } = await supabase
        .from("bookings")
        .select("id, journey_status")
        .eq("id", id)
        .single();

      if (freshBooking && freshBooking.journey_status === journey_status) {
        return NextResponse.json(
          { error: `Conflict: Booking was already transitioned to '${journey_status}'` },
          { status: 409 }
        );
      }

      // Execute update on booking
      const { data: updatedBooking, error: updateErr } = await supabase
        .from("bookings")
        .update({ journey_status })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message, code: updateErr.code },
          { status: 422 }
        );
      }

      // If cancelled, execute cascade cleanup safely and conditionally
      if (journey_status === "Cancelled") {
        try {
          if (existingBooking.trip_request_id) {
            await supabase
              .from("trip_requests")
              .update({ status: "open" })
              .eq("id", existingBooking.trip_request_id)
              .eq("status", "confirmed");
          }
          if (existingBooking.quotation_id) {
            await supabase
              .from("quotations")
              .update({ status: "pending" })
              .eq("id", existingBooking.quotation_id)
              .eq("status", "accepted");
          }
        } catch (cascadeErr) {
          console.warn("Cascade reset error during cancellation:", cascadeErr);
        }
      }

      return NextResponse.json({
        data: updatedBooking,
        success: true,
        message: `Booking successfully transitioned to ${journey_status}`,
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
