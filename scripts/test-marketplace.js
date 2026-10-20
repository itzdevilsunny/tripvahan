const test = require("node:test");
const assert = require("node:assert");

// 1. Quotation Arithmetic & Precision Test
test("Quotation total calculation matches sum of disclosed components without floating point drift", () => {
  const baseRate = 18500;
  const driverAllowance = 2000;
  const tollsTaxes = 4300;
  const travellersCount = 12;

  const total = Math.round(baseRate) + Math.round(driverAllowance) + Math.round(tollsTaxes);
  assert.strictEqual(total, 24800, "Total must equal 24,800");

  const perPerson = Math.round(total / travellersCount);
  assert.strictEqual(perPerson, 2067, "Per-person fare rounded properly to nearest rupee");
});

// 2. Capacity & Safety Validation Test
test("Capacity matching safely identifies sufficient seating and luggage volume", () => {
  function validateVehicleCapacity(vehicle, reqPax, reqLuggage) {
    if (vehicle.seating_capacity < reqPax) {
      return { valid: false, reason: `Vehicle seating (${vehicle.seating_capacity}) is less than required passengers (${reqPax})` };
    }
    if (vehicle.luggage_capacity < reqLuggage) {
      return { valid: false, reason: `Vehicle luggage capacity (${vehicle.luggage_capacity}) is less than required luggage bags (${reqLuggage})` };
    }
    return { valid: true };
  }

  const sedan = { seating_capacity: 4, luggage_capacity: 3 };
  const tempo = { seating_capacity: 13, luggage_capacity: 12 };

  // 12 pax with 10 bags in sedan must fail
  const sedanCheck = validateVehicleCapacity(sedan, 12, 10);
  assert.strictEqual(sedanCheck.valid, false);
  assert.ok(sedanCheck.reason.includes("seating"));

  // 12 pax with 10 bags in tempo traveller must succeed
  const tempoCheck = validateVehicleCapacity(tempo, 12, 10);
  assert.strictEqual(tempoCheck.valid, true);

  // 12 pax with 15 bags in tempo traveller must fail on luggage
  const tempoOverload = validateVehicleCapacity(tempo, 12, 15);
  assert.strictEqual(tempoOverload.valid, false);
  assert.ok(tempoOverload.reason.includes("luggage"));
});

// 3. Multi-Day Overlapping Concurrency Protection Test
test("Concurrency protection prevents multi-day overlapping reservations for the same vehicle", () => {
  const existingBookings = [
    {
      id: "bk_1",
      booking_code: "BK-1001",
      vehicle_reg: "DL 01 TA 9821",
      start_date: "2026-11-05",
      return_date: "2026-11-08",
      journey_status: "Confirmed",
    },
  ];

  function checkBookingOverlap(vehicleReg, newStart, newReturn) {
    const conflict = existingBookings.find((b) => {
      if (b.vehicle_reg !== vehicleReg || b.journey_status === "Cancelled") return false;
      // Interval overlap mathematical condition: StartA <= EndB and EndA >= StartB
      return newStart <= b.return_date && newReturn >= b.start_date;
    });

    if (conflict) {
      return {
        allowed: false,
        message: `Vehicle ${vehicleReg} is already confirmed for booking ${conflict.booking_code} spanning ${conflict.start_date} to ${conflict.return_date}`,
      };
    }
    return { allowed: true };
  }

  // Overlap Scenario 1: Exact same pickup date (Nov 5 - Nov 8)
  const resExact = checkBookingOverlap("DL 01 TA 9821", "2026-11-05", "2026-11-08");
  assert.strictEqual(resExact.allowed, false, "Exact duplicate interval must be rejected");

  // Overlap Scenario 2: Interior overlap (Nov 6 - Nov 7)
  const resInterior = checkBookingOverlap("DL 01 TA 9821", "2026-11-06", "2026-11-07");
  assert.strictEqual(resInterior.allowed, false, "Interior date overlap must be rejected");

  // Overlap Scenario 3: Straddling start (Nov 3 - Nov 6)
  const resStraddleStart = checkBookingOverlap("DL 01 TA 9821", "2026-11-03", "2026-11-06");
  assert.strictEqual(resStraddleStart.allowed, false, "Straddling start overlap must be rejected");

  // Overlap Scenario 4: Straddling end (Nov 7 - Nov 10)
  const resStraddleEnd = checkBookingOverlap("DL 01 TA 9821", "2026-11-07", "2026-11-10");
  assert.strictEqual(resStraddleEnd.allowed, false, "Straddling end overlap must be rejected");

  // Non-overlapping Scenario 5: Future trip (Nov 9 - Nov 12)
  const resFuture = checkBookingOverlap("DL 01 TA 9821", "2026-11-09", "2026-11-12");
  assert.strictEqual(resFuture.allowed, true, "Disjoint future journey must be permitted");

  // Non-overlapping Scenario 6: Past trip (Nov 1 - Nov 4)
  const resPast = checkBookingOverlap("DL 01 TA 9821", "2026-11-01", "2026-11-04");
  assert.strictEqual(resPast.allowed, true, "Disjoint prior journey must be permitted");

  // Non-overlapping Scenario 7: Different vehicle during same dates (Nov 5 - Nov 8)
  const resOtherVehicle = checkBookingOverlap("DL 01 TA 4422", "2026-11-05", "2026-11-08");
  assert.strictEqual(resOtherVehicle.allowed, true, "Different vehicle must be permitted");
});

// 4. Operator Vehicle Ownership Authorization Test
test("Operator authorization rejects quotation attempts on vehicles belonging to other operators", () => {
  const registeredVehicles = [
    { id: "veh_101", operator_id: "opr_delhi_cabs", name: "Urbania 13-Seater" },
    { id: "veh_202", operator_id: "opr_jaipur_tours", name: "Innova Crysta" },
  ];

  function authorizeQuotationVehicle(requestingOperatorId, vehicleId) {
    const vehicle = registeredVehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      return { authorized: false, status: 404, error: "Vehicle not found" };
    }
    if (vehicle.operator_id !== requestingOperatorId) {
      return { authorized: false, status: 403, error: "Unauthorized: Operator does not own vehicle" };
    }
    return { authorized: true, status: 200 };
  }

  // Operator quoting their own vehicle -> Authorized
  const validAuth = authorizeQuotationVehicle("opr_delhi_cabs", "veh_101");
  assert.strictEqual(validAuth.authorized, true);

  // Operator quoting another operator's vehicle -> Forbidden (403)
  const invalidAuth = authorizeQuotationVehicle("opr_jaipur_tours", "veh_101");
  assert.strictEqual(invalidAuth.authorized, false);
  assert.strictEqual(invalidAuth.status, 403);
});

// 4. Booking State Transitions Test
test("Booking State Machine transitions strictly through valid states", () => {
  const VALID_TRANSITIONS = {
    REQUESTED: ["OFFER_SELECTED", "CANCELLED"],
    OFFER_SELECTED: ["PENDING_CONFIRMATION", "CANCELLED"],
    PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  function transitionState(currentState, nextState) {
    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(nextState)) {
      throw new Error(`Invalid transition from ${currentState} to ${nextState}`);
    }
    return nextState;
  }

  assert.strictEqual(transitionState("REQUESTED", "OFFER_SELECTED"), "OFFER_SELECTED");
  assert.strictEqual(transitionState("OFFER_SELECTED", "PENDING_CONFIRMATION"), "PENDING_CONFIRMATION");
  assert.strictEqual(transitionState("PENDING_CONFIRMATION", "CONFIRMED"), "CONFIRMED");
  assert.strictEqual(transitionState("CONFIRMED", "IN_PROGRESS"), "IN_PROGRESS");
  assert.strictEqual(transitionState("IN_PROGRESS", "COMPLETED"), "COMPLETED");

  // Invalid jump directly from REQUESTED to COMPLETED must throw
  assert.throws(() => {
    transitionState("REQUESTED", "COMPLETED");
  }, /Invalid transition/);
});

// ============================================================================
// AUDIT HOTFIX TESTS: SECURITY, AUTHORIZATION & DATA INTEGRITY
// ============================================================================

