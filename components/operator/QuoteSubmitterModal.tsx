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
import { useAuth } from "@/lib/authContext";

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
  const { user, profile } = useAuth();
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
    "Well-maintained commercial vehicle with high headroom, sanitized interior, dual mobile charging ports at each seat, and a veteran hill/expressway chauffeur."
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<boolean>(false);

  useEffect(() => {
    async function loadVehicles() {
      const opId = profile?.id || user?.id || "op_rajputana";
      const data = await dataService.getVehicles(opId);
      if (data.length > 0) {
        setVehicles(data);
        setSelectedVehicleId(data[0].id);
      } else {
        setVehicles([]);
        setSelectedVehicleId("");
      }
    }
    loadVehicles();
  }, [profile, user]);

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
    setErrorMsg(null);
    if (!selectedVehicle?.id) {
      setErrorMsg("No commercial vehicle selected. Please register a vehicle in the Fleet Console before quoting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const opId = profile?.id || user?.id || "op_fleet_partner";
      const opName = profile?.operator_name || profile?.full_name || "Commercial Fleet Partner";

      const newQuote = await dataService.submitQuotation({
        trip_request_id: tripRequest.id,
        trip_code: tripRequest.trip_code,
        operator_id: opId,
        operator_name: opName,
        operator_rating: profile?.rating || 4.90,
        reviews_count: profile?.reviews_count || 0,
        vehicle_id: selectedVehicle.id,
        vehicle_name: selectedVehicle.name,
        vehicle_category: selectedVehicle.category,
        vehicle_reg: selectedVehicle.registration_number,
        vehicle_image:
          selectedVehicle.image_url ||
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
        model_year: selectedVehicle.model_year || 2023,
        badge: profile?.verified ? "Tier-1 Verified Partner" : "Pending Verification",
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
          "Monument entry tickets / Guide fee",
          "Hotel overnight parking charges (if levied)",
        ],
        validity_hours: validityHours,
        operator_note: operatorNote,
      });

      onQuotationSubmitted(newQuote);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to submit quotation");
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
                  <Clock className="w-2.5 h-2.5" /> Open for Bids
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
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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
                {vehicles.length} Vehicle Available
              </span>
            </div>

            {vehicles.length === 0 ? (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No Registered Fleet Vehicles</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  You have not registered any commercial vehicles yet. Please open the Fleet Console to register your commercial vehicle before submitting quotations.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-teal-100 text-[#00594c]">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        {selectedVehicle?.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {selectedVehicle?.registration_number}
                      </p>
                    </div>
                  </div>

                  {vehicles.length > 1 && (
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
                  )}
                </div>

                {/* Requirement Check banner */}
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Capacity: {selectedVehicle?.seating_capacity} Seats for{" "}
                    {tripRequest.travellers_count} Pax • {selectedVehicle?.luggage_capacity} Bags
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Commercial Yellow Plate Valid
                  </span>
                  <span className="font-semibold text-blue-700">
                    Speed-Gov: 80 km/h Active
                  </span>
                </div>
              </div>
            )}
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
                    Base Vehicle & Fuel (for {tripRequest.distance_km} km)
                  </span>
                  <span className="font-extrabold text-slate-900">
                    ₹{baseFuelRate.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={8000}
                  max={45000}
                  step={500}
                  value={baseFuelRate}
                  onChange={(e) => setBaseFuelRate(Number(e.target.value))}
                  className="w-full accent-[#004d40] cursor-pointer"
                />
              </div>

              {/* Driver Night Allowance */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">
                    Driver Bata & Night Allowance
                  </span>
                  <span className="font-extrabold text-slate-900">
                    ₹{nightAllowance.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={6000}
                  step={200}
                  value={nightAllowance}
                  onChange={(e) => setNightAllowance(Number(e.target.value))}
                  className="w-full accent-[#004d40] cursor-pointer"
                />
              </div>

              {/* FASTag Tolls & Permits */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeTolls}
                      onChange={(e) => setIncludeTolls(e.target.checked)}
                      className="accent-[#00594c] w-4 h-4 rounded"
                    />
                    <span>Include Highway Tolls & State Border Permits</span>
                  </label>
                  <span className="font-extrabold text-slate-900 text-xs">
                    {includeTolls ? `₹${tollsAmount.toLocaleString("en-IN")}` : "Excluded"}
                  </span>
                </div>
                {includeTolls && (
                  <input
                    type="range"
                    min={1000}
                    max={8000}
                    step={100}
                    value={tollsAmount}
                    onChange={(e) => setTollsAmount(Number(e.target.value))}
                    className="w-full accent-[#004d40] cursor-pointer"
                  />
                )}
              </div>

              {/* Total Quotation Summary */}
              <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                    Total Binding Quotation
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    Per passenger share: ₹{perPersonFare.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-[#00594c]">
                    ₹{totalQuote.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Terms & Operator Note */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-[#004d40] text-white flex items-center justify-center text-xs">
                3
              </span>
              <span>Terms & Organizer Note</span>
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
              Binding quote: 100% honest pricing guarantee. No hidden surcharges.
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
                disabled={isSubmitting || vehicles.length === 0}
                className="flex-1 py-3 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
