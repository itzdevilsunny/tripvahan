import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OperatorDocument } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const serverSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Allowed document types, MIME types, and maximum size
const ALLOWED_DOC_TYPES = [
  "commercial_rc",
  "tourist_permit",
  "fitness_cert",
  "commercial_insurance",
  "puc_cert",
  "driver_license",
  "other",
] as const;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// In-memory baseline documents for local development/testing before live DB execution
const inMemoryDocuments: OperatorDocument[] = [
  {
    id: "doc_rajputana_rc",
    operator_id: "op_rajputana",
    doc_type: "commercial_rc",
    title: "Commercial Registration Certificate (RC)",
    doc_number: "RC-DL-01-TA-9821",
    issuing_authority: "Ministry of Road Transport & Highways (MoRTH)",
    file_path: "op_rajputana/commercial_rc/rc_yellow_plate.pdf",
    file_name: "rc_yellow_plate.pdf",
    file_size: 1420500,
    mime_type: "application/pdf",
    status: "approved",
    issue_date: "2023-11-01",
    expiry_date: "2028-11-30",
    reviewed_by: "admin_lead",
    reviewer_name: "Compliance Officer",
    reviewed_at: "2026-10-15T10:30:00Z",
    created_at: "2026-10-14T08:00:00Z",
    updated_at: "2026-10-15T10:30:00Z",
  },
  {
    id: "doc_rajputana_aitp",
    operator_id: "op_rajputana",
    doc_type: "tourist_permit",
    title: "All India Tourist Permit (AITP)",
    doc_number: "AITP-DL-49201",
    issuing_authority: "State Transport Authority (STA) Delhi NCR",
    file_path: "op_rajputana/tourist_permit/aitp_delhi_raj.pdf",
    file_name: "aitp_delhi_raj.pdf",
    file_size: 980200,
    mime_type: "application/pdf",
    status: "approved",
    issue_date: "2024-05-15",
    expiry_date: "2027-05-15",
    reviewed_by: "admin_lead",
    reviewer_name: "Compliance Officer",
    reviewed_at: "2026-10-15T10:30:00Z",
    created_at: "2026-10-14T08:00:00Z",
    updated_at: "2026-10-15T10:30:00Z",
  },
];

async function authenticateCaller(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: Missing authentication token" };
  }

  const {
    data: { user },
    error: authError,
  } = await serverSupabase.auth.getUser(token);

  if (authError || !user) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid or expired session" };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("id, role, full_name, email, operator_name")
    .eq("id", user.id)
    .maybeSingle();

  return { authorized: true, user, profile };
}

/**
 * GET /api/operator/documents
 * List documents for the authenticated operator, or for a specific operator if caller is admin.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateCaller(req);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedOperatorId = searchParams.get("operator_id");

    const isAdmin = auth.profile?.role === "admin";
    const targetOperatorId = isAdmin && requestedOperatorId ? requestedOperatorId : auth.user.id;

    // Travellers are forbidden from querying operator documents
    if (!isAdmin && auth.profile?.role === "traveller") {
      return NextResponse.json(
        { error: "Forbidden: Travellers are not authorized to view operator compliance documents" },
        { status: 403 }
      );
    }

    // Try querying database table
    try {
      const { data: dbDocs, error: dbErr } = await serverSupabase
        .from("operator_documents")
        .select("*")
        .eq("operator_id", targetOperatorId)
        .order("created_at", { ascending: false });

      if (!dbErr && dbDocs) {
        return NextResponse.json({ success: true, data: dbDocs, source: "database" });
      }
    } catch {
      // Continue to in-memory fallback
    }

    // Fallback to in-memory documents
    const filtered = inMemoryDocuments.filter((d) => d.operator_id === targetOperatorId);
    return NextResponse.json({ success: true, data: filtered, source: "memory" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list documents" }, { status: 500 });
  }
}

/**
 * POST /api/operator/documents
 * Secure document submission endpoint for operators.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateCaller(req);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    const { user, profile } = auth;
    const body = await req.json();

    const {
      doc_type,
      title,
      doc_number,
      issuing_authority,
      file_path,
      file_name,
      file_size,
      mime_type,
      issue_date,
      expiry_date,
      vehicle_id,
    } = body;

    // 1. Authorization: Only operators (or admin submitting on their behalf) can upload documents
    const isOperator = profile?.role === "operator" || profile?.role === "both" || profile?.role === "admin";
    if (!isOperator) {
      return NextResponse.json(
        { error: "Forbidden: Only transport operators are authorized to submit vehicle and compliance documents" },
        { status: 403 }
      );
    }

    // 2. Validate mandatory fields
    if (!doc_type || !title || !file_path || !file_name || !file_size || !mime_type) {
      return NextResponse.json(
        { error: "Missing required document fields (doc_type, title, file_path, file_name, file_size, mime_type)" },
        { status: 400 }
      );
    }

    // 3. Validate doc_type allowlist
    if (!ALLOWED_DOC_TYPES.includes(doc_type)) {
      return NextResponse.json(
        { error: `Invalid doc_type '${doc_type}'. Allowed types: ${ALLOWED_DOC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // 4. Validate MIME type allowlist
    if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
      return NextResponse.json(
        { error: `Unsupported file type '${mime_type}'. Permitted: PDF, JPEG, PNG, WEBP` },
        { status: 400 }
      );
    }

    // 5. Validate File Size (Max 5 MB)
    if (file_size <= 0 || file_size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size (${file_size} bytes) exceeds maximum allowable limit of 5 MB (5,242,880 bytes)` },
        { status: 400 }
      );
    }

    // 6. Security: Path Traversal & Cross-Operator Isolation Guard
    if (file_path.includes("..") || file_path.startsWith("/") || file_path.startsWith("\\")) {
      return NextResponse.json(
        { error: "Invalid file_path: Path traversal characters are strictly prohibited" },
        { status: 400 }
      );
    }

    // Operator can only store objects within their designated directory: <operator_id>/...
    const expectedPrefix = `${user.id}/`;
    if (!file_path.startsWith(expectedPrefix) && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Storage path must reside within your authorized operator directory" },
        { status: 403 }
      );
    }

    // 7. Expiry Date Validation
    if (expiry_date) {
      const expiry = new Date(expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expiry < today) {
        return NextResponse.json(
          { error: `Document has already expired on ${expiry_date}. Active commercial documents must be unexpired.` },
          { status: 400 }
        );
      }
    }

    // 8. Prevent duplicate active pending/approved documents of the same category
    const activeMemoryConflict = inMemoryDocuments.find(
      (d) => d.operator_id === user.id && d.doc_type === doc_type && (d.status === "approved" || d.status === "pending")
    );

    if (activeMemoryConflict) {
      return NextResponse.json(
        {
          error: `An active or pending ${title} already exists (${activeMemoryConflict.id}). Resubmission is permitted once reviewed or rejected.`,
        },
        { status: 409 }
      );
    }

    const docId = `doc_${user.id.slice(0, 8)}_${doc_type}_${Date.now()}`;
    const newDoc: OperatorDocument = {
      id: docId,
      operator_id: user.id,
      vehicle_id: vehicle_id || null,
      doc_type,
      title,
      doc_number: doc_number || null,
      issuing_authority: issuing_authority || null,
      file_path,
      file_name,
      file_size,
      mime_type,
      status: "pending",
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      reviewed_by: null,
      reviewer_name: null,
      reviewed_at: null,
      rejection_reason: null,
      reviewer_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Attempt database insert
    try {
      const { data: inserted, error: dbErr } = await serverSupabase
        .from("operator_documents")
        .insert([newDoc])
        .select()
        .single();

      if (!dbErr && inserted) {
        inMemoryDocuments.unshift(inserted);
        return NextResponse.json({ success: true, data: inserted, database_synced: true }, { status: 201 });
      }

      if (dbErr && (dbErr.code === "23505" || dbErr.message?.includes("unique_active_operator_doc"))) {
        return NextResponse.json(
          { error: `An active document for category '${doc_type}' already exists in database.` },
          { status: 409 }
        );
      }
    } catch {
      // Continue to in-memory sync
    }

    inMemoryDocuments.unshift(newDoc);
    return NextResponse.json({ success: true, data: newDoc, database_synced: false }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process document upload" }, { status: 500 });
  }
}

/**
 * PATCH /api/operator/documents
 * Administrator review of operator documents (Approve or Reject with reason).
 */