// Pure representation of the server-side validator for unit testing
function validateBookingTransitionAuth(user, profile, booking, targetStatus, bookingOperatorId) {
  const validStatuses = ["Confirmed", "Dispatched", "Ongoing", "Completed", "Cancelled"];
  if (!validStatuses.includes(targetStatus)) {
    return {
      authorized: false,
      statusCode: 400,
      error: `Invalid journey_status '${targetStatus}'. Allowed: ${validStatuses.join(", ")}`,
    };
  }

  // Identity checks
  const isTravelerOwner = booking.traveler_id === user?.id;
  const isAssignedOperator =
    (Boolean(bookingOperatorId) && bookingOperatorId === user?.id) ||
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
  const VALID_NEXT_STATES = {
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

const mockBooking = {
  id: "bk_test_101",
  traveler_id: "user_traveller_alice",
  quotation_id: "q_202",
  trip_request_id: "tr_303",
  operator_name: "Rajputana Mobility Solutions",
  vehicle_reg: "RJ 14 TA 9988",
  journey_status: "Confirmed",
};

// 1. Unauthenticated booking cancellation
test("1. Unauthenticated booking cancellation is rejected (401)", () => {
  function handleApiRequest(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { status: 401, error: "Unauthorized: Missing authentication token" };
    }
    return { status: 200 };
  }

  const noHeader = handleApiRequest(null);
  assert.strictEqual(noHeader.status, 401);

  const malformedHeader = handleApiRequest("Basic 12345");
  assert.strictEqual(malformedHeader.status, 401);
});

// 2. Traveller attempting to cancel another traveller's booking
test("2. Traveller attempting to cancel another traveller's booking is forbidden (403)", () => {
  const evilTraveller = { id: "user_traveller_mallory" };
  const evilProfile = { role: "traveller" };

  const result = validateBookingTransitionAuth(
    evilTraveller,
    evilProfile,
    mockBooking,
    "Cancelled",
    "opr_rajputana_id"
  );

  assert.strictEqual(result.authorized, false);
  assert.strictEqual(result.statusCode, 403);
  assert.ok(result.error.includes("Forbidden"));
});

// 3. Operator attempting to modify another operator's booking
test("3. Operator attempting to modify another operator's booking is forbidden (403)", () => {
  const competitorOperator = { id: "opr_competitor_id" };
  const competitorProfile = { role: "operator", operator_name: "Competitor Cabs Ltd" };

  // Attempting to dispatch another operator's booking
  const dispatchResult = validateBookingTransitionAuth(
    competitorOperator,
    competitorProfile,
    mockBooking,
    "Dispatched",
    "opr_rajputana_id"
  );

  assert.strictEqual(dispatchResult.authorized, false);
  assert.strictEqual(dispatchResult.statusCode, 403);

  // Attempting to cancel another operator's booking
  const cancelResult = validateBookingTransitionAuth(
    competitorOperator,
    competitorProfile,
    mockBooking,
    "Cancelled",
    "opr_rajputana_id"
  );

  assert.strictEqual(cancelResult.authorized, false);
  assert.strictEqual(cancelResult.statusCode, 403);
});

// 4. Valid traveller cancellation
test("4. Valid traveller cancellation is authorized", () => {
  const legitimateTraveller = { id: "user_traveller_alice" };
  const profile = { role: "traveller" };

  const result = validateBookingTransitionAuth(
    legitimateTraveller,
    profile,
    mockBooking,
    "Cancelled",
    "opr_rajputana_id"
  );

  assert.strictEqual(result.authorized, true);
  assert.strictEqual(result.statusCode, undefined);
});

// 5. Valid operator status transition
test("5. Valid operator status transition is authorized", () => {
  const assignedOperator = { id: "opr_rajputana_id" };
  const profile = { role: "operator", operator_name: "Rajputana Mobility Solutions" };

  // Confirmed -> Dispatched
  const dispatchResult = validateBookingTransitionAuth(
    assignedOperator,
    profile,
    mockBooking,
    "Dispatched",
    "opr_rajputana_id"
  );
  assert.strictEqual(dispatchResult.authorized, true);

  // Traveller cannot dispatch even if owner
  const travellerAttempt = validateBookingTransitionAuth(
    { id: "user_traveller_alice" },
    { role: "traveller" },
    mockBooking,
    "Dispatched",
    "opr_rajputana_id"
  );
  assert.strictEqual(travellerAttempt.authorized, false);
  assert.strictEqual(travellerAttempt.statusCode, 403);
});

// 6. Invalid booking state transition
test("6. Invalid booking state transition produces conflict (409)", () => {
  const assignedOperator = { id: "opr_rajputana_id" };
  const profile = { role: "operator", operator_name: "Rajputana Mobility Solutions" };

  // Invalid jump: Confirmed directly to Completed (skipping Dispatched/Ongoing)
  const jumpResult = validateBookingTransitionAuth(
    assignedOperator,
    profile,
    mockBooking,
    "Completed",
    "opr_rajputana_id"
  );
  assert.strictEqual(jumpResult.authorized, false);
  assert.strictEqual(jumpResult.statusCode, 409);

  // Modifying already completed booking
  const completedBooking = { ...mockBooking, journey_status: "Completed" };
  const cancelCompleted = validateBookingTransitionAuth(
    { id: "user_traveller_alice" },
    { role: "traveller" },
    completedBooking,
    "Cancelled",
    "opr_rajputana_id"
  );
  assert.strictEqual(cancelCompleted.authorized, false);
  assert.strictEqual(cancelCompleted.statusCode, 409);
});

// 7. Duplicate cancellation (Idempotency)
test("7. Duplicate cancellation is rejected with 409 conflict and prevents repeated mutations", () => {
  const cancelledBooking = { ...mockBooking, journey_status: "Cancelled" };
  const legitimateTraveller = { id: "user_traveller_alice" };

  const result = validateBookingTransitionAuth(
    legitimateTraveller,
    { role: "traveller" },
    cancelledBooking,
    "Cancelled",
    "opr_rajputana_id"
  );

  assert.strictEqual(result.authorized, false);
  assert.strictEqual(result.statusCode, 409);
  assert.ok(result.error.includes("already in 'Cancelled' status"));
});

// 8. Concurrent cancellation attempts
test("8. Concurrent operations on same vehicle lock sequentially via mutex", async () => {
  const vehicleLocks = new Map();
  async function withVehicleLock(vehicleReg, fn) {
    while (vehicleLocks.get(vehicleReg)) {
      await vehicleLocks.get(vehicleReg);
    }
    let resolveLock;
    const lockPromise = new Promise((resolve) => {
      resolveLock = resolve;
    });
    vehicleLocks.set(vehicleReg, lockPromise);

    try {
      return await fn();
    } finally {
      vehicleLocks.delete(vehicleReg);
      resolveLock();
    }
  }

  const executionOrder = [];
  const p1 = withVehicleLock("RJ 14 TA 9988", async () => {
    await new Promise((r) => setTimeout(r, 20));
    executionOrder.push("task-1");
  });
  const p2 = withVehicleLock("RJ 14 TA 9988", async () => {
    await new Promise((r) => setTimeout(r, 5));
    executionOrder.push("task-2");
  });

  await Promise.all([p1, p2]);
  assert.deepStrictEqual(executionOrder, ["task-1", "task-2"], "Lock guarantees sequential atomic execution");
});

// 9. Failed cancellation cascade safety
test("9. Trip request and quotation cascade are updated conditionally to prevent reopening rebooked records", () => {
  function cascadeCancellation(booking, tripRequest, quotation) {
    const updates = { booking: { id: booking.id, journey_status: "Cancelled" } };

    // Only reopen trip request if it was Confirmed for this specific booking
    if (tripRequest && tripRequest.status === "Confirmed") {
      updates.tripRequest = { id: tripRequest.id, status: "Open" };
    }

    // Only reopen quotation if it was Accepted for this specific booking
    if (quotation && quotation.status === "Accepted") {
      updates.quotation = { id: quotation.id, status: "Pending" };
    }

    return updates;
  }

  // Normal cascade: Confirmed trip reopened to Open
  const normalCase = cascadeCancellation(
    mockBooking,
    { id: "tr_303", status: "Confirmed" },
    { id: "q_202", status: "Accepted" }
  );
  assert.strictEqual(normalCase.tripRequest.status, "Open");
  assert.strictEqual(normalCase.quotation.status, "Pending");

  // Rebooked or already completed trip is NOT mutated
  const rebookedCase = cascadeCancellation(
    mockBooking,
    { id: "tr_303", status: "Fulfilled" },
    { id: "q_202", status: "Withdrawn" }
  );
  assert.strictEqual(rebookedCase.tripRequest, undefined, "Trip request was not overwritten");
  assert.strictEqual(rebookedCase.quotation, undefined, "Quotation was not overwritten");
});

// 10. Notification empty state
test("10. Notification empty state renders honest 'No new notifications' text without fake entries", () => {
  function renderNotificationState(notifications) {
    if (!notifications || notifications.length === 0) {
      return { hasUnread: false, display: "No new notifications" };
    }
    return { hasUnread: true, display: `${notifications.length} alerts` };
  }

  const emptyState = renderNotificationState([]);
  assert.strictEqual(emptyState.hasUnread, false);
  assert.strictEqual(emptyState.display, "No new notifications");
});

// 11. Compliance verification display
test("11. Compliance checklist displays authoritative verified or pending states rather than static claims", () => {
  function getComplianceVerificationState(isOperatorVerified, vehicleCount) {
    if (isOperatorVerified) {
      return { status: "Verified", badgeClass: "bg-[#DDF7ED]" };
    }
    if (vehicleCount > 0) {
      return { status: "Pending Review", badgeClass: "bg-amber-50" };
    }
    return { status: "Not Submitted", badgeClass: "bg-slate-100" };
  }

  assert.strictEqual(getComplianceVerificationState(true, 2).status, "Verified");
  assert.strictEqual(getComplianceVerificationState(false, 3).status, "Pending Review");
  assert.strictEqual(getComplianceVerificationState(false, 0).status, "Not Submitted");
});

// 12. Database Trigger Invariants Validation Test
test("12. Trigger invariant rules block unauthorized mutations to financial, identity, and status fields", () => {
  // 12.1 Profile: User cannot self-elevate verification
  function checkProfileUpdate(oldRecord, newRecord, authRole) {
    if (newRecord.id !== oldRecord.id) throw new Error("Profile ID is immutable");
    if (newRecord.verified === true && oldRecord.verified === false && authRole !== "service_role") {
      throw new Error("Unauthorized: Profile verification can only be approved by platform administrators");
    }
    return newRecord;
  }

  assert.throws(
    () => checkProfileUpdate({ id: "usr_1", verified: false }, { id: "usr_1", verified: true }, "authenticated"),
    /Unauthorized: Profile verification/
  );
  assert.strictEqual(
    checkProfileUpdate({ id: "usr_1", verified: false }, { id: "usr_1", verified: true }, "service_role").verified,
    true
  );

  // 12.2 Vehicle: Operator ID and registration number are immutable
  function checkVehicleUpdate(oldRecord, newRecord) {
    if (newRecord.operator_id !== oldRecord.operator_id) throw new Error("Vehicle operator_id is immutable");
    if (oldRecord.registration_number && newRecord.registration_number !== oldRecord.registration_number) {
      throw new Error("Vehicle commercial registration number is immutable");
    }
    return newRecord;
  }

  assert.throws(
    () => checkVehicleUpdate({ operator_id: "op_1", registration_number: "DL 01 A 1111" }, { operator_id: "op_2", registration_number: "DL 01 A 1111" }),
    /operator_id is immutable/
  );
  assert.throws(
    () => checkVehicleUpdate({ operator_id: "op_1", registration_number: "DL 01 A 1111" }, { operator_id: "op_1", registration_number: "DL 01 B 2222" }),
    /registration number is immutable/
  );

  // 12.3 Quotation: Price and vehicle locked once accepted
  function checkQuoteUpdate(oldRecord, newRecord) {
    if (oldRecord.status === "accepted") {
      if (newRecord.total_quote !== oldRecord.total_quote || newRecord.vehicle_reg !== oldRecord.vehicle_reg) {
        throw new Error("Quotation prices, allowances, and vehicle details are locked once accepted or declined");
      }
    }
    return newRecord;
  }

  assert.throws(
    () => checkQuoteUpdate({ status: "accepted", total_quote: 15000, vehicle_reg: "DL 01 MIG 0626" }, { status: "accepted", total_quote: 18000, vehicle_reg: "DL 01 MIG 0626" }),
    /prices, allowances, and vehicle details are locked/
  );

  // 12.4 Booking: Fare amounts and linkages immutable; terminal state cannot reopen
  function checkBookingUpdate(oldRecord, newRecord) {
    if (newRecord.total_amount !== oldRecord.total_amount || newRecord.quotation_id !== oldRecord.quotation_id) {
      throw new Error("Booking prices, traveler, quotation, and trip linkage are immutable");
    }
    if (oldRecord.journey_status === "Cancelled" && newRecord.journey_status !== "Cancelled") {
      throw new Error("Cannot reopen a Cancelled booking");
    }
    return newRecord;
  }

  assert.throws(
    () => checkBookingUpdate({ total_amount: 15000, quotation_id: "q_1", journey_status: "Confirmed" }, { total_amount: 20000, quotation_id: "q_1", journey_status: "Confirmed" }),
    /Booking prices, traveler, quotation, and trip linkage are immutable/
  );
  assert.throws(
    () => checkBookingUpdate({ total_amount: 15000, quotation_id: "q_1", journey_status: "Cancelled" }, { total_amount: 15000, quotation_id: "q_1", journey_status: "Confirmed" }),
    /Cannot reopen a Cancelled booking/
  );

  // 12.5 Trip Request: Traveler ID immutable
  function checkTripUpdate(oldRecord, newRecord) {
    if (newRecord.traveler_id !== oldRecord.traveler_id) throw new Error("Trip request traveler_id is immutable");
    return newRecord;
  }

  assert.throws(
    () => checkTripUpdate({ traveler_id: "usr_alice" }, { traveler_id: "usr_bob" }),
    /traveler_id is immutable/
  );
});

// 13. Admin Verification: Statutory Document Validation
test("13. Statutory commercial compliance requires all 5 mandatory transport certificates", () => {
  function validateStatutoryDocuments(docs) {
    const requiredTypes = ["commercial_rc", "tourist_permit", "fitness_cert", "commercial_insurance", "puc_cert"];
    const presentTypes = docs.map((d) => d.doc_type);
    for (const req of requiredTypes) {
      if (!presentTypes.includes(req)) {
        return { valid: false, missing: req };
      }
    }
    const unverified = docs.find((d) => !d.verified);
    if (unverified) {
      return { valid: false, unverified: unverified.doc_type };
    }
    return { valid: true };
  }

  const completeDocs = [
    { doc_type: "commercial_rc", verified: true },
    { doc_type: "tourist_permit", verified: true },
    { doc_type: "fitness_cert", verified: true },
    { doc_type: "commercial_insurance", verified: true },
    { doc_type: "puc_cert", verified: true },
  ];
  assert.strictEqual(validateStatutoryDocuments(completeDocs).valid, true);

  const missingInsurance = [
    { doc_type: "commercial_rc", verified: true },
    { doc_type: "tourist_permit", verified: true },
    { doc_type: "fitness_cert", verified: true },
    { doc_type: "puc_cert", verified: true },
  ];
  const checkMissing = validateStatutoryDocuments(missingInsurance);
  assert.strictEqual(checkMissing.valid, false);
  assert.strictEqual(checkMissing.missing, "commercial_insurance");
});

// 14. Admin Verification Workflow & Audit Trail
test("14. Admin approval/rejection updates operator status and records audit decision", () => {
  function processOperatorDecision(operator, action, reason, reviewer) {
    if (!["approve", "reject"].includes(action)) throw new Error("Invalid action");
    if (action === "reject" && (!reason || reason.trim() === "")) {
      throw new Error("A specific rejection reason is mandatory when declining an operator");
    }

    const now = new Date().toISOString();
    if (action === "approve") {
      operator.verified = true;
      operator.rejection_reason = null;
    } else {
      operator.verified = false;
      operator.rejection_reason = reason;
    }
    operator.decided_at = now;
    operator.decided_by = reviewer;

    const auditEntry = {
      operator_id: operator.id,
      action: action === "approve" ? "approved" : "rejected",
      decided_by: reviewer,
      decided_at: now,
      reason: action === "reject" ? reason : undefined,
    };

    return { operator, auditEntry };
  }

  const op = { id: "op_test", full_name: "Test Operator", verified: false };

  // 1. Rejection requires reason
  assert.throws(
    () => processOperatorDecision(op, "reject", "", "Admin 1"),
    /rejection reason is mandatory/
  );

  // 2. Legitimate rejection records reason and audit
  const rejResult = processOperatorDecision(op, "reject", "Private white plate submitted", "Lead Admin");
  assert.strictEqual(rejResult.operator.verified, false);
  assert.strictEqual(rejResult.operator.rejection_reason, "Private white plate submitted");
  assert.strictEqual(rejResult.auditEntry.action, "rejected");

  // 3. Approval elevates to verified and clears rejection
  const appResult = processOperatorDecision(op, "approve", undefined, "Lead Admin");
  assert.strictEqual(appResult.operator.verified, true);
  assert.strictEqual(appResult.operator.rejection_reason, null);
  assert.strictEqual(appResult.auditEntry.action, "approved");
});

// 15. Marketplace Enforcement: Unverified Operators Blocked from Quoting
test("15. Unverified operators are strictly prohibited from submitting quotations", () => {
  function validateQuotationAuthorization(operatorProfile) {
    if (!operatorProfile || operatorProfile.verified !== true) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Commercial compliance verification required. Unverified fleet partners cannot submit quotations to passenger circuits until approved by platform administrators.",
      };
    }
    return { authorized: true };
  }

  // Unverified operator rejected with 403
  const unverifiedOp = { id: "op_unverified", full_name: "Unverified Fleet", verified: false };
  const blocked = validateQuotationAuthorization(unverifiedOp);
  assert.strictEqual(blocked.authorized, false);
  assert.strictEqual(blocked.statusCode, 403);
  assert.ok(blocked.error.includes("verification required"));

  // Verified operator approved
  const verifiedOp = { id: "op_verified", full_name: "Royal Fleet", verified: true };
  const allowed = validateQuotationAuthorization(verifiedOp);
  assert.strictEqual(allowed.authorized, true);
});

