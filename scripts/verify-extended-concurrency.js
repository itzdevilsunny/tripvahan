const { createClient } = require("@supabase/supabase-js");

const BASE_URL = process.env.TEST_BASE_URL || "https://tripvahan.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EBLp2hLf7wwcb8aiv-ZqTQ_QzW_nqUU";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runExtendedVerification() {
  console.log("==================================================================");
  console.log("TRIPVAHAN — EXTENDED CONCURRENCY & CANCELLATION LIFECYCLE TEST");
  console.log(`Target Service: ${BASE_URL}`);
  console.log(`Target Database: ${SUPABASE_URL}`);
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const testOperatorId = `op_ext_${timestamp}`;
  const testTravellerId = `trv_ext_${timestamp}`;
  const testVehicleId = `veh_ext_${timestamp}`;
  const testVehicleReg = `DL 01 EXT ${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // 1. Setup Profiles
    await sb.from("profiles").insert([
      {
        id: testOperatorId,
        full_name: "Surender Pal (Extended Test)",
        email: `surender_ext_${timestamp}@tripvahan.test`,
        phone: "+91 98111 22334",
        role: "operator",
        operator_name: "Delhi Express Fleet",
        operator_code: `DL-OP-${Math.floor(100 + Math.random() * 900)}`,
        verified: true
      },
      {
        id: testTravellerId,
        full_name: "Pooja Verma (Extended Test)",
        email: `pooja_ext_${timestamp}@tripvahan.test`,
        phone: "+91 98222 33445",
        role: "traveller",
        verified: true
      }
    ]);

    // 2. Setup Vehicle
    await sb.from("vehicles").insert([{
      id: testVehicleId,
      operator_id: testOperatorId,
      operator_name: "Delhi Express Fleet",
      name: "Force Urbania Executive 13-Seater",
      category: "Urbania / Tempo",
      registration_number: testVehicleReg,
      seating_capacity: 13,
      luggage_capacity: 12,
      model_year: 2024,
      compliance_status: "Commercial Yellow Board Valid",
      speed_governor_status: "Speed-Gov: 80 km/h Active",
      status: "Available"
    }]);

    // -------------------------------------------------------------------------
    // TEST PART A: Non-Overlapping Bookings on the Same Vehicle
    // Interval 1: 2026-11-20 to 2026-11-22 (3 Days)
    // Interval 2: 2026-11-25 to 2026-11-27 (3 Days)
    // Both MUST succeed with HTTP 201 Created
    // -------------------------------------------------------------------------
    const trip1Id = `trp_part_a1_${timestamp}`;
    const trip2Id = `trp_part_a2_${timestamp}`;
    const quo1Id = `quo_part_a1_${timestamp}`;
    const quo2Id = `quo_part_a2_${timestamp}`;

    await sb.from("trip_requests").insert([
      {
        id: trip1Id,
        trip_code: `TRP-EXT-A1-${Math.floor(1000 + Math.random() * 9000)}`,
        traveler_id: testTravellerId,
        traveler_name: "Pooja Verma",
        circuit_title: "Delhi NCR → Jaipur Circuit",
        origin: "Delhi NCR",
        destination: "Jaipur",
        circuit_type: "Outstation Trip",
        distance_km: 300,
        start_date: "2026-11-20",
        duration: "3 Days",
        pickup_time: "06:00 AM",
        pickup_address: "Aerocity, New Delhi",
        travellers_count: 8,
        matched_vehicle_class: "Urbania / Tempo",
        target_budget: 25000,
        status: "open"
      },
      {
        id: trip2Id,
        trip_code: `TRP-EXT-A2-${Math.floor(1000 + Math.random() * 9000)}`,
        traveler_id: testTravellerId,
        traveler_name: "Pooja Verma",
        circuit_title: "Delhi NCR → Agra & Mathura",
        origin: "Delhi NCR",
        destination: "Agra",
        circuit_type: "Outstation Trip",
        distance_km: 240,
        start_date: "2026-11-25",
        duration: "3 Days",
        pickup_time: "07:00 AM",
        pickup_address: "Aerocity, New Delhi",
        travellers_count: 8,
        matched_vehicle_class: "Urbania / Tempo",
        target_budget: 22000,
        status: "open"
      }
    ]);

    await sb.from("quotations").insert([
      {
        id: quo1Id,
        trip_request_id: trip1Id,
        trip_code: "TRP-EXT-A1",
        operator_id: testOperatorId,
        operator_name: "Delhi Express Fleet",
        vehicle_id: testVehicleId,
        vehicle_name: "Force Urbania Executive 13-Seater",
        vehicle_category: "Urbania / Tempo",
        vehicle_reg: testVehicleReg,
        model_year: 2024,
        base_vehicle_fuel_rate: 18000,
        driver_night_allowance: 2000,
        tolls_state_permit_taxes: 4000,
        total_quote: 24000,
        per_person_fare: 3000,
        status: "pending"
      },
      {
        id: quo2Id,
        trip_request_id: trip2Id,
        trip_code: "TRP-EXT-A2",
        operator_id: testOperatorId,
        operator_name: "Delhi Express Fleet",
        vehicle_id: testVehicleId,
        vehicle_name: "Force Urbania Executive 13-Seater",
        vehicle_category: "Urbania / Tempo",
        vehicle_reg: testVehicleReg,
        model_year: 2024,
        base_vehicle_fuel_rate: 16000,
        driver_night_allowance: 2000,
        tolls_state_permit_taxes: 3000,
        total_quote: 21000,
        per_person_fare: 2625,
        status: "pending"
      }
    ]);

    // Book Interval 1
    const resA1 = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: trip1Id,
        quotation_id: quo1Id,
        traveler_id: testTravellerId,
        vehicle_reg: testVehicleReg,
        pickup_date: "2026-11-20",
        duration: "3 Days"
      })
    });
    const dataA1 = await resA1.json();

    // Book Interval 2 (Non-overlapping)
    const resA2 = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: trip2Id,
        quotation_id: quo2Id,
        traveler_id: testTravellerId,
        vehicle_reg: testVehicleReg,
        pickup_date: "2026-11-25",
        duration: "3 Days"
      })
    });
    const dataA2 = await resA2.json();

    const nonOverlapPass = resA1.status === 201 && resA2.status === 201;
    console.log(`[${nonOverlapPass ? "PASS" : "FAIL"}] Non-Overlapping Bookings on Same Vehicle:`);
    console.log(`  - Booking 1 (Nov 20-22): HTTP ${resA1.status} -> Code: ${dataA1.data?.booking_code}`);
    console.log(`  - Booking 2 (Nov 25-27): HTTP ${resA2.status} -> Code: ${dataA2.data?.booking_code}`);

    // -------------------------------------------------------------------------
    // TEST PART B: Cancellation Re-usability Policy
    // When Booking 1 (Nov 20-22) is Cancelled, an overlapping request
    // (e.g. Nov 21-22) MUST now succeed with HTTP 201.
    // -------------------------------------------------------------------------
    const booking1Id = dataA1.data?.id;
    if (booking1Id) {
      // Mark as cancelled
      const { error: cancelErr } = await sb
        .from("bookings")
        .update({ journey_status: "Cancelled" })
        .eq("id", booking1Id);

      if (cancelErr) {
        console.error("Cancellation error:", cancelErr);
      }
    }

    const trip3Id = `trp_part_b_${timestamp}`;
    const quo3Id = `quo_part_b_${timestamp}`;

    await sb.from("trip_requests").insert([{
      id: trip3Id,
      trip_code: `TRP-EXT-B-${Math.floor(1000 + Math.random() * 9000)}`,
      traveler_id: testTravellerId,
      traveler_name: "Pooja Verma",
      circuit_title: "Delhi NCR → Neemrana Weekend",
      origin: "Delhi NCR",
      destination: "Neemrana",
      circuit_type: "Outstation Trip",
      distance_km: 140,
      start_date: "2026-11-21", // Overlaps with cancelled Booking 1 (Nov 20-22)!
      duration: "2 Days",
      pickup_time: "08:00 AM",
      pickup_address: "Aerocity, New Delhi",
      travellers_count: 6,
      matched_vehicle_class: "Urbania / Tempo",
      target_budget: 16000,
      status: "open"
    }]);

    await sb.from("quotations").insert([{
      id: quo3Id,
      trip_request_id: trip3Id,
      trip_code: "TRP-EXT-B",
      operator_id: testOperatorId,
      operator_name: "Delhi Express Fleet",
      vehicle_id: testVehicleId,
      vehicle_name: "Force Urbania Executive 13-Seater",
      vehicle_category: "Urbania / Tempo",
      vehicle_reg: testVehicleReg,
      model_year: 2024,
      base_vehicle_fuel_rate: 11000,
      driver_night_allowance: 1500,
      tolls_state_permit_taxes: 2500,
      total_quote: 15000,
      per_person_fare: 2500,
      status: "pending"
    }]);

    const resB = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_request_id: trip3Id,
        quotation_id: quo3Id,
        traveler_id: testTravellerId,
        vehicle_reg: testVehicleReg,
        pickup_date: "2026-11-21",
        duration: "2 Days"
      })
    });
    const dataB = await resB.json();

    const cancellationPass = resB.status === 201;
    console.log(`[${cancellationPass ? "PASS" : "FAIL"}] Cancellation Policy Re-usability:`);
    console.log(`  - Cancelled Booking 1 freed up interval Nov 20-22.`);
    console.log(`  - New Booking on Nov 21-22: HTTP ${resB.status} -> Code: ${dataB.data?.booking_code || dataB.error}`);

    // -------------------------------------------------------------------------
    // TEST PART C: Clean Up Isolated Test Records
    // -------------------------------------------------------------------------
    await sb.from("bookings").update({ journey_status: "Cancelled" }).eq("vehicle_reg", testVehicleReg);
    await sb.from("quotations").delete().in("id", [quo1Id, quo2Id, quo3Id]);
    await sb.from("trip_requests").delete().in("id", [trip1Id, trip2Id, trip3Id]);
    await sb.from("vehicles").delete().eq("id", testVehicleId);
    await sb.from("profiles").delete().in("id", [testOperatorId, testTravellerId]);

    const { count: remainingBookings } = await sb
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_reg", testVehicleReg)
      .neq("journey_status", "Cancelled");

    console.log(`[${remainingBookings === 0 ? "PASS" : "FAIL"}] Isolated Test Cleanup: ${remainingBookings} active records remaining.`);

    console.log("\n==================================================================");
    console.log("EXTENDED CONCURRENCY VERIFICATION SUMMARY");
    console.log(`Non-Overlapping Bookings: ${nonOverlapPass ? "PASS (201 & 201)" : "FAIL"}`);
    console.log(`Cancellation Re-usability: ${cancellationPass ? "PASS (201)" : "FAIL"}`);
    console.log(`Database Cleanup: ${remainingBookings === 0 ? "PASS (0 residual records)" : "FAIL"}`);
    console.log("==================================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runExtendedVerification();
