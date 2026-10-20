import { NextResponse } from "next/server";
import { serverSupabase as supabase } from "@/lib/supabaseServer";

const BOOKING_SAFE_FIELDS = `
  id,
  booking_code,
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
  escrow_status,
  journey_status,
  contract_signed,
  pickup_date,
  start_date,
  return_date,
  created_at
`.replace(/\s+/g, " ").trim();

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Valid authentication token required to access bookings" },
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

    // Determine caller's authoritative profile and role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, operator_name")
      .eq("id", user.id)
      .maybeSingle();

    const callerRole = profile?.role || "traveller";
    const { searchParams } = new URL(req.url);
    const qStatus = searchParams.get("status") || searchParams.get("journey_status");
    const qBookingCode = searchParams.get("booking_code");

    // Case 1: Genuine Platform Administrator
    if (callerRole === "admin") {
      let query = supabase.from("bookings").select(BOOKING_SAFE_FIELDS).order("created_at", { ascending: false });

      const qTravelerId = searchParams.get("traveler_id");
      const qOperatorId = searchParams.get("operator_id");

      if (qTravelerId) {
        query = query.eq("traveler_id", qTravelerId);
      }
      if (qOperatorId) {
        const { data: opQuotes } = await supabase
          .from("quotations")
          .select("id")
          .eq("operator_id", qOperatorId);
        const opQuoteIds = (opQuotes || []).map((q) => q.id);
        if (opQuoteIds.length > 0) {
          query = query.in("quotation_id", opQuoteIds);
        } else {
          return NextResponse.json({ data: [] });
        }
      }
      if (qStatus) {
        query = query.eq("journey_status", qStatus);
      }
      if (qBookingCode) {
        query = query.eq("booking_code", qBookingCode);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data: data || [] });
    }

    // Case 2: Commercial Fleet Operator
    if (callerRole === "operator") {
      // Find all quotations submitted by this authenticated operator
      const { data: opQuotes, error: quotesErr } = await supabase
        .from("quotations")
        .select("id")
        .eq("operator_id", user.id);

      if (quotesErr) {
        return NextResponse.json({ error: quotesErr.message }, { status: 500 });
      }

      const quoteIds = (opQuotes || []).map((q) => q.id);
      const operatorName = profile?.operator_name;

      if (quoteIds.length === 0 && !operatorName) {
        return NextResponse.json({ data: [] });
      }

      let query = supabase.from("bookings").select(BOOKING_SAFE_FIELDS).order("created_at", { ascending: false });

      if (quoteIds.length > 0 && operatorName) {
        query = query.or(`quotation_id.in.(${quoteIds.join(",")}),operator_name.eq."${operatorName}"`);
      } else if (quoteIds.length > 0) {
        query = query.in("quotation_id", quoteIds);
      } else if (operatorName) {
        query = query.eq("operator_name", operatorName);
      }

      if (qStatus) {
        query = query.eq("journey_status", qStatus);
      }
      if (qBookingCode) {
        query = query.eq("booking_code", qBookingCode);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data: data || [] });
    }

    // Case 3: Verified Traveller (Default & Strict Scoping)
    // Caller may NEVER supply someone else's traveler_id to access their records.
    let query = supabase
      .from("bookings")
      .select(BOOKING_SAFE_FIELDS)
      .eq("traveler_id", user.id)
      .order("created_at", { ascending: false });

    if (qStatus) {
      query = query.eq("journey_status", qStatus);
    }
    if (qBookingCode) {
      query = query.eq("booking_code", qBookingCode);
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
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Valid authentication token required to confirm booking" },
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

    const body = await req.json();
    const { trip_request_id, quotation_id } = body;

    if (!trip_request_id || !quotation_id) {
      return NextResponse.json(
        { error: "trip_request_id and quotation_id are required" },
        { status: 400 }
      );
    }

    // Verify the authenticated traveller owns the trip request
    const { data: tripRequest, error: tripErr } = await supabase
      .from("trip_requests")
      .select("id, traveler_id, status")
      .eq("id", trip_request_id)
      .maybeSingle();

    if (tripErr || !tripRequest) {
      return NextResponse.json(
        { error: `Trip request not found: ${trip_request_id}` },
        { status: 404 }
      );
    }

    if (tripRequest.traveler_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to confirm a booking for another traveller's trip request" },
        { status: 403 }
      );
    }

    // Call atomic PostgreSQL confirm_booking_transaction with verified authenticated caller ID
    const { data: rpcBooking, error: rpcErr } = await supabase.rpc("confirm_booking_transaction", {
      p_trip_request_id: trip_request_id,
      p_quotation_id: quotation_id,
      p_caller_id: user.id,
    });

    if (rpcErr) {
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

      const isNotFound = rpcErr.code === "P0002" || (rpcErr.message && rpcErr.message.includes("not found"));

      const statusCode = isConflict ? 409 : (isForbidden ? 403 : (isNotFound ? 404 : 400));

      return NextResponse.json(
        { error: rpcErr.message, code: rpcErr.code },
        { status: statusCode }
      );
    }

    return NextResponse.json({ data: rpcBooking, database_synced: true, atomic: true }, { status: 201 });
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

    if (authCheck.action === "cancel") {
      const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_booking_transaction", {
        p_booking_id: id,
        p_reason: searchParams.get("reason") || "Cancelled via booking management",
        p_caller_id: user.id,
      });

      if (rpcError) {
        const isForbidden = rpcError.code === "42501";
        const isConflict = rpcError.code === "22023" || rpcError.code === "23505";
        return NextResponse.json(
          { error: rpcError.message, code: rpcError.code },
          { status: isForbidden ? 403 : (isConflict ? 409 : 400) }
        );
      }

      return NextResponse.json({
        success: true,
        action: "cancelled",
        message: "Booking successfully cancelled in accordance with platform policy (atomic transaction)",
        data: rpcData,
        transaction_guaranteed: true,
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

    // Transitioning to Cancelled must execute atomic stored procedure public.cancel_booking_transaction(...)
    if (journey_status === "Cancelled") {
      const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_booking_transaction", {
        p_booking_id: id,
        p_reason: reason || "Cancelled via booking status update",
        p_caller_id: user.id,
      });

      if (rpcError) {
        const isForbidden = rpcError.code === "42501";
        const isConflict = rpcError.code === "22023" || rpcError.code === "23505";
        return NextResponse.json(
          { error: rpcError.message, code: rpcError.code },
          { status: isForbidden ? 403 : (isConflict ? 409 : 400) }
        );
      }

      return NextResponse.json({
        data: rpcData,
        success: true,
        message: "Booking successfully transitioned to Cancelled (atomic transaction)",
        transaction_guaranteed: true,
      });
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