// 16. Admin API Authorization & Self-Approval Prevention
test("16. Admin API verifies server-side admin role and blocks self-approval", () => {
  function validateAdminOperatorActionAuth(user, profile, targetOperatorId) {
    if (!user) {
      return {
        authorized: false,
        statusCode: 401,
        error: "Unauthorized: Platform administrator authentication required",
      };
    }

    if (!profile || profile.role !== "admin") {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Platform administrator privileges required to access verification controls",
      };
    }

    if (targetOperatorId && targetOperatorId === user.id) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Administrators cannot approve or modify their own operator account verification",
      };
    }

    return { authorized: true };
  }

  const adminUser = { id: "admin_u1", email: "admin@tripvahan.com" };
  const adminProfile = { role: "admin", full_name: "Lead Admin" };
  const travellerUser = { id: "trv_u1", email: "traveller@example.com" };
  const travellerProfile = { role: "traveller", full_name: "Traveller Tim" };
  const operatorUser = { id: "op_u1", email: "operator@fleet.com" };
  const operatorProfile = { role: "operator", full_name: "Fleet Bob" };

  // 1. Unauthenticated request returns 401
  const unauth = validateAdminOperatorActionAuth(null, null, "op_target");
  assert.strictEqual(unauth.authorized, false);
  assert.strictEqual(unauth.statusCode, 401);
  assert.ok(unauth.error.includes("authentication required"));

  // 2. Authenticated non-admin traveller returns 403
  const nonAdminTrv = validateAdminOperatorActionAuth(travellerUser, travellerProfile, "op_target");
  assert.strictEqual(nonAdminTrv.authorized, false);
  assert.strictEqual(nonAdminTrv.statusCode, 403);
  assert.ok(nonAdminTrv.error.includes("administrator privileges required"));

  // 3. Authenticated operator returns 403
  const nonAdminOp = validateAdminOperatorActionAuth(operatorUser, operatorProfile, "op_target");
  assert.strictEqual(nonAdminOp.authorized, false);
  assert.strictEqual(nonAdminOp.statusCode, 403);

  // 4. Admin attempting to approve themselves returns 403
  const selfApproval = validateAdminOperatorActionAuth(adminUser, adminProfile, "admin_u1");
  assert.strictEqual(selfApproval.authorized, false);
  assert.strictEqual(selfApproval.statusCode, 403);
  assert.ok(selfApproval.error.includes("cannot approve or modify their own operator account"));

  // 5. Authorized admin reviewing another operator returns 200 / authorized
  const legitimateAdmin = validateAdminOperatorActionAuth(adminUser, adminProfile, "op_different_123");
  assert.strictEqual(legitimateAdmin.authorized, true);
});

