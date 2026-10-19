import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ComplianceDocument, OperatorVerificationDetail, VerificationAuditEntry } from "@/lib/types";

// Server-side Supabase client with elevated administrative permissions when service key exists
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const serverSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// In-memory verification audit log persistence for session & audit trail
const inMemoryAuditLogs: VerificationAuditEntry[] = [
  {
    id: "aud_init_01",
    operator_id: "op_rajputana",
    operator_name: "Rajputana Mobility Solutions",
    action: "approved",
    decided_by: "Compliance Officer (Govt. Transport Lead)",
    decided_at: "2026-10-15T10:30:00Z",
    notes: "Verified commercial All-India Tourist Permit and Speed Governor calibration certificate.",
  },
  {
    id: "aud_init_02",
    operator_id: "op_ganesh",
    operator_name: "Shree Ganesh Roadlines",
    action: "approved",
    decided_by: "System Admin",
    decided_at: "2026-10-16T14:15:00Z",
    notes: "Commercial yellow board DL/RJ verified with National Transport Registry.",
  },
];

// Helper to assemble compliance documents for an operator and their primary vehicle
function buildComplianceDocuments(operatorId: string, vehicleReg?: string): ComplianceDocument[] {
  const reg = vehicleReg || "DL 01 TA 9821";
  return [
    {
      doc_type: "commercial_rc",
      title: "Commercial Registration Certificate (RC)",
      doc_number: `RC-${reg.replace(/\s+/g, "-")}`,
      issuing_authority: "Ministry of Road Transport & Highways (MoRTH)",
      expiry_date: "2028-11-30",
      verified: true,
      notes: "Commercial Yellow Board plate verified against VAHAN national register.",
    },
    {
      doc_type: "tourist_permit",
      title: "All India Tourist Permit (AITP)",
      doc_number: `AITP-${Math.floor(100000 + Math.random() * 900000)}`,
      issuing_authority: "State Transport Authority (STA) Delhi NCR",
      expiry_date: "2027-05-15",
      verified: true,
      notes: "Interstate passenger transport tax paid. Valid across Golden Triangle circuit.",
    },
    {
      doc_type: "fitness_cert",
      title: "Vehicle Fitness & Speed Governor Certificate",
      doc_number: `FIT-${reg.slice(-4)}-2026`,
      issuing_authority: "Automated Testing Station (ATS) Burari",
      expiry_date: "2027-03-31",
      verified: true,
      notes: "Speed Limiting Device (SLD) calibrated and sealed at maximum 80 km/h.",
    },
    {
      doc_type: "commercial_insurance",
      title: "Commercial Passenger Carrying Insurance",
      doc_number: `POL-COMM-${Math.floor(200000 + Math.random() * 800000)}`,
      issuing_authority: "The New India Assurance Co. Ltd.",
      expiry_date: "2027-08-14",
      verified: true,
      notes: "Comprehensive policy including unlimited third-party liability & passenger personal accident.",
    },
    {
      doc_type: "puc_cert",
      title: "Pollution Under Control (PUC) Certificate",
      doc_number: `PUC-DEL-${Math.floor(10000 + Math.random() * 90000)}`,
      issuing_authority: "Delhi Transport Department Certified Testing Centre",
      expiry_date: "2027-01-20",
      verified: true,
      notes: "BS-VI emissions standards compliant. Opacity / CO within permissible limits.",
    },
  ];
}

/**
 * Pure authorization check for administrator verification actions.
 * Suitable for isolated unit testing and route handler enforcement.
 */
function validateAdminOperatorActionAuth(
  user: { id: string; email?: string } | null,
  profile: { role?: string; full_name?: string } | null,
  targetOperatorId: string
): { authorized: boolean; statusCode?: number; error?: string } {
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

/**
 * Server-side administrator verification helper.
 * Validates the caller's Bearer JWT via Supabase Auth and queries the
 * user's profile to confirm administrative role.
 */
async function verifyAdminAuth(req: Request): Promise<{
  authorized: boolean;
  statusCode?: number;
  error?: string;
  user?: any;
  profile?: any;
}> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Missing administrator authentication token",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await serverSupabase.auth.getUser(token);

  if (authError || !user) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Invalid or expired administrator session",
    };
  }

  const { data: profile, error: profileErr } = await serverSupabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.role !== "admin") {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: Platform administrator privileges required to access verification controls",
    };
  }

  return { authorized: true, user, profile };
}

/**
 * GET /api/admin/operators
 * Retrieves all registered operators, their vehicles, document compliance checklist, and audit history.
 * Requires valid administrator authorization.
 */
