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
} from "lucide-react";
import { Booking, Vehicle } from "@/lib/types";
import { dataService } from "@/lib/dataService";

export default function PartnerHubView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  // New vehicle form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Urbania / Tempo");
  const [regNo, setRegNo] = useState("");
  const [seating, setSeating] = useState(13);
  const [luggage, setLuggage] = useState(12);
  const [modelYear, setModelYear] = useState(2023);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const vList = await dataService.getVehicles("op_rajputana");
    setVehicles(vList);
    const bList = await dataService.getBookings();
    setBookings(bList);
  };

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !regNo) return;
    setIsRegistering(true);
    try {
      await dataService.registerVehicle({
        operator_id: "op_rajputana",
        operator_name: "Rajputana Mobility Solutions",
        name,
        category,
        registration_number: regNo.toUpperCase(),
        seating_capacity: seating,
        luggage_capacity: luggage,
        model_year: modelYear,
        features: ["Commercial AC", "Luggage Bay", "Speed-Gov: 80 km/h"],
        compliance_status: "Commercial Yellow Board Valid",
        speed_governor_status: "Speed-Gov: 80 km/h Active",
        status: "Available",
        image_url:
          "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
      });
      setShowAddVehicle(false);
      setName("");
      setRegNo("");
      loadData();
    } catch (err) {
      console.error(err);
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
              OPERATOR CONSOLE • DL-OP-409
            </div>
            <h2 className="text-lg font-black text-slate-900">
              Fleet Partner Dashboard
            </h2>
          </div>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
            Tier-1 Partner
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">Active Fleet</span>
            <span className="text-base font-black text-slate-900">{vehicles.length}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">Bookings Won</span>
            <span className="text-base font-black text-[#00594c]">{bookings.length + 14}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-medium block">Rating</span>
            <span className="text-base font-black text-amber-600">4.92 ★</span>
          </div>
        </div>
      </div>

      {/* Fleet Vehicles Section */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#00594c]" />
            <h3 className="font-bold text-slate-900 text-sm">Registered Fleet Vehicles</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="text-xs font-semibold bg-[#004d40] text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[#00382f] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vehicle</span>
          </button>
        </div>

        {/* Add Vehicle Form Modal/Dropdown */}
        {showAddVehicle && (
          <form
            onSubmit={handleRegisterVehicle}
            className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200 space-y-2.5 text-xs"
          >
            <div className="font-bold text-teal-900">Register New Commercial Vehicle</div>
            <div>
              <label className="block text-slate-600 mb-0.5">Vehicle Model Name</label>
              <input
                type="text"
                placeholder="e.g. Force Urbania 17-Seater Luxury"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 mb-0.5">Vehicle Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="Urbania / Tempo">Urbania / Tempo</option>
                  <option value="Innova Crysta">Innova Crysta</option>
                  <option value="Coach / Minibus">Coach / Minibus</option>
                  <option value="Executive Sedan">Executive Sedan</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-0.5">Registration Number</label>
                <input
                  type="text"
                  placeholder="DL 01 TA 1234"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-600 mb-0.5">Seats</label>
                <input
                  type="number"
                  value={seating}
                  onChange={(e) => setSeating(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-0.5">Bags</label>
                <input
                  type="number"
                  value={luggage}
                  onChange={(e) => setLuggage(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-0.5">Year</label>
                <input
                  type="number"
                  value={modelYear}
                  onChange={(e) => setModelYear(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isRegistering}
                className="flex-1 py-2 bg-[#004d40] text-white font-bold rounded-lg hover:bg-[#00382f]"
              >
                {isRegistering ? "Saving..." : "Save Vehicle to Fleet"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="px-3 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Vehicle Cards */}
        <div className="space-y-2.5">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                  <img
                    src={v.image_url}
                    alt={v.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{v.name}</h4>
                  <div className="font-mono text-slate-500 text-[11px]">
                    {v.registration_number} • {v.model_year} Model
                  </div>
                  <div className="text-[10px] text-teal-800 font-medium mt-0.5">
                    {v.seating_capacity} Seats • {v.luggage_capacity} Luggage Boot
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    v.status === "Available"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {v.status}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">
                  Speed-Gov 80 km/h
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Won Journeys / Escrow Status */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Confirmed Bookings & Escrow</h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {bookings.length} Confirmed
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            No confirmed bookings yet. Submit competitive binding quotes to win open trips!
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{b.booking_code}</span>
                  <span className="font-bold text-[#00594c]">
                    ₹{b.total_amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-slate-600 text-[11px]">
                  {b.circuit_title} • {b.duration}
                </div>
                <div className="flex justify-between text-[10px] text-emerald-800 font-semibold pt-1 border-t border-emerald-100">
                  <span>Assigned: {b.vehicle_reg}</span>
                  <span>{b.escrow_status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
