"use client";

import React, { useState, useEffect } from "react";
import {
  Star,
  ShieldCheck,
  Check,
  Fuel,
  FileCheck,
  Moon,
  CreditCard,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Car,
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
    quotes_count: 3,
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

  const lowestFare = quotations.length > 0 ? Math.min(...quotations.map((q) => q.total_quote)) : 21500;

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Confirmed Request Header Card (Image 1 top) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full uppercase border border-teal-200/60">
            CONFIRMED REQUEST #{activeTrip.trip_code}
          </span>
          <button
            type="button"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Filter options"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {activeTrip.circuit_title}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            {activeTrip.duration} • {activeTrip.travellers_count} Travellers
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            {quotations.length} Quotations Received • 1 Pending
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
            <Clock className="w-3 h-3" /> Lowest quote locked for 34m
          </span>
        </div>

        {/* Route stops pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs text-slate-700 font-medium">
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-md shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> New Delhi
          </span>
          <span className="text-slate-400">→</span>
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-md shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Agra Fort
          </span>
          <span className="text-slate-400">→</span>
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-md shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Jaipur City
          </span>
        </div>
      </div>

      {/* Split Fare Toggle Card */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
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

      {/* Quotation Cards List */}
      <div className="space-y-4">
        {filteredQuotations.map((quote) => {
          const isUrbania = quote.vehicle_name.includes("Urbania");
          const isGanesh = quote.operator_name.includes("Ganesh");
          const isNCR = quote.operator_name.includes("NCR");

          const isExpanded = expandedDetailsId === quote.id;

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
                        : quote.badge?.includes("Lowest") || quote.badge?.includes("Economy")
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {quote.badge || "Verified Partner"}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{quote.operator_rating}</span>
                  <span className="text-slate-400 font-normal">({quote.reviews_count})</span>
                </div>
              </div>

              {/* Vehicle Photo Banner & Overlays */}
              <div className="relative h-44 w-full bg-slate-900 overflow-hidden group">
                <img
                  src={
                    quote.vehicle_image ||
                    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80"
                  }
                  alt={quote.vehicle_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Overlaid Tags */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white">
                  <span className="bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md font-medium border border-white/20 flex items-center gap-1">
                    <Car className="w-3 h-3 text-emerald-400" />
                    {isUrbania
                      ? "13 Luxury Recliners (2x1)"
                      : isGanesh
                      ? "17 Seater Standard Coach"
                      : "19-Seater Mini Coach"}
                  </span>
                  <span className="bg-black/60 backdrop-blur-xs px-2 py-1 rounded-md font-medium border border-white/20">
                    {quote.model_year} Model
                  </span>
                </div>
              </div>

              {/* Operator & Price Details */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {quote.operator_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {quote.vehicle_name} • {quote.vehicle_reg}
                  </p>
                </div>

                {/* Pricing Box */}
                <div className="flex items-baseline justify-between bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">
                        ₹
                        {(splitFare
                          ? quote.per_person_fare
                          : quote.total_quote
                        ).toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {splitFare ? "/ person" : "Total quote"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {splitFare
                        ? `₹${quote.total_quote.toLocaleString("en-IN")} Total all-inclusive quote`
                        : `₹${quote.per_person_fare.toLocaleString("en-IN")} / person share`}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                      quote.badge?.includes("Economy")
                        ? "bg-blue-100 text-blue-800"
                        : quote.badge?.includes("Ultra")
                        ? "bg-purple-100 text-purple-800"
                        : "bg-teal-100 text-[#00594c]"
                    }`}
                  >
                    {quote.badge?.includes("Economy")
                      ? "Lowest Fare"
                      : quote.badge?.includes("Ultra")
                      ? "VIP Seating"
                      : "Zero hidden charges"}
                  </span>
                </div>

                {/* Inclusions Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>750 km Fuel Included</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>UP & RJ Border Permits</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Driver Night Bata Included</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>FASTag Tolls Pre-paid</span>
                  </div>
                </div>

                {/* Caution note if interstate permit is excluded (Ganesh quote in screenshot) */}
                {isGanesh && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Interstate border permits (approx ₹2,200) payable separately at RTO checkpoint by passenger.
                    </span>
                  </div>
                )}

                {/* Operator Note Bubble (Image 1 feature) */}
                {quote.operator_note && (
                  <div className="bg-teal-50/60 rounded-xl p-3 border border-teal-100/90 text-[11px] text-slate-700 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-teal-900 block mb-0.5">
                        Message from {quote.operator_name.split(" ")[0]} Desk:
                      </span>
                      <p className="italic leading-relaxed">
                        &ldquo;{quote.operator_note}&rdquo;
                      </p>
                    </div>
                  </div>
                )}

                {/* Free Cancellation Notice */}
                <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Free cancellation up to 48 hrs before departure
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={() => onSelectQuotation(quote)}
                  className="w-full py-3 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all"
                >
                  {isUrbania ? (
                    <>
                      Select This Offer & Review Booking <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Select ₹{quote.total_quote.toLocaleString("en-IN")} Offer
                    </>
                  )}
                </button>

                {/* Secondary Links */}
                <div className="flex items-center justify-center gap-6 pt-1 text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setExpandedDetailsId(isExpanded ? null : quote.id)}
                    className="hover:text-slate-900 flex items-center gap-1"
                  >
                    <span>View Route Map & Audits</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href="tel:+919811234567"
                    className="hover:text-slate-900 flex items-center gap-1 text-[#00594c]"
                  >
                    <Phone className="w-3 h-3" /> Call Operator Desk
                  </a>
                </div>

                {/* Expanded Details Accordion */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-lg">
                    <div className="font-bold text-slate-800">Vehicle Compliance & Audits:</div>
                    <div>• Vehicle RC: Verified & Registered Commercial Yellow Plate</div>
                    <div>• Speed Governor: Calibrated to 80 km/h highway ceiling</div>
                    <div>• RTO Permit: All-India Tourist Permit with UP & Rajasthan endorsement</div>
                    <div>• Chauffeur: Background checked & police verified</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honest Comparison Matrix (Image 1 Bottom Table) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-800">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Honest Comparison Matrix</h3>
              <p className="text-[10px] text-slate-500">Side-by-side feature transparent breakdown</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Side-by-side
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="py-2 font-medium">Feature</th>
                <th className="py-2 font-bold text-teal-900">Urbania (Force)</th>
                <th className="py-2 font-medium">Ganesh</th>
                <th className="py-2 font-medium">NCR Coach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="py-2 text-slate-500">Total Price</td>
                <td className="py-2 font-bold text-teal-900">₹24,800</td>
                <td className="py-2 text-slate-700">₹21,500</td>
                <td className="py-2 text-slate-700">₹28,000</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Per Person</td>
                <td className="py-2 font-bold text-teal-900">₹2,066</td>
                <td className="py-2 text-slate-700">₹1,791</td>
                <td className="py-2 text-slate-700">₹2,333</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Interstate Tax</td>
                <td className="py-2 font-bold text-emerald-700">Included</td>
                <td className="py-2 text-amber-700 font-semibold">+ ₹2,200</td>
                <td className="py-2 font-bold text-emerald-700">Included</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Model Year</td>
                <td className="py-2 font-bold text-teal-900">2023</td>
                <td className="py-2 text-slate-700">2021</td>
                <td className="py-2 text-slate-700">2023</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Night Bata</td>
                <td className="py-2 font-bold text-emerald-700">Included</td>
                <td className="py-2 font-bold text-emerald-700">Included</td>
                <td className="py-2 font-bold text-emerald-700">Included</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Need Custom Quote? Specialist Assistance Card */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-teal-50/60 rounded-2xl p-4 border border-blue-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">Need a custom quote?</div>
            <p className="text-[11px] text-slate-600">
              Tripvahan mobility specialist Rohan is assisting you
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => alert("Connecting to Tripvahan mobility concierge desk...")}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-50 shadow-xs"
        >
          Help
        </button>
      </div>

      {/* Prototype Footer Disclaimer (Image 1 bottom) */}
      <p className="text-[10px] text-center text-slate-400 px-4 leading-normal">
        Quotation prices are binding only upon operator digital contract sign-off. Real Live Data connected via Supabase PostgreSQL.
      </p>
    </div>
  );
}
