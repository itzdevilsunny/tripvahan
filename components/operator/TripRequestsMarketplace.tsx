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
  Car,
  ChevronRight,
  Inbox,
  RefreshCw,
  Info,
} from "lucide-react";
import { TripRequest } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";
import { getDestinationImage, getVehicleImage } from "@/lib/mediaAssets";

interface TripRequestsMarketplaceProps {
  onSelectForQuote: (trip: TripRequest) => void;
}

export default function TripRequestsMarketplace({
  onSelectForQuote,
}: TripRequestsMarketplaceProps) {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] = useState<string>("all");

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
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.circuit_title.toLowerCase().includes(q) ||
        r.origin.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.trip_code.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Filter chips
    if (activeChip === "golden_triangle") {
      return (
        r.circuit_title.toLowerCase().includes("golden") ||
        r.circuit_title.toLowerCase().includes("agra") ||
        r.circuit_title.toLowerCase().includes("jaipur")
      );
    }
    if (activeChip === "delhi_ncr") {
      return (
        r.origin.toLowerCase().includes("delhi") ||
        r.pickup_address.toLowerCase().includes("delhi") ||
        r.origin.toLowerCase().includes("dwarka")
      );
    }
    if (activeChip === "urbania") {
      return (
        r.matched_vehicle_class.toLowerCase().includes("urbania") ||
        r.matched_vehicle_class.toLowerCase().includes("tempo")
      );
    }
    return true;
  });

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Page Title & Subtitle matching Mockup */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#172B2A] tracking-tight">
          Trip Requests
        </h1>
        <p className="text-xs sm:text-sm text-[#718096]">
          Discover genuine group travel requests from verified travellers
        </p>
      </div>

      {/* Search Bar matching Mockup */}
      <div className="relative">
        <Filter className="w-4 h-4 text-[#718096] absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search routes (e.g. Delhi to Jaipur)"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5EAF0] bg-white text-xs sm:text-sm text-[#172B2A] placeholder:text-[#718096] focus:outline-none focus:border-[#075E54] shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-2.5 text-xs text-[#718096] hover:text-[#172B2A] cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Chips row matching Mockup */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { id: "all", label: `All (${requests.length})` },
          { id: "golden_triangle", label: "Golden Triangle" },
          { id: "delhi_ncr", label: "Delhi NCR" },
          { id: "urbania", label: "Force Urbania & Tempo" },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setActiveChip(chip.id)}
            className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
              activeChip === chip.id
                ? "bg-[#075E54] text-white shadow-xs"
                : "bg-white text-[#718096] border border-[#E5EAF0] hover:border-slate-300 hover:text-[#172B2A]"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Requests List or Honest Empty State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] text-center space-y-3">
          <div className="w-7 h-7 mx-auto border-2 border-[#075E54] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#718096]">Loading marketplace itineraries...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#F7F8FA] flex items-center justify-center text-[#718096]">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-[#172B2A] text-sm">
            No Open Trip Requests Found
          </h3>
          <p className="text-xs text-[#718096] max-w-sm mx-auto leading-relaxed">
            There are currently no active trip requests matching this filter. As soon as a group traveller publishes a route request, it will appear here for bidding.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveChip("all");
                loadRequests();
              }}
              className="px-4 py-2 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-[#E5EAF0] text-[#172B2A] text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#718096]" />
              <span>Reset Filters & Refresh</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            // Build visual route points
            const routePoints =
              req.stops && req.stops.length > 0
                ? [
                    req.origin,
                    ...req.stops.filter((s) => s !== req.origin && s !== req.destination),
                    req.destination,
                  ].slice(0, 4)
                : [req.origin, req.destination];

            const destImage = getDestinationImage(req.circuit_title, req.destination, req.origin);
            const vehImage = getVehicleImage(req.matched_vehicle_class);

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-[#E5EAF0] shadow-xs hover:border-[#075E54]/30 hover:shadow-sm transition-all duration-200 overflow-hidden"
              >
                {/* 1. Destination Image Header Banner matching Mockup */}
                <div className="relative h-36 sm:h-40 w-full overflow-hidden">
                  <img
                    src={destImage}
                    alt={req.circuit_title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                  {/* Top-left Request Code Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="font-mono text-[11px] font-semibold text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-md shadow-xs">
                      REQ #{req.trip_code}
                    </span>
                  </div>

                  {/* Top-right Duration Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                      {req.duration || "3D / 2N"}
                    </span>
                  </div>
                </div>

                {/* 2. Card Content Body */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* Trip Title & Subtitle */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-[#172B2A] leading-snug tracking-tight">
                      {req.circuit_title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#718096] mt-0.5">
                      <span className="font-medium text-[#075E54]">{req.circuit_type}</span>
                    </div>
                  </div>

                  {/* Dates & Pickup */}
                  <div className="space-y-1.5 text-xs text-[#718096]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#075E54] shrink-0" />
                      <span className="font-medium text-[#172B2A]">
                        {req.start_date} {req.duration ? `(${req.duration})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#718096] shrink-0" />
                      <span className="truncate">
                        Pickup: {req.pickup_time || "06:30 AM"}, {req.pickup_address || req.origin}
                      </span>
                    </div>
                  </div>

                  {/* Specs: Passenger Capacity & Luggage Load Grid matching Mockup */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-[#718096] shrink-0" />
                      <div>
                        <div className="font-semibold text-[#172B2A]">
                          {req.travellers_count} Travellers
                        </div>
                        <div className="text-[11px] text-[#718096]">
                          {req.adults_count || req.travellers_count} Adults, {req.seniors_count || 0} Elders
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] flex items-center gap-2.5">
                      <Luggage className="w-4 h-4 text-[#718096] shrink-0" />
                      <div>
                        <div className="font-semibold text-[#172B2A]">
                          {req.luggage_bags} Bags
                        </div>
                        <div className="text-[11px] text-[#718096]">Suitcases</div>
                      </div>
                    </div>
                  </div>

                  {/* Required Vehicle Panel with Vehicle Thumbnail matching Mockup */}
                  <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="text-[11px] text-[#718096] font-medium">Required Vehicle</div>
                      <div className="font-semibold text-[#172B2A] mt-0.5">
                        {req.matched_vehicle_class}
                      </div>
                    </div>
                    <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 border border-[#E5EAF0] bg-white">
                      <img
                        src={vehImage}
                        alt={req.matched_vehicle_class}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Planned Journey Timeline matching Mockup */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[#172B2A] flex items-center gap-1.5">
                        <Route className="w-3.5 h-3.5 text-[#075E54]" /> Planned Route
                      </span>
                      {req.distance_km > 0 && (
                        <span className="text-xs font-medium text-[#718096]">
                          ~{req.distance_km} km
                        </span>
                      )}
                    </div>

                    {/* Timeline track */}
                    <div className="relative py-2">
                      <div className="flex items-center justify-between relative z-10">
                        {routePoints.map((point, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col items-center text-center max-w-[80px]"
                          >
                            <span
                              className={`w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                                idx === 0
                                  ? "bg-[#075E54]"
                                  : idx === routePoints.length - 1
                                  ? "bg-[#075E54]"
                                  : "bg-[#718096]"
                              }`}
                            />
                            <span className="text-[11px] font-medium text-[#172B2A] mt-1 truncate max-w-full">
                              {point.split(" ")[0]}
                            </span>
                            <span className="text-[9px] text-[#718096]">
                              {idx === 0
                                ? "0 km"
                                : idx === routePoints.length - 1
                                ? `~${req.distance_km || 400} km`
                                : `Stop ${idx}`}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Connecting Line behind dots */}
                      <div className="absolute top-[13px] left-4 right-4 h-[2px] bg-[#E5EAF0] -z-0" />
                    </div>
                  </div>

                  {/* Target Budget & Status Row matching Mockup */}
                  <div className="pt-3 border-t border-[#E5EAF0] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] text-[#718096] block">Target Budget</span>
                      <span className="text-lg sm:text-xl font-bold text-[#075E54]">
                        ₹{req.target_budget?.toLocaleString("en-IN") || "Quote Req."}
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-1.5 text-xs text-[#718096]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-[#172B2A]">
                          {req.quotes_count > 0 ? `${req.quotes_count} quotes` : "No quotes yet"}
                        </div>
                        <div className="text-[10px] text-[#718096]">
                          {req.quotes_count > 0
                            ? "Review competing quotes"
                            : "Be the first to respond"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Full-width CTA matching Mockup */}
                  <button
                    type="button"
                    onClick={() => onSelectForQuote(req)}
                    className="w-full py-2.5 px-4 bg-[#075E54] hover:bg-[#064e46] active:scale-[0.99] text-white rounded-xl font-medium text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Submit Quotation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Operator Trust & Compliance Footer */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#DDF7ED] text-[#075E54]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-[#172B2A] text-xs sm:text-sm">
            Commercial Transport Verification Standards
          </h4>
        </div>

        <p className="text-xs text-[#718096] leading-relaxed">
          Only quotations with verified <strong>Yellow Board commercial registration</strong>, active tourist permits, and valid insurance are presented to travellers.
        </p>

        <div className="flex items-center gap-4 pt-1 text-xs font-medium text-[#075E54]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" /> Tourist Permit Shield
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" /> Direct Pilot Settlement
          </span>
        </div>
      </div>
    </div>
  );
}
