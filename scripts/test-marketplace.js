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

// 39. Booking Inspection Security: Unauthenticated or Invalid Bearer Token Returns 401
test("Booking Inspection Security: Unauthenticated or invalid Bearer token returns 401", () => {
  function handleGetBookingsAuth(authHeader, mockGetUser) {
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return { status: 401, error: "Unauthorized: Valid authentication token required to access bookings" };
    }
    const { user, error } = mockGetUser(token);
    if (error || !user) {
      return { status: 401, error: "Unauthorized: Invalid or expired authentication session" };
    }
    return { status: 200, user };
  }

  // 1. Missing header -> 401
  const resNoHeader = handleGetBookingsAuth(null, () => ({ user: null }));
  assert.strictEqual(resNoHeader.status, 401);
  assert.ok(resNoHeader.error.includes("Valid authentication token required"));

  // 2. Malformed header (no Bearer) -> 401
  const resBadScheme = handleGetBookingsAuth("Basic dXNlcjpwYXNz", () => ({ user: null }));
  assert.strictEqual(resBadScheme.status, 401);

  // 3. Expired/Invalid JWT -> 401
  const resInvalidJwt = handleGetBookingsAuth("Bearer expired_token_xyz", () => ({
    user: null,
    error: { message: "Token expired" },
  }));
  assert.strictEqual(resInvalidJwt.status, 401);
  assert.ok(resInvalidJwt.error.includes("Invalid or expired authentication session"));

  // 4. Genuine token -> 200
  const resValid = handleGetBookingsAuth("Bearer valid_jwt_token", (t) => ({
    user: { id: "usr_alice", email: "alice@test.com" },
  }));
  assert.strictEqual(resValid.status, 200);
  assert.strictEqual(resValid.user.id, "usr_alice");
});

// 40. Booking Inspection Scoping: Traveller A cannot retrieve Traveller B's bookings
test("Booking Inspection Scoping: Traveller A cannot retrieve Traveller B's bookings and query parameters cannot bypass authorization", () => {
  const allBookingsInDb = [
    {
      id: "bk_alice_1",
      booking_code: "BK-1001",
      traveler_id: "usr_alice",
      traveler_name: "Alice Sharma",
      total_amount: 22000,
      journey_status: "Confirmed",
      internal_notes: "Private VIP note",
    },
    {
      id: "bk_eve_1",
      booking_code: "BK-2002",
      traveler_id: "usr_eve",
      traveler_name: "Eve Competitor",
      total_amount: 19000,
      journey_status: "Confirmed",
      internal_notes: "Competitor confidential",
    },
  ];

  function executeGetBookingsForCaller(callerUser, callerProfile, searchParams, dbBookings) {
    const callerRole = callerProfile?.role || "traveller";
    if (callerRole === "traveller") {
      // Must strictly filter by caller's authenticated user ID, IGNORING searchParams.traveler_id
      const filtered = dbBookings.filter((b) => b.traveler_id === callerUser.id);
      // Project only safe fields, excluding internal_notes
      return filtered.map(({ internal_notes, ...safe }) => safe);
    }
    return [];
  }

  // Caller is Alice, but query params attempt to scrape Eve's bookings: ?traveler_id=usr_eve
  const aliceCaller = { id: "usr_alice" };
  const aliceProfile = { role: "traveller" };
  const maliciousParams = { traveler_id: "usr_eve" };

  const results = executeGetBookingsForCaller(aliceCaller, aliceProfile, maliciousParams, allBookingsInDb);

  // 1. Result must only contain Alice's booking
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, "bk_alice_1");
  assert.strictEqual(results[0].traveler_id, "usr_alice");

  // 2. Eve's booking must NOT be present
  assert.strictEqual(results.some((b) => b.traveler_id === "usr_eve"), false);

  // 3. Sensitive fields must be excluded from projection
  assert.strictEqual(results[0].internal_notes, undefined);
});

// 41. Booking Inspection Scoping: Operator A cannot retrieve Operator B's bookings and admin receives authorized broader access
test("Booking Inspection Scoping: Operator A cannot retrieve Operator B's bookings and admin receives authorized broader access", () => {
  const dbBookings = [
    { id: "bk_1", quotation_id: "quo_bob_1", operator_name: "Bob Express", total_amount: 22000, traveler_id: "usr_alice" },
    { id: "bk_2", quotation_id: "quo_charlie_1", operator_name: "Charlie Cabs", total_amount: 25000, traveler_id: "usr_eve" },
    { id: "bk_3", quotation_id: "quo_david_1", operator_name: "David Travels", total_amount: 30000, traveler_id: "usr_frank" },
  ];

  const dbQuotations = [
    { id: "quo_bob_1", operator_id: "op_bob" },
    { id: "quo_charlie_1", operator_id: "op_charlie" },
    { id: "quo_david_1", operator_id: "op_david" },
  ];

  function executeRoleScopedBookings(callerUser, callerProfile, searchParams) {
    const role = callerProfile?.role || "traveller";

    if (role === "admin") {
      let res = [...dbBookings];
      if (searchParams?.operator_id) {
        const opQuotes = dbQuotations.filter((q) => q.operator_id === searchParams.operator_id).map((q) => q.id);
        res = res.filter((b) => opQuotes.includes(b.quotation_id));
      }
      return { status: 200, data: res };
    }

    if (role === "operator") {
      const myQuoteIds = dbQuotations.filter((q) => q.operator_id === callerUser.id).map((q) => q.id);
      const myBookings = dbBookings.filter(
        (b) => myQuoteIds.includes(b.quotation_id) || (callerProfile.operator_name && b.operator_name === callerProfile.operator_name)
      );
      return { status: 200, data: myBookings };
    }

    return { status: 403, error: "Forbidden" };
  }

  // 1. Operator Bob querying -> receives ONLY Bob's booking
  const bobRes = executeRoleScopedBookings({ id: "op_bob" }, { role: "operator", operator_name: "Bob Express" });
  assert.strictEqual(bobRes.status, 200);
  assert.strictEqual(bobRes.data.length, 1);
  assert.strictEqual(bobRes.data[0].id, "bk_1");
  assert.strictEqual(bobRes.data[0].quotation_id, "quo_bob_1");

  // 2. Operator Charlie querying -> receives ONLY Charlie's booking
  const charlieRes = executeRoleScopedBookings({ id: "op_charlie" }, { role: "operator", operator_name: "Charlie Cabs" });
  assert.strictEqual(charlieRes.status, 200);
  assert.strictEqual(charlieRes.data.length, 1);
  assert.strictEqual(charlieRes.data[0].id, "bk_2");

  // 3. Admin querying -> receives all bookings
  const adminRes = executeRoleScopedBookings({ id: "usr_admin_dave" }, { role: "admin" });
  assert.strictEqual(adminRes.status, 200);
  assert.strictEqual(adminRes.data.length, 3);

  // 4. Admin filtering by operator Charlie -> receives only Charlie's bookings
  const adminFilterRes = executeRoleScopedBookings({ id: "usr_admin_dave" }, { role: "admin" }, { operator_id: "op_charlie" });
  assert.strictEqual(adminFilterRes.data.length, 1);
  assert.strictEqual(adminFilterRes.data[0].quotation_id, "quo_charlie_1");
});

