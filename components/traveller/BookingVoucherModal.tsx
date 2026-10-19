"use client";

import React, { useRef } from "react";
import {
  FileText,
  Printer,
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Car,
  MapPin,
  Calendar,
  Clock,
  Award,
  Download,
} from "lucide-react";
import { Booking } from "@/lib/types";

interface Props {
  booking: Booking;
  onClose: () => void;
}

export default function BookingVoucherModal({ booking, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = booking.pickup_date || (booking.start_date ? new Date(booking.start_date).toLocaleDateString("en-IN") : "Confirmed Schedule");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#E5EAF0] shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">Tripvahan Commercial Booking Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6 text-[#172B2A] print:p-0 print:space-y-4">
          {/* Voucher Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5EAF0]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-[#075E54]">TRIPVAHAN</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Official Transit Contract
                </span>
              </div>
              <p className="text-xs text-[#718096] mt-0.5">
                India's Verified Outstation Commercial Fleet Marketplace
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider block">Booking Voucher No.</span>
              <span className="text-lg sm:text-xl font-mono font-black text-[#172B2A]">{booking.booking_code}</span>
              <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5 flex items-center sm:justify-end gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed & Rate-Locked
              </span>
            </div>
          </div>

          {/* Statutory Verification Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[#F7F8FA] rounded-2xl border border-[#E5EAF0] text-center">
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-slate-900 block">MoRTH Valid</span>
              <span className="text-[9px] text-[#718096]">Yellow Plate Commercial</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <Award className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-slate-900 block">Speed-Gov Active</span>
              <span className="text-[9px] text-[#718096]">80 km/h Statutory Limit</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <Lock className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-slate-900 block">Rate-Lock Escrow</span>
              <span className="text-[9px] text-[#718096]">No Surge / Fare Lock</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <Car className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-slate-900 block">Fleet Verified</span>
              <span className="text-[9px] text-[#718096]">Fitness & Permits Valid</span>
            </div>
          </div>

          {/* Itinerary & Circuit Specifications */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#718096]">Journey Itinerary & Schedule</h4>
            <div className="p-4 rounded-2xl border border-[#E5EAF0] bg-white space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#172B2A]">{booking.circuit_title}</h3>
                  <div className="flex items-center gap-3 text-xs text-[#718096] mt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-[#075E54]" /> Pickup Date: {formattedDate}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-[#075E54]" /> Duration: {booking.duration}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DDF7ED] text-[#075E54]">
                  {booking.journey_status}
                </span>
              </div>
            </div>
          </div>

          {/* Commercial Vehicle & Operator Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-[#E5EAF0] bg-white space-y-2">
              <h5 className="text-[11px] font-bold text-[#718096] uppercase tracking-wider">Assigned Commercial Vehicle</h5>
              <div className="text-sm font-bold text-[#172B2A]">{booking.vehicle_name}</div>
              <div className="text-xs text-[#718096] font-mono">Plate Registration: <strong className="text-slate-900">{booking.vehicle_reg}</strong></div>
              <div className="text-xs text-emerald-700 font-medium">✓ Commercial Yellow Board Authorized</div>
            </div>

            <div className="p-4 rounded-2xl border border-[#E5EAF0] bg-white space-y-2">
              <h5 className="text-[11px] font-bold text-[#718096] uppercase tracking-wider">Operating Fleet Partner</h5>
              <div className="text-sm font-bold text-[#172B2A]">{booking.operator_name}</div>
              <div className="text-xs text-[#718096]">Primary Traveller: <strong className="text-slate-900">{booking.traveler_name}</strong></div>
              <div className="text-xs text-emerald-700 font-medium">✓ Verified Operator Partner</div>
            </div>
          </div>

          {/* Authoritative Fare Breakdown */}
          <div className="p-4 rounded-2xl border border-[#E5EAF0] bg-white space-y-3">
            <h5 className="text-[11px] font-bold text-[#718096] uppercase tracking-wider">Disclosed Commercial Fare Summary</h5>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#718096]">
                <span>Commercial Vehicle Fuel & Chauffeur Services</span>
                <span className="font-semibold text-slate-800">Included</span>
              </div>
              <div className="flex justify-between text-[#718096]">
                <span>Driver Outstation Night Allowances</span>
                <span className="font-semibold text-slate-800">Included</span>
              </div>
              <div className="flex justify-between text-[#718096]">
                <span>Interstate State Border Taxes & Highway Tolls</span>
                <span className="font-semibold text-slate-800">Included</span>
              </div>
              <div className="pt-2 border-t border-dashed border-[#E5EAF0] flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-[#172B2A] block">Total Guaranteed Contract Fare</span>
                  {booking.per_person_amount > 0 && (
                    <span className="text-[11px] text-[#718096]">Approx. ₹{booking.per_person_amount.toLocaleString("en-IN")} per passenger</span>
                  )}
                </div>
                <span className="text-xl font-black text-[#075E54]">
                  ₹{booking.total_amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Legal / Statutory Terms */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1 leading-relaxed">
            <span className="font-bold text-slate-800 block">Transit Regulations & Tripvahan Guarantee:</span>
            <p>1. This commercial vehicle voucher guarantees the authoritative price agreed upon booking. The fleet partner is prohibited from demanding additional unquoted surge or per-km deviations unless route itinerary is amended.</p>
            <p>2. Commercial fleet operator certifies valid All-India Tourist Permit, fitness certificate with operational 80 km/h speed limiter, and valid passenger carrier insurance.</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-[#F7F8FA] border-t border-[#E5EAF0] flex items-center justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5EAF0] hover:bg-white text-xs font-semibold text-[#718096] hover:text-[#172B2A] cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official Voucher</span>
          </button>
        </div>
      </div>
    </div>
  );
}
