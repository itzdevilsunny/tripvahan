"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Star,
  Heart,
  Check,
  CreditCard,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ShieldCheck,
  Hourglass,
  Wind,
  UserCheck,
  Shield,
  FileCheck,
} from "lucide-react";
import { Quotation, TripRequest } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { getVehicleImage } from "@/lib/mediaAssets";

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
  const [likedQuotes, setLikedQuotes] = useState<Record<string, boolean>>({});

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

  // Filter quotes: exclude already accepted/booked quotes from available offers
  const availableQuotations = quotations.filter((q) => q.status === "pending" || !q.status);

  const filteredQuotations = [...availableQuotations].sort((a, b) => {
    if (activeFilter === "lowest") return a.total_quote - b.total_quote;
    if (activeFilter === "top_rated") return b.operator_rating - a.operator_rating;
    return 0;
  });

  const lowestFare = quotations.length > 0 ? Math.min(...quotations.map((q) => q.total_quote)) : 0;
  const hasRatedQuotes = quotations.some((q) => q.operator_rating && q.operator_rating > 0);

  const toggleLike = (quoteId: string) => {
    setLikedQuotes((prev) => ({ ...prev, [quoteId]: !prev[quoteId] }));
  };

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Page Title & Subtitle matching Column 3 of reference design */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#172B2A] tracking-tight">
          Cab Offers
        </h1>
        <p className="text-xs sm:text-sm text-[#718096]">
          Compare verified fleet partners and choose the best quotation
        </p>
      </div>

      {/* Confirmed Request Summary Pill Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wider text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-full uppercase">
            Active Request #{activeTrip.trip_code}
          </span>
          <span className="text-xs text-[#718096]">
            Status: <span className="text-[#075E54] font-semibold uppercase">{activeTrip.status}</span>
          </span>
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#172B2A] leading-snug">
            {activeTrip.circuit_title}
          </h2>
          <p className="text-xs text-[#718096] mt-1">
            {activeTrip.travellers_count} Travellers ({activeTrip.adults_count} Adults, {activeTrip.seniors_count} Seniors) · {activeTrip.luggage_bags} Bags · {activeTrip.matched_vehicle_class}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E5EAF0]">
          <span className="text-[#718096]">Target Budget</span>
          <span className="font-bold text-[#075E54] text-base">
            ₹{activeTrip.target_budget.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Filter Tabs matching Column 3 mockup: [All Offers] [Lowest Fare] [★ Top Rated] */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
            activeFilter === "all"
              ? "bg-[#075E54] text-white shadow-xs font-semibold"
              : "bg-white text-[#718096] border border-[#E5EAF0] hover:border-slate-300 hover:text-[#172B2A]"
          }`}
        >
          All Offers ({quotations.length})
        </button>

        {lowestFare > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("lowest")}
            className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
              activeFilter === "lowest"
                ? "bg-[#075E54] text-white shadow-xs font-semibold"
                : "bg-white text-[#718096] border border-[#E5EAF0] hover:border-slate-300 hover:text-[#172B2A]"
            }`}
          >
            Lowest Fare
          </button>
        )}

        {hasRatedQuotes && (
          <button
            type="button"
            onClick={() => setActiveFilter("top_rated")}
            className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              activeFilter === "top_rated"
                ? "bg-[#075E54] text-white shadow-xs font-semibold"
                : "bg-white text-[#718096] border border-[#E5EAF0] hover:border-slate-300 hover:text-[#172B2A]"
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Top Rated</span>
          </button>
        )}

        {/* Split fare toggle switch */}
        <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
          <span className="text-[11px] text-[#718096]">Per-pax</span>
          <button
            type="button"
            onClick={() => setSplitFare(!splitFare)}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
              splitFare ? "bg-[#075E54]" : "bg-slate-300"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                splitFare ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Quotation Cards List or Honest Empty State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-[#075E54] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#718096] font-medium">Fetching verified quotations from marketplace...</p>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#DDF7ED] flex items-center justify-center text-[#075E54]">
            <Hourglass className="w-5 h-5 animate-pulse" />
          </div>
          <h3 className="font-semibold text-[#172B2A] text-sm">
            Waiting for Operator Quotations
          </h3>
          <p className="text-xs text-[#718096] max-w-sm mx-auto leading-relaxed">
            Your trip request #{activeTrip.trip_code} is active. Commercial fleet partners along the route are preparing verified all-inclusive quotes.
          </p>
          <div className="pt-2">
            <span className="text-[11px] font-medium text-[#075E54] bg-[#DDF7ED] px-3 py-1.5 rounded-full inline-block">
              Switch to Fleet Partner mode above to submit quotation
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuotations.map((quote) => {
            const isExpanded = expandedDetailsId === quote.id;
            const perPerson = Math.round(quote.total_quote / activeTrip.travellers_count);
            const isLiked = !!likedQuotes[quote.id];
            const vehicleImg = getVehicleImage(undefined, quote.vehicle_name);

            return (
              <div
                key={quote.id}
                className="bg-white rounded-2xl border border-[#E5EAF0] shadow-xs overflow-hidden transition-all hover:border-[#075E54]/40"
              >
                {/* Vehicle Image Header with Badges matching Column 3 */}
                <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-100">
                  <Image
                    src={vehicleImg}
                    alt={quote.vehicle_name}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                  {/* Subtle dark gradient overlay on bottom for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                  {/* Top-left: Verified Fleet Partner Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#075E54] text-white text-[11px] font-medium px-2.5 py-1 rounded-full shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>{quote.badge || "Verified Fleet Partner"}</span>
                  </div>

                  {/* Top-right: Heart Favorite Button */}
                  <button
                    type="button"
                    onClick={() => toggleLike(quote.id)}
                    aria-label="Save offer"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-xs hover:bg-white transition-all cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isLiked ? "fill-rose-500 text-rose-500" : "text-[#718096] hover:text-rose-500"
                      }`}
                    />
                  </button>

                  {/* Bottom-right: Rating pill only when genuine rating exists */}
                  {quote.operator_rating > 0 && (
                    <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{quote.operator_rating}</span>
                      {quote.reviews_count > 0 && (
                        <span className="text-white/80 font-normal">({quote.reviews_count})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Content Body */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* Operator Name & Vehicle Specs */}
                  <div>
                    <h3 className="font-bold text-[#172B2A] text-base sm:text-lg leading-snug">
                      {quote.operator_name}
                    </h3>
                    <p className="text-xs text-[#718096] mt-0.5">
                      {quote.vehicle_name} · {quote.model_year}
                    </p>
                    <p className="text-[11px] font-mono text-[#718096] mt-0.5">
                      Yellow Plate: {quote.vehicle_reg}
                    </p>
                  </div>

                  {/* Feature Tags Row matching Column 3 */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F8FA] border border-[#E5EAF0] text-[#172B2A] text-xs font-medium">
                      <Wind className="w-3.5 h-3.5 text-[#075E54]" />
                      AC
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F8FA] border border-[#E5EAF0] text-[#172B2A] text-xs font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-[#075E54]" />
                      Experienced Driver
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F8FA] border border-[#E5EAF0] text-[#172B2A] text-xs font-medium">
                      <Shield className="w-3.5 h-3.5 text-[#075E54]" />
                      All-Inclusive
                    </span>
                  </div>

                  {/* Highlights / Inclusions */}
                  <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A] space-y-1.5">
                    <div className="flex items-center gap-2 font-medium text-[#075E54]">
                      <Check className="w-3.5 h-3.5 text-[#075E54] shrink-0" />
                      <span>{quote.inclusions[0] || "All-inclusive fuel and driver allowance"}</span>
                    </div>
                    {quote.inclusions.length > 1 && (
                      <div className="flex items-center gap-2 text-[#718096]">
                        <Check className="w-3.5 h-3.5 text-[#075E54] shrink-0" />
                        <span>{quote.inclusions[1]}</span>
                      </div>
                    )}
                  </div>

                  {/* Operator Message Note if any */}
                  {quote.operator_note && (
                    <div className="bg-[#DDF7ED]/40 p-3 rounded-xl border border-[#075E54]/20 flex items-start gap-2 text-xs text-[#172B2A]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#075E54] shrink-0 mt-0.5" />
                      <p className="text-xs italic leading-relaxed text-[#172B2A]">
                        &quot;{quote.operator_note}&quot;
                      </p>
                    </div>
                  )}

                  {/* Price Breakdown Details Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedDetailsId(isExpanded ? null : quote.id)}
                      className="text-xs font-medium text-[#718096] hover:text-[#172B2A] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? "Hide transparent fare breakdown" : "View transparent fee calculation"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] text-xs space-y-2 animate-in fade-in duration-200">
                        <div className="flex justify-between text-[#718096] text-xs">
                          <span>Base Fuel & Vehicle Usage</span>
                          <span className="font-semibold text-[#172B2A]">₹{quote.base_vehicle_fuel_rate.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-[#718096] text-xs">
                          <span>Driver Allowance & Night Bata</span>
                          <span className="font-semibold text-[#172B2A]">₹{quote.driver_night_allowance.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-[#718096] text-xs">
                          <span>FASTag Tolls & State Border Taxes</span>
                          <span className="font-semibold text-[#172B2A]">₹{quote.tolls_state_permit_taxes.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="pt-2 border-t border-[#E5EAF0] flex justify-between font-bold text-sm text-[#172B2A]">
                          <span>Total Quoted Fare</span>
                          <span className="text-[#075E54]">₹{quote.total_quote.toLocaleString("en-IN")}</span>
                        </div>

                        {quote.exclusions.length > 0 && (
                          <div className="pt-1.5 text-[11px] text-[#718096]">
                            <span className="font-medium text-[#172B2A]">Excluded: </span>
                            {quote.exclusions.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Split Row: Price on Left, View Details CTA on Right matching Column 3 */}
                  <div className="pt-2 border-t border-[#E5EAF0] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-[#075E54]">
                        {splitFare ? `₹${perPerson.toLocaleString("en-IN")}` : `₹${quote.total_quote.toLocaleString("en-IN")}`}
                      </div>
                      <div className="text-[11px] text-[#718096]">
                        {splitFare ? "per passenger" : "all-inclusive total"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectQuotation(quote)}
                      className="px-5 py-2.5 rounded-xl bg-[#DDF7ED] hover:bg-[#075E54] text-[#075E54] hover:text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <span>View Details</span>
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
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#DDF7ED] text-[#075E54]">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[#172B2A] text-sm">Honest Comparison Matrix</h3>
                <p className="text-[11px] text-[#718096]">Side-by-side transparent fleet comparison</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#E5EAF0] text-[#718096] text-xs">
                  <th className="py-2.5 font-medium">Metric</th>
                  {filteredQuotations.map((q) => (
                    <th key={q.id} className="py-2.5 font-semibold text-[#172B2A]">
                      {q.vehicle_name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0] font-normal">
                <tr>
                  <td className="py-2.5 text-[#718096]">Total Price</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2.5 font-semibold text-[#172B2A]">
                      ₹{q.total_quote.toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 text-[#718096]">Per Person</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2.5 font-semibold text-[#075E54]">
                      ₹{Math.round(q.total_quote / activeTrip.travellers_count).toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 text-[#718096]">Model Year</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2.5 text-[#172B2A]">
                      {q.model_year}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 text-[#718096]">Operator Rating</td>
                  {filteredQuotations.map((q) => (
                    <td key={q.id} className="py-2.5 text-amber-600 font-semibold">
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
      <p className="text-[11px] text-center text-[#718096] px-4 leading-normal">
        Quotation prices are binding only upon operator contract confirmation. Real Live Data connected via Supabase PostgreSQL.
      </p>
    </div>
  );
}