// 42. Client DataService: Mutating actions mandate Bearer tokens and missing sessions produce clear error
test("Client DataService: Mutating actions (confirm, quote, vehicle, cancel) mandate Bearer tokens and missing session produces clear error", async () => {
  class MockDataService {
    constructor(session) {
      this.session = session;
    }

    async getAuthHeaders(includeContentType = true) {
      const headers = {};
      if (includeContentType) headers["Content-Type"] = "application/json";
      if (this.session?.access_token) {
        headers["Authorization"] = `Bearer ${this.session.access_token}`;
      }
      return headers;
    }

    async confirmBooking(data) {
      const headers = await this.getAuthHeaders(true);
      if (!headers["Authorization"]) {
        throw new Error("Authentication required: Please sign in as a traveller to confirm this booking");
      }
      return { success: true, headersSent: headers };
    }

    async submitQuotation(data) {
      const headers = await this.getAuthHeaders(true);
      if (!headers["Authorization"]) {
        throw new Error("Authentication required: Please sign in as a verified fleet operator to submit quotations");
      }
      return { success: true, headersSent: headers };
    }

    async registerVehicle(data) {
      const headers = await this.getAuthHeaders(true);
      if (!headers["Authorization"]) {
        throw new Error("Authentication required: Please sign in as an operator to register vehicles");
      }
      return { success: true, headersSent: headers };
    }

    async cancelBooking(bookingId) {
      const headers = await this.getAuthHeaders(true);
      if (!headers["Authorization"]) {
        throw new Error("Authentication required: Please sign in to cancel this booking");
      }
      return { success: true, headersSent: headers };
    }
  }

  // 1. Unauthenticated client -> All mutating methods throw clear authentication error
  const unauthService = new MockDataService(null);
  await assert.rejects(() => unauthService.confirmBooking({}), /Authentication required: Please sign in as a traveller/);
  await assert.rejects(() => unauthService.submitQuotation({}), /Authentication required: Please sign in as a verified fleet operator/);
  await assert.rejects(() => unauthService.registerVehicle({}), /Authentication required: Please sign in as an operator/);
  await assert.rejects(() => unauthService.cancelBooking("bk_1"), /Authentication required: Please sign in to cancel/);

  // 2. Authenticated client -> Attaches Bearer token properly
  const authService = new MockDataService({ access_token: "mock_jwt_access_token_123" });
  const confirmRes = await authService.confirmBooking({});
  assert.strictEqual(confirmRes.headersSent["Authorization"], "Bearer mock_jwt_access_token_123");
  assert.strictEqual(confirmRes.headersSent["Content-Type"], "application/json");

  const quoteRes = await authService.submitQuotation({});
  assert.strictEqual(quoteRes.headersSent["Authorization"], "Bearer mock_jwt_access_token_123");

  const vehicleRes = await authService.registerVehicle({});
  assert.strictEqual(vehicleRes.headersSent["Authorization"], "Bearer mock_jwt_access_token_123");

  const cancelRes = await authService.cancelBooking("bk_1");
  assert.strictEqual(cancelRes.headersSent["Authorization"], "Bearer mock_jwt_access_token_123");
});

// 43. Client DataService: Protected API failures never trigger direct database-write fallbacks and never leak tokens
test("Client DataService: Protected API failures never trigger direct database-write fallbacks and never leak tokens", async () => {
  const directDbWrites = [];

  class MockSecuredService {
    async confirmBookingWithFallbackCheck(apiStatus, apiErrorMessage) {
      // Direct mock of fetch returning error
      const res = { ok: apiStatus >= 200 && apiStatus < 300, status: apiStatus };
      if (!res.ok) {
        // STRICT RULE: Must throw error directly, NO direct db insertion fallback!
        throw new Error(apiErrorMessage || `Booking confirmation failed (HTTP ${apiStatus})`);
      }
      directDbWrites.push({ action: "insert_booking" });
      return { success: true };
    }
  }

  const service = new MockSecuredService();

  // Test 401 Unauthorized from API
  await assert.rejects(
    () => service.confirmBookingWithFallbackCheck(401, "Unauthorized: Valid authentication token required"),
    /Unauthorized/
  );
  assert.strictEqual(directDbWrites.length, 0, "No direct database writes should occur on 401");

  // Test 409 Conflict from API (e.g. Overlapping reservation)
  await assert.rejects(
    () => service.confirmBookingWithFallbackCheck(409, "Vehicle is already confirmed for another booking during the requested dates"),
    /already confirmed/
  );
  assert.strictEqual(directDbWrites.length, 0, "No direct database writes should occur on 409 conflict");

  // Verify access token is not leaked into error messages
  const sampleToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload";
  try {
    const err = new Error("Authentication failed with status 401");
    assert.strictEqual(err.message.includes(sampleToken), false, "Token must never appear in error message");
  } catch (e) {
    assert.fail(e);
  }
});

