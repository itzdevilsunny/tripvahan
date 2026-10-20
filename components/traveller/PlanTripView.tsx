"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Route,
  Users,
  Luggage,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Car,
  BookmarkCheck,
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { dataService } from "@/lib/dataService";
import { TripRequest } from "@/lib/types";
import { useAuth } from "@/lib/authContext";
import { DESTINATION_IMAGES, getVehicleImage } from "@/lib/mediaAssets";
import AuthModal from "@/components/common/AuthModal";

interface PlanTripViewProps {
  onPublished: (trip: TripRequest) => void;
}

export default function PlanTripView({ onPublished }: PlanTripViewProps) {
  const { user, profile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form state
  const [circuitType, setCircuitType] = useState<string>("Multi-day circuit");
  const [origin, setOrigin] = useState("New Delhi");
  const [destination, setDestination] = useState("Jaipur");
  const [duration, setDuration] = useState("3 Days, 2 Nights");
  const [distanceKm, setDistanceKm] = useState(680);
  const [startDate, setStartDate] = useState("2026-11-05");
  const [endDate, setEndDate] = useState("2026-11-07");
  const [pickupTime, setPickupTime] = useState("06:30 AM");
  const [pickupAddress, setPickupAddress] = useState("Sector 14, Dwarka, New Delhi");

  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeNote, setRouteNote] = useState<string | null>(null);

  const [stops, setStops] = useState<string[]>([
    "Agra & Taj Mahal",
    "Fatehpur Sikri",
  ]);
  const [newStopInput, setNewStopInput] = useState("");
  const [showAddStop, setShowAddStop] = useState(false);

  // Passengers & Luggage
  const [adults, setAdults] = useState(8);
  const [seniors, setSeniors] = useState(2);
  const [trolleys, setTrolleys] = useState(8);
  const [duffles, setDuffles] = useState(2);

  const totalPax = adults + seniors;
  const totalBags = trolleys + duffles;

  // Target Budget Slider
  const [targetBudget, setTargetBudget] = useState(25000);

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
    if (pax <= 16 && bags <= 14) return "Force Urbania / Tempo (12-16 Seater)";
    return "BharatBenz Executive Coach (19-26 Seater)";
  };

  const matchedVehicle = getMatchedVehicleClass(totalPax, totalBags);
  const vehicleThumbnail = getVehicleImage(undefined, matchedVehicle);

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
          const calculatedKm = circuitType === "Round Trip" ? data.distance_km * 2 : data.distance_km;
          setDistanceKm(calculatedKm);
          if (data.formatted_duration) {
            setDuration(data.formatted_duration);
          }
          setRouteNote(`Highway route calculated: ~${calculatedKm} km`);
        } else if (data.message) {
          setRouteNote(data.message);
        }
      }
    } catch {
      setRouteNote("Live routing unavailable. Using manual estimate.");
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

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const travelerId = user.id;
      const travelerName = profile?.full_name || user?.email?.split("@")[0] || "Group Traveller";

      const newTrip = await dataService.createTripRequest({
        traveler_id: travelerId,
        traveler_name: travelerName,
        circuit_title: `${origin} → ${destination}`,
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
      {/* 1. Scenic Mountain Hero Banner matching Column 4 of reference mockup */}
      <div className="relative rounded-2xl overflow-hidden h-48 sm:h-56 w-full p-5 flex flex-col justify-between shadow-xs">
        <Image
          src={DESTINATION_IMAGES.highwayHero}
          alt="Plan Your Group Journey"
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 600px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
            <Route className="w-4 h-4 text-white" />
          </div>
          <span className="text-[11px] font-semibold bg-[#DDF7ED] text-[#075E54] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Verified Fleets
          </span>
        </div>

        <div className="relative z-10 space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Plan Your Group Journey
          </h1>
          <p className="text-xs sm:text-sm text-white/90">
            Get quotes from verified fleet partners for your outstation trip.
          </p>
        </div>
      </div>

      {/* 2. Trip Type Switcher matching Column 4 mockup: [One Way] [Round Trip] [Multi-City] */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#172B2A]">Trip Type</label>
          <span className="text-[11px] text-[#718096]">{duration}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-[#F7F8FA] p-1 rounded-xl border border-[#E5EAF0]">
          {["One Way", "Round Trip", "Multi-City"].map((t) => {
            const isSelected =
              (t === "One Way" && circuitType === "One-Way Outstation") ||
              (t === "Round Trip" && circuitType === "Round Trip") ||
              (t === "Multi-City" && circuitType === "Multi-day circuit");

            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (t === "One Way") setCircuitType("One-Way Outstation");
                  else if (t === "Round Trip") setCircuitType("Round Trip");
                  else setCircuitType("Multi-day circuit");
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#075E54] text-white shadow-xs"
                    : "text-[#718096] hover:text-[#172B2A]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Route Details Panel with Connected Vertical Tracker matching Column 4 mockup */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#718096]">
            Route Details
          </h2>
          <button
            type="button"
            onClick={() => setIsEditingRoute(!isEditingRoute)}
            className="text-xs font-medium text-[#075E54] hover:underline cursor-pointer"
          >
            {isEditingRoute ? "Done Editing" : "Change Cities"}
          </button>
        </div>

        {/* Vertical Connected Route Timeline */}
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5EAF0]">
          {/* Pickup location */}
          <div className="relative">
            <span className="absolute -left-6 top-1 w-4 h-4 rounded-full border-3 border-[#075E54] bg-white ring-2 ring-white" />
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[#172B2A]">{origin}</div>
              <div className="text-xs text-[#718096]">Pickup location ({pickupAddress})</div>
            </div>
          </div>

          {/* Intermediate Stops if any */}
          {stops.map((stop, i) => (
            <div key={i} className="relative flex items-center justify-between pr-2">
              <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#075E54] ring-2 ring-white" />
              <div className="text-xs font-semibold text-[#172B2A]">{stop}</div>
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="text-slate-400 hover:text-red-500 text-xs transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}

          {/* Add Stop Button Pill Centered in Timeline */}
          <div className="relative pt-1 pb-1">
            <button
              type="button"
              onClick={() => setShowAddStop(!showAddStop)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDF7ED] text-[#075E54] text-xs font-medium hover:bg-[#075E54] hover:text-white transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stop</span>
            </button>
          </div>

          {showAddStop && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="e.g. Fatehpur Sikri or Abhaneri"
                value={newStopInput}
                onChange={(e) => setNewStopInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStop()}
                className="flex-1 text-xs px-3 py-1.5 border border-[#E5EAF0] rounded-lg focus:outline-none focus:border-[#075E54] bg-white text-[#172B2A]"
              />
              <button
                type="button"
                onClick={addStop}
                className="bg-[#075E54] hover:bg-[#064e46] text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              >
                Add
              </button>
            </div>
          )}

          {/* Destination */}
          <div className="relative">
            <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#075E54] ring-2 ring-white" />
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[#172B2A]">{destination}</div>
              <div className="text-xs text-[#718096]">Final destination (~{distanceKm} km total)</div>
            </div>
          </div>
        </div>

        {/* Expandable Inline City Editor */}
        {isEditingRoute && (
          <div className="pt-3 border-t border-[#E5EAF0] space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-[#172B2A]">Origin City</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#172B2A]">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#172B2A]">Pickup Address</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRecalculateRoute}
                disabled={isCalculatingRoute}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#075E54] hover:bg-[#064e46] px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCalculatingRoute ? "animate-spin" : ""}`} />
                <span>{isCalculatingRoute ? "Calculating Road Distance..." : "Recalculate Distance"}</span>
              </button>
            </div>
          </div>
        )}

        {routeNote && (
          <p className="text-xs text-[#075E54] font-medium bg-[#DDF7ED] p-2 rounded-lg">
            {routeNote}
          </p>
        )}
      </div>

      {/* 4. Travel Dates Panel matching Column 4 mockup */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#DDF7ED] text-[#075E54] shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#718096]">Travel Dates</div>
            <div className="text-sm font-bold text-[#172B2A] mt-0.5">
              {startDate} – {endDate}
            </div>
            <div className="text-[11px] text-[#718096]">({duration}) · Pickup {pickupTime}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs p-1.5 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
          />
        </div>
      </div>

      {/* 5. Travellers Panel matching Column 4 mockup */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#DDF7ED] text-[#075E54] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#718096]">Travellers</div>
            <div className="text-sm font-bold text-[#172B2A] mt-0.5">
              {totalPax} Travellers
            </div>
            <div className="text-[11px] text-[#718096]">{adults} Adults, {seniors} Elders</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[#718096]">Ad:</span>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-lg px-2 py-1 text-xs font-semibold text-[#172B2A]"
            >
              {[1, 2, 4, 6, 8, 10, 12, 14, 16, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#718096]">El:</span>
            <select
              value={seniors}
              onChange={(e) => setSeniors(Number(e.target.value))}
              className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-lg px-2 py-1 text-xs font-semibold text-[#172B2A]"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 6. Luggage Panel matching Column 4 mockup */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#DDF7ED] text-[#075E54] shrink-0">
            <Luggage className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#718096]">Luggage</div>
            <div className="text-sm font-bold text-[#172B2A] mt-0.5">
              {totalBags} Bags (Suitcases)
            </div>
            <div className="text-[11px] text-[#718096]">{trolleys} Trolleys, {duffles} Small Bags</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={trolleys}
            onChange={(e) => setTrolleys(Number(e.target.value))}
            className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#172B2A]"
          >
            {[0, 2, 4, 6, 8, 10, 12, 14].map((n) => (
              <option key={n} value={n}>{n} Trolleys</option>
            ))}
          </select>
        </div>
      </div>

      {/* 7. Preferred Vehicle Preview Card matching Column 4 mockup */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs space-y-2">
        <div className="text-xs font-semibold text-[#718096] uppercase tracking-wider">
          Preferred Vehicle
        </div>
        <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-12 rounded-lg overflow-hidden relative bg-slate-100 shrink-0 border border-[#E5EAF0]">
              <Image
                src={vehicleThumbnail}
                alt={matchedVehicle}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-[#172B2A]">{matchedVehicle}</div>
              <div className="text-xs text-[#718096]">Matched to {totalPax} pax & {totalBags} bags</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#718096] shrink-0" />
        </div>
      </div>

      {/* 8. Target Budget Slider */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#172B2A] text-sm sm:text-base">Target Budget</h3>
            <p className="text-xs text-[#718096] mt-0.5">
              Guideline for fleet operator competitive quotes
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-[#075E54]">
              ₹{targetBudget.toLocaleString("en-IN")}
            </span>
            <div className="text-[11px] text-[#718096]">
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
          className="w-full accent-[#075E54] cursor-pointer"
        />

        <div className="flex items-center justify-between text-xs text-[#718096]">
          <span>₹5,000 (Local)</span>
          <span>₹25,000 (Golden Triangle)</span>
          <span>₹60,000 (Luxury Coach)</span>
        </div>
      </div>

      {/* Corridor Amenities */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs space-y-3">
        <h3 className="font-semibold text-[#172B2A] text-sm sm:text-base">Trip Requirements</h3>
        {[
          {
            title: "Dual AC & Reclining Pushback Seats",
            desc: "Required for highway heat & 5+ hours passenger comfort",
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
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                checked
                  ? "bg-[#DDF7ED]/30 border-[#075E54]/30 text-[#172B2A]"
                  : "bg-[#F7F8FA] border-[#E5EAF0] text-[#718096] hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
                className="mt-0.5 accent-[#075E54] w-4 h-4 rounded cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-semibold text-[#172B2A]">{item.title}</div>
                <div className="text-[11px] text-[#718096] mt-0.5">{item.desc}</div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Operator Standard Guarantee */}
      <div className="bg-[#F7F8FA] rounded-2xl p-4 border border-[#E5EAF0] space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#075E54]">
          <ShieldCheck className="w-4 h-4 text-[#075E54]" />
          TRIPVAHAN OPERATOR STANDARD
        </div>
        <p className="text-xs text-[#718096] leading-relaxed">
          Matches are restricted strictly to commercial Yellow-Plate vehicles with valid interstate permits, speed governors, and comprehensive passenger insurance.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Action Button matching Column 4 mockup */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting}
          className="w-full py-3.5 px-5 bg-[#075E54] hover:bg-[#064e46] active:scale-[0.99] text-white rounded-xl font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? (
            <span>Publishing to Fleet Partners...</span>
          ) : (
            <>
              <span>Submit Quote →</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full py-2.5 px-4 bg-white hover:bg-[#F7F8FA] text-[#718096] hover:text-[#172B2A] border border-[#E5EAF0] rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <BookmarkCheck className="w-4 h-4 text-[#718096]" />
          {draftSaved ? "Saved to Drafts!" : "Save Trip Plan as Draft"}
        </button>
      </div>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-4 text-xs text-[#718096] font-normal pt-1">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" /> Zero Commission Pilot
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" /> Verified Fleets
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" /> Commercial Permits
        </span>
      </div>

      {/* Auth Modal for unauthenticated trip publication */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

