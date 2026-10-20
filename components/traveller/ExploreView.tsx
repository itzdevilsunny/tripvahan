"use client";

import React from "react";
import {
  Compass,
  MapPin,
  Clock,
  Sparkles,
  Users,
  ArrowRight,
  ShieldCheck,
  Star,
  Car,
} from "lucide-react";

interface ExploreViewProps {
  onSelectCircuit: (circuit: {
    origin: string;
    destination: string;
    title: string;
    duration: string;
    distanceKm: number;
    budget: number;
  }) => void;
  onOpenAiPlanner?: () => void;
}

export default function ExploreView({ onSelectCircuit, onOpenAiPlanner }: ExploreViewProps) {
  const circuits = [
    {
      title: "Golden Triangle Circuit",
      route: "Delhi NCR → Agra Fort → Jaipur City",
      origin: "Delhi NCR",
      destination: "Jaipur",
      duration: "3D / 2N",
      distanceKm: 680,
      budget: 24500,
      image:
        "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
      paxRecommendation: "10–14 Pax (Force Urbania)",
      rating: 4.95,
      reviews: 320,
    },
    {
      title: "Devbhoomi Pilgrimage",
      route: "Delhi NCR → Haridwar → Rishikesh Ghats",
      origin: "Delhi NCR",
      destination: "Rishikesh",
      duration: "2D / 1N",
      distanceKm: 520,
      budget: 16500,
      image:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
      paxRecommendation: "6–7 Pax (Innova Crysta)",
      rating: 4.88,
      reviews: 195,
    },
    {
      title: "Himachal Valley Express",
      route: "Delhi NCR → Chandigarh → Shimla → Manali",
      origin: "Delhi NCR",
      destination: "Manali",
      duration: "5D / 4N",
      distanceKm: 1150,
      budget: 42000,
      image:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      paxRecommendation: "12–16 Pax (Tempo Traveller AC)",
      rating: 4.92,
      reviews: 140,
    },
  ];

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Hero Welcome banner */}
      <div className="bg-[#075E54] rounded-2xl p-5 text-white shadow-xs space-y-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full inline-block">
          Travel Marketplace
        </span>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight leading-snug">
          Verified Fleet Quotes For Your Custom Outstation Trips
        </h1>
        <p className="text-xs text-emerald-100/90 leading-relaxed font-normal">
          No algorithmic surge pricing. Post your trip requirements, get binding quotes from registered commercial fleet partners, and lock in your vehicle with confidence.
        </p>
      </div>

      {/* AI Trip Planner Card in Explore */}
      {onOpenAiPlanner && (
        <div className="bg-gradient-to-r from-emerald-900 via-[#075E54] to-teal-800 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-emerald-700/40">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                AI Trip Planner
              </span>
            </div>
            <p className="text-xs text-white/90">
              Want a custom route or group itinerary? Describe it naturally and let AI analyze corridor benchmarks.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAiPlanner}
            className="shrink-0 bg-white hover:bg-emerald-50 text-[#075E54] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Plan My Trip</span>
          </button>
        </div>
      )}

      {/* Popular Tourist Circuits */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#718096] uppercase tracking-wider">
            Popular Circuits & Benchmarks
          </h2>
          <span className="text-xs text-[#718096] font-normal">Verified Corridors</span>
        </div>

        <div className="space-y-3.5">
          {circuits.map((c, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#E5EAF0] shadow-xs overflow-hidden transition-all hover:border-[#075E54]/40"
            >
              <div className="relative h-36 w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <div className="absolute top-2.5 left-3">
                  <span className="bg-[#075E54] text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    {c.duration}
                  </span>
                </div>
                <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between text-white text-xs">
                  <span className="font-medium">{c.distanceKm} km Circuit</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {c.rating} ({c.reviews})
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-[#172B2A] text-sm sm:text-base">
                    {c.title}
                  </h3>
                  <p className="text-xs text-[#718096] mt-0.5">{c.route}</p>
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#E5EAF0]">
                  <div>
                    <span className="text-[11px] text-[#718096] block">Indicative Budget</span>
                    <span className="font-bold text-[#075E54] text-sm sm:text-base">
                      ₹{c.budget.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCircuit(c)}
                    className="py-2 px-3.5 bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Request Quotations</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
