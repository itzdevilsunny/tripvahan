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
}

export default function ExploreView({ onSelectCircuit }: ExploreViewProps) {
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
      <div className="bg-gradient-to-r from-[#004d40] to-[#00796b] rounded-2xl p-5 text-white shadow-md space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full inline-block">
          Two-Sided Marketplace
        </span>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
          Verified Fleet Quotes For Your Custom Outstation Trips
        </h1>
        <p className="text-xs text-teal-100 leading-relaxed">
          No algorithmic surge pricing. Post your trip requirements, get binding itemized quotes from registered commercial cab owners, and confirm with verified rate-lock guarantee.
        </p>
      </div>

      {/* Popular Tourist Circuits */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Popular Circuits & Benchmarks
          </h2>
          <span className="text-xs text-slate-500 font-medium">Real RTO Corridors</span>
        </div>

        <div className="space-y-3">
          {circuits.map((c, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-teal-300"
            >
              <div className="relative h-36 w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-2.5 left-3">
                  <span className="bg-[#004d40] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {c.duration}
                  </span>
                </div>
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-bold">{c.distanceKm} km Circuit</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {c.rating} ({c.reviews})
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{c.route}</p>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Indicative Budget</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      ₹{c.budget.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCircuit(c)}
                    className="py-1.5 px-3 bg-[#004d40] hover:bg-[#00382f] text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
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