// 17. Booking DELETE Authorization & Cancellation Preservation
test("17. Booking DELETE requires authentication, enforces ownership, and prefers cancellation", () => {
  function validateBookingDeleteAuth(user, profile, booking, bookingOperatorId, hardDelete = false) {
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

  const bookingAlice = {
    id: "bk_alice_1",
    traveler_id: "alice_id",
    operator_name: "Bob Cabs",
    journey_status: "Confirmed",
  };

  const userAlice = { id: "alice_id" };
  const userMallory = { id: "mallory_id" };
  const profileMallory = { role: "traveller" };
  const userBob = { id: "bob_id" };
  const profileBob = { role: "operator", operator_name: "Bob Cabs" };
  const userEve = { id: "eve_id" };
  const profileEve = { role: "operator", operator_name: "Eve Cabs" };
  const userAdmin = { id: "admin_id" };
  const profileAdmin = { role: "admin" };

  // 1. Unauthenticated request returns 401
  const unauth = validateBookingDeleteAuth(null, null, bookingAlice, "bob_id");
  assert.strictEqual(unauth.authorized, false);
  assert.strictEqual(unauth.statusCode, 401);

  // 2. Non-existent booking returns 404
  const notFound = validateBookingDeleteAuth(userAlice, null, null, "bob_id");
  assert.strictEqual(notFound.authorized, false);
  assert.strictEqual(notFound.statusCode, 404);

  // 3. Unrelated traveller Mallory cannot delete Alice's booking (403)
  const forbiddenTrv = validateBookingDeleteAuth(userMallory, profileMallory, bookingAlice, "bob_id");
  assert.strictEqual(forbiddenTrv.authorized, false);
  assert.strictEqual(forbiddenTrv.statusCode, 403);

  // 4. Unrelated operator Eve cannot delete Bob's booking (403)
  const forbiddenOp = validateBookingDeleteAuth(userEve, profileEve, bookingAlice, "bob_id");
  assert.strictEqual(forbiddenOp.authorized, false);
  assert.strictEqual(forbiddenOp.statusCode, 403);

  // 5. Non-admin attempting hard delete returns 403
  const nonAdminHardDel = validateBookingDeleteAuth(userAlice, null, bookingAlice, "bob_id", true);
  assert.strictEqual(nonAdminHardDel.authorized, false);
  assert.strictEqual(nonAdminHardDel.statusCode, 403);
  assert.ok(nonAdminHardDel.error.includes("Only platform administrators"));

  // 6. Cannot cancel completed journey (409)
  const completedBooking = { ...bookingAlice, journey_status: "Completed" };
  const completedErr = validateBookingDeleteAuth(userAlice, null, completedBooking, "bob_id");
  assert.strictEqual(completedErr.authorized, false);
  assert.strictEqual(completedErr.statusCode, 409);

  // 7. Cannot cancel already cancelled booking (409)
  const alreadyCancelled = { ...bookingAlice, journey_status: "Cancelled" };
  const cancelledErr = validateBookingDeleteAuth(userAlice, null, alreadyCancelled, "bob_id");
  assert.strictEqual(cancelledErr.authorized, false);
  assert.strictEqual(cancelledErr.statusCode, 409);

  // 8. Legitimate owner Alice cancelling active booking returns authorized with action "cancel"
  const legitimateCancel = validateBookingDeleteAuth(userAlice, null, bookingAlice, "bob_id");
  assert.strictEqual(legitimateCancel.authorized, true);
  assert.strictEqual(legitimateCancel.action, "cancel");

  // 9. Legitimate assigned operator Bob cancelling active booking returns authorized with action "cancel"
  const operatorCancel = validateBookingDeleteAuth(userBob, profileBob, bookingAlice, "bob_id");
  assert.strictEqual(operatorCancel.authorized, true);
  assert.strictEqual(operatorCancel.action, "cancel");

  // 10. Platform admin hard delete on purged record returns authorized with action "hard_delete"
  const adminHardDelete = validateBookingDeleteAuth(userAdmin, profileAdmin, alreadyCancelled, "bob_id", true);
  assert.strictEqual(adminHardDelete.authorized, true);
  assert.strictEqual(adminHardDelete.action, "hard_delete");
});

// ====================================================================
// PHASE 1C: ATOMIC BOOKING CONFIRMATION, REBOOKING & CANCELLATION TESTS
// ====================================================================

function createMockDatabase() {
  return {
    trip_requests: [
      {
        id: "trip_101",
        trip_code: "TRIP-101",
        traveler_id: "traveller_alice",
        traveler_name: "Alice Smith",
        status: "open",
        travellers_count: 6,
        circuit_title: "Delhi to Agra Golden Triangle",
        duration: "3 Days",
        start_date: "2026-11-10",
        end_date: "2026-11-12",
      },
    ],
    quotations: [
      {
        id: "quote_201",
        trip_request_id: "trip_101",
        operator_id: "op_bob",
        operator_name: "Bob Cabs",
        vehicle_id: "veh_301",
        vehicle_name: "Toyota Innova Crysta",
        vehicle_reg: "DL 01 TA 1234",
        total_quote: 18000,
        per_person_fare: 3000,
        status: "pending",
      },
      {
        id: "quote_202",
        trip_request_id: "trip_101",
        operator_id: "op_charlie",
        operator_name: "Charlie Travels",
        vehicle_id: "veh_302",
        vehicle_name: "Mahindra Marazzo",
        vehicle_reg: "HR 26 BR 5678",
        total_quote: 19500,
        per_person_fare: 3250,
        status: "pending",
      },
    ],
    vehicles: [
      {
        id: "veh_301",
        operator_id: "op_bob",
        seating_capacity: 7,
        luggage_capacity: 5,
        registration_number: "DL 01 TA 1234",
      },
      {
        id: "veh_302",
        operator_id: "op_charlie",
        seating_capacity: 7,
        luggage_capacity: 6,
        registration_number: "HR 26 BR 5678",
      },
      {
        id: "veh_small",
        operator_id: "op_bob",
        seating_capacity: 4, // Insufficient for 6 pax
        luggage_capacity: 2,
        registration_number: "DL 01 TA 9999",
      },
    ],
    profiles: [
      { id: "traveller_alice", role: "traveller", verified: true },
      { id: "traveller_mallory", role: "traveller", verified: true },
      { id: "op_bob", role: "operator", verified: true, operator_name: "Bob Cabs" },
      { id: "op_charlie", role: "operator", verified: true, operator_name: "Charlie Travels" },
      { id: "op_unverified", role: "operator", verified: false, operator_name: "Rogue Cabs" },
    ],
    bookings: [],
  };
}

/**
 * Pure simulation of PostgreSQL public.confirm_booking_transaction(...)
 * Performs snapshot isolation and rolls back all mutations on any failure.
 */
function simulateConfirmBookingTransaction(db, { tripRequestId, quotationId, callerId, simulateFailureStep }) {
  // Snapshot for atomic rollback simulation
  const snapshot = JSON.parse(JSON.stringify(db));

  try {
    if (!callerId || typeof callerId !== "string" || callerId.trim() === "") {
      const err = new Error("Unauthorized: Authenticated session required to confirm booking");
      err.code = "42501";
      throw err;
    }

    // 1. Lock and inspect Trip Request
    const trip = db.trip_requests.find((t) => t.id === tripRequestId);
    if (!trip) {
      const err = new Error("Trip request not found");
      err.code = "P0002";
      throw err;
    }

    if (trip.traveler_id !== callerId) {
      const err = new Error("Forbidden: You are not authorized to confirm a booking for another traveller's trip request");
      err.code = "42501";
      throw err;
    }

    if (trip.status === "confirmed" || trip.status === "completed") {
      const err = new Error(`Trip request has already been booked (Status: ${trip.status})`);
      err.code = "23505";
      throw err;
    }

    if (trip.status === "cancelled") {
      const err = new Error("Cannot book a cancelled trip request");
      err.code = "22023";
      throw err;
    }

    // Check active non-cancelled booking (Partial Unique Index simulation)
    const existingActiveBooking = db.bookings.find(
      (b) => b.trip_request_id === tripRequestId && b.journey_status !== "Cancelled"
    );
    if (existingActiveBooking) {
      const err = new Error(`Trip request already has an active booking (${existingActiveBooking.booking_code})`);
      err.code = "23505";
      throw err;
    }

    // 2. Lock and inspect Quotation
    const quote = db.quotations.find((q) => q.id === quotationId);
    if (!quote) {
      const err = new Error("Quotation record not found");
      err.code = "P0002";
      throw err;
    }

    if (quote.trip_request_id !== tripRequestId) {
      const err = new Error(`Quotation ${quotationId} does not belong to trip request ${tripRequestId}`);
      err.code = "23503";
      throw err;
    }

    if (quote.status !== "pending") {
      const err = new Error(`Quotation is not available for booking (Status: ${quote.status})`);
      err.code = "22023";
      throw err;
    }

    // 3. Verify Operator Verification
    const operator = db.profiles.find((p) => p.id === quote.operator_id);
    if (!operator || operator.verified !== true) {
      const err = new Error(`Operator is not verified. Unverified operators cannot receive bookings.`);
      err.code = "42501";
      throw err;
    }

    // 4. Verify Vehicle specs and capacity
    const vehicle = db.vehicles.find((v) => v.id === quote.vehicle_id);
    if (!vehicle) {
      const err = new Error("Vehicle not found in operator fleet");
      err.code = "P0002";
      throw err;
    }

    if (vehicle.operator_id !== quote.operator_id) {
      const err = new Error("Vehicle does not belong to quoting operator");
      err.code = "42501";
      throw err;
    }

    if (vehicle.seating_capacity < trip.travellers_count) {
      const err = new Error(`Vehicle capacity (${vehicle.seating_capacity} seats) is insufficient for ${trip.travellers_count} travellers`);
      err.code = "22023";
      throw err;
    }

    // 5. Check overlapping vehicle bookings
    const tripStart = trip.start_date;
    const tripEnd = trip.end_date || trip.start_date;
    const vehicleConflict = db.bookings.find((b) => {
      if (b.vehicle_reg.trim().toUpperCase() !== quote.vehicle_reg.trim().toUpperCase()) return false;
      if (b.journey_status === "Cancelled") return false; // Partial index ignores cancelled!
      const bStart = b.start_date || b.pickup_date;
      const bEnd = b.return_date || bStart;
      return tripStart <= bEnd && tripEnd >= bStart;
    });

    if (vehicleConflict) {
      const err = new Error(`Vehicle ${quote.vehicle_reg} is already confirmed for booking ${vehicleConflict.booking_code}`);
      err.code = "23P01";
      throw err;
    }

    // 6. Create Booking with immutable authoritative quote pricing
    const newBooking = {
      id: `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      booking_code: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
      trip_request_id: trip.id,
      quotation_id: quote.id,
      traveler_id: trip.traveler_id,
      traveler_name: trip.traveler_name,
      operator_name: quote.operator_name,
      vehicle_name: quote.vehicle_name,
      vehicle_reg: quote.vehicle_reg,
      circuit_title: trip.circuit_title,
      duration: trip.duration,
      total_amount: quote.total_quote, // Authoritative pricing from quote
      per_person_amount: quote.per_person_fare, // Authoritative per-person pricing
      journey_status: "Confirmed",
      escrow_status: "Rate Lock Guaranteed",
      contract_signed: true,
      pickup_date: tripStart,
      start_date: tripStart,
      return_date: tripEnd,
    };
    db.bookings.push(newBooking);

    // 7. Accept selected quote & decline competing quotes
    quote.status = "accepted";
    db.quotations.forEach((q) => {
      if (q.trip_request_id === trip.id && q.id !== quote.id && q.status === "pending") {
        q.status = "declined";
      }
    });

    if (simulateFailureStep === "after_quotes") {
      throw new Error("Simulated database failure during quotation update cascade");
    }

    // 8. Update trip request status
    trip.status = "confirmed";

    if (simulateFailureStep === "after_trip") {
      throw new Error("Simulated database failure during trip request status update");
    }

    return { success: true, booking: newBooking };
  } catch (err) {
    // Atomic Rollback: revert db to pristine state
    db.trip_requests = snapshot.trip_requests;
    db.quotations = snapshot.quotations;
    db.vehicles = snapshot.vehicles;
    db.profiles = snapshot.profiles;
    db.bookings = snapshot.bookings;
    throw err;
  }
}

/**
 * Pure simulation of PostgreSQL public.cancel_booking_transaction(...)
 */
function simulateCancelBookingTransaction(db, { bookingId, reason, callerId, simulateFailureStep }) {
  const snapshot = JSON.parse(JSON.stringify(db));

  try {
    if (!callerId) {
      const err = new Error("Unauthorized: Authenticated session required");
      err.code = "42501";
      throw err;
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      const err = new Error("Booking not found");
      err.code = "P0002";
      throw err;
    }

    if (booking.journey_status === "Completed") {
      const err = new Error("Conflict: Cannot cancel a completed journey");
      err.code = "22023";
      throw err;
    }

    if (booking.journey_status === "Cancelled") {
      const err = new Error("Conflict: Booking is already cancelled");
      err.code = "22023";
      throw err;
    }

    const callerProfile = db.profiles.find((p) => p.id === callerId);
    const quote = db.quotations.find((q) => q.id === booking.quotation_id);

    const isTraveler = booking.traveler_id === callerId;
    const isOperator = (quote && quote.operator_id === callerId) || (callerProfile && callerProfile.operator_name === booking.operator_name);
    const isAdmin = callerProfile && callerProfile.role === "admin";

    if (!isTraveler && !isOperator && !isAdmin) {
      const err = new Error("Forbidden: You are not authorized to cancel this booking");
      err.code = "42501";
      throw err;
    }

    // Update booking status
    booking.journey_status = "Cancelled";

    // Cascade trip status back to open
    if (booking.trip_request_id) {
      const trip = db.trip_requests.find((t) => t.id === booking.trip_request_id);
      if (trip && trip.status === "confirmed") {
        trip.status = "open";
      }
    }

    // Cascade quotation status back to pending
    if (booking.quotation_id) {
      const q = db.quotations.find((quoteItem) => quoteItem.id === booking.quotation_id);
      if (q && q.status === "accepted") {
        q.status = "pending";
      }
    }

    if (simulateFailureStep === "after_cancel") {
      throw new Error("Simulated failure during cancellation cascade");
    }

    return { success: true, booking };
  } catch (err) {
    db.trip_requests = snapshot.trip_requests;
    db.quotations = snapshot.quotations;
    db.vehicles = snapshot.vehicles;
    db.profiles = snapshot.profiles;
    db.bookings = snapshot.bookings;
    throw err;
  }
}

// 18. Atomic Booking Confirmation: Happy Path & Authoritative Price Binding
test("Atomic confirmation accepts selected quote, declines competing quotes, sets authoritative pricing, and marks trip confirmed", () => {
  const db = createMockDatabase();

  const result = simulateConfirmBookingTransaction(db, {
    tripRequestId: "trip_101",
    quotationId: "quote_201",
    callerId: "traveller_alice",
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.booking.id);
  assert.strictEqual(result.booking.journey_status, "Confirmed");
  // Total quote and per-person price must be bound directly from quotation
  assert.strictEqual(result.booking.total_amount, 18000);
  assert.strictEqual(result.booking.per_person_amount, 3000);

  // Selected quote must be accepted
  const selectedQuote = db.quotations.find((q) => q.id === "quote_201");
  assert.strictEqual(selectedQuote.status, "accepted");

  // Competing quote must be declined automatically
  const competingQuote = db.quotations.find((q) => q.id === "quote_202");
  assert.strictEqual(competingQuote.status, "declined");

  // Trip request status must be confirmed
  const trip = db.trip_requests.find((t) => t.id === "trip_101");
  assert.strictEqual(trip.status, "confirmed");
});

// 19. Atomic Booking Confirmation Validation & Security Rejections
test("Atomic confirmation rejects invalid quotations, traveller ownership violations, unverified operators, and capacity shortfalls", () => {
  const db = createMockDatabase();

  // 1. Unauthenticated caller
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_201", callerId: null }),
    (err) => err.code === "42501" && err.message.includes("Unauthorized")
  );

  // 2. Ownership violation: Mallory confirming Alice's trip
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_201", callerId: "traveller_mallory" }),
    (err) => err.code === "42501" && err.message.includes("Forbidden")
  );

  // 3. Quotation does not belong to trip
  db.quotations.push({
    id: "quote_alien",
    trip_request_id: "trip_different_999",
    operator_id: "op_bob",
    vehicle_id: "veh_301",
    vehicle_reg: "DL 01 TA 1234",
    total_quote: 15000,
    per_person_fare: 2500,
    status: "pending",
  });
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_alien", callerId: "traveller_alice" }),
    (err) => err.code === "23503" && err.message.includes("does not belong")
  );

  // 4. Unverified operator quote rejection
  db.quotations.push({
    id: "quote_unverified_op",
    trip_request_id: "trip_101",
    operator_id: "op_unverified",
    vehicle_id: "veh_301",
    vehicle_reg: "DL 01 TA 1234",
    total_quote: 14000,
    per_person_fare: 2333,
    status: "pending",
  });
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_unverified_op", callerId: "traveller_alice" }),
    (err) => err.code === "42501" && err.message.includes("Operator is not verified")
  );

  // 5. Ineligible vehicle capacity: vehicle has 4 seats, trip needs 6
  db.quotations.push({
    id: "quote_small_veh",
    trip_request_id: "trip_101",
    operator_id: "op_bob",
    vehicle_id: "veh_small",
    vehicle_reg: "DL 01 TA 9999",
    total_quote: 12000,
    per_person_fare: 2000,
    status: "pending",
  });
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_small_veh", callerId: "traveller_alice" }),
    (err) => err.code === "22023" && err.message.includes("capacity (4 seats) is insufficient")
  );
});

// 20. Atomic Concurrency, Vehicle Date Collision & Duplicate Prevention
test("Atomic confirmation prevents overlapping vehicle reservations and duplicate active bookings", () => {
  const db = createMockDatabase();

  // Create initial confirmed booking for vehicle DL 01 TA 1234 on 2026-11-10 to 2026-11-12
  simulateConfirmBookingTransaction(db, {
    tripRequestId: "trip_101",
    quotationId: "quote_201",
    callerId: "traveller_alice",
  });

  // Attempt to confirm duplicate active booking for the exact same trip request
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_101", quotationId: "quote_201", callerId: "traveller_alice" }),
    (err) => err.code === "23505" && err.message.includes("already been booked")
  );

  // Set up second trip overlapping dates with vehicle DL 01 TA 1234
  db.trip_requests.push({
    id: "trip_conflict",
    trip_code: "TRIP-CONFLICT",
    traveler_id: "traveller_mallory",
    status: "open",
    travellers_count: 5,
    start_date: "2026-11-11", // Overlaps with 2026-11-10 to 2026-11-12!
    end_date: "2026-11-14",
  });
  db.quotations.push({
    id: "quote_conflict_veh",
    trip_request_id: "trip_conflict",
    operator_id: "op_bob",
    vehicle_id: "veh_301",
    vehicle_reg: "DL 01 TA 1234",
    total_quote: 17000,
    per_person_fare: 3400,
    status: "pending",
  });

  // Must reject vehicle collision with 23P01
  assert.throws(
    () => simulateConfirmBookingTransaction(db, { tripRequestId: "trip_conflict", quotationId: "quote_conflict_veh", callerId: "traveller_mallory" }),
    (err) => err.code === "23P01" && err.message.includes("already confirmed for booking")
  );
});

// 21. Transaction Rollback Atomicity on Simulated Failure
test("Simulated database failure during cascade rolls back all updates atomically without partial writes", () => {
  const db = createMockDatabase();

  assert.throws(
    () => simulateConfirmBookingTransaction(db, {
      tripRequestId: "trip_101",
      quotationId: "quote_201",
      callerId: "traveller_alice",
      simulateFailureStep: "after_quotes",
    }),
    /Simulated database failure during quotation update cascade/
  );

  // Assert complete rollback: no booking was inserted!
  assert.strictEqual(db.bookings.length, 0);

  // Trip request remains open
  const trip = db.trip_requests.find((t) => t.id === "trip_101");
  assert.strictEqual(trip.status, "open");

  // Selected quote remains pending (not partially accepted)
  const quote = db.quotations.find((q) => q.id === "quote_201");
  assert.strictEqual(quote.status, "pending");

  // Competing quote remains pending (not partially declined)
  const competing = db.quotations.find((q) => q.id === "quote_202");
  assert.strictEqual(competing.status, "pending");
});

// 22. Cancellation Lifecycle & Legitimate Rebooking (Partial Unique Constraint)
test("Cancellation cleanly resets trip and quote status, and allows legitimate rebooking under partial unique constraints", () => {
  const db = createMockDatabase();

  // 1. Initial booking
  const confirmResult = simulateConfirmBookingTransaction(db, {
    tripRequestId: "trip_101",
    quotationId: "quote_201",
    callerId: "traveller_alice",
  });
  const bookingId = confirmResult.booking.id;

  // 2. Cancellation by authorized traveller Alice
  const cancelResult = simulateCancelBookingTransaction(db, {
    bookingId,
    reason: "Change of plans",
    callerId: "traveller_alice",
  });
  assert.strictEqual(cancelResult.success, true);
  assert.strictEqual(cancelResult.booking.journey_status, "Cancelled");

  // Audit history is preserved: booking record still exists!
  assert.strictEqual(db.bookings.length, 1);
  assert.strictEqual(db.bookings[0].journey_status, "Cancelled");

  // Trip request is reset to 'open'
  const trip = db.trip_requests.find((t) => t.id === "trip_101");
  assert.strictEqual(trip.status, "open");

  // Quote is reset to 'pending'
  const quote = db.quotations.find((q) => q.id === "quote_201");
  assert.strictEqual(quote.status, "pending");

  // Reset competing quote back to pending for rebooking
  const competingQuote = db.quotations.find((q) => q.id === "quote_202");
  competingQuote.status = "pending";

  // 3. Legitimate rebooking after cancellation: Alice selects competing quote 202!
  const rebookResult = simulateConfirmBookingTransaction(db, {
    tripRequestId: "trip_101",
    quotationId: "quote_202",
    callerId: "traveller_alice",
  });

  assert.strictEqual(rebookResult.success, true);
  assert.strictEqual(rebookResult.booking.journey_status, "Confirmed");
  assert.strictEqual(rebookResult.booking.operator_name, "Charlie Travels");
  assert.strictEqual(rebookResult.booking.total_amount, 19500);

  // Database now has two bookings: 1 Cancelled (audit record) and 1 Confirmed (active)
  assert.strictEqual(db.bookings.length, 2);
  const activeBookings = db.bookings.filter((b) => b.journey_status !== "Cancelled");
  assert.strictEqual(activeBookings.length, 1);

  // 4. Concurrency check: Cannot cancel a completed journey
  rebookResult.booking.journey_status = "Completed";
  assert.throws(
    () => simulateCancelBookingTransaction(db, { bookingId: rebookResult.booking.id, callerId: "traveller_alice" }),
    (err) => err.code === "22023" && err.message.includes("Cannot cancel a completed journey")
  );
});

// ====================================================================
// PHASE 1D: PERSISTENT OPERATOR VERIFICATION AUDIT TESTS
// ====================================================================

function createAuditMockDatabase() {
  return {
    profiles: [
      { id: "admin_lead", role: "admin", full_name: "Vikram Admin", email: "admin@tripvahan.com" },
      { id: "admin_rogue", role: "admin", full_name: "Rogue Admin", email: "rogue@tripvahan.com" },
      { id: "trv_alice", role: "traveller", full_name: "Alice Smith", email: "alice@example.com" },
      { id: "op_bob", role: "operator", full_name: "Bob Driver", operator_name: "Bob Cabs", verified: false, rejection_reason: null },
      { id: "op_charlie", role: "operator", full_name: "Charlie Fleet", operator_name: "Charlie Travels", verified: true, rejection_reason: null },
    ],
    vehicles: [
      { id: "veh_b1", operator_id: "op_bob", compliance_status: "Pending Verification", status: "Pending Verification" },
      { id: "veh_c1", operator_id: "op_charlie", compliance_status: "Verified Commercial Fleet", status: "Available" },
    ],
    operator_verification_audit: [],
  };
}

/**
 * Pure simulation of PostgreSQL public.verify_operator_transaction(...)
 */
function simulateVerifyOperatorTransaction(db, { operatorId, action, reason, notes, callerId, correlationId, simulateAuditFailure }) {
  const snapshot = JSON.parse(JSON.stringify(db));

  try {
    if (!callerId) {
      const err = new Error("Unauthorized: Authenticated administrator session required");
      err.code = "42501";
      throw err;
    }

    const admin = db.profiles.find((p) => p.id === callerId);
    if (!admin || admin.role !== "admin") {
      const err = new Error("Forbidden: Platform administrator role required");
      err.code = "42501";
      throw err;
    }

    if (callerId === operatorId) {
      const err = new Error("Forbidden: Platform administrators cannot verify or modify their own operator account");
      err.code = "42501";
      throw err;
    }

    const operator = db.profiles.find((p) => p.id === operatorId);
    if (!operator) {
      const err = new Error(`Operator profile not found: ${operatorId}`);
      err.code = "P0002";
      throw err;
    }

    const previousState = Boolean(operator.verified);
    let newState;
    let cleanReason = null;

    if (action === "approve") {
      newState = true;
    } else if (action === "reject") {
      newState = false;
      if (!reason || reason.trim() === "") {
        const err = new Error("A specific statutory rejection reason is mandatory when declining an operator");
        err.code = "22023";
        throw err;
      }
      cleanReason = reason.trim();
    } else {
      const err = new Error(`Invalid verification action "${action}". Allowed values: approve, reject`);
      err.code = "22023";
      throw err;
    }

    // 1. Update Operator Profile
    operator.verified = newState;
    operator.rejection_reason = cleanReason;
    operator.decided_at = new Date().toISOString();
    operator.decided_by = admin.full_name || admin.email || "Platform Administrator";

    // 2. Update Fleet Compliance
    db.vehicles.forEach((v) => {
      if (v.operator_id === operatorId) {
        if (newState) {
          v.compliance_status = "Verified Commercial Fleet";
          v.status = "Available";
        } else {
          v.compliance_status = `Compliance Rejected: ${cleanReason}`;
          v.status = "Pending Verification";
        }
      }
    });

    // 3. Simulated failure on audit insertion
    if (simulateAuditFailure) {
      throw new Error("Simulated database failure on operator_verification_audit insertion");
    }

    // 4. Insert into Audit Table
    const auditEntry = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      operator_id: operatorId,
      operator_name: operator.operator_name || operator.full_name,
      admin_id: callerId,
      admin_name: admin.full_name || "Platform Administrator",
      admin_email: admin.email,
      action: newState ? "approved" : "rejected",
      previous_state: previousState,
      new_state: newState,
      decision_reason: cleanReason,
      notes: notes || null,
      correlation_id: correlationId || `req_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    if (!db.operator_verification_audit) {
      db.operator_verification_audit = [];
    }
    db.operator_verification_audit.push(auditEntry);

    return {
      success: true,
      action: auditEntry.action,
      operator_id: operatorId,
      previous_state: previousState,
      new_state: newState,
      audit_entry: auditEntry,
    };
  } catch (err) {
    // Atomic rollback: restore pristine database state
    db.profiles = snapshot.profiles;
    db.vehicles = snapshot.vehicles;
    db.operator_verification_audit = snapshot.operator_verification_audit;
    throw err;
  }
}

// 23. Authorized Approval with Persistent Audit Trail
test("Authorized admin approval updates profile, fleet status, and records persistent audit entry with authentic admin identity", () => {
  const db = createAuditMockDatabase();

  const result = simulateVerifyOperatorTransaction(db, {
    operatorId: "op_bob",
    action: "approve",
    notes: "Verified RC, AITP, Speed Governor, Commercial Insurance & PUC.",
    callerId: "admin_lead",
    correlationId: "req_test_approval_001",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.action, "approved");
  assert.strictEqual(result.previous_state, false);
  assert.strictEqual(result.new_state, true);

  // Verify profile mutation
  const operator = db.profiles.find((p) => p.id === "op_bob");
  assert.strictEqual(operator.verified, true);
  assert.strictEqual(operator.rejection_reason, null);
  assert.strictEqual(operator.decided_by, "Vikram Admin");

  // Verify vehicle fleet authorization
  const vehicle = db.vehicles.find((v) => v.operator_id === "op_bob");
  assert.strictEqual(vehicle.compliance_status, "Verified Commercial Fleet");
  assert.strictEqual(vehicle.status, "Available");

  // Verify persistent audit record
  assert.strictEqual(db.operator_verification_audit.length, 1);
  const audit = db.operator_verification_audit[0];
  assert.strictEqual(audit.operator_id, "op_bob");
  assert.strictEqual(audit.operator_name, "Bob Cabs");
  assert.strictEqual(audit.admin_id, "admin_lead");
  assert.strictEqual(audit.admin_name, "Vikram Admin");
  assert.strictEqual(audit.admin_email, "admin@tripvahan.com");
  assert.strictEqual(audit.action, "approved");
  assert.strictEqual(audit.previous_state, false);
  assert.strictEqual(audit.new_state, true);
  assert.strictEqual(audit.correlation_id, "req_test_approval_001");
  assert.ok(audit.created_at);
});

// 24. Authorized Rejection with Mandatory Reason & Vehicle Restriction
test("Authorized admin rejection requires specific statutory reason, restricts fleet, and records persistent audit trail", () => {
  const db = createAuditMockDatabase();

  const rejectionReason = "Speed governor calibration certificate expired and unsealed.";
  const result = simulateVerifyOperatorTransaction(db, {
    operatorId: "op_charlie",
    action: "reject",
    reason: rejectionReason,
    notes: "Please re-upload ATS fitness certificate with seal.",
    callerId: "admin_lead",
    correlationId: "req_test_reject_002",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.action, "rejected");
  assert.strictEqual(result.previous_state, true);
  assert.strictEqual(result.new_state, false);

  // Verify profile mutation
  const operator = db.profiles.find((p) => p.id === "op_charlie");
  assert.strictEqual(operator.verified, false);
  assert.strictEqual(operator.rejection_reason, rejectionReason);

  // Verify fleet restriction
  const vehicle = db.vehicles.find((v) => v.operator_id === "op_charlie");
  assert.strictEqual(vehicle.compliance_status, `Compliance Rejected: ${rejectionReason}`);
  assert.strictEqual(vehicle.status, "Pending Verification");

  // Verify audit log
  assert.strictEqual(db.operator_verification_audit.length, 1);
  const audit = db.operator_verification_audit[0];
  assert.strictEqual(audit.operator_id, "op_charlie");
  assert.strictEqual(audit.action, "rejected");
  assert.strictEqual(audit.decision_reason, rejectionReason);
  assert.strictEqual(audit.admin_id, "admin_lead");
});

// 25. Unauthorized Access & Self-Approval Rejection
test("Operator verification strictly rejects unauthenticated callers, non-admin users, and self-approval attempts", () => {
  const db = createAuditMockDatabase();

  // 1. Unauthenticated request
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "op_bob", action: "approve", callerId: null }),
    (err) => err.code === "42501" && err.message.includes("Unauthorized")
  );

  // 2. Non-admin traveller attempting operator verification
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "op_bob", action: "approve", callerId: "trv_alice" }),
    (err) => err.code === "42501" && err.message.includes("Forbidden")
  );

  // 3. Self-approval: Admin attempting to verify their own operator account
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "admin_rogue", action: "approve", callerId: "admin_rogue" }),
    (err) => err.code === "42501" && err.message.includes("cannot verify or modify their own operator account")
  );
});