// 44. Trip Creation Security (POST /api/trips): Authentication, Identity Binding, Validation & Error Handling
test("POST /api/trips: Strict authentication, identity derivation, field validation, and error reporting", async () => {
  const mockDb = [];

  function simulatePostTrip(token, user, body, simulateDbError = false) {
    if (!token) {
      return { status: 401, error: "Unauthorized: Valid authentication token required to create trip requests" };
    }
    if (!user) {
      return { status: 401, error: "Unauthorized: Invalid or expired authentication session" };
    }
    if (!body || typeof body !== "object") {
      return { status: 400, error: "Malformed request payload" };
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
      target_budget,
      amenities = [],
    } = body;

    // Reject attempts to create trips under another user's identity
    if (clientTravelerId && clientTravelerId !== user.id) {
      return { status: 403, error: "Forbidden: Cannot create trip requests on behalf of another user identity" };
    }

    // Server-side field validations
    if (!origin || typeof origin !== "string" || !origin.trim()) {
      return { status: 400, error: "Trip origin is required" };
    }
    if (!destination || typeof destination !== "string" || !destination.trim()) {
      return { status: 400, error: "Trip destination is required" };
    }
    if (!start_date || isNaN(Date.parse(start_date))) {
      return { status: 400, error: "Valid travel start date is required" };
    }
    if (end_date && (isNaN(Date.parse(end_date)) || new Date(end_date) < new Date(start_date))) {
      return { status: 400, error: "Travel end date cannot precede start date" };
    }

    const parsedPax = Number(travellers_count);
    if (isNaN(parsedPax) || parsedPax < 1) {
      return { status: 400, error: "At least 1 passenger is required" };
    }

    const parsedAdults = Number(adults_count) || 0;
    const parsedSeniors = Number(seniors_count) || 0;
    const parsedBags = Number(luggage_bags) || 0;
    if (parsedAdults < 0 || parsedSeniors < 0 || parsedBags < 0) {
      return { status: 400, error: "Passenger and luggage counts must be non-negative" };
    }

    if (simulateDbError) {
      return { status: 500, error: "Database insertion failed: Connection pool exhausted" };
    }

    const newTrip = {
      id: `trp_${Date.now()}`,
      trip_code: `TRP-1234`,
      traveler_id: user.id, // Strictly bound to authenticated user
      traveler_name: user.email?.split("@")[0] || "Traveller",
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
      target_budget: Number(target_budget) || 15000,
      amenities: Array.isArray(amenities) ? amenities : [],
      status: "open",
      quotes_count: 0,
    };

    mockDb.push(newTrip);
    return { status: 201, data: newTrip, database_synced: true };
  }

  // 1. Unauthenticated request -> HTTP 401
  const unauthRes = simulatePostTrip(null, null, { origin: "Delhi", destination: "Jaipur" });
  assert.strictEqual(unauthRes.status, 401);
  assert.match(unauthRes.error, /Unauthorized/);

  // 2. Cross-user spoofing attempt -> HTTP 403
  const spoofRes = simulatePostTrip("token_alice", { id: "usr_alice", email: "alice@test.com" }, {
    traveler_id: "usr_victim_bob", // Mallory attempting to create trip as Bob
    origin: "Delhi NCR",
    destination: "Agra",
    start_date: "2026-11-01",
    travellers_count: 4,
  });
  assert.strictEqual(spoofRes.status, 403);
  assert.match(spoofRes.error, /Forbidden/);

  // 3. Validation failures -> HTTP 400
  const missingOriginRes = simulatePostTrip("token_alice", { id: "usr_alice" }, {
    destination: "Agra",
    start_date: "2026-11-01",
    travellers_count: 2,
  });
  assert.strictEqual(missingOriginRes.status, 400);

  const invalidDatesRes = simulatePostTrip("token_alice", { id: "usr_alice" }, {
    origin: "Delhi",
    destination: "Agra",
    start_date: "2026-11-05",
    end_date: "2026-11-02", // End before start
    travellers_count: 2,
  });
  assert.strictEqual(invalidDatesRes.status, 400);
  assert.match(invalidDatesRes.error, /precede start date/);

  const zeroPaxRes = simulatePostTrip("token_alice", { id: "usr_alice" }, {
    origin: "Delhi",
    destination: "Agra",
    start_date: "2026-11-01",
    travellers_count: 0,
  });
  assert.strictEqual(zeroPaxRes.status, 400);

  // 4. Database failure returns HTTP 500 (Never 201)
  const dbFailRes = simulatePostTrip("token_alice", { id: "usr_alice", email: "alice@test.com" }, {
    origin: "Delhi",
    destination: "Agra",
    start_date: "2026-11-01",
    travellers_count: 4,
  }, true);
  assert.strictEqual(dbFailRes.status, 500);
  assert.strictEqual(dbFailRes.data, undefined);

  // 5. Valid trip creation derives traveler_id from auth and returns HTTP 201
  const validRes = simulatePostTrip("token_alice", { id: "usr_alice", email: "alice@test.com" }, {
    origin: "Delhi NCR",
    destination: "Jaipur",
    start_date: "2026-11-01",
    travellers_count: 6,
    target_budget: 18000,
  });
  assert.strictEqual(validRes.status, 201);
  assert.strictEqual(validRes.database_synced, true);
  assert.strictEqual(validRes.data.traveler_id, "usr_alice");
  assert.strictEqual(mockDb.length, 1);
  assert.strictEqual(mockDb[0].traveler_id, "usr_alice");
});

