const { createClient } = require("@supabase/supabase-js");

const BASE_URL = process.env.TEST_BASE_URL || "https://tripvahan.vercel.app";
const SUPABASE_URL = process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.STAGING_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const PRODUCTION_PROJECT_ID = "ykaorzsoajfwuzibmgoo";
if (!SUPABASE_URL || SUPABASE_URL.includes(PRODUCTION_PROJECT_ID)) {
  console.error("\n🚨 SAFETY INTERCEPT: Direct probe/execution against production (ykaorzsoajfwuzibmgoo) is prohibited.");
  console.error("Please supply a dedicated staging or local URL via STAGING_SUPABASE_URL.\n");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runUpdateSecurityTests() {
  console.log("==================================================================");
  console.log("TRIPVAHAN — UPDATE POLICY & LEAST-PRIVILEGE SECURITY TEST SUITE");
  console.log(`Target Service: ${BASE_URL}`);
  console.log(`Target Database: ${SUPABASE_URL}`);
  console.log("==================================================================\n");

  const ts = Date.now();
  const testOpId = `op_sec_${ts}`;
  const testTrvId = `trv_sec_${ts}`;
  const testVehId = `veh_sec_${ts}`;
  const testVehReg = `DL 01 SEC ${Math.floor(1000 + Math.random() * 9000)}`;

  let passed = 0;
  let failed = 0;

  function report(name, isPass, detail) {
    if (isPass) {
      passed++;
      console.log(`[PASS] ${name}: ${detail}`);
    } else {
      failed++;
      console.log(`[FAIL] ${name}: ${detail}`);
    }
  }

  try {
    // Setup isolated test profiles
    await sb.from("profiles").insert([
      {
        id: testOpId,
        full_name: "Test Operator Unverified",
        email: `op_sec_${ts}@test.com`,
        role: "operator",
        operator_name: "Security Test Fleet",
        verified: false // UNVERIFIED OPERATOR
      },
      {
        id: testTrvId,
        full_name: "Test Traveller Owner",
        email: `trv_sec_${ts}@test.com`,
        role: "traveller",
        verified: true
      }
    ]);

    const testVehId2 = `veh_sec_2_${ts}`;
    const testVehReg2 = `DL 01 SEC ${Math.floor(1000 + Math.random() * 9000)}`;

    // Setup vehicles
    await sb.from("vehicles").insert([
      {
        id: testVehId,
        operator_id: testOpId,
        operator_name: "Security Test Fleet",
        name: "Security Test Cab",
        category: "Urbania / Tempo",
        registration_number: testVehReg,
        seating_capacity: 13,
        luggage_capacity: 12,
        model_year: 2023,
        compliance_status: "Pending Operator Verification",
        status: "Pending Verification"
      },
      {
        id: testVehId2,
        operator_id: testOpId,
        operator_name: "Security Test Fleet",
        name: "Security Test Cab 2",
        category: "Urbania / Tempo",
        registration_number: testVehReg2,
        seating_capacity: 13,
        luggage_capacity: 12,
        model_year: 2023,
        compliance_status: "Pending Operator Verification",
        status: "Pending Verification"
      }
    ]);

    // -------------------------------------------------------------------------
    // TEST 1: Price Manipulation Guard via Booking Confirmation
    // A client attempts to book with total_amount: 100 instead of quote's 25,000.
    // The server MUST ignore the client-sent 100 and bind 25,000 authoritatively.
    // -------------------------------------------------------------------------
    const testTripId = `trp_sec_${ts}`;
    const testQuoteId = `quo_sec_${ts}`;

    const { error: trErr } = await sb.from("trip_requests").insert([{
      id: testTripId,
      trip_code: `TRP-SEC-${Math.floor(1000 + Math.random() * 9000)}`,
      traveler_id: testTrvId,
      traveler_name: "Test Traveller Owner",
      circuit_title: "Delhi to Jaipur",
      origin: "Delhi",
      destination: "Jaipur",
      circuit_type: "Outstation Trip",
      distance_km: 300,
      start_date: "2026-12-01",
      duration: "3 Days",
      pickup_time: "06:00 AM",
      pickup_address: "Connaught Place, New Delhi",
      travellers_count: 8,
      matched_vehicle_class: "Urbania / Tempo",
      target_budget: 25000,
      status: "open"
    }]);
    if (trErr) console.error("Trip insert error:", trErr);

    await sb.from("quotations").insert([{
      id: testQuoteId,
      trip_request_id: testTripId,
      trip_code: "TRP-SEC",
      operator_id: testOpId,
      operator_name: "Security Test Fleet",
      vehicle_id: testVehId,
      vehicle_name: "Security Test Cab",
      vehicle_category: "Urbania / Tempo",
      vehicle_reg: testVehReg,
      model_year: 2023,
      base_vehicle_fuel_rate: 19000,
      driver_night_allowance: 2000,
      tolls_state_permit_taxes: 4000,
      total_quote: 25000, // AUTHORITATIVE DATABASE PRICE
      per_person_fare: 3125,
      status: "pending"
    }]);

    // Client maliciously attempts to send total_amount: 100
    const spoofRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: testTripId,
        quotation_id: testQuoteId,
        traveler_id: testTrvId,
        vehicle_reg: testVehReg,
        pickup_date: "2026-12-01",
        duration: "3 Days",
        total_amount: 100, // MALICIOUS SPOOF ATTEMPT
        per_person_amount: 12
      })
    });

    const spoofData = await spoofRes.json();
    const persistedAmount = spoofData.data?.total_amount;
    const priceProtected = spoofRes.status === 201 && persistedAmount === 25000;
    report(
      "Price Manipulation Protection",
      priceProtected,
      `Client submitted ₹100 spoofed total; server enforced authoritative database price of ₹${persistedAmount} (HTTP ${spoofRes.status})`
    );

    const bookingId = spoofData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 2: Legitimate Booking Status Lifecycle Transition via PATCH
    // Transition Confirmed -> Cancelled
    // -------------------------------------------------------------------------
    if (bookingId) {
      const patchRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          journey_status: "Cancelled",
          reason: "Traveller itinerary changed"
        })
      });

      const patchData = await patchRes.json();
      const cancelPass = patchRes.status === 200 && patchData.data?.journey_status === "Cancelled";
      report(
        "Authorized Booking Cancellation Lifecycle",
        cancelPass,
        `Status transitioned to Cancelled via PATCH (HTTP ${patchRes.status}); Trip and quotation released.`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 3: Invalid Journey Status Transition via PATCH
    // Attempting to send an invalid arbitrary status "HackedStatus"
    // -------------------------------------------------------------------------
    if (bookingId) {
      const invalidPatchRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          journey_status: "HackedStatus"
        })
      });

      const invalidPass = invalidPatchRes.status === 400;
      report(
        "Invalid Journey Status Rejection",
        invalidPass,
        `Server rejected invalid status with HTTP ${invalidPatchRes.status}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4: Cross-Operator Quoting Unauthorized Access
    // Operator B attempts to quote using Operator A's vehicle
    // -------------------------------------------------------------------------
    const crossQuoteRes = await fetch(`${BASE_URL}/api/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: testTripId,
        operator_id: "op_attacker_fake",
        vehicle_id: testVehId, // Belongs to testOpId!
        base_vehicle_fuel_rate: 15000,
        driver_night_allowance: 1500,
        tolls_state_permit_taxes: 2500,
        travellers_count: 8
      })
    });

    const crossPass = crossQuoteRes.status === 403;
    report(
      "Cross-Operator Fleet Access Protection",
      crossPass,
      `Blocked unauthorized quote on third-party vehicle with HTTP ${crossQuoteRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Unverified Operator Self-Badging Protection
    // Unverified operator tries to claim verified badge
    // -------------------------------------------------------------------------
    const unverQuoteRes = await fetch(`${BASE_URL}/api/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: testTripId,
        operator_id: testOpId, // UNVERIFIED
        vehicle_id: testVehId2,
        base_vehicle_fuel_rate: 16000,
        driver_night_allowance: 1500,
        tolls_state_permit_taxes: 2500,
        travellers_count: 8,
        badge: "Tier-1 Verified Partner" // False claim
      })
    });

    const unverQuoteData = await unverQuoteRes.json();
    const badgeOverridden = unverQuoteData.data?.badge === "Pending Verification";
    report(
      "Unverified Operator Self-Badging Protection",
      badgeOverridden,
      `Badge false claim overridden to "${unverQuoteData.data?.badge}"`
    );

    // Cleanup
    if (bookingId) {
      await sb.from("bookings").delete().eq("id", bookingId);
    }
    await sb.from("bookings").delete().in("vehicle_reg", [testVehReg, testVehReg2]);
    await sb.from("quotations").delete().in("id", [testQuoteId, unverQuoteData.data?.id].filter(Boolean));
    await sb.from("trip_requests").delete().eq("id", testTripId);
    await sb.from("vehicles").delete().in("id", [testVehId, testVehId2]);
    await sb.from("profiles").delete().in("id", [testOpId, testTrvId]);

    console.log("\n==================================================================");
    console.log("UPDATE & AUTHORIZATION SECURITY AUDIT SUMMARY");
    console.log(`Total Checks: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
    console.log("==================================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runUpdateSecurityTests();
