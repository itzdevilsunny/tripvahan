"use client";

import React, { useState, useEffect } from "react";
import {
  Star,
  ShieldCheck,
  Check,
  Fuel,
  FileCheck,
  CreditCard,
  Phone,
  Clock,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Car,
  Hourglass,
} from "lucide-react";
import { Quotation, TripRequest } from "@/lib/types";
import { dataService } from "@/lib/dataService";

interface CabOffersViewProps {
  tripRequest?: TripRequest | null;
  onSelectQuotation: (quotation: Quotation) => void;
}

export default function CabOffersView({
  tripRequest,
  onSelectQuotation,
}: CabOffersViewProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [splitFare, setSplitFare] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "lowest" | "top_rated">("all");
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  // Default active trip request if none passed
  const activeTrip: TripRequest = tripRequest || {
    id: "trp_9042",
    trip_code: "TRP-9042",
    traveler_id: "usr_rohan",
    traveler_name: "Rohan S.",
    circuit_title: "Delhi → Agra → Jaipur",
    origin: "Delhi NCR",
    destination: "Jaipur",
    stops: ["New Delhi", "Agra Fort", "Jaipur City"],
    circuit_type: "Multi-day circuit",
    distance_km: 680,
    start_date: "Oct 24, 2026",
    duration: "3D / 2N Golden Triangle Trip",
    pickup_time: "06:30 AM",
    pickup_address: "Dwarka Sector 10, New Delhi",
    travellers_count: 12,
    adults_count: 10,
    seniors_count: 2,
    luggage_bags: 12,
    matched_vehicle_class: "Executive Minibus / Tempo Traveller",
    indicative_budget_min: 22000,
    indicative_budget_max: 26000,
    target_budget: 24500,
    amenities: ["Dual AC", "Waterproof Carrier"],
    status: "bidding",
    quotes_count: 0,
  };

  useEffect(() => {
    async function loadQuotes() {
      setLoading(true);
      const quotes = await dataService.getQuotations(activeTrip.id);
      setQuotations(quotes);
      setLoading(false);
    }
    loadQuotes();
  }, [activeTrip.id]);

  // Filter quotes
  const filteredQuotations = [...quotations].sort((a, b) => {
    if (activeFilter === "lowest") return a.total_quote - b.total_quote;
    if (activeFilter === "top_rated") return b.operator_rating - a.operator_rating;
    return 0;
  });

  const lowestFare = quotations.length > 0 ? Math.min(...quotations.map((q) => q.total_quote)) : 0;

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Confirmed Request Header Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full uppercase border border-teal-200/60">
            ACTIVE REQUEST #{activeTrip.trip_code}
          </span>
          <span className="text-xs font-semibold text-slate-500">
            Status: <span className="text-emerald-700 font-bold uppercase">{activeTrip.status}</span>
          </span>
        </div>

        <div>
          <h1 className="text-base font-extrabold text-slate-900 leading-snug">
            {activeTrip.circuit_title}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {activeTrip.travellers_count} Travellers ({activeTrip.adults_count} Adults, {activeTrip.seniors_count} Seniors) • {activeTrip.luggage_bags} Bags • {activeTrip.matched_vehicle_class}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-500">Target Budget:</span>
          <span className="font-extrabold text-[#00594c] text-sm">
            ₹{activeTrip.target_budget.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Split Fare Toggle */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-800">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">
              Split among {activeTrip.travellers_count} travellers
            </div>
            <div className="text-[11px] text-slate-500">
              showing per-person fair share
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSplitFare(!splitFare)}
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
            splitFare ? "bg-[#004d40]" : "bg-slate-300"
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              splitFare ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
            activeFilter === "all"
              ? "bg-[#004d40] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Offers ({quotations.length})
        </button>

        {lowestFare > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("lowest")}
            className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
              activeFilter === "lowest"
                ? "bg-[#004d40] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Lowest Fare (₹{lowestFare.toLocaleString("en-IN")})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveFilter("top_rated")}
          className={`px-3 py-1.5 rounded-full transition-all shrink-0 flex items-center gap-1 ${
            activeFilter === "top_rated"
              ? "bg-[#004d40] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Top Rated
        </button>
      </div>

      {/* Quotation Cards List or Honest Empty State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 font-medium">Fetching verified quotations from database...</p>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 flex items-center justify-center text-[#004d40]">
            <Hourglass className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-sm">
            Waiting for Operator Quotations
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Your trip request #{activeTrip.trip_code} is live in the marketplace. Commercial fleet partners in the corridor are preparing verified all-inclusive quotes.
          </p>
          <div className="pt-2">
            <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-full inline-block">
              Switch to Partner mode above to submit quotation
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuotations.map((quote) => {
            const isExpanded = expandedDetailsId === quote.id;
            const perPerson = Math.round(quote.total_quote / activeTrip.travellers_count);

            return (
              <div
                key={quote.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:border-teal-200"
              >
                {/* Badge & Rating Header */}
                <div className="p-3.5 pb-2 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        quote.badge?.includes("Best Match")
                          ? "bg-emerald-100 text-[#00594c]"
                          : quote.badge?.includes("Economy")
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {quote.badge || "Verified Fleet Partner"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{quote.operator_rating}</span>
                    <span className="text-slate-400 font-normal">({quote.reviews_count})</span>
                  </div>
                </div>

                {/* Main Vehicle & Price Row */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{quote.vehicle_name}</h3>
                      <p className="text-xs text-slate-500 font-semibold">{quote.operator_name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Plate: {quote.vehicle_reg} • Model {quote.model_year}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">
                        {splitFare ? `₹${perPerson.toLocaleString("en-IN")}` : `₹${quote.total_quote.toLocaleString("en-IN")}`}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        {splitFare ? "per passenger" : "all-inclusive total"}
                      </div>
                    </div>
                  </div>

                  {/* Highlights / Inclusions */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#00594c]">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{quote.inclusions[0] || "All-inclusive fuel and driver allowance"}</span>
                    </div>
                    {quote.inclusions.length > 1 && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{quote.inclusions[1]}</span>
                      </div>
                    )}
                  </div>

                  {/* Operator Message Note if any */}
                  {quote.operator_note && (
                    <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-100 flex items-start gap-2 text-xs text-teal-900">
                      <MessageSquare className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] italic leading-tight">
                        &quot;{quote.operator_note}&quot;
                      </p>
                    </div>
                  )}

                  {/* Price Breakdown Details Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedDetailsId(isExpanded ? null : quote.id)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? "Hide detailed fare breakdown" : "View transparent fee calculation"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 animate-in fade-in duration-200">
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>Base Fuel & Vehicle Usage</span>
                          <span className="font-bold text-slate-900">₹{quote.base_vehicle_fuel_rate.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>Driver Allowance & Night Bata</span>
                          <span className="font-bold text-slate-900">₹{quote.driver_night_allowance.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>FASTag Tolls & State Border Taxes</span>
                          <span className="font-bold text-slate-900">₹{quote.tolls_state_permit_taxes.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-200 flex justify-between font-extrabold text-slate-900">
                          <span>Total Quoted Fare</span>
                          <span className="text-[#00594c]">₹{quote.total_quote.toLocaleString("en-IN")}</span>
                        </div>

                        {quote.exclusions.length > 0 && (
                          <div className="pt-2 text-[10px] text-amber-800">
                            <span className="font-bold">Excluded: </span>
                            {quote.exclusions.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectQuotation(quote)}
                      className="w-full py-2.5 px-4 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Select Offer & Review Reservation Contract</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Honest Comparison Matrix (Only when 2+ quotes exist) */}
      {filteredQuotations.length > 1 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-800">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Honest Comparison Matrix</h3>
                <p className="text-[10px] text-slate-500">Side-by-side transparent fleet comparison</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                  <th className="py-2 font-medium">Metric</th>
                  {filteredQuotations.map((q) => (
                    <th key={q.id} className="py-2 font-bold text-teal-900">
                      {q.vehicle_name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-2 text-slate-500">Total Price</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2 font-bold text-slate-900">
                      ₹{q.total_quote.toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Per Person</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2 font-bold text-teal-900">
                      ₹{Math.round(q.total_quote / activeTrip.travellers_count).toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Model Year</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2 text-slate-700">
                      {q.model_year}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Operator Rating</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2 text-amber-700 font-bold">
                      ★ {q.operator_rating}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trust & Guarantee Disclaimer */}
      <p className="text-[10px] text-center text-slate-400 px-4 leading-normal">
        Quotation prices are binding only upon operator contract confirmation. Real Live Data connected via Supabase PostgreSQL.
      </p>
    </div>
  );
}
