"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Users,
  Briefcase,
  Calendar,
  Car,
  Info,
  ArrowRight,
  Clock,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Compass,
  CreditCard,
  Edit3,
} from "lucide-react";
import type {
  AiEngine,
  VehicleRecommendation,
  IndicativeBudgetBreakdown,
  RouteIntelligence,
} from "@/lib/aiTripEngine";

export interface TransferredAiPlan {
  origin: string;
  destination: string;
  stops: string[];
  circuit_type: string;
  duration: string;
  days_count: number;
  distance_km: number;
  duration_hours: number;
  formatted_travel_time: string;
  travellers_count: number;
  adults_count: number;
  children_count: number;
  seniors_count: number;
  luggage_bags: number;
  luggage_warning?: string | null;
  target_budget: number;
  indicative_budget_min: number;
  indicative_budget_max: number;
  matched_vehicle_class: string;
  vehicle_recommendations?: VehicleRecommendation[];
  budget_breakdown?: IndicativeBudgetBreakdown;
  route_intelligence?: RouteIntelligence;
  amenities: string[];
  itinerary_highlights: string[];
  engine: AiEngine;
  user_facts: Record<string, any>;
  ai_suggestions: Record<string, any>;
}

interface AiTripPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferToForm: (plan: TransferredAiPlan) => void;
}

const EXAMPLE_PROMPTS = [
  {
    label: "Delhi to Manali (5 Days, 8 Pax)",
    text: "Plan a 5-day Delhi to Manali trip for 8 people, including 2 children, with 8 luggage bags and a budget of ₹35,000.",
  },
  {
    label: "Golden Triangle (3 Days, 6 Pax)",
    text: "3-day trip from Delhi to Jaipur for 6 adults with luggage, visiting Agra and Taj Mahal on the way.",
  },
  {
    label: "Rishikesh Getaway (2 Days, 4 Pax)",
    text: "Weekend getaway from Delhi to Rishikesh for 4 people with 3 bags, budget ₹15,000.",
  },
  {
    label: "Bangalore to Ooty (4 Days, 7 Pax)",
    text: "Bangalore to Ooty for 7 family members with 2 seniors and 6 bags, 4-day leisure trip.",
  },
];