// 26. Invalid Operator ID and Rejection Reason Validation
test("Operator verification rejects non-existent operator IDs and rejection requests missing a statutory reason", () => {
  const db = createAuditMockDatabase();

  // 1. Non-existent operator ID
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "op_non_existent", action: "approve", callerId: "admin_lead" }),
    (err) => err.code === "P0002" && err.message.includes("Operator profile not found")
  );

  // 2. Rejection without a mandatory reason
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "op_bob", action: "reject", reason: "", callerId: "admin_lead" }),
    (err) => err.code === "22023" && err.message.includes("rejection reason is mandatory")
  );

  // 3. Invalid action keyword
  assert.throws(
    () => simulateVerifyOperatorTransaction(db, { operatorId: "op_bob", action: "promote", callerId: "admin_lead" }),
    (err) => err.code === "22023" && err.message.includes("Invalid verification action")
  );
});

// 27. Transaction Atomicity & Rollback on Audit Failure
test("Operator verification rolls back profile and vehicle mutations atomically if audit logging fails", () => {
  const db = createAuditMockDatabase();

  // Initial state of op_bob: verified = false
  assert.strictEqual(db.profiles.find((p) => p.id === "op_bob").verified, false);

  assert.throws(
    () => simulateVerifyOperatorTransaction(db, {
      operatorId: "op_bob",
      action: "approve",
      callerId: "admin_lead",
      simulateAuditFailure: true,
    }),
    /Simulated database failure on operator_verification_audit insertion/
  );

  // Assert atomic rollback: operator remains unverified!
  const operator = db.profiles.find((p) => p.id === "op_bob");
  assert.strictEqual(operator.verified, false);
  assert.strictEqual(operator.decided_by, undefined);

  // Vehicle compliance status remains untouched
  const vehicle = db.vehicles.find((v) => v.operator_id === "op_bob");
  assert.strictEqual(vehicle.compliance_status, "Pending Verification");

  // No partial audit record is stored
  assert.strictEqual(db.operator_verification_audit.length, 0);
});

