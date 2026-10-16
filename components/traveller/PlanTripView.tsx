"use client";

import React, { useState } from "react";
import {
  Route,
  Users,
  Luggage,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  Car,
  BookmarkCheck,
  Plus,
  Trash2,
} from "lucide-react";
import { dataService } from "@/lib/dataService";
import { TripRequest } from "@/lib/types";

interface PlanTripViewProps {
  onPublished: (trip: TripRequest) => void;
}

export default function PlanTripView({ onPublished }: PlanTripViewProps) {
  // Form state
  const [circuitType, setCircuitType] = useState<string>("Multi-day circuit");
  const [origin, setOrigin] = useState("Delhi NCR");
  const [destination, setDestination] = useState("Jaipur");
  const [duration, setDuration] = useState("3D / 2N");
  const [distanceKm, setDistanceKm] = useState(680);
  const [startDate, setStartDate] = useState("Fri, 24 Oct");
  const [pickupTime, setPickupTime] = useState("06:30 AM");
  const [pickupAddress, setPickupAddress] = useState("Dwarka Sector 10, New Delhi");

  const [stops, setStops] = useState<string[]>([
    "New Delhi Pickup (Dwarka)",
    "Agra Fort & Taj Mahal",
    "Fatehpur Sikri",
    "Amer Fort, Jaipur",
  ]);
  const [newStopInput, setNewStopInput] = useState("");
  const [showAddStop, setShowAddStop] = useState(false);

  // Passengers & Luggage
  const [adults, setAdults] = useState(10);
  const [seniors, setSeniors] = useState(2);
  const [trolleys, setTrolleys] = useState(8);
  const [duffles, setDuffles] = useState(4);

  const totalPax = adults + seniors;
  const totalBags = trolleys + duffles;

  // Target Budget Slider
  const [targetBudget, setTargetBudget] = useState(24500);

  // Preferences
  const [amenities, setAmenities] = useState<string[]>([
    "Dual AC & Reclining Pushback Seats",
    "Waterproof Carrier Roof Rack",
    "Bilingual Driver (Hindi & English)",
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const perPersonCost = totalPax > 0 ? Math.round(targetBudget / totalPax) : 0;

  const toggleAmenity = (item: string) => {
    if (amenities.includes(item)) {
      setAmenities(amenities.filter((a) => a !== item));
    } else {
      setAmenities([...amenities, item]);
    }
  };

  const addStop = () => {
    if (newStopInput.trim()) {
      setStops([...stops, newStopInput.trim()]);
      setNewStopInput("");
      setShowAddStop(false);
    }
  };

  const removeStop = (idx: number) => {
    setStops(stops.filter((_, i) => i !== idx));
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const newTrip = await dataService.createTripRequest({
        traveler_id: "usr_rohan",
        traveler_name: "Rohan S.",
        circuit_title: `${origin} → ${destination} (${circuitType})`,
        origin,
        destination,
        stops,
        circuit_type: circuitType,
        distance_km: distanceKm,
        start_date: startDate,
        duration,
        pickup_time: pickupTime,
        pickup_address: pickupAddress,
        travellers_count: totalPax,
        adults_count: adults,
        seniors_count: seniors,
        luggage_bags: totalBags,
        matched_vehicle_class:
          totalPax > 7
            ? "Executive Minibus / Tempo Traveller (12-16 Seater)"
            : "Innova Crysta / Premium SUV",
        indicative_budget_min: Math.round(targetBudget * 0.9),
        indicative_budget_max: Math.round(targetBudget * 1.1),
        target_budget: targetBudget,
        amenities,
      });

      onPublished(newTrip);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  };

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Top Banner & Progress Stepper */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <div className="flex items-center gap-1.5 text-teal-800 font-bold uppercase tracking-wider text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Cab Partner Connect
          </div>
          <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
            Live Matchmaker
          </span>
        </div>

        {/* 4 Steps breadcrumb */}
        <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold text-slate-500 mb-4">
          <div className="pb-1.5 border-b-2 border-emerald-600 text-emerald-800">1. Route</div>
          <div className="pb-1.5 border-b-2 border-emerald-600 text-emerald-800">2. Fleet & Pax</div>
          <div className="pb-1.5 border-b-2 border-emerald-600 text-emerald-800">3. Budget</div>
          <div className="pb-1.5 border-b-2 border-slate-200 text-slate-400">4. Dispatch</div>
        </div>

        {/* Circuit Card */}
        <div className="bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-blue-50/40 rounded-xl p-3.5 border border-teal-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md">
              {circuitType}
            </span>
            <span className="text-[11px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-full shadow-xs">
              {duration}
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 mt-2">
            {origin} → Agra → {destination}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1.5">
            <span className="flex items-center gap-1 font-semibold text-slate-800">
              <Route className="w-3.5 h-3.5 text-teal-700" /> ~{distanceKm} km
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> {startDate}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> {pickupTime}
            </span>
          </div>
        </div>

        {/* Confirmed Stops and Detours */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Confirmed Stops & Detours
            </span>
            <button
              type="button"
              onClick={() => setShowAddStop(!showAddStop)}
              className="text-[11px] font-semibold text-[#00594c] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Detour
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {stops.map((stop, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {stop}
                {stops.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStop(idx)}
                    className="hover:text-red-500 transition-colors ml-0.5"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {showAddStop && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="e.g. Fatehpur Sikri or Abhaneri Stepwell"
                value={newStopInput}
                onChange={(e) => setNewStopInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStop()}
                className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={addStop}
                className="bg-[#004d40] text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Passenger & Luggage Matrix */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Passenger & Luggage Matrix</h3>
            <p className="text-[11px] text-slate-500">
              Capacity strictly impacts RTO highway safety compliance
            </p>
          </div>
          <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Travellers */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Travellers</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                Verified Pax
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {totalPax} Total
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Ad:</span>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                >
                  {[1, 2, 4, 6, 8, 10, 12, 14, 16].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Sen:</span>
                <select
                  value={seniors}
                  onChange={(e) => setSeniors(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Luggage Load */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Luggage Load</span>
              <Luggage className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {totalBags} Bags
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Trolleys:</span>
                <select
                  value={trolleys}
                  onChange={(e) => setTrolleys(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                >
                  {[0, 2, 4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Duff:</span>
                <select
                  value={duffles}
                  onChange={(e) => setDuffles(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                >
                  {[0, 2, 4, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Matched Vehicle Class */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
              Matched Vehicle Class
            </span>
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
              High Fit
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-900 shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                Executive Minibus / Tempo Traveller
              </h4>
              <p className="text-[11px] text-slate-600">
                12–17 Seat Configurations • Dedicated Boot
              </p>
            </div>
          </div>

          {/* Capacity Alert */}
          <div className="p-2.5 rounded-lg bg-red-50/90 border border-red-200/80 flex items-start gap-2 text-[11px] text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="leading-tight">
              <strong className="font-semibold">Capacity Alert:</strong> Standard 6/7-seater SUVs (Innova/Ertiga) cannot safely hold {totalPax} passengers plus {totalBags} suitcases on NH-48 interstate toll runs.
            </p>
          </div>
        </div>
      </div>

      {/* Target Trip Budget */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Target Trip Budget</h3>
            <p className="text-[11px] text-slate-500">
              Estimated based on previous 34 Delhi-Rajasthan multi-day tours
            </p>
          </div>
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
            Tolls & State Taxes Incl.
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-2xl font-black text-slate-900">
              ₹{targetBudget.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 ml-2 font-medium">
              [Estimated Range: ₹22k - ₹26k]
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-teal-800">
              ~₹{perPersonCost.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-500 block">/ person</span>
          </div>
        </div>

        {/* Range slider */}
        <div className="space-y-1.5 pt-1">
          <input
            type="range"
            min={18000}
            max={32000}
            step={500}
            value={targetBudget}
            onChange={(e) => setTargetBudget(Number(e.target.value))}
            className="w-full accent-[#00594c] h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>Economy (₹18,000)</span>
            <span className="text-[#00594c] font-bold">[Recommended]</span>
            <span>Luxury 1x1 (₹32,000)</span>
          </div>
        </div>
      </div>

      {/* Amenity & Chauffeur Preferences */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Amenity & Chauffeur Preferences
        </h3>

        {[
          {
            title: "Dual AC & Reclining Pushback Seats",
            desc: "Recommended for senior passengers during highway transit",
          },
          {
            title: "Waterproof Carrier Roof Rack",
            desc: "Secure tarpaulin protection for all soft and hard luggage",
          },
          {
            title: "Bilingual Driver (Hindi & English)",
            desc: "Trained for heritage tourist circuits and Golden Triangle guides",
          },
        ].map((item, i) => {
          const checked = amenities.includes(item.title);
          return (
            <label
              key={i}
              onClick={() => toggleAmenity(item.title)}
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                checked
                  ? "bg-teal-50/40 border-teal-200 text-slate-900"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
                className="mt-0.5 accent-[#00594c] w-4 h-4 rounded"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-900">{item.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Operator Standard Guarantee */}
      <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl p-4 border border-blue-200/80 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-700" />
          ALLROUTEBOOK OPERATOR STANDARD
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Matches are restricted strictly to commercial Yellow-Plate vehicles with valid Delhi-UP-Rajasthan interstate permits, speed governors, and comprehensive passenger insurance.
        </p>
      </div>

      {/* 4 Verified Fleets in Corridor */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-[#00594c] font-bold text-xs shrink-0">
            4
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">
              4 Verified Fleets in Corridor
            </div>
            <p className="text-[11px] text-slate-500">
              Delhi NCR / Noida hub standby • Avg 38m quote
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          Ready to Bid
        </span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting}
          className="w-full py-3.5 px-5 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 transition-all"
        >
          {isSubmitting ? (
            <span>Publishing to Cab Partners...</span>
          ) : (
            <>
              Publish Request to Cab Partners <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <BookmarkCheck className="w-4 h-4 text-slate-500" />
          {draftSaved ? "Saved to Drafts!" : "Save Trip Plan as Draft"}
        </button>
      </div>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium pt-1">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Zero Advance Fee
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Direct Operator Chat
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified RTO
        </span>
      </div>
    </div>
  );
}