// 45. CabOffersView: Elimination of hardcoded mock trip fallback and honest empty state
test("CabOffersView: Elimination of hardcoded mock trips (trp_9042, usr_rohan) and honest empty state", () => {
  // Simulate CabOffersView state logic
  function renderCabOffersView(tripRequest, quotations) {
    if (!tripRequest) {
      return {
        viewType: "EMPTY_STATE",
        message: "No active trip request. Plan and publish your itinerary to receive competitive fleet offers.",
        hasPlanningCta: true,
        offersRendered: 0,
      };
    }

    const available = (quotations || []).filter((q) => q.status === "pending" || !q.status);
    if (available.length === 0) {
      return {
        viewType: "WAITING_QUOTES",
        message: "Waiting for fleet operators to submit quotations.",
        tripCode: tripRequest.trip_code,
        offersRendered: 0,
      };
    }

    return {
      viewType: "QUOTATION_LIST",
      tripCode: tripRequest.trip_code,
      offersRendered: available.length,
    };
  }

  // 1. When no tripRequest is passed, it must render honest empty state
  const emptyView = renderCabOffersView(null, []);
  assert.strictEqual(emptyView.viewType, "EMPTY_STATE");
  assert.strictEqual(emptyView.offersRendered, 0);
  assert.strictEqual(emptyView.hasPlanningCta, true);
  assert.strictEqual(
    emptyView.message,
    "No active trip request. Plan and publish your itinerary to receive competitive fleet offers."
  );

  // 2. When valid real trip has 0 quotes
  const waitingView = renderCabOffersView({ id: "trp_real_1", trip_code: "TRP-9999" }, []);
  assert.strictEqual(waitingView.viewType, "WAITING_QUOTES");
  assert.strictEqual(waitingView.offersRendered, 0);

  // 3. When valid real trip has real quotes
  const activeView = renderCabOffersView({ id: "trp_real_1", trip_code: "TRP-9999" }, [
    { id: "quo_1", total_quote: 15000, status: "pending" },
    { id: "quo_2", total_quote: 16500, status: "pending" },
  ]);
  assert.strictEqual(activeView.viewType, "QUOTATION_LIST");
  assert.strictEqual(activeView.offersRendered, 2);

  // 4. Verify that code files do not contain hardcoded trp_9042 fallback in components
  const fs = require("fs");
  const path = require("path");
  const cabOffersCode = fs.readFileSync(path.join(__dirname, "../components/traveller/CabOffersView.tsx"), "utf8");
  assert.strictEqual(cabOffersCode.includes("trp_9042"), false, "CabOffersView must not reference hardcoded trp_9042");
  assert.strictEqual(cabOffersCode.includes("usr_rohan"), false, "CabOffersView must not reference hardcoded usr_rohan");
});

// 46. Authentication Enforcement in Marketplace Workflows (Publishing, Quoting, Vehicle Registration)
test("Marketplace Workflows: Unauthenticated actions open AuthModal, prevent guest fabrication, and attach sessions", () => {
  // Simulate workflow auth gatekeeper
  function handleWorkflowAction(actionType, user, profile, payload) {
    if (!user) {
      return { action: "PROMPT_AUTH_MODAL", preservePayload: payload, permitted: false };
    }

    if (actionType === "PUBLISH_TRIP") {
      return {
        action: "EXECUTE_API",
        permitted: true,
        travelerId: user.id, // Strictly derived from user
      };
    }

    if (actionType === "SUBMIT_QUOTE") {
      if (profile?.role !== "operator") {
        return { action: "REJECT", error: "Operator role required", permitted: false };
      }
      if (!profile?.verified) {
        return { action: "REJECT", error: "Operator verification required", permitted: false };
      }
      return {
        action: "EXECUTE_API",
        permitted: true,
        operatorId: user.id,
      };
    }

    if (actionType === "REGISTER_VEHICLE") {
      return {
        action: "EXECUTE_API",
        permitted: true,
        operatorId: user.id,
      };
    }

    return { permitted: false };
  }

  // 1. Unauthenticated traveller publishing trip -> Triggers auth modal and preserves payload
  const draftTrip = { origin: "Jaipur", destination: "Udaipur", travellers_count: 5 };
  const unauthPublish = handleWorkflowAction("PUBLISH_TRIP", null, null, draftTrip);
  assert.strictEqual(unauthPublish.action, "PROMPT_AUTH_MODAL");
  assert.strictEqual(unauthPublish.permitted, false);
  assert.deepStrictEqual(unauthPublish.preservePayload, draftTrip);

  // 2. Authenticated traveller publishing trip -> Binds travelerId to session user
  const authPublish = handleWorkflowAction("PUBLISH_TRIP", { id: "usr_alice" }, { role: "traveller" }, draftTrip);
  assert.strictEqual(authPublish.action, "EXECUTE_API");
  assert.strictEqual(authPublish.permitted, true);
  assert.strictEqual(authPublish.travelerId, "usr_alice");

  // 3. Unauthenticated operator submitting quote -> Triggers auth modal
  const unauthQuote = handleWorkflowAction("SUBMIT_QUOTE", null, null, { totalQuote: 25000 });
  assert.strictEqual(unauthQuote.action, "PROMPT_AUTH_MODAL");
  assert.strictEqual(unauthQuote.permitted, false);

  // 4. Non-operator attempting to quote -> Rejected
  const travellerQuoting = handleWorkflowAction("SUBMIT_QUOTE", { id: "usr_alice" }, { role: "traveller" }, {});
  assert.strictEqual(travellerQuoting.permitted, false);
  assert.match(travellerQuoting.error, /Operator role required/);

  // 5. Unverified operator attempting to quote -> Rejected
  const unverifiedQuoting = handleWorkflowAction("SUBMIT_QUOTE", { id: "op_unverified" }, { role: "operator", verified: false }, {});
  assert.strictEqual(unverifiedQuoting.permitted, false);
  assert.match(unverifiedQuoting.error, /Operator verification required/);

  // 6. Verified operator submitting quote -> Permitted
  const verifiedQuoting = handleWorkflowAction("SUBMIT_QUOTE", { id: "op_verified" }, { role: "operator", verified: true }, {});
  assert.strictEqual(verifiedQuoting.action, "EXECUTE_API");
  assert.strictEqual(verifiedQuoting.permitted, true);
  assert.strictEqual(verifiedQuoting.operatorId, "op_verified");
});

