"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Send,
  Save,
  Check,
  Fuel,
  Info,
} from "lucide-react";
import { Quotation, TripRequest, Vehicle } from "@/lib/types";
import { dataService } from "@/lib/dataService";

interface QuoteSubmitterModalProps {
  tripRequest: TripRequest | null;
  onClose: () => void;
  onQuotationSubmitted: (quote: Quotation) => void;
}

export default function QuoteSubmitterModal({
  tripRequest,
  onClose,
  onQuotationSubmitted,
}: QuoteSubmitterModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Step 2 Calculator state
  const [baseFuelRate, setBaseFuelRate] = useState<number>(18500);
  const [nightAllowance, setNightAllowance] = useState<number>(2000);
  const [includeTolls, setIncludeTolls] = useState<boolean>(true);
  const [tollsAmount, setTollsAmount] = useState<number>(4300);

  // Step 3 Terms state
  const [validityHours, setValidityHours] = useState<number>(48);
  const [operatorNote, setOperatorNote] = useState<string>(
    "Well-maintained 2023 Force Urbania with high headroom, sanitized interior, dual mobile charging ports at each seat, and a veteran hill/expressway chauffeur."
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [savedDraft, setSavedDraft] = useState<boolean>(false);

  useEffect(() => {
    async function loadVehicles() {
      const data = await dataService.getVehicles("op_rajputana");
      setVehicles(data);
      if (data.length > 0) {
        setSelectedVehicleId(data[0].id);
      }
    }
    loadVehicles();
  }, []);

  if (!tripRequest) return null;

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const totalQuote =
    baseFuelRate + nightAllowance + (includeTolls ? tollsAmount : 0);
  const perPersonFare =
    tripRequest.travellers_count > 0
      ? Math.round(totalQuote / tripRequest.travellers_count)
      : totalQuote;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const newQuote = await dataService.submitQuotation({
        trip_request_id: tripRequest.id,
        trip_code: tripRequest.trip_code,
        operator_id: "op_rajputana",
        operator_name: "Royal Rajputana Fleet Mobility",
        operator_rating: 4.92,
        reviews_count: 143,
        vehicle_id: selectedVehicle?.id || "veh_urb_01",
        vehicle_name: selectedVehicle?.name || "Force Urbania Executive Class",
        vehicle_category: selectedVehicle?.category || "Urbania / Tempo",
        vehicle_reg: selectedVehicle?.registration_number || "DL 01 TA 9821",
        vehicle_image:
          selectedVehicle?.image_url ||
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
        model_year: selectedVehicle?.model_year || 2023,
        badge: "Best Match • Tier-1 Partner",
        base_vehicle_fuel_rate: baseFuelRate,
        driver_night_allowance: nightAllowance,
        tolls_state_permit_taxes: includeTolls ? tollsAmount : 0,
        total_quote: totalQuote,
        per_person_fare: perPersonFare,
        inclusions: [
          `Fuel for complete ${tripRequest.distance_km} km route itinerary`,
          "Chauffeur uniform, night stay bata & meals",
          "All interstate entry permits (UP & Rajasthan)",
          "Dual AC operation across highways & cities",
        ],
        exclusions: [
          "Taj Mahal / Amber Fort monument entry tickets",
          "Hotel overnight parking charges (if levied)",
        ],
        validity_hours: validityHours,
        operator_note: operatorNote,
      });

      onQuotationSubmitted(newQuote);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Bar */}
        <div className="bg-[#004d40] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-300">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">
                  Req #{tripRequest.trip_code}
                </span>
                <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <Clock className="w-2.5 h-2.5" /> Expires in 03h 42m
                </span>
              </div>
              <h3 className="font-extrabold text-base leading-tight mt-0.5">
                {tripRequest.traveler_name} • {tripRequest.travellers_count} Guests
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-teal-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto text-sm">
          {/* Trip Summary strip */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/90 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Duration</span>
              <span className="font-bold text-slate-900">{tripRequest.duration}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Plan Est.</span>
              <span className="font-bold text-slate-900">{tripRequest.distance_km} km</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Capacity Req.</span>
              <span className="font-bold text-slate-900">{tripRequest.travellers_count}+ Pax</span>
            </div>
          </div>

          {/* Section 1: Assign Fleet Vehicle */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-[#004d40] text-white flex items-center justify-center text-xs">
                  1
                </span>
                <span>Assign Fleet Vehicle</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                1 of 3 Ready
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-teal-100 text-[#00594c]">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {selectedVehicle?.name || "Force Urbania 13-Seater"}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {selectedVehicle?.registration_number || "DL 01 TA 9821"} • Pristine White
                    </p>
                  </div>
                </div>

                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Requirement Check banner */}
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Meets requirement: {selectedVehicle?.seating_capacity || 13} Seats for{" "}
                  {tripRequest.travellers_count} Pax • 12 Bag Luggage Bay
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Commercial FC valid till Dec 2026
                </span>
                <span className="font-semibold text-blue-700">
                  Speed-Gov: 80 km/h
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Cost Breakdown Calculator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-[#004d40] text-white flex items-center justify-center text-xs">
                  2
                </span>
                <span>Cost Breakdown Calculator</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                Auto-Calculated
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Base Vehicle & Fuel Rate */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">
                    Base Vehicle & Fuel Rate
                  </span>
                  <span className="text-[11px] text-slate-500">Includes 750 km limit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    value={baseFuelRate}
                    onChange={(e) => setBaseFuelRate(Number(e.target.value))}
                    className="flex-1 font-bold text-base bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div className="text-[10px] text-slate-500">
                  Extra km charge: ₹18 / km beyond 750 km buffer
                </div>
              </div>

              {/* Driver Night Allowance (Bata) */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">
                    Driver Night Allowance (Bata)
                  </span>
                  <span className="text-[11px] text-slate-500">2 Nights × ₹1,000</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    value={nightAllowance}
                    onChange={(e) => setNightAllowance(Number(e.target.value))}
                    className="flex-1 font-bold text-base bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Tolls & State Permit Taxes */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-medium text-slate-700 block">
                      Tolls & State Permit Taxes
                    </span>
                    <span className="text-[11px] text-slate-500">
                      UP & Rajasthan Commercial Entry
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeTolls(!includeTolls)}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                      includeTolls ? "bg-[#004d40]" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                        includeTolls ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {includeTolls && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Pass-through Breakdown:</span>
                      <span>₹2,400 entry taxes + ₹1,900 FASTag</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold">₹</span>
                      <input
                        type="number"
                        value={tollsAmount}
                        onChange={(e) => setTollsAmount(Number(e.target.value))}
                        className="flex-1 font-bold text-base bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist */}
            <div className="text-[11px] text-slate-600 space-y-1 pt-1 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Parking & Monument Entry: Payable at actuals by guest</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Commercial GST 5% Included (RCM/ITC Applied)</span>
              </div>
            </div>

            {/* Total Operator Quotation Card (Image 4 middle emerald box) */}
            <div className="bg-[#00594c] text-white rounded-2xl p-4 shadow-md space-y-1">
              <div className="flex justify-between items-center text-xs text-teal-100">
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  Total Operator Quotation
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  Fixed Offer
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black">
                  ₹{totalQuote.toLocaleString("en-IN")}
                </span>
                <div className="text-right">
                  <span className="text-sm font-bold text-teal-100">
                    ₹{perPersonFare.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-teal-200 block">/ person</span>
                </div>
              </div>

              <div className="pt-2 border-t border-teal-500/50 flex justify-between text-[11px] text-teal-100">
                <span>Guaranteed price for {tripRequest.travellers_count} pax group</span>
                <span className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> AllRoute Escrow Protected
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Terms & Chauffeur Note */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-[#004d40] text-white flex items-center justify-center text-xs">
                3
              </span>
              <span>Terms & Chauffeur Note</span>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider block mb-1">
                  Included in this quote
                </span>
                <ul className="space-y-1 text-slate-700">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Fuel for complete {tripRequest.distance_km} km route itinerary
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Chauffeur uniform, night stay bata & meals
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    All interstate entry permits (UP & Rajasthan)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Dual AC operation across highways & cities
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-red-800 text-[10px] uppercase tracking-wider block mb-1">
                  Exclusions
                </span>
                <ul className="space-y-1 text-slate-500">
                  <li>✕ Taj Mahal / Amber Fort monument entry tickets</li>
                  <li>✕ Hotel overnight parking charges (if levied)</li>
                </ul>
              </div>
            </div>

            {/* Lock Validity */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Quotation Lock Validity
              </label>
              <select
                value={validityHours}
                onChange={(e) => setValidityHours(Number(e.target.value))}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium"
              >
                <option value={24}>24 Hours Locked Price</option>
                <option value={48}>48 Hours Locked Price (Recommended)</option>
                <option value={72}>72 Hours Locked Price</option>
              </select>
            </div>

            {/* Note to Organizer */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-700">
                  Note to Organizer {tripRequest.traveler_name}
                </label>
                <span className="text-[10px] text-slate-500">Visible in traveler app</span>
              </div>
              <textarea
                rows={3}
                value={operatorNote}
                onChange={(e) => setOperatorNote(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                placeholder="Describe your vehicle cleanliness, driver experience, or amenities..."
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-2 space-y-2">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Binding quote: 100% honest pricing guarantee. No on-trip surge allowed.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSavedDraft(true);
                  setTimeout(() => setSavedDraft(false), 2000);
                }}
                className="w-1/3 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                {savedDraft ? "Saved!" : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <span>Sending to Traveler Console...</span>
                ) : (
                  <>
                    <span>
                      Send Binding Quotation ₹{totalQuote.toLocaleString("en-IN")}
                    </span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
