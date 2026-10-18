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
  Inbox,
} from "lucide-react";
import { TripRequest } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";

interface TripRequestsMarketplaceProps {
  onSelectForQuote: (trip: TripRequest) => void;
}

export default function TripRequestsMarketplace({
  onSelectForQuote,
}: TripRequestsMarketplaceProps) {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [hubFilter, setHubFilter] = useState("All Corridors");

  const loadRequests = async () => {
    setLoading(true);
    const data = await dataService.getTripRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
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
      {/* Fleet Partner Header Banner */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                <span>COMMERCIAL FLEET PARTNER</span>
              </div>
              <h2 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                {profile?.operator_name || profile?.full_name || "Verified Fleet Partner"}
              </h2>
            </div>
          </div>

          <span className="text-[11px] font-bold bg-emerald-100 text-[#00594c] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            {requests.length} Open Requests
          </span>
        </div>

        {/* Filter categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
              activeCategory === "all"
                ? "bg-[#004d40] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Vehicles ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("urbania")}
            className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
              activeCategory === "urbania"
                ? "bg-[#004d40] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Urbania / Tempo
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("innova")}
            className={`px-3 py-1.5 rounded-full transition-all shrink-0 ${
              activeCategory === "innova"
                ? "bg-[#004d40] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Innova Crysta
          </button>
        </div>
      </div>

      {/* Requests List or Honest Empty State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 font-medium">Loading live marketplace requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-sm">
            No Open Trip Requests Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            There are currently no active trip requests matching this filter. As soon as a group traveller publishes a route request, it will appear here for bidding.
          </p>
          <div className="pt-2">
            <button
              onClick={loadRequests}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
            >
              Refresh Marketplace
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden hover:border-teal-200 transition-all"
            >
              <div className="p-4 space-y-3">
                {/* Trip header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase border border-teal-200/60">
                      Req #{req.trip_code}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mt-1.5">
                      {req.circuit_title}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Target Budget</span>
                    <span className="font-black text-[#00594c] text-base">
                      ₹{req.target_budget?.toLocaleString("en-IN") || "Quote Req."}
                    </span>
                  </div>
                </div>

                {/* Timing & Pickup */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span className="font-semibold">
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
                  {req.matched_vehicle_class}
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
                        ? `${req.quotes_count} Quotes submitted`
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
          ))}
        </div>
      )}

      {/* Operator Trust & Compliance */}
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
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Transparent Payout
          </span>
        </div>
      </div>
    </div>
  );
}
