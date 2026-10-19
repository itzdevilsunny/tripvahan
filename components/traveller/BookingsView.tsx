"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  CalendarCheck,
  ShieldCheck,
  Car,
  MapPin,
  Lock,
  Phone,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Calendar,
} from "lucide-react";
import { Booking } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";
import { getVehicleImage } from "@/lib/mediaAssets";
import BookingVoucherModal from "./BookingVoucherModal";

interface BookingsViewProps {
  onPlanNewTrip: () => void;
}

export default function BookingsView({ onPlanNewTrip }: BookingsViewProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedVoucherBooking, setSelectedVoucherBooking] = useState<Booking | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    const data = await dataService.getBookings(user?.id);
    setBookings(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, [user]);

  const handleCancelBooking = async (bookingId: string) => {
    setIsCancelling(true);
    try {
      const ok = await dataService.cancelBooking(bookingId);
      if (ok) {
        setToastMessage("Booking successfully cancelled. Vehicle released.");
        setTimeout(() => setToastMessage(null), 3500);
        await loadBookings();
      }
    } catch (e: any) {
      alert("Failed to cancel booking: " + e.message);
    } finally {
      setIsCancelling(false);
      setCancellingBookingId(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-[#DDF7ED] border border-[#075E54]/30 rounded-xl text-xs font-semibold text-[#075E54] flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#075E54] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#075E54]">
            TRAVELLER CONSOLE
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-[#172B2A] mt-0.5">My Confirmed Journeys</h2>
        </div>
        <span className="text-xs font-medium bg-[#DDF7ED] text-[#075E54] px-3 py-1 rounded-full">
          {bookings.filter((b) => b.journey_status !== "Cancelled").length} Active
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] shadow-xs text-center space-y-2">
          <div className="w-7 h-7 mx-auto border-3 border-[#075E54] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#718096] font-medium">Loading your journey records...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E5EAF0] shadow-xs text-center space-y-3">
          <div className="w-12 h-12 bg-[#DDF7ED] text-[#075E54] rounded-full flex items-center justify-center mx-auto">
            <Car className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-[#172B2A] text-sm sm:text-base">No Confirmed Bookings Yet</h3>
          <p className="text-xs text-[#718096] max-w-xs mx-auto leading-relaxed">
            Plan your custom trip or select an offer from your active quotes to lock in a commercial yellow-plate vehicle.
          </p>
          <button
            type="button"
            onClick={onPlanNewTrip}
            className="py-2.5 px-4 bg-[#075E54] hover:bg-[#064e46] text-white rounded-xl font-medium text-xs shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Plan a Trip Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const isCancelled = b.journey_status === "Cancelled";
            const vehicleImg = getVehicleImage(undefined, b.vehicle_name);

            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-[#E5EAF0] shadow-xs overflow-hidden space-y-3.5 p-4 sm:p-5"
              >
                {/* Top Row: Code & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-medium bg-[#F7F8FA] text-[#172B2A] border border-[#E5EAF0] px-2.5 py-0.5 rounded-md">
                      #{b.booking_code}
                    </span>
                    <span className="text-xs text-[#718096]">{b.duration}</span>
                  </div>

                  <span
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isCancelled
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-[#DDF7ED] text-[#075E54]"
                    }`}
                  >
                    {isCancelled ? (
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#075E54]" />
                    )}
                    <span>{b.journey_status}</span>
                  </span>
                </div>

                {/* Circuit Title */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#172B2A]">
                    {b.circuit_title}
                  </h3>
                </div>

                {/* Visual Journey Progress Timeline */}
                <div className="bg-[#F7F8FA] p-3 rounded-xl border border-[#E5EAF0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#718096]">
                      Journey Lifecycle Status
                    </span>
                    <span className="text-[10px] font-medium text-[#075E54]">
                      {b.journey_status}
                    </span>
                  </div>

                  {isCancelled ? (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-center">
                      <span className="text-xs font-semibold text-red-700">Journey Cancelled & Vehicle Released</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                      {/* Step 1: Confirmed */}
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-[#075E54]" />
                        <span className="font-semibold text-[#075E54]">1. Confirmed</span>
                      </div>
                      {/* Step 2: Dispatched */}
                      <div className="space-y-1">
                        <div className={`h-1.5 rounded-full ${["Dispatched", "Ongoing", "Completed"].includes(b.journey_status) ? "bg-[#075E54]" : "bg-slate-200"}`} />
                        <span className={["Dispatched", "Ongoing", "Completed"].includes(b.journey_status) ? "font-semibold text-[#075E54]" : "text-[#718096]"}>
                          2. Dispatched
                        </span>
                      </div>
                      {/* Step 3: Ongoing */}
                      <div className="space-y-1">
                        <div className={`h-1.5 rounded-full ${["Ongoing", "Completed"].includes(b.journey_status) ? "bg-[#075E54]" : "bg-slate-200"}`} />
                        <span className={["Ongoing", "Completed"].includes(b.journey_status) ? "font-semibold text-[#075E54]" : "text-[#718096]"}>
                          3. Ongoing
                        </span>
                      </div>
                      {/* Step 4: Completed */}
                      <div className="space-y-1">
                        <div className={`h-1.5 rounded-full ${b.journey_status === "Completed" ? "bg-[#075E54]" : "bg-slate-200"}`} />
                        <span className={b.journey_status === "Completed" ? "font-semibold text-[#075E54]" : "text-[#718096]"}>
                          4. Completed
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle & Operator Spec Card */}
                <div className="p-3 rounded-xl bg-white border border-[#E5EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-11 rounded-lg overflow-hidden relative bg-slate-100 shrink-0 border border-[#E5EAF0]">
                      <Image
                        src={vehicleImg}
                        alt={b.vehicle_name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#172B2A]">{b.vehicle_name}</div>
                      <div className="text-[11px] text-[#718096] font-mono">Plate: {b.vehicle_reg}</div>
                      <div className="text-[11px] text-[#075E54] font-medium">{b.operator_name}</div>
                    </div>
                  </div>

                  {/* Contact Operator / WhatsApp */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {b.operator_phone && b.operator_phone.trim().length >= 10 ? (
                      <a
                        href={`https://wa.me/${b.operator_phone.replace(/[^0-9]/g, "")}?text=Hello%20${encodeURIComponent(b.operator_name)},%20regarding%20Tripvahan%20Booking%20%23${b.booking_code}%20for%20${encodeURIComponent(b.circuit_title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#DDF7ED] text-[#075E54] hover:bg-[#075E54] hover:text-white transition-colors text-xs font-medium flex items-center gap-1.5"
                        title="Contact Operator via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat on WhatsApp</span>
                      </a>
                    ) : (
                      <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] flex items-center gap-1" title="Direct operator phone number has not been published or verified yet">
                        <MessageCircle className="w-3 h-3 text-slate-400" />
                        <span>Operator contact unavailable</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Locked Fare & Settlement note */}
                <div className="pt-2 border-t border-[#E5EAF0] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#718096] block">Authoritative Total Fare</span>
                    <span className="text-base sm:text-lg font-bold text-[#075E54]">
                      ₹{b.total_amount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVoucherBooking(b)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#F7F8FA] hover:bg-[#DDF7ED] text-[#075E54] border border-[#E5EAF0] hover:border-[#075E54]/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View & Print Official Transit Voucher"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Transit Voucher</span>
                    </button>

                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => setCancellingBookingId(b.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellingBookingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#E5EAF0] shadow-lg space-y-3.5 animate-in fade-in duration-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-[#172B2A] text-base">Confirm Cancellation</h3>
              <p className="text-xs text-[#718096] leading-relaxed">
                Are you sure you want to cancel this booking? The assigned vehicle will be released and the trip request will return to the active marketplace.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCancellingBookingId(null)}
                disabled={isCancelling}
                className="py-2.5 rounded-xl border border-[#E5EAF0] text-xs font-semibold text-[#718096] hover:text-[#172B2A] hover:bg-slate-50 cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={() => handleCancelBooking(cancellingBookingId)}
                disabled={isCancelling}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Commercial Transit Voucher Modal */}
      {selectedVoucherBooking && (
        <BookingVoucherModal
          booking={selectedVoucherBooking}
          onClose={() => setSelectedVoucherBooking(null)}
        />
      )}
    </div>
  );
}