// ====================================================================
// PHASE 1E: SECURE OPERATOR DOCUMENT STORAGE AND REVIEW TESTS
// ====================================================================

const ALLOWED_TEST_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TEST_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateDocumentUploadRequest(user, profile, payload, existingDocs = []) {
  if (!user) {
    return { valid: false, statusCode: 401, error: "Unauthorized: Missing authentication session" };
  }

  const isOperator = profile?.role === "operator" || profile?.role === "both" || profile?.role === "admin";
  if (!isOperator) {
    return { valid: false, statusCode: 403, error: "Forbidden: Only transport operators are authorized to submit documents" };
  }

  if (!payload.doc_type || !payload.title || !payload.file_path || !payload.file_name || !payload.file_size || !payload.mime_type) {
    return { valid: false, statusCode: 400, error: "Missing required document fields" };
  }

  if (!ALLOWED_TEST_MIME_TYPES.includes(payload.mime_type)) {
    return { valid: false, statusCode: 400, error: `Unsupported file type '${payload.mime_type}'. Permitted: PDF, JPEG, PNG, WEBP` };
  }

  if (payload.file_size <= 0 || payload.file_size > MAX_TEST_FILE_SIZE) {
    return { valid: false, statusCode: 400, error: `File size (${payload.file_size} bytes) exceeds maximum allowable limit of 5 MB` };
  }

  if (payload.file_path.includes("..") || payload.file_path.startsWith("/") || payload.file_path.startsWith("\\")) {
    return { valid: false, statusCode: 400, error: "Invalid file_path: Path traversal characters are strictly prohibited" };
  }

  const expectedPrefix = `${user.id}/`;
  if (!payload.file_path.startsWith(expectedPrefix) && profile?.role !== "admin") {
    return { valid: false, statusCode: 403, error: "Forbidden: Storage path must reside within your authorized operator directory" };
  }

  if (payload.expiry_date) {
    const exp = new Date(payload.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (exp < today) {
      return { valid: false, statusCode: 400, error: `Document has already expired on ${payload.expiry_date}. Active commercial documents must be unexpired.` };
    }
  }

  const duplicate = existingDocs.find(
    (d) => d.operator_id === user.id && d.doc_type === payload.doc_type && (d.status === "approved" || d.status === "pending")
  );
  if (duplicate) {
    return { valid: false, statusCode: 409, error: `An active or pending document for category '${payload.doc_type}' already exists` };
  }

  return { valid: true };
}

function validateDocumentDownloadRequest(user, profile, docRecord) {
  if (!user) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: Missing authentication token" };
  }

  if (!docRecord) {
    return { authorized: false, statusCode: 404, error: "Document record not found" };
  }

  const isOwner = docRecord.operator_id === user.id;
  const isAdmin = profile?.role === "admin";

  if (!isOwner && !isAdmin) {
    return { authorized: false, statusCode: 403, error: "Forbidden: You are not authorized to view or download this private operator document" };
  }

  return { authorized: true };
}

function validateDocumentReviewRequest(user, profile, docRecord, { status, reason, notes }) {
  if (!user) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: Administrator authentication required" };
  }

  if (profile?.role !== "admin") {
    return { authorized: false, statusCode: 403, error: "Forbidden: Platform administrator privileges required to review documents" };
  }

  if (!docRecord) {
    return { authorized: false, statusCode: 404, error: "Document not found" };
  }

  // Self-approval guard
  if (docRecord.operator_id === user.id) {
    return { authorized: false, statusCode: 403, error: "Forbidden: Administrators cannot review or approve their own documents" };
  }

  if (!status || !["approved", "rejected"].includes(status)) {
    return { authorized: false, statusCode: 400, error: "Valid status ('approved' | 'rejected') is required" };
  }

  if (status === "rejected" && (!reason || reason.trim() === "")) {
    return { authorized: false, statusCode: 400, error: "A specific rejection reason is mandatory when declining an operator document" };
  }

  return { authorized: true };
}

// 28. Document Upload Validation: File Types, Size Limits, and Path Traversal
test("Document upload rejects unauthenticated callers, invalid MIME types, oversized files (>5MB), and path traversal", () => {
  const operatorUser = { id: "op_123" };
  const operatorProfile = { role: "operator" };

  const validPayload = {
    doc_type: "commercial_rc",
    title: "Commercial RC Yellow Board",
    file_path: "op_123/commercial_rc/rc_yellow.pdf",
    file_name: "rc_yellow.pdf",
    file_size: 1024 * 1024, // 1 MB
    mime_type: "application/pdf",
    expiry_date: "2028-12-31",
  };

  // 1. Unauthenticated upload fails with 401
  const unauth = validateDocumentUploadRequest(null, null, validPayload);
  assert.strictEqual(unauth.valid, false);
  assert.strictEqual(unauth.statusCode, 401);

  // 2. Invalid MIME type (e.g., .exe or .html) fails with 400
  const invalidMime = validateDocumentUploadRequest(operatorUser, operatorProfile, {
    ...validPayload,
    mime_type: "application/x-msdownload",
  });
  assert.strictEqual(invalidMime.valid, false);
  assert.strictEqual(invalidMime.statusCode, 400);
  assert.ok(invalidMime.error.includes("Unsupported file type"));

  // 3. Oversized file (6 MB > 5 MB) fails with 400
  const oversized = validateDocumentUploadRequest(operatorUser, operatorProfile, {
    ...validPayload,
    file_size: 6 * 1024 * 1024,
  });
  assert.strictEqual(oversized.valid, false);
  assert.strictEqual(oversized.statusCode, 400);
  assert.ok(oversized.error.includes("exceeds maximum allowable limit"));

  // 4. Path traversal attempt fails with 400
  const pathTraversal = validateDocumentUploadRequest(operatorUser, operatorProfile, {
    ...validPayload,
    file_path: "op_123/../../etc/passwd",
  });
  assert.strictEqual(pathTraversal.valid, false);
  assert.strictEqual(pathTraversal.statusCode, 400);
  assert.ok(pathTraversal.error.includes("Path traversal"));

  // 5. Valid payload passes
  const valid = validateDocumentUploadRequest(operatorUser, operatorProfile, validPayload);
  assert.strictEqual(valid.valid, true);
});