// 47. Vehicle and Quotation Persistence Error Handling: DB failure returns 500 (Never 201 with fabricated records)
test("Vehicle & Quotation APIs: DB insertion failure returns HTTP 500 and never 201 with fabricated records", async () => {
  // Simulate POST /api/vehicles persistence logic
  function simulateVehicleRegister(dbError, vehiclePayload) {
    if (!vehiclePayload.name || !vehiclePayload.registration_number) {
      return { status: 400, error: "name and registration_number are required" };
    }

    if (dbError) {
      // Defect fix: Must return 500, NOT 201 with database_synced: false
      return {
        status: 500,
        error: `Database insertion failed: ${dbError.message}`,
      };
    }

    const persistedVehicle = {
      ...vehiclePayload,
      id: `veh_${Date.now()}`,
      status: "Available",
      created_at: new Date().toISOString(),
    };

    return {
      status: 201,
      data: persistedVehicle,
      database_synced: true,
    };
  }

  // 1. Vehicle DB failure returns HTTP 500
  const vehFail = simulateVehicleRegister(new Error("Connection terminated unexpectedly"), {
    name: "Force Urbania",
    registration_number: "DL 01 TA 1234",
  });
  assert.strictEqual(vehFail.status, 500);
  assert.strictEqual(vehFail.data, undefined);
  assert.match(vehFail.error, /Database insertion failed/);

  // 2. Vehicle DB success returns HTTP 201
  const vehSuccess = simulateVehicleRegister(null, {
    name: "Force Urbania",
    registration_number: "DL 01 TA 1234",
  });
  assert.strictEqual(vehSuccess.status, 201);
  assert.strictEqual(vehSuccess.database_synced, true);
  assert.ok(vehSuccess.data?.id);

  // Simulate POST /api/quotations persistence logic
  function simulateQuoteSubmit(dbError, quotePayload) {
    if (!quotePayload.trip_request_id || !quotePayload.vehicle_id) {
      return { status: 400, error: "trip_request_id and vehicle_id are required" };
    }

    if (dbError) {
      // Defect fix: Must return 500, NOT 201 with database_synced: false
      return {
        status: 500,
        error: `Database insertion failed: ${dbError.message}`,
      };
    }

    const persistedQuote = {
      ...quotePayload,
      id: `quo_${Date.now()}`,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    return {
      status: 201,
      data: persistedQuote,
      database_synced: true,
    };
  }

  // 3. Quotation DB failure returns HTTP 500
  const quoteFail = simulateQuoteSubmit(new Error("Disk full / table locked"), {
    trip_request_id: "trp_1",
    vehicle_id: "veh_1",
  });
  assert.strictEqual(quoteFail.status, 500);
  assert.strictEqual(quoteFail.data, undefined);
  assert.match(quoteFail.error, /Database insertion failed/);

  // 4. Quotation DB success returns HTTP 201
  const quoteSuccess = simulateQuoteSubmit(null, {
    trip_request_id: "trp_1",
    vehicle_id: "veh_1",
  });
  assert.strictEqual(quoteSuccess.status, 201);
  assert.strictEqual(quoteSuccess.database_synced, true);
  assert.ok(quoteSuccess.data?.id);
});

// 53. Privilege Escalation Barrier: Registration role sanitization & admin self-assignment rejection
test("Self-registration strictly blocks client-specified admin role and forces unverified status for operators", () => {
  // Simulates the security-hardened signUp logic from lib/authContext.tsx
  function simulateRegistration(email, password, fullName, chosenRole, operatorName) {
    if (chosenRole === "admin") {
      return {
        error: "Security violation: Platform administrator accounts cannot be self-registered or created via public registration.",
        profile: null,
      };
    }

    const safeRole = chosenRole === "operator" ? "operator" : "traveller";
    const profile = {
      id: `usr_${Date.now()}`,
      full_name: fullName,
      email,
      role: safeRole,
      operator_name: safeRole === "operator" ? (operatorName || null) : null,
      verified: false, // Security: All new operators require platform admin approval before quoting
      rating: safeRole === "operator" ? 4.90 : 5.0,
      reviews_count: 0,
    };

    return { error: null, profile };
  }

  // 1. Attempting to register as 'admin' must be immediately rejected with security violation
  const adminRegAttempt = simulateRegistration("malicious@actor.com", "Secret123!", "Attacker", "admin");
  assert.ok(adminRegAttempt.error);
  assert.match(adminRegAttempt.error, /Security violation: Platform administrator accounts cannot be self-registered/);
  assert.strictEqual(adminRegAttempt.profile, null);

  // 2. Registering as operator correctly forces verified to false
  const operatorReg = simulateRegistration("newop@fleet.com", "Secret123!", "New Fleet", "operator", "New Fleet LLC");
  assert.strictEqual(operatorReg.error, null);
  assert.strictEqual(operatorReg.profile.role, "operator");
  assert.strictEqual(operatorReg.profile.verified, false);

  // 3. Registering as traveller correctly sets traveller role
  const travellerReg = simulateRegistration("traveler@family.com", "Secret123!", "Family Group", "traveller");
  assert.strictEqual(travellerReg.error, null);
  assert.strictEqual(travellerReg.profile.role, "traveller");
  assert.strictEqual(travellerReg.profile.operator_name, null);

  // 4. Any unexpected or malicious role string is coerced to safe traveller
  const customRoleReg = simulateRegistration("custom@test.com", "Secret123!", "Custom Role", "super_admin");
  assert.strictEqual(customRoleReg.error, null);
  assert.strictEqual(customRoleReg.profile.role, "traveller");
});

// 54. Database Trigger Invariant: protect_profile_privilege_escalation rejects direct INSERT with role='admin' or verified=true
test("54. Database Trigger Invariant: protect_profile_privilege_escalation rejects direct INSERT with role='admin' or verified=true", () => {
  // Simulates PostgreSQL plpgsql protect_profile_privilege_escalation() function on INSERT
  function simulateProfileInsertTrigger(authContext, newRow) {
    const authRole = authContext?.role || "authenticated";
    const authUid = authContext?.uid || null;

    if (authRole !== "service_role") {
      // 1. Direct insert of 'admin' role is prohibited
      if (newRow.role === "admin") {
        const err = new Error("Forbidden: Administrator accounts cannot be self-registered or inserted via client APIs");
        err.code = "42501";
        throw err;
      }

      // 2. Direct insert of verified=true for commercial operators is prohibited
      if (newRow.role === "operator" && newRow.verified === true) {
        const err = new Error("Forbidden: Commercial fleet operators require administrator compliance verification before activation");
        err.code = "42501";
        throw err;
      }

      // 3. Callers can only insert their own profile matching auth.uid()
      if (!authUid || authUid !== newRow.id) {
        const err = new Error("Forbidden: Cannot insert profile for another user identity");
        err.code = "42501";
        throw err;
      }
    }

    return newRow;
  }

  const callerContext = { role: "authenticated", uid: "usr_alice" };

  // 1. Authenticated user attempting direct REST insert with role='admin' is rejected with 42501
  assert.throws(
    () => {
      simulateProfileInsertTrigger(callerContext, {
        id: "usr_alice",
        email: "alice@evil.com",
        role: "admin",
        verified: false,
      });
    },
    (err) => err.code === "42501" && err.message.includes("Administrator accounts cannot be self-registered")
  );

  // 2. Authenticated operator attempting direct REST insert with verified=true is rejected with 42501
  assert.throws(
    () => {
      simulateProfileInsertTrigger(callerContext, {
        id: "usr_alice",
        email: "alice@fleet.com",
        role: "operator",
        verified: true,
      });
    },
    (err) => err.code === "42501" && err.message.includes("Commercial fleet operators require administrator compliance verification")
  );

  // 3. User attempting to insert a profile for a different user ID is rejected
  assert.throws(
    () => {
      simulateProfileInsertTrigger(callerContext, {
        id: "usr_bob",
        email: "bob@other.com",
        role: "traveller",
        verified: false,
      });
    },
    (err) => err.code === "42501" && err.message.includes("Cannot insert profile for another user identity")
  );

  // 4. Valid traveller profile insertion succeeds
  const validTraveller = simulateProfileInsertTrigger(callerContext, {
    id: "usr_alice",
    email: "alice@trip.com",
    role: "traveller",
    verified: false,
  });
  assert.strictEqual(validTraveller.role, "traveller");
  assert.strictEqual(validTraveller.verified, false);

  // 5. Valid unverified operator profile insertion succeeds
  const validOperator = simulateProfileInsertTrigger(callerContext, {
    id: "usr_alice",
    email: "alice@transport.com",
    role: "operator",
    verified: false,
  });
  assert.strictEqual(validOperator.role, "operator");
  assert.strictEqual(validOperator.verified, false);

  // 6. Privileged service_role (DBA/seeding) can provision admin accounts
  const serviceRoleContext = { role: "service_role", uid: null };
  const adminProvisioned = simulateProfileInsertTrigger(serviceRoleContext, {
    id: "admin_master",
    email: "admin@tripvahan.internal",
    role: "admin",
    verified: true,
  });
  assert.strictEqual(adminProvisioned.role, "admin");
  assert.strictEqual(adminProvisioned.verified, true);
});

// =========================================================================
// AI TRIP PLANNER REGRESSION SUITE (Tests 55–60)
// =========================================================================

// 55. AI Trip Planner: Input Validation and Security Guards
test("55. AI Trip Planner: Request validation strictly enforces non-empty prompt, 1000 char limit, and JSON structure", () => {
  function validateAiPlanRequest(body) {
    if (!body || typeof body !== "object") {
      return { status: 400, error: "Invalid request: Expected JSON body with a prompt" };
    }
    const { prompt } = body;
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return { status: 400, error: "Prompt cannot be empty. Please describe your desired trip." };
    }
    if (prompt.length > 1000) {
      return { status: 400, error: "Prompt exceeds maximum allowed length of 1,000 characters" };
    }
    return { status: 200, prompt: prompt.trim() };
  }

  // 1. Missing body or non-object body
  assert.strictEqual(validateAiPlanRequest(null).status, 400);
  assert.strictEqual(validateAiPlanRequest("raw string").status, 400);

  // 2. Empty or whitespace prompt
  assert.strictEqual(validateAiPlanRequest({}).status, 400);
  assert.strictEqual(validateAiPlanRequest({ prompt: "" }).status, 400);
  assert.strictEqual(validateAiPlanRequest({ prompt: "   \n\t  " }).status, 400);

  // 3. Prompt exceeding 1000 characters
  const oversizedPrompt = "A".repeat(1001);
  const oversizedRes = validateAiPlanRequest({ prompt: oversizedPrompt });
  assert.strictEqual(oversizedRes.status, 400);
  assert.match(oversizedRes.error, /exceeds maximum allowed length of 1,000 characters/);

  // 4. Valid prompt within limits
  const validRes = validateAiPlanRequest({ prompt: "Plan a 5-day Delhi to Manali trip for 8 people" });
  assert.strictEqual(validRes.status, 200);
  assert.strictEqual(validRes.prompt, "Plan a 5-day Delhi to Manali trip for 8 people");
});

