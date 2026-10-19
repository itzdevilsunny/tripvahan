"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Plus,
  RefreshCw,
} from "lucide-react";
import { OperatorDocument } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface Props {
  operatorId: string;
  isVerified?: boolean;
}

const STATUTORY_CATEGORIES = [
  {
    type: "commercial_rc",
    title: "Commercial RC (Yellow Plate)",
    desc: "Form 23 Commercial Motor Vehicle Registration with yellow background",
    authority: "Ministry of Road Transport & Highways (MoRTH)",
  },
  {
    type: "tourist_permit",
    title: "All-India / Interstate Tourist Permit",
    desc: "National tourist permit / State Transport Authority interstate authorization",
    authority: "State Transport Authority (STA)",
  },
  {
    type: "fitness_cert",
    title: "Speed Governor & Fitness Certificate",
    desc: "Automated testing station fitness with sealed 80 km/h speed limiter",
    authority: "Automated Testing Station (ATS)",
  },
  {
    type: "commercial_insurance",
    title: "Commercial Passenger Insurance",
    desc: "Comprehensive commercial carrier policy with passenger liability coverage",
    authority: "IRDAI Licensed General Insurer",
  },
  {
    type: "puc_cert",
    title: "Pollution Under Control (PUC)",
    desc: "Valid emission certificate compliant with BS-VI norms",
    authority: "Transport Department Certified Emission Centre",
  },
];