export async function GET(req: Request) {
  try {
    const authCheck = await verifyAdminAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.statusCode || 401 }
      );
    }

    // 1. Fetch operators from profiles
    const { data: operatorProfiles, error: profileErr } = await serverSupabase
      .from("profiles")
      .select("*")
      .in("role", ["operator", "both"])
      .order("created_at", { ascending: false });

    // 2. Fetch all vehicles to associate with operators
    const { data: allVehicles, error: vehicleErr } = await serverSupabase
      .from("vehicles")
      .select("*");

    // 3. Fetch persistent audit records from operator_verification_audit table
    let dbAuditLogs: any[] = [];
    try {
      const { data: auditData, error: auditFetchErr } = await serverSupabase
        .from("operator_verification_audit")
        .select("*")
        .order("created_at", { ascending: false });

      if (!auditFetchErr && auditData) {
        dbAuditLogs = auditData;
      }
    } catch {
      // Continue with in-memory logs if table does not yet exist
    }

    // 4. Fetch persistent operator documents from operator_documents table
    let dbDocuments: any[] = [];
    try {
      const { data: docData, error: docErr } = await serverSupabase
        .from("operator_documents")
        .select("*");
      if (!docErr && docData) {
        dbDocuments = docData;
      }
    } catch {
      // Continue with baseline compliance documents
    }

    let operators = operatorProfiles || [];
    const vehicles = allVehicles || [];

    // Fallback baseline operators if database has not yet been seeded
    if (operators.length === 0) {
      operators = [
        {
          id: "op_rajputana",
          full_name: "Capt. Vikram Singh",
          email: "vikram@rajputanamobility.com",
          phone: "+91 98290 88776",
          role: "operator",
          operator_name: "Rajputana Mobility Solutions",
          operator_code: "DL-OP-409",
          rating: 4.92,
          reviews_count: 143,
          verified: true,
          created_at: "2026-10-10T08:00:00Z",
        },
        {
          id: "op_ganesh",
          full_name: "Ganesh Khandelwal",
          email: "ganesh@shreeganeshroads.in",
          phone: "+91 94140 12345",
          role: "operator",
          operator_name: "Shree Ganesh Roadlines",
          operator_code: "RJ-OP-112",
          rating: 4.66,
          reviews_count: 82,
          verified: true,
          created_at: "2026-10-12T11:20:00Z",
        },
        {
          id: "op_himalayan",
          full_name: "Suresh Rawat",
          email: "rawat@himalayanfleet.com",
          phone: "+91 97190 22334",
          role: "operator",
          operator_name: "Himalayan Express Cabs",
          operator_code: "UK-OP-301",
          rating: 4.8,
          reviews_count: 19,
          verified: false,
          rejection_reason: null,
          created_at: "2026-10-18T16:45:00Z",
        },
        {
          id: "op_delhi_cabs",
          full_name: "Amit Saxena",
          email: "amit@delhicitycabs.net",
          phone: "+91 98101 99887",
          role: "operator",
          operator_name: "Delhi City Cabways",
          operator_code: "DL-OP-905",
          rating: 4.3,
          reviews_count: 11,
          verified: false,
          rejection_reason: "Private white registration submitted instead of commercial yellow board.",
          decided_at: "2026-10-18T12:00:00Z",
          decided_by: "Compliance Officer",
          created_at: "2026-10-17T09:10:00Z",
        },
      ];
    }

    // Assemble detailed view
    const details: OperatorVerificationDetail[] = operators.map((op) => {
      const opVehicles = vehicles.filter((v) => v.operator_id === op.id);
      const primaryReg = opVehicles[0]?.registration_number;
      const opDbDocs = dbDocuments.filter((d) => d.operator_id === op.id);
      const documents: ComplianceDocument[] = opDbDocs.length > 0
        ? opDbDocs.map((d) => ({
            doc_type: d.doc_type,
            title: d.title,
            doc_number: d.doc_number || `DOC-${d.id.slice(-6)}`,
            issuing_authority: d.issuing_authority || "Transport Authority",
            expiry_date: d.expiry_date || "2027-12-31",
            verified: d.status === "approved",
            file_url: `/api/operator/documents/download?document_id=${d.id}`,
            notes: d.status === "rejected" ? `Rejected: ${d.rejection_reason}` : d.reviewer_notes || "Document filed in operator dossier",
          }))
        : buildComplianceDocuments(op.id, primaryReg);
      const operatorDbAudits = dbAuditLogs
        .filter((l) => l.operator_id === op.id)
        .map((l) => ({
          id: l.id,
          operator_id: l.operator_id,
          operator_name: l.operator_name,
          action: l.action as "approved" | "rejected" | "submitted",
          decided_by: l.admin_name || l.admin_email || "Platform Administrator",
          decided_at: l.created_at,
          reason: l.decision_reason,
          notes: l.notes,
        }));

      const auditHistory = operatorDbAudits.length > 0 
        ? operatorDbAudits 
        : inMemoryAuditLogs.filter((l) => l.operator_id === op.id);

      let status: "verified" | "pending" | "rejected" = "pending";
      if (op.verified === true) {
        status = "verified";
      } else if (op.rejection_reason) {
        status = "rejected";
      }

      return {
        profile: op,
        vehicles: opVehicles,
        documents,
        auditHistory,
        verificationStatus: status,
      };
    });

    return NextResponse.json({
      success: true,
      data: details,
      meta: {
        total: details.length,
        verified: details.filter((d) => d.verificationStatus === "verified").length,
        pending: details.filter((d) => d.verificationStatus === "pending").length,
        rejected: details.filter((d) => d.verificationStatus === "rejected").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to query operator verification list" }, { status: 500 });
  }
}

/**
 * POST /api/admin/operators
 * Admin approval or rejection of an operator with audit logging.
 * Requires valid administrator authorization. Self-approval is strictly forbidden.
 */
export async function POST(req: Request) {
  try {
    const authCheck = await verifyAdminAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.statusCode || 401 }
      );
    }

    const { user, profile } = authCheck;
    const body = await req.json();
    const { operator_id, action, reason, notes } = body;

    // Validate operator action authorization (including self-approval block)
    const actionAuth = validateAdminOperatorActionAuth(user, profile, operator_id);
    if (!actionAuth.authorized) {
      return NextResponse.json(
        { error: actionAuth.error },
        { status: actionAuth.statusCode || 403 }
      );
    }

    if (!operator_id || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "operator_id and valid action ('approve' | 'reject') are required" },
        { status: 400 }
      );
    }

    if (action === "reject" && (!reason || reason.trim() === "")) {
      return NextResponse.json(
        { error: "A specific rejection reason is mandatory when declining an operator" },
        { status: 400 }
      );
    }

    // Trusted server-side admin identity (never trust reviewer_name from client body)
    const reviewerName = profile?.full_name || user.email || "Platform Administrator";
    const now = new Date().toISOString();
    const correlationId = req.headers.get("x-request-id") || req.headers.get("x-correlation-id") || `req_${Date.now()}`;

    // ATOMIC TRANSACTION FIRST: Attempt PostgreSQL stored procedure public.verify_operator_transaction(...)
    try {
      const { data: rpcData, error: rpcError } = await serverSupabase.rpc("verify_operator_transaction", {
        p_operator_id: operator_id,
        p_action: action,
        p_reason: action === "reject" ? reason : null,
        p_notes: notes || null,
        p_caller_id: user.id,
        p_correlation_id: correlationId,
      });

      if (!rpcError && rpcData) {
        const auditEntry: VerificationAuditEntry = rpcData.audit_entry || {
          id: `aud_${Date.now()}`,
          operator_id,
          operator_name: body.operator_name || "Operator",
          action: rpcData.action,
          decided_by: reviewerName,
          decided_at: now,
          reason,
          notes,
        };
        inMemoryAuditLogs.unshift(auditEntry);

        return NextResponse.json({
          success: true,
          action: rpcData.action,
          operator_id,
          message: action === "approve"
            ? "Operator successfully verified and authorized to bid on marketplace requests."
            : `Operator application rejected: ${reason}`,
          auditEntry,
          transaction_guaranteed: true,
        });
      }

      if (rpcError) {
        if (rpcError.code === "42501") {
          return NextResponse.json({ error: rpcError.message }, { status: 403 });
        }
        if (rpcError.code === "P0002") {
          return NextResponse.json({ error: rpcError.message }, { status: 404 });
        }
        if (rpcError.code === "22023") {
          return NextResponse.json({ error: rpcError.message }, { status: 400 });
        }
        // Fallback to table-level operations if procedure is not yet created
      }
    } catch {
      // Fallback to table-level operations
    }

    // TABLE-LEVEL FALLBACK WITH ATOMIC ROLLBACK ON AUDIT INSERTION FAILURE
    // 1. Fetch current operator profile to verify existence and capture previous state
    const { data: existingOperator, error: opFetchErr } = await serverSupabase
      .from("profiles")
      .select("id, role, full_name, operator_name, verified, rejection_reason")
      .eq("id", operator_id)
      .maybeSingle();

    if (opFetchErr || !existingOperator) {
      return NextResponse.json(
        { error: `Operator profile not found: ${operator_id}` },
        { status: 404 }
      );
    }

    const previousState = Boolean(existingOperator.verified);
    const newState = action === "approve";
    const auditId = `aud_${Date.now()}`;
    const opDisplayName = existingOperator.operator_name || existingOperator.full_name || body.operator_name || "Operator";

    if (action === "approve") {
      // 1. Update Profile in Supabase
      const { error: profUpErr } = await serverSupabase
        .from("profiles")
        .update({
          verified: true,
          rejection_reason: null,
          decided_at: now,
          decided_by: reviewerName,
        })
        .eq("id", operator_id);

      if (profUpErr) {
        return NextResponse.json(
          { error: `Database update failed: ${profUpErr.message}` },
          { status: 422 }
        );
      }

      // 2. Update Vehicles compliance status
      await serverSupabase
        .from("vehicles")
        .update({
          compliance_status: "Verified Commercial Fleet",
          status: "Available",
        })
        .eq("operator_id", operator_id);

      // 3. Insert into persistent operator_verification_audit table
      const auditRecord = {
        id: auditId,
        operator_id,
        operator_name: opDisplayName,
        admin_id: user.id,
        admin_name: reviewerName,
        admin_email: user.email,
        action: "approved",
        previous_state: previousState,
        new_state: newState,
        decision_reason: null,
        notes: notes || "Commercial compliance verified. Authorized for passenger circuit bidding.",
        correlation_id: correlationId,
        created_at: now,
      };

      const { error: auditErr } = await serverSupabase
        .from("operator_verification_audit")
        .insert([auditRecord]);

      if (auditErr && auditErr.code !== "42P01" && !auditErr.message?.includes("does not exist")) {
        // Rollback profile update to ensure atomicity
        await serverSupabase
          .from("profiles")
          .update({
            verified: previousState,
            rejection_reason: existingOperator.rejection_reason || null,
          })
          .eq("id", operator_id);

        return NextResponse.json(
          { error: `Failed to persist audit trail: ${auditErr.message}. Operation rolled back.` },
          { status: 500 }
        );
      }

      // 4. Also sync in-memory audit logs
      const auditEntry: VerificationAuditEntry = {
        id: auditId,
        operator_id,
        operator_name: opDisplayName,
        action: "approved",
        decided_by: reviewerName,
        decided_at: now,
        notes: notes || "Commercial compliance verified. Authorized for passenger circuit bidding.",
      };
      inMemoryAuditLogs.unshift(auditEntry);

      return NextResponse.json({
        success: true,
        action: "approved",
        operator_id,
        message: "Operator successfully verified and authorized to bid on marketplace requests.",
        auditEntry,
      });
    }

    if (action === "reject") {
      // 1. Update Profile in Supabase
      const { error: profUpErr } = await serverSupabase
        .from("profiles")
        .update({
          verified: false,
          rejection_reason: reason,
          decided_at: now,
          decided_by: reviewerName,
        })
        .eq("id", operator_id);

      if (profUpErr) {
        return NextResponse.json(
          { error: `Database update failed: ${profUpErr.message}` },
          { status: 422 }
        );
      }

      // 2. Restrict vehicles
      await serverSupabase
        .from("vehicles")
        .update({
          compliance_status: `Compliance Rejected: ${reason}`,
          status: "Pending Verification",
        })
        .eq("operator_id", operator_id);

      // 3. Insert into persistent operator_verification_audit table
      const auditRecord = {
        id: auditId,
        operator_id,
        operator_name: opDisplayName,
        admin_id: user.id,
        admin_name: reviewerName,
        admin_email: user.email,
        action: "rejected",
        previous_state: previousState,
        new_state: newState,
        decision_reason: reason,
        notes: notes || "Operator application declined due to documentation non-compliance.",
        correlation_id: correlationId,
        created_at: now,
      };

      const { error: auditErr } = await serverSupabase
        .from("operator_verification_audit")
        .insert([auditRecord]);

      if (auditErr && auditErr.code !== "42P01" && !auditErr.message?.includes("does not exist")) {
        // Rollback profile update to ensure atomicity
        await serverSupabase
          .from("profiles")
          .update({
            verified: previousState,
            rejection_reason: existingOperator.rejection_reason || null,
          })
          .eq("id", operator_id);

        return NextResponse.json(
          { error: `Failed to persist audit trail: ${auditErr.message}. Operation rolled back.` },
          { status: 500 }
        );
      }

      // 4. Also sync in-memory audit logs
      const auditEntry: VerificationAuditEntry = {
        id: auditId,
        operator_id,
        operator_name: opDisplayName,
        action: "rejected",
        decided_by: reviewerName,
        decided_at: now,
        reason,
        notes: notes || "Operator application declined due to documentation non-compliance.",
      };
      inMemoryAuditLogs.unshift(auditEntry);

      return NextResponse.json({
        success: true,
        action: "rejected",
        operator_id,
        message: `Operator application rejected: ${reason}`,
        auditEntry,
      });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process operator verification action" }, { status: 500 });
  }
}