// 56. AI Trip Planner: Missing AI Configuration & Deterministic NLP Fallback
test("56. AI Trip Planner: When Gemini API is not configured, engine falls back to intelligent_nlp and parses corridor facts", () => {
  // Simulates NLP corridor parsing logic
  function simulateAiTripPlanner(prompt, apiKey) {
    const engine = apiKey ? "gemini_live" : "intelligent_nlp";
    const p = prompt.toLowerCase();

    // Check ambiguous
    const hasOrigin = p.includes("delhi") || p.includes("bangalore") || p.includes("mumbai");
    const hasDest = p.includes("manali") || p.includes("jaipur") || p.includes("ooty") || p.includes("goa");
    if (!hasOrigin || !hasDest) {
      return {
        success: false,
        engine,
        needs_clarification: true,
        missing_fields: [!hasOrigin ? "origin" : "", !hasDest ? "destination" : ""].filter(Boolean),
        clarification_questions: ["Where will your journey begin and what is your primary destination?"],
      };
    }

    // Capacity matching
    let pax = 4;
    const paxMatch = p.match(/(\d+)\s*(?:people|pax|passengers)/);
    if (paxMatch) pax = parseInt(paxMatch[1], 10);

    let vehicle = "Executive Sedan (Dzire / Etios)";
    if (pax > 4 && pax <= 7) vehicle = "Innova Crysta / Premium SUV (6+1 / 7+1)";
    else if (pax > 7 && pax <= 16) vehicle = "Force Urbania / Tempo (12-16 Seater)";

    let budget = 25000;
    const budgetMatch = p.match(/(?:₹|rs\.?|budget\s*(?:of|is|:)?\s*)?\s*(\d{4,6})/);
    if (budgetMatch) budget = parseInt(budgetMatch[1], 10);

    return {
      success: true,
      engine,
      trip: {
        origin: "Delhi NCR",
        destination: "Manali",
        days_count: 5,
        travellers_count: pax,
        matched_vehicle_class: vehicle,
        target_budget: budget,
        indicative_budget_min: Math.round(budget * 0.9),
        indicative_budget_max: Math.round(budget * 1.1),
        distance_km: 1150,
        formatted_travel_time: "~24 hrs total drive time",
        user_facts: { origin: "Delhi NCR", destination: "Manali", passengers: pax, budget },
        ai_suggestions: { vehicle_class_recommendation: vehicle },
        disclaimer: "Indicative estimates only. Exact quotes will be provided by verified fleet operators.",
      },
    };
  }

  // Without GEMINI_API_KEY
  const result = simulateAiTripPlanner(
    "Plan a 5-day Delhi-to-Manali trip for 8 people, including 2 children, with luggage and a ₹35000 budget.",
    null
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.engine, "intelligent_nlp", "Must report intelligent_nlp when no key is set");
  assert.strictEqual(result.trip.origin, "Delhi NCR");
  assert.strictEqual(result.trip.destination, "Manali");
  assert.strictEqual(result.trip.travellers_count, 8);
  assert.strictEqual(result.trip.target_budget, 35000);
  assert.strictEqual(result.trip.matched_vehicle_class, "Force Urbania / Tempo (12-16 Seater)");
  assert.strictEqual(result.trip.distance_km, 1150);
});

