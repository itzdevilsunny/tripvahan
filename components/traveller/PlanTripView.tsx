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
  Navigation,
  RefreshCw,
} from "lucide-react";
import { dataService } from "@/lib/dataService";
import { TripRequest } from "@/lib/types";
import { useAuth } from "@/lib/authContext";

interface PlanTripViewProps {
  onPublished: (trip: TripRequest) => void;
}

export default function PlanTripView({ onPublished }: PlanTripViewProps) {
  const { user, profile } = useAuth();

  // Form state
  const [circuitType, setCircuitType] = useState<string>("Multi-day circuit");
  const [origin, setOrigin] = useState("Delhi NCR");
  const [destination, setDestination] = useState("Jaipur");
  const [duration, setDuration] = useState("3D / 2N");
  const [distanceKm, setDistanceKm] = useState(680);
  const [startDate, setStartDate] = useState("2026-10-24");
  const [endDate, setEndDate] = useState("2026-10-27");
  const [pickupTime, setPickupTime] = useState("06:30 AM");
  const [pickupAddress, setPickupAddress] = useState("Dwarka Sector 10, New Delhi");

  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeNote, setRouteNote] = useState<string | null>(null);

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const perPersonCost = totalPax > 0 ? Math.round(targetBudget / totalPax) : 0;

  // Determine matched vehicle class based on capacity matrix
  const getMatchedVehicleClass = (pax: number, bags: number) => {
    if (pax <= 4 && bags <= 4) return "Executive Sedan (Dzire / Etios)";
    if (pax <= 7 && bags <= 6) return "Innova Crysta / Premium SUV (6+1 / 7+1)";
    if (pax <= 16 && bags <= 14) return "Force Urbania / Tempo Traveller (12-16 Seater)";
    return "BharatBenz AC Executive Coach (19-26 Seater)";
  };

  const matchedVehicle = getMatchedVehicleClass(totalPax, totalBags);

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

  // Real route calculation via /api/route-estimate
  const handleRecalculateRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg("Please enter both origin and destination");
      return;
    }

    setIsCalculatingRoute(true);
    setRouteNote(null);
    try {
      const res = await fetch("/api/route-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, stops }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.distance_km) {
          // Multiply round trips by 2 if needed
          const calculatedKm = circuitType === "Round Trip" ? data.distance_km * 2 : data.distance_km;
          setDistanceKm(calculatedKm);
          if (data.formatted_duration) {
            setDuration(data.formatted_duration);
          }
          setRouteNote(`Route resolved: ${data.distance_km} km driving distance calculated.`);
        } else if (data.message) {
          setRouteNote(data.message);
        }
      }
    } catch {
      setRouteNote("Live highway routing service temporarily unavailable. Using manual estimate.");
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handlePublish = async () => {
    setErrorMsg(null);
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg("Origin and destination are required.");
      return;
    }
    if (totalPax < 1) {
      setErrorMsg("At least 1 passenger is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const travelerId = user?.id || "usr_guest_" + Date.now();
      const travelerName = profile?.full_name || user?.email?.split("@")[0] || "Group Traveller";

      const newTrip = await dataService.createTripRequest({
        traveler_id: travelerId,
        traveler_name: travelerName,
        circuit_title: `${origin} → ${destination} (${circuitType})`,
        origin,
        destination,
        stops,
        circuit_type: circuitType,
        distance_km: distanceKm,
        start_date: startDate,
        end_date: endDate,
        duration,
        pickup_time: pickupTime,
        pickup_address: pickupAddress,
        travellers_count: totalPax,
        adults_count: adults,
        seniors_count: seniors,
        luggage_bags: totalBags,
        matched_vehicle_class: matchedVehicle,
        indicative_budget_min: Math.round(targetBudget * 0.9),
        indicative_budget_max: Math.round(targetBudget * 1.1),
        target_budget: targetBudget,
        amenities,
      });

      onPublished(newTrip);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to publish trip request");
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
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-full shadow-xs">
                {duration}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingRoute(!isEditingRoute)}
                className="text-[10px] font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 px-2 py-0.5 rounded-md transition-colors"
              >
                {isEditingRoute ? "Hide Edit" : "Edit Route"}
              </button>
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-900 mt-2">
            {origin} → {destination}
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

          {routeNote && (
            <p className="mt-2 text-[11px] text-teal-900 font-medium bg-teal-100/50 p-1.5 rounded-lg">
              {routeNote}
            </p>
          )}

          {/* Interactive Route Editor */}
          {isEditingRoute && (
            <div className="mt-3 pt-3 border-t border-teal-200/60 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700">Origin City / Area</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                    placeholder="e.g. Delhi NCR"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700">Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                    placeholder="e.g. Jaipur"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700">Circuit Type</label>
                  <select
                    value={circuitType}
                    onChange={(e) => setCircuitType(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold"
                  >
                    <option value="Multi-day circuit">Multi-day circuit</option>
                    <option value="Round Trip">Round Trip</option>
                    <option value="One-Way Outstation">One-Way Outstation</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRecalculateRoute}
                  disabled={isCalculatingRoute}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#004d40] hover:bg-[#00382f] px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCalculatingRoute ? "animate-spin" : ""}`} />
                  <span>{isCalculatingRoute ? "Calculating Road Route..." : "Calculate Real Highway Route"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmed Stops and Detours */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Confirmed Stops & Detours ({stops.length})
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
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Snr:</span>
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

          {/* Luggage Bags */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Luggage Bags</span>
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                Boot Volume
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {totalBags} Bags
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Trolley:</span>
                <select
                  value={trolleys}
                  onChange={(e) => setTrolleys(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                >
                  {[0, 2, 4, 6, 8, 10, 12, 14].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Duffle:</span>
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

        {/* Matched vehicle suggestion */}
        <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004d40] text-white flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                RTO Safety Matched Class
              </p>
              <p className="text-xs font-extrabold text-slate-900">{matchedVehicle}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
            Fit Confirmed
          </span>
        </div>
      </div>

      {/* Target Budget Slider */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Target Group Budget</h3>
            <p className="text-[11px] text-slate-500">
              Guideline for transport operator competitive quotations
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-extrabold text-[#00594c]">
              ₹{targetBudget.toLocaleString("en-IN")}
            </span>
            <div className="text-[10.5px] font-semibold text-slate-500">
              ~₹{perPersonCost.toLocaleString("en-IN")} / person
            </div>
          </div>
        </div>

        <input
          type="range"
          min={5000}
          max={60000}
          step={500}
          value={targetBudget}
          onChange={(e) => setTargetBudget(Number(e.target.value))}
          className="w-full accent-[#004d40] cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
          <span>₹5,000 (Local)</span>
          <span>₹24,500 (Golden Triangle)</span>
          <span>₹60,000 (Luxury Coach)</span>
        </div>
      </div>

      {/* Corridor Amenities */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2.5">
        <h3 className="font-bold text-slate-900 text-sm">Corridor Fleet Requirements</h3>
        {[
          {
            title: "Dual AC & Reclining Pushback Seats",
            desc: "Required for Rajasthan highway heat & 5+ hours passenger comfort",
          },
          {
            title: "Waterproof Carrier Roof Rack",
            desc: "Mandatory for 10+ oversized family luggage bags",
          },
          {
            title: "Bilingual Driver (Hindi & English)",
            desc: "Experienced with outstation tourist police checkpoints & FASTag",
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
          Matches are restricted strictly to commercial Yellow-Plate vehicles with valid interstate permits, speed governors, and comprehensive passenger insurance.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting}
          className="w-full py-3.5 px-5 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Operators
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified RTO
        </span>
      </div>
    </div>
  );
}
