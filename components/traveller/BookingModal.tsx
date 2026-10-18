"use client";

import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Car,
  Lock,
  ArrowRight,
  FileText,
  UserCheck,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Booking, Quotation } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";

interface BookingModalProps {
  quotation: Quotation | null;
  onClose: () => void;
  onBookingConfirmed: (booking: Booking) => void;
}

export default function BookingModal({
  quotation,
  onClose,
  onBookingConfirmed,
}: BookingModalProps) {
  const { user, profile } = useAuth();
  const [contractSigned, setContractSigned] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  if (!quotation) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);
    setIsConfirming(true);
    try {
      const travelerId = user?.id || "usr_guest_" + Date.now();
      const travelerName = profile?.full_name || user?.email?.split("@")[0] || "Group Traveller";

      const bkg = await dataService.confirmBooking({
        trip_request_id: quotation.trip_request_id,
        quotation_id: quotation.id,
        traveler_id: travelerId,
        traveler_name: travelerName,
        operator_name: quotation.operator_name,
        vehicle_name: quotation.vehicle_name,
        vehicle_reg: quotation.vehicle_reg,
        circuit_title: quotation.trip_code || "Group Outstation Journey",
        duration: "Outstation Itinerary",
        total_amount: quotation.total_quote,
        per_person_amount: quotation.per_person_fare,
        escrow_status: "Secured in Escrow",
        journey_status: "Confirmed",
        contract_signed: contractSigned,
        pickup_date: new Date().toISOString().split("T")[0],
      });

      setConfirmedBooking(bkg);

      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      onBookingConfirmed(bkg);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to confirm booking");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-[#004d40] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Confirm Fleet Booking</h3>
              <p className="text-xs text-teal-100">
                Verified Yellow Board Commercial Transport
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-teal-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* Confirmation Success Screen */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-[#00594c] rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                Booking Recorded in Database
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                Booking ID: {confirmedBooking.booking_code}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your journey with {confirmedBooking.operator_name} is officially confirmed.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assigned Vehicle</span>
                <span className="font-bold text-slate-900">{confirmedBooking.vehicle_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Registration Number</span>
                <span className="font-mono font-bold text-slate-800">{confirmedBooking.vehicle_reg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Quoted Fare</span>
                <span className="font-extrabold text-[#00594c] text-sm">
                  ₹{confirmedBooking.total_amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Per Passenger Share</span>
                <span className="font-bold text-slate-800">
                  ₹{confirmedBooking.per_person_amount.toLocaleString("en-IN")} / pax
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reservation Status</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Confirmed & Rate Locked
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#004d40] hover:bg-[#00382f] text-white rounded-xl font-bold text-sm shadow-md transition-all"
            >
              Close & View Confirmed Itinerary
            </button>
          </div>
        ) : (
          /* Review & Lock Quotation Screen */
          <div className="p-5 space-y-4 text-sm">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Operator & Vehicle snippet */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center text-[#004d40] shrink-0">
                <Car className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  {quotation.badge || "Verified Quotation"}
                </div>
                <h4 className="font-bold text-slate-900 text-sm truncate">
                  {quotation.operator_name}
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  {quotation.vehicle_name} • {quotation.vehicle_reg}
                </p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-teal-50/50 rounded-xl p-3.5 border border-teal-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Base Vehicle & Fuel Rate</span>
                <span className="font-bold text-slate-800">
                  ₹{quotation.base_vehicle_fuel_rate.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Driver Night Bata & Lodging</span>
                <span className="font-bold text-slate-800">
                  ₹{quotation.driver_night_allowance.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Tolls & State Permit Taxes</span>
                <span className="font-bold text-slate-800">
                  ₹{quotation.tolls_state_permit_taxes.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="pt-2 border-t border-teal-200/80 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-sm">Total Quoted Amount</span>
                <div className="text-right">
                  <span className="text-xl font-black text-[#00594c]">
                    ₹{quotation.total_quote.toLocaleString("en-IN")}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-medium">
                    (₹{quotation.per_person_fare.toLocaleString("en-IN")} / person)
                  </span>
                </div>
              </div>
            </div>

            {/* Honest Booking Notice */}
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-2 text-xs text-blue-900">
              <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong>Guaranteed Price Lock:</strong> Confirming this offer locks the vehicle and fare in the database. No price escalation or fuel surcharges are permitted once accepted.
              </p>
            </div>

            {/* Digital Contract Sign-off */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={contractSigned}
                onChange={(e) => setContractSigned(e.target.checked)}
                className="mt-0.5 accent-[#00594c] w-4 h-4 rounded"
              />
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">
                  Digital Agreement & Cancellation Policy
                </span>
                I confirm the passenger group count, vehicle class, and accept the verified operator cancellation policy.
              </div>
            </label>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || !contractSigned}
              className="w-full py-3.5 bg-[#004d40] hover:bg-[#00382f] active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isConfirming ? (
                <span>Confirming Booking in Database...</span>
              ) : (
                <>
                  Confirm Booking & Lock Rate (₹{quotation.total_quote.toLocaleString("en-IN")}){" "}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