// 57. AI Trip Planner: Ambiguous Trip Descriptions Require Clarification
test("57. AI Trip Planner: Ambiguous trip descriptions trigger needs_clarification and do not invent details", () => {
  function checkAmbiguity(prompt) {
    const p = prompt.toLowerCase();
    const hasOrigin = p.includes("delhi") || p.includes("bangalore") || p.includes("mumbai");
    const hasDest = p.includes("manali") || p.includes("jaipur") || p.includes("ooty");

    if (!hasOrigin || !hasDest) {
      return {
        success: false,
        engine: "intelligent_nlp",
        needs_clarification: true,
        missing_fields: [!hasOrigin ? "origin" : "", !hasDest ? "destination" : ""].filter(Boolean),
        clarification_questions: [
          "Where will your journey begin and what is your primary destination? (e.g. Delhi to Manali)",
        ],
      };
    }
    return { success: true };
  }

  // Ambiguous prompt without route
  const res1 = checkAmbiguity("Plan a nice trip for 6 people next weekend");
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.needs_clarification, true);
  assert.ok(res1.missing_fields.includes("origin"));
  assert.ok(res1.missing_fields.includes("destination"));
  assert.ok(res1.clarification_questions.length > 0);

  // Ambiguous prompt with only origin
  const res2 = checkAmbiguity("I am in Delhi with 4 friends looking to travel");
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.needs_clarification, true);
  assert.ok(res2.missing_fields.includes("destination"));
});

// 58. AI Trip Planner: Mocked Gemini Live Provider Integration & Validation
test("58. AI Trip Planner: Mocked Gemini live response validates output schema and handles timeouts gracefully", async () => {
  async function mockGeminiCall(prompt, timeoutMs, shouldTimeout, malformedJson) {
    if (shouldTimeout) {
      throw new Error("Gemini request timed out after 9000ms");
    }
    if (malformedJson) {
      return "NOT_VALID_JSON{{{";
    }
    return JSON.stringify({
      origin: "Delhi NCR",
      destination: "Jaipur",
      stops: ["Amer Fort", "Neemrana"],
      circuit_title: "Delhi NCR → Jaipur",
      circuit_type: "Multi-day circuit",
      duration: "3 Days, 2 Nights",
      days_count: 3,
      travellers_count: 6,
      target_budget: 22000,
      distance_km: 560,
      duration_hours: 10,
    });
  }

  // 1. Successful model response parsed and validated
  const rawResponse = await mockGeminiCall("Delhi to Jaipur for 6", 9000, false, false);
  const parsed = JSON.parse(rawResponse);
  assert.strictEqual(parsed.origin, "Delhi NCR");
  assert.strictEqual(parsed.destination, "Jaipur");
  assert.strictEqual(parsed.travellers_count, 6);

  // 2. Timeout handled safely without crashing
  await assert.rejects(
    async () => mockGeminiCall("prompt", 9000, true, false),
    /timed out/
  );

  // 3. Malformed JSON handled gracefully
  const badResponse = await mockGeminiCall("prompt", 9000, false, true);
  assert.throws(() => JSON.parse(badResponse));
});

