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
import AuthModal from "@/components/common/AuthModal";

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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [contractSigned, setContractSigned] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  if (!quotation) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsConfirming(true);
    try {
      const travelerId = user.id;
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
        escrow_status: "Rate Lock Guaranteed",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-[#E5EAF0] overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-[#075E54] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Confirm Fleet Booking</h3>
              <p className="text-xs text-emerald-100/90 font-normal">
                Verified Yellow Board Commercial Transport
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-emerald-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* Confirmation Success Screen */
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-[#DDF7ED] text-[#075E54] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#075E54] bg-[#DDF7ED] px-3 py-1 rounded-full">
                Booking Recorded
              </span>
              <h3 className="text-lg font-bold text-[#172B2A] mt-2">
                Booking ID: {confirmedBooking.booking_code}
              </h3>
              <p className="text-xs text-[#718096] mt-1">
                Your journey with {confirmedBooking.operator_name} is officially confirmed.
              </p>
            </div>

            <div className="bg-[#F7F8FA] rounded-xl p-4 text-left border border-[#E5EAF0] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#718096]">Assigned Vehicle</span>
                <span className="font-semibold text-[#172B2A]">{confirmedBooking.vehicle_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#718096]">Registration Number</span>
                <span className="font-mono text-[#172B2A] font-medium">{confirmedBooking.vehicle_reg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#718096]">Total Quoted Fare</span>
                <span className="font-bold text-[#075E54] text-sm">
                  ₹{confirmedBooking.total_amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#718096]">Per Passenger Share</span>
                <span className="font-medium text-[#172B2A]">
                  ₹{confirmedBooking.per_person_amount.toLocaleString("en-IN")} / pax
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#718096]">Reservation Status</span>
                <span className="font-medium text-[#075E54] flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Confirmed & Rate Locked
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-[#075E54] hover:bg-[#064e46] text-white rounded-xl font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            >
              Close & View Confirmed Itinerary
            </button>
          </div>
        ) : (
          /* Review & Lock Quotation Screen */
          <div className="p-5 space-y-4 text-xs sm:text-sm">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Operator & Vehicle snippet */}
            <div className="bg-[#F7F8FA] p-3.5 rounded-xl border border-[#E5EAF0] flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#DDF7ED] flex items-center justify-center text-[#075E54] shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#075E54]">
                  {quotation.badge || "Verified Quotation"}
                </div>
                <h4 className="font-semibold text-[#172B2A] text-xs sm:text-sm truncate mt-0.5">
                  {quotation.operator_name}
                </h4>
                <p className="text-xs text-[#718096] truncate">
                  {quotation.vehicle_name} · {quotation.vehicle_reg}
                </p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-[#DDF7ED]/30 rounded-xl p-3.5 border border-[#075E54]/20 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#718096]">Base Vehicle & Fuel Rate</span>
                <span className="font-semibold text-[#172B2A]">
                  ₹{quotation.base_vehicle_fuel_rate.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#718096]">Driver Night Bata & Lodging</span>
                <span className="font-semibold text-[#172B2A]">
                  ₹{quotation.driver_night_allowance.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#718096]">Tolls & State Permit Taxes</span>
                <span className="font-semibold text-[#172B2A]">
                  ₹{quotation.tolls_state_permit_taxes.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="pt-2 border-t border-[#075E54]/20 flex justify-between items-baseline">
                <span className="font-semibold text-[#172B2A]">Total Quoted Amount</span>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-bold text-[#075E54]">
                    ₹{quotation.total_quote.toLocaleString("en-IN")}
                  </span>
                  <span className="block text-[11px] text-[#718096]">
                    (₹{quotation.per_person_fare.toLocaleString("en-IN")} / person)
                  </span>
                </div>
              </div>
            </div>

            {/* Honest Booking Notice */}
            <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E5EAF0] space-y-2 text-xs text-[#172B2A]">
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#075E54] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-[#172B2A]">Guaranteed Price Lock:</strong> Confirming this offer locks the vehicle and fare in the marketplace. No price escalation or fuel surcharges are permitted once accepted.
                </p>
              </div>
              <div className="pt-2 border-t border-[#E5EAF0] flex items-start gap-2 text-xs text-[#718096]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#075E54] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-[#172B2A]">Direct Pilot Settlement:</strong> Token deposit and balance trip payment are settled directly with the verified operator upon dispatch. Tripvahan charges zero platform commission during this pilot.
                </p>
              </div>
            </div>

            {/* Digital Contract Sign-off */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E5EAF0] bg-[#F7F8FA] cursor-pointer">
              <input
                type="checkbox"
                checked={contractSigned}
                onChange={(e) => setContractSigned(e.target.checked)}
                className="mt-0.5 accent-[#075E54] w-4 h-4 rounded cursor-pointer"
              />
              <div className="text-xs text-[#718096]">
                <span className="font-semibold text-[#172B2A] block">
                  Agreement & Cancellation Policy
                </span>
                I confirm the passenger group count, vehicle class, and accept the verified operator cancellation policy.
              </div>
            </label>

            {/* Confirm button or Unavailable state */}
            {quotation.status && quotation.status !== "pending" ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1">
                <span className="text-xs font-semibold text-amber-800 block">
                  Quotation Already {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                </span>
                <p className="text-[11px] text-amber-700">
                  This offer has already been locked into an existing booking. Please view your confirmed journeys in the Bookings tab or choose another open quotation.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 w-full py-2 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Return to Cab Offers
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming || !contractSigned}
                className="w-full py-3 bg-[#075E54] hover:bg-[#064e46] active:scale-[0.99] text-white rounded-xl font-medium text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isConfirming ? (
                  <span>Confirming Booking...</span>
                ) : (
                  <>
                    <span>Confirm Booking & Lock Rate (₹{quotation.total_quote.toLocaleString("en-IN")})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