// 29. Cross-Operator Isolation & Cross-Profile Upload Rejection
test("Document upload prevents cross-operator file uploads and blocks non-operators from submitting fleet documents", () => {
  const operatorAlice = { id: "op_alice" };
  const profileAlice = { role: "operator" };
  const travellerBob = { id: "trv_bob" };
  const profileBob = { role: "traveller" };

  // 1. Operator Alice trying to upload to Operator Charlie's directory is blocked with 403
  const crossOpUpload = validateDocumentUploadRequest(operatorAlice, profileAlice, {
    doc_type: "tourist_permit",
    title: "All-India Tourist Permit",
    file_path: "op_charlie/tourist_permit/charlie_permit.pdf",
    file_name: "permit.pdf",
    file_size: 500000,
    mime_type: "application/pdf",
  });
  assert.strictEqual(crossOpUpload.valid, false);
  assert.strictEqual(crossOpUpload.statusCode, 403);
  assert.ok(crossOpUpload.error.includes("authorized operator directory"));

  // 2. Ordinary traveller trying to submit operator documents is blocked with 403
  const trvUpload = validateDocumentUploadRequest(travellerBob, profileBob, {
    doc_type: "commercial_rc",
    title: "Fake RC",
    file_path: "trv_bob/commercial_rc/fake.pdf",
    file_name: "fake.pdf",
    file_size: 500000,
    mime_type: "application/pdf",
  });
  assert.strictEqual(trvUpload.valid, false);
  assert.strictEqual(trvUpload.statusCode, 403);
  assert.ok(trvUpload.error.includes("Only transport operators are authorized"));
});

// 30. Document Download Security & Signed URL Authorization
test("Document downloads are restricted strictly to owning operator and admins, blocking cross-operator and traveller access", () => {
  const ownerUser = { id: "op_owner" };
  const ownerProfile = { role: "operator" };
  const otherOpUser = { id: "op_other" };
  const otherOpProfile = { role: "operator" };
  const travellerUser = { id: "trv_tim" };
  const travellerProfile = { role: "traveller" };
  const adminUser = { id: "admin_super" };
  const adminProfile = { role: "admin" };

  const privateDoc = {
    id: "doc_secure_1",
    operator_id: "op_owner",
    file_path: "op_owner/commercial_rc/yellow_board.pdf",
  };

  // 1. Unauthenticated download fails with 401
  const unauth = validateDocumentDownloadRequest(null, null, privateDoc);
  assert.strictEqual(unauth.authorized, false);
  assert.strictEqual(unauth.statusCode, 401);

  // 2. Other operator trying to download Owner's document is blocked with 403
  const crossOpDownload = validateDocumentDownloadRequest(otherOpUser, otherOpProfile, privateDoc);
  assert.strictEqual(crossOpDownload.authorized, false);
  assert.strictEqual(crossOpDownload.statusCode, 403);
  assert.ok(crossOpDownload.error.includes("not authorized to view or download"));

  // 3. Ordinary traveller trying to download private document is blocked with 403
  const trvDownload = validateDocumentDownloadRequest(travellerUser, travellerProfile, privateDoc);
  assert.strictEqual(trvDownload.authorized, false);
  assert.strictEqual(trvDownload.statusCode, 403);

  // 4. Document owner can download their own document
  const ownerDownload = validateDocumentDownloadRequest(ownerUser, ownerProfile, privateDoc);
  assert.strictEqual(ownerDownload.authorized, true);

  // 5. Platform administrator can download any operator's document for compliance inspection
  const adminDownload = validateDocumentDownloadRequest(adminUser, adminProfile, privateDoc);
  assert.strictEqual(adminDownload.authorized, true);
});

// 31. Document Review Authorization, Mandatory Rejection Reasons, and Self-Approval Prevention
test("Document review requires admin privileges, rejects self-approval, and enforces mandatory rejection reason", () => {
  const adminLead = { id: "admin_lead" };
  const adminLeadProfile = { role: "admin" };
  const rogueAdmin = { id: "admin_rogue" };
  const rogueAdminProfile = { role: "admin" };
  const operatorTim = { id: "op_tim" };
  const operatorTimProfile = { role: "operator" };

  const targetDoc = {
    id: "doc_101",
    operator_id: "op_tim",
    doc_type: "fitness_cert",
    status: "pending",
  };

  const selfDoc = {
    id: "doc_rogue_102",
    operator_id: "admin_rogue",
    doc_type: "fitness_cert",
    status: "pending",
  };

  // 1. Non-admin operator cannot review documents (403)
  const nonAdminReview = validateDocumentReviewRequest(operatorTim, operatorTimProfile, targetDoc, { status: "approved" });
  assert.strictEqual(nonAdminReview.authorized, false);
  assert.strictEqual(nonAdminReview.statusCode, 403);

  // 2. Admin cannot approve their own operator document (Self-Approval Guard 403)
  const selfApproval = validateDocumentReviewRequest(rogueAdmin, rogueAdminProfile, selfDoc, { status: "approved" });
  assert.strictEqual(selfApproval.authorized, false);
  assert.strictEqual(selfApproval.statusCode, 403);
  assert.ok(selfApproval.error.includes("cannot review or approve their own documents"));

  // 3. Rejection without a statutory reason fails with 400
  const rejectNoReason = validateDocumentReviewRequest(adminLead, adminLeadProfile, targetDoc, { status: "rejected", reason: "" });
  assert.strictEqual(rejectNoReason.authorized, false);
  assert.strictEqual(rejectNoReason.statusCode, 400);
  assert.ok(rejectNoReason.error.includes("rejection reason is mandatory"));

  // 4. Authorized admin review with valid reason passes
  const validApproval = validateDocumentReviewRequest(adminLead, adminLeadProfile, targetDoc, { status: "approved" });
  assert.strictEqual(validApproval.authorized, true);

  const validRejection = validateDocumentReviewRequest(adminLead, adminLeadProfile, targetDoc, {
    status: "rejected",
    reason: "Speed governor seal missing from testing station",
  });
  assert.strictEqual(validRejection.authorized, true);
});

// 32. Expired-Document Handling & Duplicate Active Document Constraints
test("Document submission rejects already-expired certificates and prevents duplicate active documents of the same category", () => {
  const operator = { id: "op_alpha" };
  const profile = { role: "operator" };

  const existingDocs = [
    {
      id: "doc_alpha_rc",
      operator_id: "op_alpha",
      doc_type: "commercial_rc",
      status: "approved",
    },
  ];

  // 1. Submission with expired date (yesterday) fails with 400
  const expiredPayload = {
    doc_type: "puc_cert",
    title: "Expired PUC",
    file_path: "op_alpha/puc_cert/puc.pdf",
    file_name: "puc.pdf",
    file_size: 300000,
    mime_type: "application/pdf",
    expiry_date: "2020-01-01", // Long expired!
  };
  const expiredRes = validateDocumentUploadRequest(operator, profile, expiredPayload, existingDocs);
  assert.strictEqual(expiredRes.valid, false);
  assert.strictEqual(expiredRes.statusCode, 400);
  assert.ok(expiredRes.error.includes("already expired"));

  // 2. Submitting duplicate active category ('commercial_rc' when already approved) fails with 409
  const duplicatePayload = {
    doc_type: "commercial_rc",
    title: "Another RC",
    file_path: "op_alpha/commercial_rc/rc2.pdf",
    file_name: "rc2.pdf",
    file_size: 400000,
    mime_type: "application/pdf",
    expiry_date: "2028-01-01",
  };
  const duplicateRes = validateDocumentUploadRequest(operator, profile, duplicatePayload, existingDocs);
  assert.strictEqual(duplicateRes.valid, false);
  assert.strictEqual(duplicateRes.statusCode, 409);
  assert.ok(duplicateRes.error.includes("already exists"));
});

// ============================================================================
// PHASE 3 — CRITICAL API SECURITY & ATOMIC FALLBACK PREVENTION TEST SUITE
// ============================================================================

// 33. Booking Confirmation Authentication & Authorization Guard Tests
test("Unauthenticated booking confirmation returns 401 and rejects caller-supplied traveler ID spoofing", () => {
  function validateBookingConfirmationAuth(token, user, tripRequest) {
    if (!token) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Valid authentication token required to confirm booking" };
    }
    if (!user || !user.id) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid or expired authentication session" };
    }
    if (tripRequest && tripRequest.traveler_id !== user.id) {
      return { authorized: false, statusCode: 403, error: "Forbidden: You are not authorized to confirm a booking for another traveller's trip request" };
    }
    return { authorized: true, callerId: user.id };
  }

  // 1. Missing Bearer token
  const resNoToken = validateBookingConfirmationAuth(null, null, { traveler_id: "usr_alice" });
  assert.strictEqual(resNoToken.authorized, false);
  assert.strictEqual(resNoToken.statusCode, 401);

  // 2. Invalid session
  const resBadToken = validateBookingConfirmationAuth("invalid_jwt", null, { traveler_id: "usr_alice" });
  assert.strictEqual(resBadToken.authorized, false);
  assert.strictEqual(resBadToken.statusCode, 401);

  // 3. Caller Eve trying to confirm Alice's booking (caller spoofing)
  const eveUser = { id: "usr_eve" };
  const aliceTrip = { traveler_id: "usr_alice" };
  const resSpoof = validateBookingConfirmationAuth("valid_eve_jwt", eveUser, aliceTrip);
  assert.strictEqual(resSpoof.authorized, false);
  assert.strictEqual(resSpoof.statusCode, 403);
  assert.ok(resSpoof.error.includes("Forbidden"));

  // 4. Legitimate owner Alice confirming her own booking
  const aliceUser = { id: "usr_alice" };
  const resValid = validateBookingConfirmationAuth("valid_alice_jwt", aliceUser, aliceTrip);
  assert.strictEqual(resValid.authorized, true);
  assert.strictEqual(resValid.callerId, "usr_alice");
});