export default function AiTripPlannerModal({
  isOpen,
  onClose,
  onTransferToForm,
}: AiTripPlannerModalProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [engine, setEngine] = useState<AiEngine | null>(null);
  const [plan, setPlan] = useState<TransferredAiPlan | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Selected vehicle option index
  const [selectedVehicleIdx, setSelectedVehicleIdx] = useState(0);
  const [showEditDrawer, setShowEditDrawer] = useState(false);

  // Editable preview states
  const [editOrigin, setEditOrigin] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editDays, setEditDays] = useState(3);
  const [editAdults, setEditAdults] = useState(4);
  const [editChildren, setEditChildren] = useState(0);
  const [editSeniors, setEditSeniors] = useState(0);
  const [editLuggage, setEditLuggage] = useState(4);
  const [editBudget, setEditBudget] = useState(25000);

  if (!isOpen) return null;

  const handleApplyExample = (text: string) => {
    setPrompt(text);
    setErrorMessage(null);
  };

  const handleReset = () => {
    setPrompt("");
    setPlan(null);
    setEngine(null);
    setErrorMessage(null);
    setClarificationQuestions([]);
    setMissingFields([]);
    setShowEditDrawer(false);
    setSelectedVehicleIdx(0);
  };

  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setErrorMessage("Please describe your desired journey first.");
      return;
    }
    if (prompt.length > 1000) {
      setErrorMessage("Prompt cannot exceed 1,000 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setClarificationQuestions([]);
    setMissingFields([]);

    try {
      const response = await fetch("/api/ai-trip-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI trip plan");
      }

      setEngine(data.engine);

      if (data.needs_clarification) {
        setClarificationQuestions(data.clarification_questions || []);
        setMissingFields(data.missing_fields || []);
        setPlan(null);
        return;
      }

      if (data.success && data.trip) {
        const trip = data.trip;
        const fullPlan: TransferredAiPlan = {
          origin: trip.origin,
          destination: trip.destination,
          stops: trip.stops || [],
          circuit_type: trip.circuit_type || "Multi-day circuit",
          duration: trip.duration || `${trip.days_count} Days`,
          days_count: trip.days_count || 3,
          distance_km: trip.distance_km || 0,
          duration_hours: trip.duration_hours || 0,
          formatted_travel_time: trip.formatted_travel_time || "Pending operator estimate",
          travellers_count: trip.travellers_count || 4,
          adults_count: trip.adults_count ?? 4,
          children_count: trip.children_count || 0,
          seniors_count: trip.seniors_count || 0,
          luggage_bags: trip.luggage_bags ?? 4,
          luggage_warning: trip.luggage_warning || null,
          target_budget: trip.target_budget || 0,
          indicative_budget_min: trip.indicative_budget_min || 0,
          indicative_budget_max: trip.indicative_budget_max || 0,
          matched_vehicle_class: trip.matched_vehicle_class || "Force Urbania / Tempo (12-16 Seater)",
          vehicle_recommendations: trip.vehicle_recommendations || [],
          budget_breakdown: trip.budget_breakdown,
          route_intelligence: trip.route_intelligence,
          amenities: trip.amenities || [],
          itinerary_highlights: trip.itinerary_highlights || [],
          engine: data.engine,
          user_facts: trip.user_facts || {},
          ai_suggestions: trip.ai_suggestions || {},
        };

        setPlan(fullPlan);
        setSelectedVehicleIdx(0);
        // Sync editable fields
        setEditOrigin(fullPlan.origin);
        setEditDestination(fullPlan.destination);
        setEditDays(fullPlan.days_count);
        setEditAdults(fullPlan.adults_count);
        setEditChildren(fullPlan.children_count);
        setEditSeniors(fullPlan.seniors_count);
        setEditLuggage(fullPlan.luggage_bags);
        setEditBudget(fullPlan.target_budget);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong while connecting to the trip planner.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTransfer = () => {
    if (!plan) return;

    // Use edited values if modified by traveller in preview
    const finalPax = editAdults + editChildren + editSeniors;
    const selectedVeh = plan.vehicle_recommendations?.[selectedVehicleIdx];

    const finalPlan: TransferredAiPlan = {
      ...plan,
      origin: editOrigin || plan.origin,
      destination: editDestination || plan.destination,
      days_count: editDays,
      duration: `${editDays} Days, ${Math.max(1, editDays - 1)} Nights`,
      adults_count: editAdults,
      children_count: editChildren,
      seniors_count: editSeniors,
      travellers_count: finalPax > 0 ? finalPax : plan.travellers_count,
      luggage_bags: editLuggage,
      target_budget: editBudget,
      matched_vehicle_class: selectedVeh?.category || plan.matched_vehicle_class,
    };

    onTransferToForm(finalPlan);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-planner-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#E5EAF0] my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header matching Tripvahan design system */}
        <div className="bg-gradient-to-r from-[#075E54] via-[#086b5f] to-[#0A7B6E] p-5 sm:p-6 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-0.5 rounded-full text-emerald-100">
              Tripvahan Assistant
            </span>
          </div>

          <h2 id="ai-planner-title" className="text-xl sm:text-2xl font-bold tracking-tight">
            Tripvahan AI Trip Planner
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-xl">
            Plan your group journey with clear estimates and real operator quotations.
          </p>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 grow">
          {/* Engine Disclaimer & Provenance Badge */}
          {engine && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F7F8FA] border border-[#E5EAF0] px-3.5 py-2.5 rounded-2xl text-xs">
              <span className="text-[#718096] font-medium flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#075E54]" />
                Planning Engine:
              </span>
              {engine === "groq_live" ? (
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Groq Live AI (gpt-oss-120b)
                </span>
              ) : engine === "gemini_live" ? (
                <span className="font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Gemini 2.5 Flash (Live)
                </span>
              ) : (
                <span className="font-semibold text-[#075E54] bg-[#DDF7ED] px-2.5 py-1 rounded-full border border-[#075E54]/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" />
                  Corridor Benchmark Engine (Deterministic)
                </span>
              )}
            </div>
          )}

          {/* Prompt Input Section (when not yet generated) */}
          {!plan && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="ai-prompt-input" className="font-semibold text-[#172B2A]">
                    Describe Your Trip
                  </label>
                  <span
                    className={`text-[11px] ${
                      prompt.length > 950 ? "text-amber-600 font-bold" : "text-[#718096]"
                    }`}
                  >
                    {prompt.length}/1,000 characters
                  </span>
                </div>

                <textarea
                  id="ai-prompt-input"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={1000}
                  placeholder="e.g. Plan a 5-day Delhi to Manali trip for 8 people, including 2 children, with 8 luggage bags and a budget of ₹35,000."
                  className="w-full text-xs sm:text-sm p-3.5 border border-[#E5EAF0] rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#075E54]/25 focus:border-[#075E54] transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Example Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider block">
                  Quick Examples
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyExample(ex.text)}
                      className="text-xs font-medium bg-[#F7F8FA] hover:bg-[#E5EAF0] text-[#172B2A] p-2.5 rounded-xl border border-[#E5EAF0] transition-colors cursor-pointer text-left"
                    >
                      <span className="font-semibold text-[#075E54] block mb-0.5">{ex.label}</span>
                      <span className="text-[11px] text-[#718096] line-clamp-1">{ex.text}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unable to plan trip</p>
                    <p className="mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Clarification Notice */}
              {clarificationQuestions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Please clarify your travel requirements</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-amber-800">
                    {clarificationQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-700 italic pt-1">
                    Please update your trip description above to include your starting city and primary destination.
                  </p>
                </div>
              )}

              {/* Generate Action Button */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                {prompt.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isLoading || !prompt.trim()}
                  className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isLoading || !prompt.trim()
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#075E54] hover:bg-[#064e46] text-white active:scale-[0.99]"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Route & Fleet Options...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Trip Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Generated Plan View: 5 Structured Sections */}
          {plan && (
            <div className="space-y-5 animate-in fade-in">
              {/* SECTION 1: Your Journey & Group Breakdown */}
              <div className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#075E54] uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5" />
                    <span>Section 1 — Your Journey</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditDrawer(!showEditDrawer)}
                    className="text-xs font-semibold text-[#075E54] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{showEditDrawer ? "Hide Quick Adjustments" : "Edit Details"}</span>
                  </button>
                </div>

                {/* Journey Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="text-[11px] text-[#718096] block">From</span>
                    <span className="font-bold text-[#172B2A] text-sm mt-0.5 block truncate">
                      {editOrigin}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="text-[11px] text-[#718096] block">To</span>
                    <span className="font-bold text-[#172B2A] text-sm mt-0.5 block truncate">
                      {editDestination}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="text-[11px] text-[#718096] block">Duration</span>
                    <span className="font-bold text-[#172B2A] text-sm mt-0.5 block">
                      {editDays} Days
                    </span>
                  </div>
                </div>

                {/* Structured Passenger Breakdown (Fixing Section B) */}
                <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF0] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#172B2A] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#075E54]" />
                      Group size: {editAdults + editChildren + editSeniors} travellers
                    </span>
                    <span className="text-[#718096] text-[11px]">
                      {editLuggage} luggage {editLuggage === 1 ? "bag" : "bags"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-[#F7F8FA] border border-[#E5EAF0] px-2.5 py-1 rounded-lg text-[#172B2A] font-medium">
                      Adults: <strong className="text-[#075E54]">{editAdults}</strong>
                    </span>
                    <span className="bg-[#F7F8FA] border border-[#E5EAF0] px-2.5 py-1 rounded-lg text-[#172B2A] font-medium">
                      Children: <strong className="text-[#075E54]">{editChildren}</strong>
                    </span>
                    <span className="bg-[#F7F8FA] border border-[#E5EAF0] px-2.5 py-1 rounded-lg text-[#172B2A] font-medium">
                      Seniors: <strong className="text-[#075E54]">{editSeniors}</strong>
                    </span>
                    <span className="bg-[#F7F8FA] border border-[#E5EAF0] px-2.5 py-1 rounded-lg text-[#172B2A] font-medium flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-[#718096]" />
                      Luggage: <strong className="text-[#075E54]">{editLuggage} bags</strong>
                    </span>
                    {editBudget > 0 && (
                      <span className="bg-[#DDF7ED] border border-[#075E54]/20 px-2.5 py-1 rounded-lg text-[#075E54] font-semibold">
                        Target Budget: ₹{editBudget.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Luggage Volume Warning if luggage is heavy */}
                  {plan.luggage_warning && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>Luggage advisory:</strong> {plan.luggage_warning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Optional Quick Adjustment Drawer */}
                {showEditDrawer && (
                  <div className="bg-white p-4 rounded-xl border border-[#075E54]/30 space-y-3 animate-in fade-in">
                    <span className="text-xs font-bold text-[#172B2A] block">
                      Edit Parameters
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="text-[#718096] block text-[11px] mb-1">Adults</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editAdults}
                          onChange={(e) => setEditAdults(parseInt(e.target.value, 10) || 1)}
                          className="w-full p-2 border border-[#E5EAF0] rounded-lg text-center font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[#718096] block text-[11px] mb-1">Children</label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={editChildren}
                          onChange={(e) => setEditChildren(parseInt(e.target.value, 10) || 0)}
                          className="w-full p-2 border border-[#E5EAF0] rounded-lg text-center font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[#718096] block text-[11px] mb-1">Seniors</label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={editSeniors}
                          onChange={(e) => setEditSeniors(parseInt(e.target.value, 10) || 0)}
                          className="w-full p-2 border border-[#E5EAF0] rounded-lg text-center font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[#718096] block text-[11px] mb-1">Bags</label>
                        <input
                          type="number"
                          min={0}
                          max={40}
                          value={editLuggage}
                          onChange={(e) => setEditLuggage(parseInt(e.target.value, 10) || 0)}
                          className="w-full p-2 border border-[#E5EAF0] rounded-lg text-center font-semibold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Verified Route Information */}
              <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#075E54] uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Section 2 — Route Information</span>
                  </div>
                  <span className="text-[11px] bg-[#F7F8FA] border border-[#E5EAF0] px-2 py-0.5 rounded-full font-medium text-[#718096]">
                    {plan.route_intelligence?.source_label || "Corridor benchmark estimate"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="text-[11px] text-[#718096] block">Road Distance</span>
                    <span className="font-bold text-[#172B2A] text-sm mt-0.5 block">
                      {plan.distance_km > 0 ? `~${plan.distance_km.toLocaleString("en-IN")} km` : "Route estimate unavailable"}
                    </span>
                  </div>
                  <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="text-[11px] text-[#718096] block">Estimated Driving Time</span>
                    <span className="font-bold text-[#172B2A] text-sm mt-0.5 block">
                      {plan.formatted_travel_time}
                    </span>
                  </div>
                </div>

                {/* Intermediate Stops */}
                {plan.stops && plan.stops.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-[#718096] block mb-1 font-medium">
                      En-Route Stops & Waypoints:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.stops.map((stop, i) => (
                        <span
                          key={i}
                          className="bg-[#DDF7ED] text-[#075E54] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#075E54]/20 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#075E54]" />
                          {stop}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Vehicle Recommendations with Explicit Reasons */}
              <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#075E54] uppercase tracking-wider">
                    <Car className="w-3.5 h-3.5" />
                    <span>Section 3 — Vehicle Recommendations</span>
                  </div>
                  <span className="text-[11px] text-[#718096]">
                    Select preferred tier for quotation
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {plan.vehicle_recommendations && plan.vehicle_recommendations.length > 0 ? (
                    plan.vehicle_recommendations.map((veh, idx) => {
                      const isSelected = selectedVehicleIdx === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedVehicleIdx(idx)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "bg-[#DDF7ED]/40 border-[#075E54] shadow-xs ring-1 ring-[#075E54]"
                              : "bg-[#F7F8FA] border-[#E5EAF0] hover:border-[#075E54]/40"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  veh.tier_tag === "Recommended"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : veh.tier_tag === "Spacious Alternative"
                                    ? "bg-purple-100 text-purple-800"
                                    : veh.tier_tag === "Luxury Upgrade"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {veh.tier_tag}
                              </span>
                              <input
                                type="radio"
                                name="vehicle_choice"
                                checked={isSelected}
                                onChange={() => setSelectedVehicleIdx(idx)}
                                className="accent-[#075E54] cursor-pointer"
                              />
                            </div>

                            <h5 className="font-bold text-xs text-[#172B2A] leading-snug">
                              {veh.name}
                            </h5>

                            <div className="flex items-center gap-2 text-[11px] text-[#718096]">
                              <span>Seats: <strong>{veh.pax_capacity}</strong></span>
                              <span>·</span>
                              <span>Bags: <strong>{veh.luggage_capacity}</strong></span>
                            </div>

                            <p className="text-[11px] text-[#718096] leading-relaxed pt-1">
                              {veh.suitability_reason}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#E5EAF0]/60 mt-3 flex items-center justify-between text-xs">
                            <span className="text-[#718096] text-[11px]">Est. Base Hire</span>
                            <span className="font-bold text-[#075E54]">
                              ₹{veh.estimated_cost.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-3 p-4 bg-[#F7F8FA] rounded-xl text-xs text-[#172B2A]">
                      Recommended: <strong>{plan.matched_vehicle_class}</strong>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-[#718096] italic">
                  * Vehicle recommendations are evaluated based on seating and luggage volumes. Commercial availability is confirmed once verified operators review your trip request.
                </p>
              </div>

              {/* SECTION 4: Indicative Trip Budget & Cost Breakdown */}
              <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#075E54] uppercase tracking-wider">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Section 4 — Estimated Trip Budget</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-full border border-[#075E54]/20">
                    Indicative Calculation
                  </span>
                </div>

                {plan.budget_breakdown ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-[#F7F8FA] p-2.5 rounded-xl border border-[#E5EAF0]">
                        <span className="text-[10px] text-[#718096] block">Billable Distance</span>
                        <span className="font-bold text-[#172B2A] text-xs mt-0.5 block">
                          {plan.budget_breakdown.billable_km} km
                        </span>
                      </div>
                      <div className="bg-[#F7F8FA] p-2.5 rounded-xl border border-[#E5EAF0]">
                        <span className="text-[10px] text-[#718096] block">Vehicle Tariff</span>
                        <span className="font-bold text-[#172B2A] text-xs mt-0.5 block">
                          ₹{plan.budget_breakdown.per_km_rate}/km
                        </span>
                      </div>
                      <div className="bg-[#F7F8FA] p-2.5 rounded-xl border border-[#E5EAF0]">
                        <span className="text-[10px] text-[#718096] block">Driver Allowance</span>
                        <span className="font-bold text-[#172B2A] text-xs mt-0.5 block">
                          ₹{plan.budget_breakdown.driver_allowance.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-[#F7F8FA] p-2.5 rounded-xl border border-[#E5EAF0]">
                        <span className="text-[10px] text-[#718096] block">Tolls & Permits</span>
                        <span className="font-bold text-[#172B2A] text-xs mt-0.5 block">
                          ₹{plan.budget_breakdown.state_permits_tolls.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#F7F8FA] p-3.5 rounded-xl border border-[#E5EAF0] space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172B2A]">
                              Estimated Trip Total: ₹{plan.budget_breakdown.indicative_total.toLocaleString("en-IN")}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                plan.budget_breakdown.budget_status === "within_budget"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : plan.budget_breakdown.budget_status === "above_budget"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {plan.budget_breakdown.budget_status === "within_budget"
                                ? "Within Budget"
                                : plan.budget_breakdown.budget_status === "above_budget"
                                ? "Above Target Budget"
                                : "Benchmark"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#718096] mt-1 font-medium">
                            {plan.budget_breakdown.budget_comparison_note}
                          </p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[11px] text-[#718096] block">Indicative Range</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#075E54]">
                            ₹{plan.indicative_budget_min.toLocaleString("en-IN")} – ₹{plan.indicative_budget_max.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A]">
                    Market Range: <strong>₹{plan.indicative_budget_min.toLocaleString("en-IN")} – ₹{plan.indicative_budget_max.toLocaleString("en-IN")}</strong>
                  </div>
                )}
              </div>

              {/* SECTION 5: Suggested Daily Itinerary */}
              {plan.itinerary_highlights && plan.itinerary_highlights.length > 0 && (
                <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#075E54] uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Section 5 — Suggested Itinerary</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {plan.itinerary_highlights.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-[#F7F8FA] rounded-xl border border-[#E5EAF0] flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#075E54] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-[#172B2A] leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#718096] italic">
                    Daily destinations and activities are suggestions for planning convenience. Itineraries remain fully customizable.
                  </p>
                </div>
              )}

              {/* Legal Disclaimer */}
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer:</strong> Route benchmarks and budget figures are indicative estimates. Verified commercial fleet operators will provide genuine competitive quotations after you review and submit the trip form.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer Actions */}
        {plan && (
          <div className="p-4 sm:p-5 bg-white border-t border-[#E5EAF0] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#718096] hover:text-[#172B2A] border border-[#E5EAF0] rounded-xl cursor-pointer transition-colors"
            >
              Adjust Prompt
            </button>

            <button
              type="button"
              onClick={handleConfirmTransfer}
              className="w-full sm:w-auto px-6 py-3 bg-[#075E54] hover:bg-[#064e46] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.99]"
            >
              <span>Continue to Trip Request</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
