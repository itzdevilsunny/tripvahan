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
} from "lucide-react";

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
  target_budget: number;
  indicative_budget_min: number;
  indicative_budget_max: number;
  matched_vehicle_class: string;
  amenities: string[];
  itinerary_highlights: string[];
  engine: "gemini_live" | "intelligent_nlp";
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
    text: "Plan a 5-day Delhi-to-Manali trip for 8 people, including 2 children, with luggage and a ₹35,000 budget.",
  },
  {
    label: "Golden Triangle (3 Days, 6 Pax)",
    text: "3-day trip from Delhi to Jaipur for 6 adults with luggage, visiting Agra and Taj Mahal on the way.",
  },
  {
    label: "Rishikesh Weekend (2 Days, 4 Pax)",
    text: "Weekend getaway from Delhi to Rishikesh for 4 people with light luggage, budget ₹15,000.",
  },
  {
    label: "Bangalore to Ooty (4 Days, 7 Pax)",
    text: "Bangalore to Ooty for 7 family members with 2 seniors and luggage, 4-day leisure trip.",
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
  const [engine, setEngine] = useState<"gemini_live" | "intelligent_nlp" | null>(null);
  const [plan, setPlan] = useState<TransferredAiPlan | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);

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
  };

  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setErrorMessage("Please enter a trip description first.");
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
          distance_km: trip.distance_km || 600,
          duration_hours: trip.duration_hours || 12,
          formatted_travel_time: trip.formatted_travel_time || "~12 hrs drive",
          travellers_count: trip.travellers_count || 4,
          adults_count: trip.adults_count || 4,
          children_count: trip.children_count || 0,
          seniors_count: trip.seniors_count || 0,
          luggage_bags: trip.luggage_bags || 4,
          target_budget: trip.target_budget || 25000,
          indicative_budget_min: trip.indicative_budget_min || Math.round(trip.target_budget * 0.9),
          indicative_budget_max: trip.indicative_budget_max || Math.round(trip.target_budget * 1.1),
          matched_vehicle_class: trip.matched_vehicle_class || "Force Urbania / Tempo (12-16 Seater)",
          amenities: trip.amenities || [],
          itinerary_highlights: trip.itinerary_highlights || [],
          engine: data.engine,
          user_facts: trip.user_facts || {},
          ai_suggestions: trip.ai_suggestions || {},
        };

        setPlan(fullPlan);
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
      indicative_budget_min: Math.round(editBudget * 0.9),
      indicative_budget_max: Math.round(editBudget * 1.1),
    };

    onTransferToForm(finalPlan);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-planner-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E5EAF0] my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#075E54] to-[#0A7B6E] p-5 sm:p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider bg-white/15 px-2.5 py-0.5 rounded-full text-emerald-100">
              Tripvahan Assistant
            </span>
          </div>

          <h2 id="ai-planner-title" className="text-xl sm:text-2xl font-bold tracking-tight">
            AI-Powered Trip Planner
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-lg">
            Describe your group journey in natural language. We’ll analyze route benchmarks, recommend vehicle capacity, and prepare an editable request.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Engine Disclaimer Badge */}
          {engine && (
            <div className="flex items-center justify-between bg-[#F7F8FA] border border-[#E5EAF0] px-3.5 py-2 rounded-xl text-xs">
              <span className="text-[#718096]">Processing Engine:</span>
              {engine === "gemini_live" ? (
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Gemini 2.5 Flash (Live Model)
                </span>
              ) : (
                <span className="font-semibold text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-full border border-[#075E54]/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" />
                  Intelligent NLP Corridors (Rule-Based Fallback)
                </span>
              )}
            </div>
          )}

          {/* Prompt Input Section */}
          {!plan && (
            <div className="space-y-3">
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

              <div className="relative">
                <textarea
                  id="ai-prompt-input"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={1000}
                  placeholder="e.g. Plan a 5-day Delhi to Manali trip for 8 people, including 2 children, with luggage and a ₹35,000 budget."
                  className="w-full text-xs sm:text-sm p-3.5 border border-[#E5EAF0] rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#075E54]/25 focus:border-[#075E54] transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Example Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider block">
                  Quick Prompt Templates
                </span>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyExample(ex.text)}
                      className="text-[11px] font-medium bg-[#F7F8FA] hover:bg-[#E5EAF0] text-[#172B2A] px-2.5 py-1.5 rounded-xl border border-[#E5EAF0] transition-colors cursor-pointer text-left"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unable to process request</p>
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
                    Please update your description above to include your starting city and primary destination.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                {prompt.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3.5 py-2.5 text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isLoading || !prompt.trim()}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                    isLoading || !prompt.trim()
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#075E54] hover:bg-[#064e46] text-white"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Itinerary...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Itinerary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Generated Plan Review Section */}
          {plan && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#DDF7ED] border border-[#075E54]/20 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#075E54] text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#DDF7ED]" />
                  </span>
                  <div>
                    <h4 className="font-bold text-[#075E54] text-sm">
                      Structured Itinerary Ready for Review
                    </h4>
                    <p className="text-xs text-[#172B2A]/80">
                      Verify details below. You can edit any parameter before transferring to the trip form.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-[#075E54] hover:underline shrink-0 cursor-pointer"
                >
                  Start Over
                </button>
              </div>

              {/* User Facts vs AI Suggestions Distinction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. User Facts */}
                <div className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-[#718096] uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#075E54]" />
                    User-Provided Facts
                  </span>
                  <div className="space-y-1.5 text-[#172B2A]">
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Route:</span>
                      <span className="font-semibold">
                        {editOrigin} → {editDestination}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Passengers:</span>
                      <span className="font-semibold">
                        {editAdults + editChildren + editSeniors} Pax ({editAdults} Adults, {editChildren} Kids, {editSeniors} Seniors)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Budget Specified:</span>
                      <span className="font-semibold">
                        ₹{editBudget.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Duration:</span>
                      <span className="font-semibold">{editDays} Days</span>
                    </div>
                  </div>
                </div>

                {/* 2. AI Suggestions & Estimates */}
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#075E54]" />
                    AI Suggestions & Capacity
                  </span>
                  <div className="space-y-1.5 text-[#172B2A]">
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Recommended Fleet:</span>
                      <span className="font-semibold text-[#075E54]">
                        {plan.matched_vehicle_class}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Estimated Highway Distance:</span>
                      <span className="font-semibold">
                        {plan.distance_km > 0 ? `~${plan.distance_km} km (Estimate)` : "Pending partner quotation"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Estimated Drive Time:</span>
                      <span className="font-semibold">{plan.formatted_travel_time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Market Range:</span>
                      <span className="font-semibold">
                        ₹{plan.indicative_budget_min.toLocaleString("en-IN")} – ₹{plan.indicative_budget_max.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Fields Form */}
              <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 space-y-3.5">
                <span className="text-xs font-bold text-[#172B2A] block">
                  Quick Adjustments (Optional)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Origin City</label>
                    <input
                      type="text"
                      value={editOrigin}
                      onChange={(e) => setEditOrigin(e.target.value)}
                      className="w-full p-2.5 border border-[#E5EAF0] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#075E54]"
                    />
                  </div>
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Destination</label>
                    <input
                      type="text"
                      value={editDestination}
                      onChange={(e) => setEditDestination(e.target.value)}
                      className="w-full p-2.5 border border-[#E5EAF0] rounded-xl text-xs font-medium focus:ring-1 focus:ring-[#075E54]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Days</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={editDays}
                      onChange={(e) => setEditDays(parseInt(e.target.value, 10) || 1)}
                      className="w-full p-2 border border-[#E5EAF0] rounded-xl text-xs text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Adults</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editAdults}
                      onChange={(e) => setEditAdults(parseInt(e.target.value, 10) || 1)}
                      className="w-full p-2 border border-[#E5EAF0] rounded-xl text-xs text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Children</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={editChildren}
                      onChange={(e) => setEditChildren(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2 border border-[#E5EAF0] rounded-xl text-xs text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#718096] block font-medium mb-1">Luggage Bags</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={editLuggage}
                      onChange={(e) => setEditLuggage(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2 border border-[#E5EAF0] rounded-xl text-xs text-center font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#718096] block font-medium mb-1 text-xs">
                    Target Budget (₹ INR)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={editBudget}
                    onChange={(e) => setEditBudget(parseInt(e.target.value, 10) || 5000)}
                    className="w-full p-2.5 border border-[#E5EAF0] rounded-xl text-xs font-semibold text-[#075E54]"
                  />
                </div>
              </div>

              {/* Day-by-Day Itinerary Highlights */}
              {plan.itinerary_highlights.length > 0 && (
                <div className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-2xl p-4 space-y-2">
                  <span className="text-xs font-bold text-[#172B2A] block">
                    Suggested Daily Outline
                  </span>
                  <div className="space-y-1.5 text-xs text-[#172B2A]/90">
                    {plan.itinerary_highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#075E54] mt-1.5 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estimate Disclaimer */}
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Disclaimer:</strong> Route benchmarks and budget figures are indicative estimates. Verified commercial fleet operators will provide binding competitive quotations only after you review and publish the trip form.
                </p>
              </div>

              {/* Transfer CTA */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#718096] hover:text-[#172B2A] border border-[#E5EAF0] rounded-xl cursor-pointer"
                >
                  Adjust Prompt
                </button>

                <button
                  type="button"
                  onClick={handleConfirmTransfer}
                  className="w-full sm:w-auto px-6 py-3 bg-[#075E54] hover:bg-[#064e46] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <span>Review & Transfer to Trip Form</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
