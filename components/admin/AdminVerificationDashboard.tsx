"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Car,
  AlertTriangle,
  Building2,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Eye,
  Check,
  X,
  Lock,
  Award,
} from "lucide-react";
import { ComplianceDocument, OperatorVerificationDetail, VerificationAuditEntry } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export default function AdminVerificationDashboard() {
  const [operators, setOperators] = useState<OperatorVerificationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<OperatorVerificationDetail | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchOperators = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/operators", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setOperators(json.data);
          if (selectedOperator) {
            const updated = json.data.find(
              (o: OperatorVerificationDetail) => o.profile.id === selectedOperator.profile.id
            );
            if (updated) setSelectedOperator(updated);
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        setAuthError(errJson.error || "Administrator privileges required to access verification controls.");
      }
    } catch (err) {
      console.warn("Failed to fetch operators for admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleApprove = async (operator: OperatorVerificationDetail) => {
    setIsProcessing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers,
        body: JSON.stringify({
          operator_id: operator.profile.id,
          operator_name: operator.profile.operator_name || operator.profile.full_name,
          action: "approve",
          notes: "All 5 statutory documents verified: Yellow Board RC, AITP, 80km/h Speed Governor, Commercial Insurance & PUC.",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionNotice(`Approved ${operator.profile.operator_name || operator.profile.full_name}! Operator is now verified to quote.`);
        await fetchOperators();
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        alert(json.error || "Approval failed");
      }
    } catch (err: any) {
      alert(err.message || "Approval request failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedOperator) return;
    if (!rejectReason) {
      alert("Please select or enter a rejection reason.");
      return;
    }

    setIsProcessing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers,
        body: JSON.stringify({
          operator_id: selectedOperator.profile.id,
          operator_name: selectedOperator.profile.operator_name || selectedOperator.profile.full_name,
          action: "reject",
          reason: rejectReason,
          notes: customNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionNotice(`Rejected application for ${selectedOperator.profile.operator_name || selectedOperator.profile.full_name}.`);
        setShowRejectModal(false);
        setRejectReason("");
        setCustomNotes("");
        await fetchOperators();
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        alert(json.error || "Rejection failed");
      }
    } catch (err: any) {
      alert(err.message || "Rejection request failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter & Search
  const filteredOperators = operators.filter((op) => {
    if (filterTab !== "all" && op.verificationStatus !== filterTab) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = op.profile.operator_name?.toLowerCase().includes(q) || false;
      const matchOwner = op.profile.full_name?.toLowerCase().includes(q) || false;
      const matchEmail = op.profile.email?.toLowerCase().includes(q) || false;
      const matchPlate = op.vehicles.some((v) => v.registration_number.toLowerCase().includes(q));
      return matchName || matchOwner || matchEmail || matchPlate;
    }
    return true;
  });

  const counts = {
    total: operators.length,
    pending: operators.filter((o) => o.verificationStatus === "pending").length,
    verified: operators.filter((o) => o.verificationStatus === "verified").length,
    rejected: operators.filter((o) => o.verificationStatus === "rejected").length,
  };

  const PRESET_REJECTION_REASONS = [
    "Commercial Yellow Board plate not submitted (Private white board registration rejected)",
    "Expired Commercial Passenger Carrying Insurance policy",
    "Missing State / All-India Tourist Permit (AITP)",
    "Speed Governor (80 km/h) calibration certificate missing or expired",
    "Registration certificate mismatch with operator identity",
  ];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      {/* Platform Security Banner */}
      <div className="bg-[#172B2A] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#075E54] flex items-center justify-center text-white shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-[#DDF7ED]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Admin Fleet Verification Dashboard</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#DDF7ED] border border-emerald-400/30">
                Server-Guarded
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Review and authorize commercial transport operators before marketplace bidding activation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchOperators}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Access Restriction Banner */}
      {authError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Administrator Access Required</h4>
            <p className="text-xs text-amber-700 mt-1">{authError}</p>
          </div>
        </div>
      )}

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2 shadow-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterTab("pending")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTab === "pending"
              ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30 shadow-xs"
              : "bg-white border-[#E5EAF0] hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Pending Review</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-1">{counts.pending}</p>
          <p className="text-[10px] text-amber-700/80 mt-0.5">Requires compliance action</p>
        </div>

        <div
          onClick={() => setFilterTab("verified")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTab === "verified"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/30 shadow-xs"
              : "bg-white border-[#E5EAF0] hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Verified Partners</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{counts.verified}</p>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">Authorized to quote</p>
        </div>

        <div
          onClick={() => setFilterTab("rejected")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTab === "rejected"
              ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/30 shadow-xs"
              : "bg-white border-[#E5EAF0] hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">Rejected</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-900 mt-1">{counts.rejected}</p>
          <p className="text-[10px] text-rose-700/80 mt-0.5">Non-compliant / re-apply</p>
        </div>

        <div
          onClick={() => setFilterTab("all")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filterTab === "all"
              ? "bg-slate-100 border-slate-300 ring-2 ring-slate-400/30 shadow-xs"
              : "bg-white border-[#E5EAF0] hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider">Total Fleet</span>
            <Building2 className="w-3.5 h-3.5 text-[#718096]" />
          </div>
          <p className="text-2xl font-bold text-[#172B2A] mt-1">{counts.total}</p>
          <p className="text-[10px] text-[#718096] mt-0.5">Registered operators</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E5EAF0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(["pending", "verified", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                filterTab === tab
                  ? "bg-[#075E54] text-white shadow-xs"
                  : "bg-[#F7F8FA] text-[#718096] hover:text-[#172B2A]"
              }`}
            >
              {tab === "all" ? "All Operators" : tab}
              <span className="ml-1.5 text-[10px] opacity-80">
                ({tab === "all" ? counts.total : counts[tab]})
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search operator, owner, plate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F8FA] border border-[#E5EAF0] rounded-xl text-[#172B2A] placeholder-slate-400 focus:outline-none focus:border-[#075E54]"
          />
        </div>
      </div>

      {/* Operator List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E5EAF0] text-center text-xs text-[#718096] space-y-2">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#075E54]" />
            <p>Loading operator compliance records...</p>
          </div>
        ) : filteredOperators.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E5EAF0] text-center space-y-2">
            <Award className="w-8 h-8 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-[#172B2A]">No Operators in this category</h3>
            <p className="text-xs text-[#718096]">
              {searchQuery ? "Try refining your search terms." : "No applications currently match this filter state."}
            </p>
          </div>
        ) : (
          filteredOperators.map((op) => (
            <div
              key={op.profile.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs hover:border-[#075E54]/40 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] flex items-center justify-center text-[#075E54] font-bold text-base shrink-0">
                    {op.profile.operator_name ? op.profile.operator_name.slice(0, 2).toUpperCase() : "OP"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#172B2A]">
                        {op.profile.operator_name || op.profile.full_name}
                      </h3>
                      {op.verificationStatus === "verified" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified Fleet Partner
                        </span>
                      )}
                      {op.verificationStatus === "pending" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Review
                        </span>
                      )}
                      {op.verificationStatus === "rejected" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Application Declined
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#718096] mt-1 flex-wrap">
                      <span>Owner: <strong className="text-[#172B2A]">{op.profile.full_name}</strong></span>
                      {op.profile.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {op.profile.phone}
                        </span>
                      )}
                      {op.profile.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {op.profile.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setSelectedOperator(op)}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E5EAF0] hover:bg-[#F7F8FA] text-xs font-semibold text-[#172B2A] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#075E54]" />
                    <span>Inspect Documents</span>
                  </button>

                  {op.verificationStatus !== "verified" && (
                    <button
                      onClick={() => handleApprove(op)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {op.verificationStatus !== "rejected" && (
                    <button
                      onClick={() => {
                        setSelectedOperator(op);
                        setShowRejectModal(true);
                      }}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Rejection Notice if applicable */}
              {op.profile.rejection_reason && (
                <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-900">Rejection Reason: </span>
                    <span>{op.profile.rejection_reason}</span>
                    {op.profile.decided_at && (
                      <span className="text-[10px] text-rose-600 block mt-0.5">
                        Decided {new Date(op.profile.decided_at).toLocaleString("en-IN")} by {op.profile.decided_by || "Administrator"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Fleet & Document Checklist Strip */}
              <div className="bg-[#F7F8FA] rounded-xl p-3 border border-[#E5EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-[#718096] font-medium">Fleet Registered:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {op.vehicles.length > 0 ? (
                      op.vehicles.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-0.5 rounded-md bg-white border border-[#E5EAF0] text-[11px] font-bold text-[#172B2A] flex items-center gap-1"
                        >
                          <Car className="w-3 h-3 text-[#075E54]" />
                          <span>{v.registration_number}</span>
                          <span className="text-[10px] text-[#718096] font-normal">({v.name})</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-amber-700 italic">No vehicles registered yet</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#718096]">
                  <span className="font-medium text-[#172B2A]">Documents:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">RC Yellow</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">AITP</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Speed-Gov</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Insurance</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">PUC</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspection Modal */}
      {selectedOperator && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="bg-[#172B2A] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#075E54] flex items-center justify-center text-white font-bold text-base">
                  <ShieldCheck className="w-5 h-5 text-[#DDF7ED]" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    {selectedOperator.profile.operator_name || selectedOperator.profile.full_name}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Commercial Vehicle Compliance & Statutory Verification File
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOperator(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              {/* Operator details badge */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-[#F7F8FA] rounded-2xl border border-[#E5EAF0] text-xs">
                <div>
                  <span className="text-[#718096] block text-[11px]">Primary Contact</span>
                  <span className="font-bold text-[#172B2A]">{selectedOperator.profile.full_name}</span>
                </div>
                <div>
                  <span className="text-[#718096] block text-[11px]">Contact Phone</span>
                  <span className="font-bold text-[#172B2A]">{selectedOperator.profile.phone || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-[#718096] block text-[11px]">Current Status</span>
                  <span
                    className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      selectedOperator.verificationStatus === "verified"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedOperator.verificationStatus === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {selectedOperator.verificationStatus}
                  </span>
                </div>
              </div>

              {/* Statutory Documents Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#718096]">
                    Mandatory Commercial Transport Documents (5/5)
                  </h4>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    MoRTH & STA Compliant
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selectedOperator.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-[#E5EAF0] bg-white hover:border-[#075E54]/40 transition-all flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#DDF7ED] flex items-center justify-center text-[#075E54] shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#172B2A]">{doc.title}</span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Valid
                            </span>
                          </div>
                          <p className="text-[11px] text-[#718096] mt-0.5">
                            Doc ID: <strong className="text-[#172B2A]">{doc.doc_number}</strong> · Authority: {doc.issuing_authority}
                          </p>
                          <p className="text-[11px] text-[#075E54] mt-0.5">
                            ✓ {doc.notes}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <div>
                          <span className="text-[10px] text-[#718096] block">Valid Until</span>
                          <span className="text-xs font-bold text-[#172B2A]">{doc.expiry_date}</span>
                        </div>
                        {doc.file_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const headers = await getAuthHeaders();
                                const res = await fetch(doc.file_url!, { headers });
                                if (res.ok) {
                                  const json = await res.json();
                                  if (json.signed_url) {
                                    window.open(json.signed_url, "_blank", "noopener,noreferrer");
                                  }
                                } else {
                                  const err = await res.json();
                                  alert(err.error || "Failed to generate download link");
                                }
                              } catch {
                                alert("Failed to fetch signed document preview");
                              }
                            }}
                            className="px-2 py-0.5 rounded-md bg-[#F7F8FA] hover:bg-emerald-50 text-[10px] font-semibold text-[#075E54] border border-[#E5EAF0] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Signed Preview</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit History Timeline */}
              <div className="space-y-2.5 pt-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#718096]">
                  Decision Audit Trail
                </h4>
                {selectedOperator.auditHistory.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOperator.auditHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] text-xs flex items-start gap-2.5"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#075E54] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#172B2A] capitalize">
                            Action: {entry.action} by {entry.decided_by}
                          </span>
                          <span className="text-[10px] text-[#718096] block">
                            Timestamp: {new Date(entry.decided_at).toLocaleString("en-IN")}
                          </span>
                          {entry.notes && (
                            <p className="text-[11px] text-slate-700 mt-1 italic">"{entry.notes}"</p>
                          )}
                          {entry.reason && (
                            <p className="text-[11px] text-rose-700 mt-1 font-semibold">
                              Reason: {entry.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#718096] italic bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0]">
                    No previous review actions logged for this operator.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 bg-[#F7F8FA] border-t border-[#E5EAF0] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setSelectedOperator(null)}
                className="px-4 py-2 rounded-xl border border-[#E5EAF0] bg-white text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
              >
                Close File
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Application</span>
                </button>

                <button
                  onClick={() => handleApprove(selectedOperator)}
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Authorize Fleet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal Dialog */}
      {showRejectModal && selectedOperator && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#172B2A]">
                  Decline Operator Verification
                </h3>
                <p className="text-xs text-[#718096]">
                  {selectedOperator.profile.operator_name || selectedOperator.profile.full_name}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">
                  Select Statutory Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <div className="space-y-1.5">
                  {PRESET_REJECTION_REASONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        rejectReason === preset
                          ? "bg-rose-50 border-rose-300 text-rose-900 font-semibold"
                          : "bg-white border-[#E5EAF0] text-[#172B2A] hover:bg-[#F7F8FA]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#172B2A] block mb-1">
                  Custom Audit Note / Feedback for Operator
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Specify required correction (e.g. Upload valid Yellow Plate RC with RTO stamp)..."
                  className="w-full text-xs p-2.5 border border-[#E5EAF0] rounded-xl focus:outline-none focus:border-rose-600 text-[#172B2A] bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAF0]">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-2 rounded-xl border border-[#E5EAF0] bg-white text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isProcessing || !rejectReason}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Recording Decision..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
