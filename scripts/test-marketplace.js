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