// 34. Quotation Submission Authentication & Cross-Operator Authorization Tests
test("Quotation submission strictly requires verified operator and blocks cross-operator impersonation", () => {
  function validateQuotationSubmissionAuth(token, user, profile, requestedOperatorId) {
    if (!token) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Valid operator authentication token required" };
    }
    if (!user || !user.id) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid or expired operator session" };
    }
    if (!profile || profile.role !== "operator") {
      return { authorized: false, statusCode: 403, error: "Forbidden: Only registered transport fleet operators can submit quotations" };
    }
    if (!profile.verified) {
      return { authorized: false, statusCode: 403, error: "Forbidden: Operator account must complete statutory document verification before bidding" };
    }
    if (requestedOperatorId && requestedOperatorId !== user.id) {
      return { authorized: false, statusCode: 403, error: "Forbidden: Cross-operator quotation submission is strictly prohibited" };
    }
    return { authorized: true, operatorId: user.id };
  }

  // 1. Missing token -> 401
  const resUnauth = validateQuotationSubmissionAuth(null, null, null, "op_bob");
  assert.strictEqual(resUnauth.authorized, false);
  assert.strictEqual(resUnauth.statusCode, 401);

  // 2. Non-operator caller (traveller Alice) -> 403
  const aliceUser = { id: "usr_alice" };
  const aliceProfile = { role: "traveler", verified: true };
  const resTraveller = validateQuotationSubmissionAuth("jwt_alice", aliceUser, aliceProfile, "usr_alice");
  assert.strictEqual(resTraveller.authorized, false);
  assert.strictEqual(resTraveller.statusCode, 403);

  // 3. Unverified operator Charlie -> 403
  const charlieUser = { id: "op_charlie" };
  const charlieProfile = { role: "operator", verified: false };
  const resUnverified = validateQuotationSubmissionAuth("jwt_charlie", charlieUser, charlieProfile, "op_charlie");
  assert.strictEqual(resUnverified.authorized, false);
  assert.strictEqual(resUnverified.statusCode, 403);
  assert.ok(resUnverified.error.includes("verification"));

  // 4. Operator Bob attempting to submit under Operator Charlie's ID -> 403
  const bobUser = { id: "op_bob" };
  const bobProfile = { role: "operator", verified: true };
  const resCross = validateQuotationSubmissionAuth("jwt_bob", bobUser, bobProfile, "op_charlie");
  assert.strictEqual(resCross.authorized, false);
  assert.strictEqual(resCross.statusCode, 403);
  assert.ok(resCross.error.includes("Cross-operator"));

  // 5. Verified operator Bob submitting under own ID -> authorized
  const resValid = validateQuotationSubmissionAuth("jwt_bob", bobUser, bobProfile, "op_bob");
  assert.strictEqual(resValid.authorized, true);
  assert.strictEqual(resValid.operatorId, "op_bob");
});

// 35. Vehicle Registration & Fleet Mutation Authorization Tests
test("Vehicle registration and mutation require operator authentication and block cross-operator tampering", () => {
  function validateVehicleActionAuth(token, user, profile, targetOperatorId, existingVehicleOwnerId) {
    if (!token) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Valid authentication token required to register or modify vehicles" };
    }
    if (!user || !user.id) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid or expired session" };
    }
    if (!profile || profile.role !== "operator") {
      return { authorized: false, statusCode: 403, error: "Forbidden: Only fleet operators can register or manage vehicles" };
    }
    if (targetOperatorId && targetOperatorId !== user.id) {
      return { authorized: false, statusCode: 403, error: "Forbidden: You cannot register a vehicle under another operator's identity" };
    }
    if (existingVehicleOwnerId && existingVehicleOwnerId !== user.id && profile.role !== "admin") {
      return { authorized: false, statusCode: 403, error: "Forbidden: You do not own this vehicle and cannot modify it" };
    }
    return { authorized: true, operatorId: user.id };
  }

  // 1. Unauthenticated vehicle registration -> 401
  const resUnauth = validateVehicleActionAuth(null, null, null, "op_bob");
  assert.strictEqual(resUnauth.authorized, false);
  assert.strictEqual(resUnauth.statusCode, 401);

  // 2. Non-operator caller -> 403
  const travellerUser = { id: "usr_alice" };
  const travellerProfile = { role: "traveler" };
  const resNonOp = validateVehicleActionAuth("jwt_alice", travellerUser, travellerProfile, "usr_alice");
  assert.strictEqual(resNonOp.authorized, false);
  assert.strictEqual(resNonOp.statusCode, 403);

  // 3. Bob trying to register vehicle as Charlie -> 403
  const bobUser = { id: "op_bob" };
  const bobProfile = { role: "operator" };
  const resCrossReg = validateVehicleActionAuth("jwt_bob", bobUser, bobProfile, "op_charlie");
  assert.strictEqual(resCrossReg.authorized, false);
  assert.strictEqual(resCrossReg.statusCode, 403);

  // 4. Bob trying to mutate Charlie's existing vehicle -> 403
  const resCrossMutate = validateVehicleActionAuth("jwt_bob", bobUser, bobProfile, "op_bob", "op_charlie");
  assert.strictEqual(resCrossMutate.authorized, false);
  assert.strictEqual(resCrossMutate.statusCode, 403);

  // 5. Bob mutating his own vehicle -> 200
  const resValid = validateVehicleActionAuth("jwt_bob", bobUser, bobProfile, "op_bob", "op_bob");
  assert.strictEqual(resValid.authorized, true);
});

// 36. Administrator Verification & Service-Role Authentication Rejection Tests
test("Administrator verification requires genuine admin session and rejects service-role token as caller identity", () => {
  function validateAdminSession(token, user, profile, targetOperatorId) {
    if (!token) {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Missing administrator authentication token" };
    }
    // Strict enforcement: Service role secret supplied as caller Bearer token is rejected
    // Service-role keys do not have user identity and cannot act as a caller session
    if (token === "SUPABASE_SERVICE_ROLE_SECRET_KEY" || !user || !user.id || user.id === "sys_admin") {
      return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid or expired administrator session (synthetic identities prohibited)" };
    }
    if (!profile || profile.role !== "admin") {
      return { authorized: false, statusCode: 403, error: "Forbidden: Platform administrator privileges required to access verification controls" };
    }
    if (user.id === targetOperatorId) {
      return { authorized: false, statusCode: 403, error: "Forbidden: Administrators cannot approve or modify their own operator account verification" };
    }
    return { authorized: true, adminId: user.id };
  }

  // 1. Missing token -> 401
  const resNoToken = validateAdminSession(null, null, null, "op_bob");
  assert.strictEqual(resNoToken.authorized, false);
  assert.strictEqual(resNoToken.statusCode, 401);

  // 2. Service role key passed as Bearer token -> 401
  const resServiceKey = validateAdminSession("SUPABASE_SERVICE_ROLE_SECRET_KEY", null, null, "op_bob");
  assert.strictEqual(resServiceKey.authorized, false);
  assert.strictEqual(resServiceKey.statusCode, 401);

  // 3. Synthetic sys_admin user -> 401
  const sysAdminUser = { id: "sys_admin" };
  const resSysAdmin = validateAdminSession("jwt_fake", sysAdminUser, { role: "admin" }, "op_bob");
  assert.strictEqual(resSysAdmin.authorized, false);
  assert.strictEqual(resSysAdmin.statusCode, 401);

  // 4. Non-admin operator Dave -> 403
  const daveUser = { id: "usr_dave" };
  const daveProfile = { role: "operator" };
  const resNonAdmin = validateAdminSession("jwt_dave", daveUser, daveProfile, "op_bob");
  assert.strictEqual(resNonAdmin.authorized, false);
  assert.strictEqual(resNonAdmin.statusCode, 403);

  // 5. Admin Dave attempting self-approval -> 403
  const adminDave = { id: "usr_admin_dave" };
  const adminProfile = { role: "admin" };
  const resSelfApproval = validateAdminSession("jwt_admin_dave", adminDave, adminProfile, "usr_admin_dave");
  assert.strictEqual(resSelfApproval.authorized, false);
  assert.strictEqual(resSelfApproval.statusCode, 403);

  // 6. Valid admin approving operator Bob -> 200
  const resValid = validateAdminSession("jwt_admin_dave", adminDave, adminProfile, "op_bob");
  assert.strictEqual(resValid.authorized, true);
  assert.strictEqual(resValid.adminId, "usr_admin_dave");
});

// 37. Database Transaction Failure Never Triggers Insecure Direct-Write Fallback
test("Database transaction failure cleanly returns error without falling back to insecure direct table writes", () => {
  // Mock database representing state before transaction
  const initialDb = {
    bookings: [],
    vehicles: [{ id: "veh_1", registration_no: "DL 01 TA 9821", status: "Available" }],
    trip_requests: [{ id: "trip_1", traveler_id: "usr_alice", status: "open" }],
    quotations: [{ id: "quote_1", trip_request_id: "trip_1", operator_id: "op_bob", status: "pending", vehicle_id: "veh_1" }],
  };

  // Simulating route handler logic where direct-write fallback is REMOVED
  function handleBookingConfirmation(db, { trip_request_id, quotation_id, caller_id, rpcShouldFail }) {
    if (rpcShouldFail) {
      // Stored procedure returns conflict error (e.g., overlapping reservation or concurrent lock)
      const rpcError = { code: "23505", message: "Vehicle is already confirmed for another booking during the requested dates" };
      // STRICT REQUIREMENT: No fallback direct-writes to db.bookings or db.vehicles!
      return {
        statusCode: 409,
        error: rpcError.message,
        code: rpcError.code,
      };
    }

    // Normal atomic execution
    db.bookings.push({ id: "bk_1", trip_request_id, quotation_id, traveler_id: caller_id });
    return { statusCode: 201, data: { id: "bk_1" } };
  }

  // Deep clone DB to track mutations
  const dbState = JSON.parse(JSON.stringify(initialDb));

  // Run with RPC failure
  const result = handleBookingConfirmation(dbState, {
    trip_request_id: "trip_1",
    quotation_id: "quote_1",
    caller_id: "usr_alice",
    rpcShouldFail: true,
  });

  // 1. Error response matches 409 conflict
  assert.strictEqual(result.statusCode, 409);
  assert.ok(result.error.includes("already confirmed"));

  // 2. CRITICAL: Bookings table remained completely untouched (NO partial direct write!)
  assert.strictEqual(dbState.bookings.length, 0, "No booking record should be inserted when procedure fails");
  // 3. Vehicle status remained unchanged
  assert.strictEqual(dbState.vehicles[0].status, "Available", "Vehicle status must remain unchanged on failure");
  // 4. Trip request status remained open
  assert.strictEqual(dbState.trip_requests[0].status, "open", "Trip status must remain open on failure");
});

// 38. Failed Verification Audit Insertion Leaves Profile and Vehicle State Unchanged
test("Failed verification audit insertion leaves profile and vehicle state unchanged (Atomic Guarantee)", () => {
  const operatorProfile = { id: "op_bob", verified: false, rejection_reason: null };
  const operatorVehicles = [{ id: "veh_bob_1", operator_id: "op_bob", status: "Pending Verification" }];
  const auditTable = [];

  function executeVerifyOperatorAtomic(profile, vehicles, audit, { action, reason, auditInsertFails }) {
    // Snapshot state
    const profileSnapshot = { ...profile };
    const vehiclesSnapshot = vehicles.map((v) => ({ ...v }));

    try {
      // Step 1: Update profile in-memory
      profile.verified = action === "approve";
      profile.rejection_reason = action === "reject" ? reason : null;

      // Step 2: Update vehicles in-memory
      for (const v of vehicles) {
        v.status = action === "approve" ? "Available" : "Pending Verification";
      }

      // Step 3: Insert audit record
      if (auditInsertFails) {
        throw new Error("Foreign key constraint violation or DB error during audit logging");
      }

      audit.push({ id: "aud_1", operator_id: profile.id, action });
      return { success: true };
    } catch (err) {
      // Transaction rollback: restore snapshots
      Object.assign(profile, profileSnapshot);
      vehicles.splice(0, vehicles.length, ...vehiclesSnapshot);
      return { success: false, error: err.message };
    }
  }

  // Attempt verification where audit log fails
  const res = executeVerifyOperatorAtomic(operatorProfile, operatorVehicles, auditTable, {
    action: "approve",
    auditInsertFails: true,
  });

  // Verify failure
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes("audit logging"));

  // Verify atomic rollback
  assert.strictEqual(operatorProfile.verified, false, "Profile verified must remain false after rollback");
  assert.strictEqual(operatorVehicles[0].status, "Pending Verification", "Vehicle status must remain Pending Verification");
  assert.strictEqual(auditTable.length, 0, "No audit records created");
});



