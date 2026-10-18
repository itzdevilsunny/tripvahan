"use client";

import React, { useState, useEffect } from "react";
import {
  Car,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Truck,
  DollarSign,
  TrendingUp,
  FileCheck,
  Award,
  Inbox,
  X,
} from "lucide-react";
import { Booking, Vehicle } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";

export default function PartnerHubView() {
  const { user, profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  // New vehicle form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Urbania / Tempo");
  const [regNo, setRegNo] = useState("");
  const [seating, setSeating] = useState(13);
  const [luggage, setLuggage] = useState(12);
  const [modelYear, setModelYear] = useState(2023);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const opId = profile?.id || user?.id || "op_rajputana";
  const opName = profile?.operator_name || profile?.full_name || "Rajputana Mobility Solutions";

  const loadData = async () => {
    setLoading(true);
    const vList = await dataService.getVehicles(opId);
    setVehicles(vList);
    const bList = await dataService.getBookings();
    setBookings(bList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [profile, user]);

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !regNo.trim()) {
      setErrorMsg("Please enter vehicle model name and commercial registration number");
      return;
    }

    setIsRegistering(true);
    try {
      await dataService.registerVehicle({
        operator_id: opId,
        operator_name: opName,
        name,
        category,
        registration_number: regNo.toUpperCase().trim(),
        seating_capacity: Number(seating),
        luggage_capacity: Number(luggage),
        model_year: Number(modelYear),
        features: ["Commercial AC", "Luggage Bay", "Speed-Gov: 80 km/h"],
        compliance_status: "Commercial Yellow Board Valid",
        speed_governor_status: "Speed-Gov: 80 km/h Active",
      });
      setShowAddVehicle(false);
      setName("");
      setRegNo("");
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register vehicle");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* Fleet Stats Banner */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
              COMMERCIAL OPERATOR CONSOLE
            </div>
            <h2 className="text-lg font-black text-slate-900">
              {opName}
            </h2>
          </div>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
            {profile?.verified ? "Verified Partner" : "Verification Pending"}
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">Active Fleet</span>
            <span className="text-base font-black text-slate-900">{vehicles.length}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">Confirmed Trips</span>
            <span className="text-base font-black text-slate-900">{bookings.length}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">RTO Compliance</span>
            <span className="text-base font-black text-emerald-700">100%</span>
          </div>
        </div>
      </div>

      {/* Fleet Management Header & Add Vehicle Trigger */}
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-slate-900 text-sm">
          Registered Fleet Vehicles ({vehicles.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowAddVehicle(!showAddVehicle)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004d40] hover:bg-[#00382f] text-white text-xs font-bold shadow-xs transition-colors"
        >
          {showAddVehicle ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showAddVehicle ? "Close Form" : "Add Vehicle"}</span>
        </button>
      </div>

      {/* Add Vehicle Modal / Form */}
      {showAddVehicle && (
        <form
          onSubmit={handleRegisterVehicle}
          className="bg-white rounded-2xl p-4 border border-teal-200 shadow-md space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-xs">Register Commercial Fleet Vehicle</h4>
            <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
              Yellow Board
            </span>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Vehicle Model Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Force Urbania Executive"
                required
                className="w-full text-xs p-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 font-semibold"
              >
                <option value="Urbania / Tempo">Urbania / Tempo</option>
                <option value="Innova Crysta">Innova Crysta</option>
                <option value="Coach / Minibus">Coach / Minibus</option>
                <option value="Executive Sedan">Executive Sedan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Plate Reg No.
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="DL 01 TA 1234"
                required
                className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Seats (RTO)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={seating}
                onChange={(e) => setSeating(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Bags Cap.
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={luggage}
                onChange={(e) => setLuggage(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isRegistering}
            className="w-full py-2.5 rounded-xl bg-[#004d40] hover:bg-[#00382f] text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {isRegistering ? "Saving to Database..." : "Register Vehicle & Activate Availability"}
          </button>
        </form>
      )}

      {/* Vehicle List */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-2">
          <div className="w-7 h-7 mx-auto border-3 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 font-medium">Loading fleet data from Supabase...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/90 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Car className="w-6 h-6" />
          </div>
          <h4 className="font-extrabold text-slate-900 text-sm">No Vehicles Registered Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your first commercial cab, Force Urbania, or luxury minibus to start discovering and bidding on group trip requests.
          </p>
          <button
            type="button"
            onClick={() => setShowAddVehicle(true)}
            className="px-4 py-2 rounded-xl bg-[#004d40] text-white text-xs font-bold"
          >
            Add Your First Vehicle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center text-[#004d40] shrink-0 font-bold">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{v.name}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-mono font-semibold text-slate-700">
                      {v.registration_number}
                    </span>
                    <span>•</span>
                    <span>{v.seating_capacity} Seats</span>
                    <span>•</span>
                    <span>{v.luggage_capacity} Bags</span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {v.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Confirmed Operator Bookings */}
      {bookings.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Confirmed Assigned Trips ({bookings.length})
          </h3>
          <div className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                    Booking #{b.booking_code}
                  </span>
                  <h4 className="font-bold text-slate-900 mt-1">{b.circuit_title}</h4>
                  <p className="text-[11px] text-slate-500">
                    Traveler: {b.traveler_name} • Vehicle: {b.vehicle_name} ({b.vehicle_reg})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#00594c]">
                    ₹{b.total_amount.toLocaleString("en-IN")}
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-700">
                    {b.journey_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
