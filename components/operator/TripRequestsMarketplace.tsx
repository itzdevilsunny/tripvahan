"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  Users,
  Luggage,
  Route,
  ArrowRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Zap,
  Car,
  ChevronRight,
} from "lucide-react";
import { TripRequest } from "@/lib/types";
import { dataService } from "@/lib/dataService";

interface TripRequestsMarketplaceProps {
  onSelectForQuote: (trip: TripRequest) => void;
}

export default function TripRequestsMarketplace({
  onSelectForQuote,
}: TripRequestsMarketplaceProps) {
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [hubFilter, setHubFilter] = useState("Delhi NCR Hub");

  useEffect(() => {
    async function loadRequests() {
      const data = await dataService.getTripRequests();
      setRequests(data);
    }
    loadRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (activeCategory === "urbania") {
      return (
        r.matched_vehicle_class.toLowerCase().includes("urbania") ||
        r.matched_vehicle_class.toLowerCase().includes("tempo")
      );
    }
    if (activeCategory === "innova") {
      return r.matched_vehicle_class.toLowerCase().includes("innova");
    }
    return true;
  });

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Fleet Partner Header Banner (Image 2 top) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                <span>FLEET PARTNER • DL-OP-409</span>
              </div>
              <h2 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                Rajputana Mobility Solutions
              </h2>
            </div>
          </div>

          <span className="text-[11px] font-bold bg-emerald-100 text-[#00594c] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            {requests.length} Matches
          </span>
        </div>

        {/* Filters bar */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span>{hubFilter}</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Next 7 Days</span>
          </button>

          <button
            type="button"
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
            activeCategory === "all"
              ? "bg-[#004d40] text-white shadow-xs font-bold"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Matching ({requests.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("urbania")}
          className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
            activeCategory === "urbania"
              ? "bg-[#004d40] text-white shadow-xs font-bold"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Urbania / Tempo (4)
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("innova")}
          className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
            activeCategory === "innova"
              ? "bg-[#004d40] text-white shadow-xs font-bold"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Innova Crysta
        </button>
      </div>

      {/* Matching Trip Requests Feed */}
      <div className="space-y-4">
        {filteredRequests.map((req, idx) => {
          const isUrgentMatch = idx === 0;

          return (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-teal-300"
            >
              {/* Top match bar */}
              {isUrgentMatch && (
                <div className="bg-teal-50/80 px-3.5 py-1.5 border-b border-teal-100 flex items-center justify-between text-[11px] font-semibold text-teal-900">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Car className="w-3.5 h-3.5 text-teal-700" />
                    Match: DL 01 TA 9821 (Force Urbania)
                  </span>
                  <span className="text-red-600 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 4h left
                  </span>
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Circuit header & Budget */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                      {req.circuit_title.includes("Golden")
                        ? "Golden Triangle Circuit"
                        : req.circuit_type}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {req.origin} → {req.destination}
                    </h3>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-2.5 py-1 text-right shrink-0">
                    <span className="text-[9px] font-bold uppercase text-emerald-800 block">
                      Indicative Budget
                    </span>
                    <span className="font-extrabold text-[#00594c] text-xs sm:text-sm">
                      ₹{Math.round(req.target_budget * 0.95 / 1000)}k -{" "}
                      {Math.round(req.target_budget * 1.05 / 1000)}k
                    </span>
                  </div>
                </div>

                {/* Dates & Pickup */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {req.start_date} ({req.duration})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      Pickup: {req.pickup_time} {req.pickup_address}
                    </span>
                  </div>
                </div>

                {/* Passenger & Luggage Matrix row */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Travellers</div>
                      <div className="font-bold text-slate-900">
                        {req.travellers_count} ({req.adults_count || req.travellers_count} Ad,{" "}
                        {req.seniors_count || 0} Elders)
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Luggage className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500">Luggage Load</div>
                      <div className="font-bold text-slate-900">
                        {req.luggage_bags} Bags (Suitcases)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle Requirement Note */}
                <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  <span className="font-bold text-slate-900">Required: </span>
                  {req.matched_vehicle_class} with pushback 2×1 seating & clean carrier.
                </div>

                {/* Planned Route Track */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-teal-900 flex items-center gap-1">
                      <Route className="w-3 h-3 text-teal-700" /> Planned Route Track
                    </span>
                    <span className="font-bold text-slate-800">~{req.distance_km} km total</span>
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">
                    {req.stops && req.stops.length > 0
                      ? req.stops.join(" → ")
                      : `${req.origin} → ${req.destination}`}
                  </div>
                </div>

                {/* Card Action bar */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                      DL
                    </span>
                    <span>
                      {req.quotes_count > 0
                        ? `${req.quotes_count} Quotes in`
                        : "No quotes yet • Be First"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectForQuote(req)}
                    className="py-2.5 px-4 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    <span>{req.quotes_count > 0 ? "Review & Quote" : "Submit Quotation"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operator Trust & Compliance (Image 2 bottom) */}
      <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-blue-50/60 rounded-2xl p-4 border border-teal-200/80 space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-100 text-teal-900">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
            Operator Trust & Compliance
          </h3>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          Only quotes from <strong>Yellow Board commercial vehicles</strong> with active comprehensive insurance and valid RTO interstate permits are released to organizers.
        </p>

        <div className="flex items-center gap-4 pt-1 text-[11px] font-semibold text-teal-900">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Permit Shield
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Escrow Pay
          </span>
        </div>
      </div>

      <p className="text-[10px] text-center text-slate-400 px-4 leading-normal">
        Live trip opportunities are matched algorithmically based on your garage hub and vehicle permit readiness.
      </p>
    </div>
  );
}
