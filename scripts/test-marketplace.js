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

// 3. Concurrency Protection Test
test("Concurrency protection prevents double-booking same vehicle for overlapping pickup dates", () => {
  const bookings = [
    {
      id: "bk_1",
      booking_code: "BK-1001",
      vehicle_reg: "DL 01 TA 9821",
      pickup_date: "2026-10-24",
      status: "Confirmed",
    },
  ];

  function canBookVehicle(vehicleReg, pickupDate) {
    const conflict = bookings.find(
      (b) => b.vehicle_reg === vehicleReg && b.pickup_date === pickupDate && b.status === "Confirmed"
    );
    if (conflict) {
      return { allowed: false, message: `Vehicle ${vehicleReg} is already confirmed for booking ${conflict.booking_code} on ${pickupDate}` };
    }
    return { allowed: true };
  }

  // Attempting to book same vehicle on same date must be rejected
  const resConflict = canBookVehicle("DL 01 TA 9821", "2026-10-24");
  assert.strictEqual(resConflict.allowed, false);

  // Attempting to book different vehicle on same date must be allowed
  const resDifferentVehicle = canBookVehicle("DL 01 TA 3311", "2026-10-24");
  assert.strictEqual(resDifferentVehicle.allowed, true);

  // Attempting to book same vehicle on different date must be allowed
  const resDifferentDate = canBookVehicle("DL 01 TA 9821", "2026-10-28");
  assert.strictEqual(resDifferentDate.allowed, true);
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
