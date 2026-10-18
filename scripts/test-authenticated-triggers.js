const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EBLp2hLf7wwcb8aiv-ZqTQ_QzW_nqUU";

async function verifyLiveInstalledTriggers() {
  console.log("==================================================================");
  console.log("TRIPVAHAN — AUTHENTICATED TRIGGER & RLS VERIFICATION");
  console.log(`Database: ${SUPABASE_URL}`);
  console.log("==================================================================\n");

  const ts = Date.now();
  const testEmail = `probe_auth_${ts}@gmail.com`;
  const testPassword = `Pass@Secure_${ts}!`;

  // Create client
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log(`1. Creating ephemeral authenticated test user: ${testEmail}...`);
  const { data: authData, error: authErr } = await sb.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (authErr) {
    console.error("Auth signUp failed:", authErr.message);
    return;
  }

  const user = authData.user;
  if (!user) {
    console.log("No user returned (Email confirmation might be required).");
    console.log("Testing with session:", authData.session ? "Active" : "None");
    return;
  }

  console.log(`   Authenticated User ID: ${user.id}`);

  // Create an authenticated client scoped to this user
  const authSb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  if (authData.session) {
    await authSb.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });
  }

  // -------------------------------------------------------------
  // TEST A: Profile Verification Self-Elevation Trigger
  // -------------------------------------------------------------
  console.log("\n2. Testing Profile Protection Trigger (trg_protect_profile_updates)...");
  
  // Ensure profile exists
  const { error: insProfErr } = await authSb.from("profiles").upsert({
    id: user.id,
    full_name: "Test Operator Auth",
    email: testEmail,
    role: "operator",
    verified: false
  });

  if (insProfErr) {
    console.log("   Insert profile error:", insProfErr.message);
  }

  // Try to update verified to true as authenticated user
  const { data: profUpData, error: profUpErr } = await authSb
    .from("profiles")
    .update({ verified: true })
    .eq("id", user.id)
    .select();

  if (profUpErr) {
    console.log(`   [RESULT] Trigger/RLS Active! Threw expected error: "${profUpErr.message}" (Code: ${profUpErr.code})`);
  } else if (profUpData && profUpData[0]?.verified === true) {
    console.log("   [ALERT] Trigger NOT installed in live DB: Authenticated user was able to self-approve verified = true!");
  } else {
    console.log("   [RESULT] Update blocked (0 rows updated). RLS protected.");
  }

  // -------------------------------------------------------------
  // TEST B: Vehicle Registration & Ownership Trigger
  // -------------------------------------------------------------
  console.log("\n3. Testing Vehicle Ownership Trigger (trg_protect_vehicle_updates)...");
  const testVehId = `veh_auth_${ts}`;
  const testReg = `DL 01 AUTH ${Math.floor(1000 + Math.random() * 9000)}`;

  await authSb.from("vehicles").insert([{
    id: testVehId,
    operator_id: user.id,
    operator_name: "Auth Test Fleet",
    name: "Auth Test Cab",
    category: "Innova Crysta",
    registration_number: testReg,
    seating_capacity: 7,
    luggage_capacity: 4,
    model_year: 2024,
    compliance_status: "Pending Operator Verification",
    status: "Pending Verification"
  }]);

  // Try to change operator_id to another user
  const { data: vehUpData, error: vehUpErr } = await authSb
    .from("vehicles")
    .update({ operator_id: "op_another_user" })
    .eq("id", testVehId)
    .select();

  if (vehUpErr) {
    console.log(`   [RESULT] Trigger/RLS Active! Threw expected error: "${vehUpErr.message}"`);
  } else if (vehUpData && vehUpData[0]?.operator_id === "op_another_user") {
    console.log("   [ALERT] Trigger NOT installed in live DB: Authenticated user changed operator_id!");
  } else {
    console.log("   [RESULT] Update blocked by RLS/Trigger (0 rows modified).");
  }

  // -------------------------------------------------------------
  // TEST C: Cross-User Profile Modification
  // -------------------------------------------------------------
  console.log("\n4. Testing Cross-User Profile Modification...");
  const victimId = `prof_victim_${ts}`;
  // Insert victim profile with anon client
  await sb.from("profiles").insert([{
    id: victimId,
    full_name: "Victim User",
    email: `victim_${ts}@test.com`,
    role: "traveller",
    verified: false
  }]);

  // Authenticated user attempts to modify victim profile
  const { data: victimUpData, error: victimUpErr } = await authSb
    .from("profiles")
    .update({ full_name: "HACKED NAME" })
    .eq("id", victimId)
    .select();

  const crossUserBlocked = (!victimUpData || victimUpData.length === 0) && !victimUpErr;
  console.log(`   [RESULT] Cross-user profile update: ${crossUserBlocked ? "BLOCKED (0 rows affected)" : "PERMITTED"}`);

  // Cleanup
  console.log("\n5. Cleaning up ephemeral test records...");
  await authSb.from("vehicles").delete().eq("id", testVehId);
  await authSb.from("profiles").delete().eq("id", user.id);
  await sb.from("profiles").delete().eq("id", victimId);

  console.log("Verification probe finished.\n");
}

verifyLiveInstalledTriggers();
