"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Booking } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";

interface BookingsViewProps {
  onPlanNewTrip: () => void;
}

export default function BookingsView({ onPlanNewTrip }: BookingsViewProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      const data = await dataService.getBookings(user?.id);
      setBookings(data);
      setLoading(false);
    }
    loadBookings();
  }, [user]);

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
            TRAVELLER CONSOLE
          </div>
          <h2 className="text-lg font-black text-slate-900">My Confirmed Journeys</h2>
        </div>
        <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
          {bookings.length} Confirmed
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-xs text-center space-y-2">
          <div className="w-7 h-7 mx-auto border-3 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-xs text-center space-y-3">
          <div className="w-14 h-14 bg-teal-50 text-[#00594c] rounded-full flex items-center justify-center mx-auto">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">No Confirmed Bookings Yet</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Plan your custom trip or select an offer from your active quotes to lock in a confirmed vehicle.
          </p>
          <button
            type="button"
            onClick={onPlanNewTrip}
            className="py-2.5 px-5 bg-[#004d40] hover:bg-[#00382f] text-white rounded-xl font-bold text-xs shadow-xs inline-flex items-center gap-1.5 transition-all"
          >
            <span>Plan a Trip Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  {b.booking_code}
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {b.journey_status}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {b.circuit_title}
                </h3>
                <p className="text-xs text-slate-500">{b.duration}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Operator</span>
                  <span className="font-bold text-slate-900">{b.operator_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle</span>
                  <span className="font-bold text-slate-900">{b.vehicle_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Commercial Registration</span>
                  <span className="font-mono font-bold text-slate-800">{b.vehicle_reg}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-extrabold">
                  <span className="text-slate-900">Total Fare (Locked)</span>
                  <span className="text-[#00594c]">₹{b.total_amount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