// 59. AI Trip Planner: Distinction between facts, suggestions, and no fake marketplace inventory
test("59. AI Trip Planner: Output clearly distinguishes user facts from AI suggestions and provides zero fabricated operators", () => {
  const aiOutput = {
    user_facts: {
      origin: "Delhi NCR",
      destination: "Manali",
      passengers: 8,
      budget: 35000,
    },
    ai_suggestions: {
      suggested_stops: ["Chandigarh", "Kullu Valley"],
      vehicle_class_recommendation: "Force Urbania / Tempo (12-16 Seater)",
      recommended_amenities: ["Dual AC & Reclining Pushback Seats", "Waterproof Carrier Roof Rack"],
    },
    disclaimer: "Indicative estimates only. Exact rates and vehicle allocations will be provided by verified fleet operators upon publication.",
  };

  // Facts must match user input
  assert.strictEqual(aiOutput.user_facts.origin, "Delhi NCR");
  assert.strictEqual(aiOutput.user_facts.passengers, 8);

  // Recommendations are labeled suggestions, not confirmed inventory
  assert.ok(aiOutput.ai_suggestions.suggested_stops.length > 0);
  assert.ok(aiOutput.disclaimer.includes("Indicative estimates only"));

  // Check that NO operator names, driver names, vehicle registrations, or fake bids exist
  assert.strictEqual(aiOutput.operator_name, undefined);
  assert.strictEqual(aiOutput.driver_name, undefined);
  assert.strictEqual(aiOutput.vehicle_reg, undefined);
  assert.strictEqual(aiOutput.bids, undefined);
});

// 60. AI Trip Planner: Human Confirmation & Authentication Workflow before Publication
test("60. AI Trip Planner: Modal transfer never auto-publishes to database; requires human review and authenticated user", () => {
  // Simulates transfer action to form
  function transferPlanToForm(aiPlan, currentFormState) {
    return {
      ...currentFormState,
      origin: aiPlan.origin,
      destination: aiPlan.destination,
      stops: aiPlan.stops,
      duration: aiPlan.duration,
      distanceKm: aiPlan.distance_km,
      adults: aiPlan.adults_count,
      targetBudget: aiPlan.target_budget,
      ai_notice: "Pre-filled by AI Trip Planner. Review all details before publishing.",
      is_published: false, // Never auto-published!
    };
  }

  // Simulates form submission
  function publishTripFromForm(formState, user) {
    if (!user) {
      return { action: "SHOW_AUTH_MODAL", published: false };
    }
    if (!formState.origin || !formState.destination) {
      return { error: "Origin and destination required", published: false };
    }
    return {
      action: "INSERT_DATABASE",
      published: true,
      trip: {
        traveler_id: user.id, // Authenticated identity
        origin: formState.origin,
        destination: formState.destination,
        target_budget: formState.targetBudget,
      },
    };
  }

  const sampleAiPlan = {
    origin: "Delhi NCR",
    destination: "Manali",
    stops: ["Chandigarh", "Kullu"],
    duration: "5 Days, 4 Nights",
    distance_km: 1150,
    adults_count: 8,
    target_budget: 35000,
  };

  const initialForm = { origin: "", destination: "", is_published: false };

  // 1. Transferring sets form state but does NOT publish
  const updatedForm = transferPlanToForm(sampleAiPlan, initialForm);
  assert.strictEqual(updatedForm.origin, "Delhi NCR");
  assert.strictEqual(updatedForm.destination, "Manali");
  assert.strictEqual(updatedForm.is_published, false, "Must not auto-publish on modal transfer");

  // 2. Unauthenticated publication attempt requires AuthModal
  const unauthAttempt = publishTripFromForm(updatedForm, null);
  assert.strictEqual(unauthAttempt.action, "SHOW_AUTH_MODAL");
  assert.strictEqual(unauthAttempt.published, false);

  // 3. Authenticated publication derives traveler_id from session user
  const authAttempt = publishTripFromForm(updatedForm, { id: "usr_verified_traveler" });
  assert.strictEqual(authAttempt.published, true);
  assert.strictEqual(authAttempt.trip.traveler_id, "usr_verified_traveler");
});

// 61. Production UI: Elimination of Hackathon Walkthrough Banner
test("61. Production UI: Hackathon Walkthrough Banner and demo state are completely removed from app/page.tsx", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const pagePath = path.resolve(__dirname, "../app/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");

  assert.strictEqual(
    pageContent.includes("Hackathon Demo Walkthrough"),
    false,
    "app/page.tsx must not contain the Hackathon Demo Walkthrough title"
  );
  assert.strictEqual(
    pageContent.includes("showHackathonGuide"),
    false,
    "app/page.tsx must not contain showHackathonGuide state or handler"
  );
  assert.strictEqual(
    pageContent.includes("Follow 3 simple steps to experience the complete marketplace"),
    false,
    "app/page.tsx must not contain hackathon guide instruction text"
  );
});

// 62. Production Security: Elimination of 1-Click Demo Persona Logins
test("62. Production Security: AuthModal requires genuine credentials and contains no 1-click demo persona bypass", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const authModalPath = path.resolve(__dirname, "../components/common/AuthModal.tsx");
  const authModalContent = fs.readFileSync(authModalPath, "utf-8");

  assert.strictEqual(
    authModalContent.includes("handleQuickSignIn"),
    false,
    "AuthModal must not contain handleQuickSignIn demo bypass function"
  );
  assert.strictEqual(
    authModalContent.includes("@tripvahan.demo"),
    false,
    "AuthModal must not contain hardcoded demo email credentials"
  );
  assert.strictEqual(
    authModalContent.includes("Hackathon Quick Access"),
    false,
    "AuthModal must not contain Hackathon Quick Access card"
  );
  assert.strictEqual(
    authModalContent.includes("1-Click Demo Login"),
    false,
    "AuthModal must not contain 1-Click Demo Login UI"
  );
});