export default function OperatorDocumentManager({ operatorId, isVerified }: Props) {
  const [documents, setDocuments] = useState<OperatorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("commercial_rc");
  const [docTitle, setDocTitle] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [authority, setAuthority] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/operator/documents?operator_id=${encodeURIComponent(operatorId)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setDocuments(json.data);
        }
      }
    } catch (err: any) {
      console.warn("Error fetching operator documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [operatorId]);

  const handleOpenUpload = (categoryType?: string) => {
    const typeToUse = categoryType || "commercial_rc";
    const cat = STATUTORY_CATEGORIES.find((c) => c.type === typeToUse);
    setSelectedType(typeToUse);
    setDocTitle(cat?.title || "");
    setAuthority(cat?.authority || "");
    setDocNumber("");
    setExpiryDate("");
    setFile(null);
    setErrorMsg(null);
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const chosen = e.target.files[0];
      if (chosen.size > 5 * 1024 * 1024) {
        setErrorMsg("File exceeds maximum size limit of 5 MB");
        setFile(null);
        return;
      }
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(chosen.type)) {
        setErrorMsg("Only PDF, JPEG, PNG, and WEBP files are accepted");
        setFile(null);
        return;
      }
      setErrorMsg(null);
      setFile(chosen);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!docTitle || !file) {
      setErrorMsg("Please provide document title and select a file");
      return;
    }

    if (expiryDate) {
      const exp = new Date(expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (exp < today) {
        setErrorMsg("Document expiry date must be in the future");
        return;
      }
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();

      // Clean file name and build secure storage path
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const securePath = `${operatorId}/${selectedType}/${Date.now()}_${cleanFileName}`;

      const payload = {
        doc_type: selectedType,
        title: docTitle,
        doc_number: docNumber,
        issuing_authority: authority,
        file_path: securePath,
        file_name: cleanFileName,
        file_size: file.size,
        mime_type: file.type,
        expiry_date: expiryDate || null,
      };

      const res = await fetch("/api/operator/documents", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit document metadata");
      }

      setSuccessMsg(`Document '${docTitle}' submitted successfully for administrator verification!`);
      setShowUploadModal(false);
      await fetchDocuments();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Upload submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadView = async (docId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/operator/documents/download?document_id=${encodeURIComponent(docId)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.signed_url) {
          window.open(json.signed_url, "_blank", "noopener,noreferrer");
        }
      } else {
        const errJson = await res.json();
        alert(errJson.error || "Failed to generate download link");
      }
    } catch (err: any) {
      alert("Network error opening document");
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#DDF7ED] text-[#075E54]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#172B2A]">
              Statutory Fleet & Compliance Documents
            </h4>
            <p className="text-[11px] text-[#718096]">
              Required under Motor Vehicles Act & Tourist Transport Regulations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenUpload()}
          className="px-3 py-1.5 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && !showUploadModal && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Category Grid */}
      <div className="space-y-2.5">
        {STATUTORY_CATEGORIES.map((cat) => {
          const doc = documents.find((d) => d.doc_type === cat.type);
          const isPending = doc?.status === "pending";
          const isApproved = doc?.status === "approved";
          const isRejected = doc?.status === "rejected";

          // Expiry check
          let isExpiringSoon = false;
          let isExpired = false;
          if (doc?.expiry_date) {
            const exp = new Date(doc.expiry_date);
            const now = new Date();
            const daysLeft = Math.round((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
            if (daysLeft < 0) isExpired = true;
            else if (daysLeft <= 30) isExpiringSoon = true;
          }

          return (
            <div
              key={cat.type}
              className="p-3 rounded-xl border border-[#E5EAF0] bg-[#F7F8FA] hover:bg-white transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white border border-[#E5EAF0] text-[#075E54] mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#172B2A]">{cat.title}</span>
                      {isApproved && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Approved</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Pending Review</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" />
                          <span>Rejected</span>
                        </span>
                      )}
                      {!doc && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                          Not Submitted
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#718096] mt-0.5">{cat.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {doc ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadView(doc.id)}
                      className="px-2.5 py-1 rounded-lg border border-[#E5EAF0] bg-white text-[11px] font-semibold text-[#075E54] hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View File</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenUpload(cat.type)}
                      className="px-2.5 py-1 rounded-lg bg-[#075E54] text-white text-[11px] font-semibold hover:bg-[#064e46] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Submit</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Document details / Rejection feedback strip */}
              {doc && (
                <div className="pt-2 border-t border-[#E5EAF0] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-3 text-[#718096]">
                    {doc.doc_number && (
                      <span>
                        Ref: <strong className="text-[#172B2A]">{doc.doc_number}</strong>
                      </span>
                    )}
                    {doc.expiry_date && (
                      <span className={isExpired ? "text-rose-700 font-bold" : isExpiringSoon ? "text-amber-700 font-bold" : ""}>
                        Expires: {doc.expiry_date} {isExpired ? "(EXPIRED)" : isExpiringSoon ? "(Expiring Soon)" : ""}
                      </span>
                    )}
                  </div>

                  {isRejected && (
                    <div className="w-full mt-1 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-2">
                      <span>Reason: {doc.rejection_reason}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenUpload(cat.type)}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 cursor-pointer"
                      >
                        Resubmit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#075E54]" />
                <h3 className="font-bold text-sm sm:text-base text-[#172B2A]">Submit Commercial Document</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">Document Category</label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    const cat = STATUTORY_CATEGORIES.find((c) => c.type === e.target.value);
                    if (cat) {
                      setDocTitle(cat.title);
                      setAuthority(cat.authority);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                >
                  {STATUTORY_CATEGORIES.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">Certificate / Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Commercial RC Yellow Board"
                  className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#172B2A] block mb-1">Certificate Number</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="e.g. DL-01-TA-9821"
                    className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#172B2A] block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">Issuing Authority</label>
                <input
                  type="text"
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="e.g. State Transport Authority Delhi NCR"
                  className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">
                  Upload Document File (PDF, PNG, JPG - Max 5 MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="w-full p-2 rounded-xl border border-dashed border-[#075E54] bg-[#F7F8FA] text-[#172B2A] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#075E54] file:text-white hover:file:bg-[#064e46] cursor-pointer"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAF0]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5EAF0] bg-white text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !file}
                  className="px-4 py-2 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Uploading..." : "Submit for Verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