export async function PATCH(req: Request) {
  try {
    const auth = await authenticateCaller(req);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    const { user, profile } = auth;
    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator privileges required to review documents" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, status, reason, notes } = body;

    if (!id || !status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "document ID and valid status ('approved' | 'rejected') are required" },
        { status: 400 }
      );
    }

    if (status === "rejected" && (!reason || reason.trim() === "")) {
      return NextResponse.json(
        { error: "A specific rejection reason is mandatory when declining an operator document" },
        { status: 400 }
      );
    }

    // 1. ATOMIC TRANSACTION FIRST: Attempt PostgreSQL stored procedure public.review_operator_document_transaction(...)
    try {
      const { data: rpcData, error: rpcError } = await serverSupabase.rpc("review_operator_document_transaction", {
        p_document_id: id,
        p_status: status,
        p_reason: status === "rejected" ? reason : null,
        p_notes: notes || null,
        p_caller_id: user.id,
      });

      if (!rpcError && rpcData) {
        return NextResponse.json({
          success: true,
          data: rpcData,
          message: `Document ${status === "approved" ? "approved" : "rejected"} successfully`,
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
      }
    } catch {
      // Fallback to table-level update
    }

    // 2. Table-level Fallback
    const targetDoc = inMemoryDocuments.find((d) => d.id === id);
    if (!targetDoc) {
      return NextResponse.json({ error: `Document not found: ${id}` }, { status: 404 });
    }

    // Self-approval guard
    if (targetDoc.operator_id === user.id) {
      return NextResponse.json(
        { error: "Forbidden: Administrators cannot review or approve their own documents" },
        { status: 403 }
      );
    }

    const reviewerName = profile?.full_name || user.email || "Platform Administrator";
    const now = new Date().toISOString();

    targetDoc.status = status;
    targetDoc.reviewed_by = user.id;
    targetDoc.reviewer_name = reviewerName;
    targetDoc.reviewed_at = now;
    targetDoc.rejection_reason = status === "rejected" ? reason : null;
    targetDoc.reviewer_notes = notes || null;
    targetDoc.updated_at = now;

    // Also update in Supabase if table exists
    try {
      await serverSupabase
        .from("operator_documents")
        .update({
          status,
          reviewed_by: user.id,
          reviewer_name: reviewerName,
          reviewed_at: now,
          rejection_reason: status === "rejected" ? reason : null,
          reviewer_notes: notes || null,
          updated_at: now,
        })
        .eq("id", id);
    } catch {
      // In-memory updated
    }

    return NextResponse.json({
      success: true,
      data: targetDoc,
      message: `Document ${status === "approved" ? "approved" : "rejected"} successfully`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to review document" }, { status: 500 });
  }
}
