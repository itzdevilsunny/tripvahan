const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.STAGING_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const PRODUCTION_PROJECT_ID = "ykaorzsoajfwuzibmgoo";
if (!SUPABASE_URL || SUPABASE_URL.includes(PRODUCTION_PROJECT_ID)) {
  console.error("\n🚨 SAFETY INTERCEPT: Direct probe/execution against production (ykaorzsoajfwuzibmgoo) is prohibited.");
  console.error("Please supply a dedicated staging or local URL via STAGING_SUPABASE_URL.\n");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMigrationStatus() {
  console.log("==================================================================");
  console.log("TRIPVAHAN — LIVE DATABASE MIGRATION STATUS PROBE");
  console.log(`Database: ${SUPABASE_URL}`);
  console.log("==================================================================\n");

  const ts = Date.now();
  const testProfId = `prof_probe_${ts}`;
  const testVehId = `veh_probe_${ts}`;
  const testTripId = `trp_probe_${ts}`;
  const testQuoId = `quo_probe_${ts}`;
  const testBkgId = `bkg_probe_${ts}`;
  const testVehReg = `DL 01 PRB ${Math.floor(1000 + Math.random() * 9000)}`;

  const results = {
    profileTriggerInstalled: false,
    profileTriggerMessage: "",
    vehicleTriggerInstalled: false,
    vehicleTriggerMessage: "",
    quoteTriggerInstalled: false,
    quoteTriggerMessage: "",
    bookingTriggerInstalled: false,
    bookingTriggerMessage: "",
    tripTriggerInstalled: false,
    tripTriggerMessage: ""
  };

  try {
    // -------------------------------------------------------------
    // 1. PROBE PROFILE TRIGGER: Self-elevating verification
    // -------------------------------------------------------------
    console.log("1. Probing trg_protect_profile_updates on public.profiles...");
    const { error: insProfErr } = await sb.from("profiles").insert([{
      id: testProfId,
      full_name: "Probe User",
      email: `probe_${ts}@test.com`,
      role: "operator",
      verified: false
    }]);

    if (insProfErr) {
      console.log("   Insert profile failed:", insProfErr.message);
    } else {
      // Attempt to self-approve verified: true
      const { data: upProfData, error: upProfErr } = await sb
        .from("profiles")
        .update({ verified: true })
        .eq("id", testProfId)
        .select();

      if (upProfErr) {
        results.profileTriggerInstalled = true;
        results.profileTriggerMessage = upProfErr.message;
        console.log(`   [INSTALLED] Blocked update with error: "${upProfErr.message}"`);
      } else {
        // If it succeeded, check if verified actually became true
        const updated = upProfData && upProfData[0]?.verified === true;
        if (updated) {
          results.profileTriggerInstalled = false;
          results.profileTriggerMessage = "UPDATE SUCCEEDED — Profile self-verified without administrator check!";
          console.log(`   [NOT INSTALLED] ${results.profileTriggerMessage}`);
        } else {
          // If no rows were updated due to RLS
          results.profileTriggerInstalled = true;
          results.profileTriggerMessage = "RLS blocked update (0 rows affected)";
          console.log(`   [RLS ACTIVE] ${results.profileTriggerMessage}`);
        }
      }
    }

    // -------------------------------------------------------------
    // 2. PROBE VEHICLE TRIGGER: Modifying operator_id
    // -------------------------------------------------------------
    console.log("\n2. Probing trg_protect_vehicle_updates on public.vehicles...");
    const { error: insVehErr } = await sb.from("vehicles").insert([{
      id: testVehId,
      operator_id: testProfId,
      operator_name: "Probe Fleet",
      name: "Probe Vehicle",
      category: "Innova Crysta",
      registration_number: testVehReg,
      seating_capacity: 7,
      luggage_capacity: 4,
      model_year: 2024,
      compliance_status: "Pending Operator Verification",
      status: "Pending Verification"
    }]);

    if (insVehErr) {
      console.log("   Insert vehicle failed:", insVehErr.message);
    } else {
      // Attempt to change operator_id to another operator
      const { data: upVehData, error: upVehErr } = await sb
        .from("vehicles")
        .update({ operator_id: "op_hijacker_999" })
        .eq("id", testVehId)
        .select();

      if (upVehErr) {
        results.vehicleTriggerInstalled = true;
        results.vehicleTriggerMessage = upVehErr.message;
        console.log(`   [INSTALLED] Blocked ownership transfer: "${upVehErr.message}"`);
      } else {
        const transferred = upVehData && upVehData[0]?.operator_id === "op_hijacker_999";
        if (transferred) {
          results.vehicleTriggerInstalled = false;
          results.vehicleTriggerMessage = "UPDATE SUCCEEDED — Vehicle operator_id was modified!";
          console.log(`   [NOT INSTALLED] ${results.vehicleTriggerMessage}`);
        } else {
          results.vehicleTriggerInstalled = true;
          results.vehicleTriggerMessage = "RLS blocked update (0 rows affected)";
          console.log(`   [RLS ACTIVE] ${results.vehicleTriggerMessage}`);
        }
      }
    }

    // -------------------------------------------------------------
    // 3. PROBE QUOTATION TRIGGER: Modifying accepted quote price
    // -------------------------------------------------------------
    console.log("\n3. Probing trg_protect_quotation_updates on public.quotations...");
    const { error: insTripErr } = await sb.from("trip_requests").insert([{
      id: testTripId,
      trip_code: `TRP-PRB-${Math.floor(1000 + Math.random() * 9000)}`,
      traveler_id: testProfId,
      traveler_name: "Probe User",
      circuit_title: "Probe Trip",
      origin: "Delhi",
      destination: "Agra",
      circuit_type: "Round Trip",
      distance_km: 240,
      start_date: "2026-12-15",
      duration: "2 Days",
      pickup_time: "07:00 AM",
      pickup_address: "Delhi",
      travellers_count: 4,
      matched_vehicle_class: "Innova Crysta",
      target_budget: 15000,
      status: "open"
    }]);

    if (insTripErr) {
      console.log("   Insert trip failed:", insTripErr.message);
    } else {
      const { error: insQuoErr } = await sb.from("quotations").insert([{
        id: testQuoId,
        trip_request_id: testTripId,
        trip_code: "TRP-PRB",
        operator_id: testProfId,
        operator_name: "Probe Fleet",
        vehicle_id: testVehId,
        vehicle_name: "Probe Vehicle",
        vehicle_category: "Innova Crysta",
        vehicle_reg: testVehReg,
        model_year: 2024,
        base_vehicle_fuel_rate: 12000,
        driver_night_allowance: 1000,
        tolls_state_permit_taxes: 2000,
        total_quote: 15000,
        per_person_fare: 3750,
        status: "accepted" // Marked as accepted
      }]);

      if (insQuoErr) {
        console.log("   Insert quote failed:", insQuoErr.message);
      } else {
        // Attempt to tamper with accepted quote price
        const { data: upQuoData, error: upQuoErr } = await sb
          .from("quotations")
          .update({ total_quote: 99999 })
          .eq("id", testQuoId)
          .select();

        if (upQuoErr) {
          results.quoteTriggerInstalled = true;
          results.quoteTriggerMessage = upQuoErr.message;
          console.log(`   [INSTALLED] Blocked price tampering: "${upQuoErr.message}"`);
        } else {
          const tampered = upQuoData && upQuoData[0]?.total_quote === 99999;
          if (tampered) {
            results.quoteTriggerInstalled = false;
            results.quoteTriggerMessage = "UPDATE SUCCEEDED — Accepted quote price was modified!";
            console.log(`   [NOT INSTALLED] ${results.quoteTriggerMessage}`);
          } else {
            results.quoteTriggerInstalled = true;
            results.quoteTriggerMessage = "RLS blocked update (0 rows affected)";
            console.log(`   [RLS ACTIVE] ${results.quoteTriggerMessage}`);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 4. PROBE BOOKINGS TRIGGER: Reopening a Cancelled booking
    // -------------------------------------------------------------
    console.log("\n4. Probing trg_protect_booking_updates on public.bookings...");
    const { error: insBkgErr } = await sb.from("bookings").insert([{
      id: testBkgId,
      booking_code: `BK-PRB-${Math.floor(1000 + Math.random() * 9000)}`,
      trip_request_id: testTripId,
      quotation_id: testQuoId,
      traveler_id: testProfId,
      traveler_name: "Probe User",
      operator_name: "Probe Fleet",
      vehicle_name: "Probe Vehicle",
      vehicle_reg: testVehReg,
      circuit_title: "Probe Trip",
      duration: "2 Days",
      total_amount: 15000,
      per_person_amount: 3750,
      pickup_date: "2026-12-15",
      start_date: "2026-12-15",
      return_date: "2026-12-16",
      journey_status: "Cancelled" // Already cancelled
    }]);

    if (insBkgErr) {
      console.log("   Insert booking failed:", insBkgErr.message);
    } else {
      // Attempt to reopen a Cancelled booking to Confirmed
      const { data: upBkgData, error: upBkgErr } = await sb
        .from("bookings")
        .update({ journey_status: "Confirmed" })
        .eq("id", testBkgId)
        .select();

      if (upBkgErr) {
        results.bookingTriggerInstalled = true;
        results.bookingTriggerMessage = upBkgErr.message;
        console.log(`   [INSTALLED] Blocked reopening cancelled booking: "${upBkgErr.message}"`);
      } else {
        const reopened = upBkgData && upBkgData[0]?.journey_status === "Confirmed";
        if (reopened) {
          results.bookingTriggerInstalled = false;
          results.bookingTriggerMessage = "UPDATE SUCCEEDED — Cancelled booking was reopened to Confirmed!";
          console.log(`   [NOT INSTALLED] ${results.bookingTriggerMessage}`);
        } else {
          results.bookingTriggerInstalled = true;
          results.bookingTriggerMessage = "RLS blocked update (0 rows affected)";
          console.log(`   [RLS ACTIVE] ${results.bookingTriggerMessage}`);
        }
      }
    }

    // -------------------------------------------------------------
    // CLEANUP TEST RECORDS
    // -------------------------------------------------------------
    console.log("\nCleaning up probe records...");
    await sb.from("bookings").delete().eq("id", testBkgId);
    await sb.from("quotations").delete().eq("id", testQuoId);
    await sb.from("trip_requests").delete().eq("id", testTripId);
    await sb.from("vehicles").delete().eq("id", testVehId);
    await sb.from("profiles").delete().eq("id", testProfId);

    console.log("\n==================================================================");
    console.log("DATABASE MIGRATION VERIFICATION SUMMARY");
    console.log("==================================================================");
    console.log(`Profile Protection:  ${results.profileTriggerInstalled ? "VERIFIED (ACTIVE)" : "NOT INSTALLED"}`);
    console.log(`Vehicle Protection:  ${results.vehicleTriggerInstalled ? "VERIFIED (ACTIVE)" : "NOT INSTALLED"}`);
    console.log(`Quote Protection:    ${results.quoteTriggerInstalled ? "VERIFIED (ACTIVE)" : "NOT INSTALLED"}`);
    console.log(`Booking Protection:  ${results.bookingTriggerInstalled ? "VERIFIED (ACTIVE)" : "NOT INSTALLED"}`);
    console.log("==================================================================");

  } catch (err) {
    console.error("Probe error:", err);
  }
}

checkMigrationStatus();
