"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Car,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Users,
  Luggage,
  ArrowRight,
  X,
  FileCheck,
} from "lucide-react";
import { Booking, Vehicle, TripRequest, Quotation } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";
import { DESTINATION_IMAGES, VEHICLE_IMAGES, getDestinationImage, getVehicleImage } from "@/lib/mediaAssets";
import QuoteSubmitterModal from "./QuoteSubmitterModal";
import OperatorDocumentManager from "./OperatorDocumentManager";
import AuthModal from "@/components/common/AuthModal";

export default function PartnerHubView() {
  const { user, profile } = useAuth();
  const opId = user?.id || "";
  const opName = profile?.operator_name || profile?.full_name || (user ? "Commercial Fleet Partner" : "Fleet Partner");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recentTrips, setRecentTrips] = useState<TripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showDocVerification, setShowDocVerification] = useState(false);
  const [quotingTrip, setQuotingTrip] = useState<TripRequest | null>(null);

  // New vehicle form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Urbania / Tempo");
  const [regNo, setRegNo] = useState("");
  const [seating, setSeating] = useState(13);
  const [luggage, setLuggage] = useState(12);
  const [modelYear, setModelYear] = useState(2024);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    if (!user?.id) {
      setVehicles([]);
      setBookings([]);
      const tList = await dataService.getTripRequests();
      setRecentTrips(tList.slice(0, 3));
      setLoading(false);
      return;
    }
    const vList = await dataService.getVehicles(user.id);
    setVehicles(vList);
    const bList = await dataService.getBookings();
    setBookings(bList);
    const tList = await dataService.getTripRequests();
    setRecentTrips(tList.slice(0, 3));
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

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsRegistering(true);
    try {
      const opId = user.id;
      const opName = profile?.operator_name || profile?.full_name || "Commercial Fleet Partner";

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

  // Honest verification state based on verified partner record
  const complianceDisplay = profile?.verified ? "Verified" : vehicles.length > 0 ? "Pending Review" : "Not Submitted";

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 sm:px-4 space-y-4 pt-2">
      {/* 1. Welcome Header Banner matching Column 5 of reference mockup */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#064E45] to-[#075E54] text-white p-5 shadow-xs flex items-center justify-between min-h-[140px]">
        {/* Left Side: Welcome greeting & operator name */}
        <div className="space-y-1.5 z-10 max-w-[65%]">
          <p className="text-xs text-white/80 font-medium">Welcome back,</p>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
            {opName}
          </h2>
          <div className="pt-1">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-xs ${
              profile?.verified ? "bg-[#DDF7ED] text-[#075E54]" : "bg-amber-100 text-amber-800"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {profile?.verified ? "Verified Partner" : "Verification Pending"}
            </span>
          </div>
        </div>

        {/* Right Side: Vehicle Cutout / Graphic */}
        <div className="relative w-32 sm:w-36 h-24 shrink-0 -mr-2">
          <Image
            src={VEHICLE_IMAGES.urbania}
            alt="Fleet Van"
            fill
            className="object-contain drop-shadow-md rounded-xl"
            sizes="(max-width: 768px) 140px, 160px"
          />
        </div>
      </div>

      {/* 2. 3 Metrics Cards calculated from real application data */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5EAF0] shadow-xs">
          <span className="text-[11px] text-[#718096] font-medium block">Active Fleet</span>
          <span className="text-lg sm:text-xl font-bold text-[#172B2A] mt-0.5 block">
            {vehicles.length}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5EAF0] shadow-xs">
          <span className="text-[11px] text-[#718096] font-medium block">Confirmed Trips</span>
          <span className="text-lg sm:text-xl font-bold text-[#172B2A] mt-0.5 block">
            {bookings.length}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5EAF0] shadow-xs">
          <span className="text-[11px] text-[#718096] font-medium block">RTO Compliance</span>
          <span className={`text-xs sm:text-sm font-bold mt-1.5 block ${
            profile?.verified ? "text-[#075E54]" : "text-amber-700"
          }`}>
            {complianceDisplay}
          </span>
        </div>
      </div>

      {/* Commercial Verification Workflow Banner */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#DDF7ED] text-[#075E54]">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#172B2A]">RTO & Operator Compliance Shield</h4>
              <p className="text-[11px] text-[#718096]">Required for verified quotes on Rajasthan & UP highways</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDocVerification(!showDocVerification)}
            className="text-xs font-semibold text-[#075E54] hover:underline cursor-pointer"
          >
            {showDocVerification ? "Hide Checklist" : "View Checklist"}
          </button>
        </div>

        {showDocVerification && (
          <div className="pt-2 border-t border-[#E5EAF0] animate-in fade-in duration-150">
            <OperatorDocumentManager operatorId={opId} isVerified={profile?.verified} />
          </div>
        )}
      </div>

      {/* 3. Primary Action Button: + Add New Vehicle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAddVehicle(!showAddVehicle)}
          className="w-full py-3 px-4 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {showAddVehicle ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showAddVehicle ? "Close Form" : "+ Add New Vehicle"}</span>
        </button>
      </div>

      {/* Add Vehicle Modal / Form */}
      {showAddVehicle && (
        <form
          onSubmit={handleRegisterVehicle}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5EAF0] shadow-sm space-y-3.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-2.5">
            <h4 className="font-semibold text-[#172B2A] text-xs sm:text-sm">Register Commercial Fleet Vehicle</h4>
            <span className="text-[11px] font-medium text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-full">
              Yellow Board
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-[#172B2A] block mb-1">
                Vehicle Model Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Force Urbania 16 Seater"
                required
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#172B2A] block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] font-medium focus:outline-none focus:border-[#075E54]"
              >
                <option value="Urbania / Tempo">Urbania / Tempo</option>
                <option value="Innova Crysta">Innova Crysta</option>
                <option value="Coach / Minibus">Coach / Minibus</option>
                <option value="Executive Sedan">Executive Sedan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-[#172B2A] block mb-1">
                Plate Reg No.
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="DL 01 TA 1234"
                required
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white font-mono uppercase text-[#172B2A] focus:outline-none focus:border-[#075E54]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#172B2A] block mb-1">
                Seats (RTO)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={seating}
                onChange={(e) => setSeating(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#172B2A] block mb-1">
                Bags Cap.
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={luggage}
                onChange={(e) => setLuggage(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-[#E5EAF0] bg-white text-[#172B2A] focus:outline-none focus:border-[#075E54]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isRegistering}
            className="w-full py-2.5 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isRegistering ? "Saving to Database..." : "Register Vehicle & Activate Availability"}
          </button>
        </form>
      )}

      {/* 4. "Recent Trip Requests" matching Column 5 of reference mockup */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#172B2A] text-sm sm:text-base">
            Recent Trip Requests
          </h3>
          <span className="text-xs font-semibold text-[#075E54] hover:underline cursor-pointer">
            View All
          </span>
        </div>

        {recentTrips.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-[#E5EAF0] text-center text-xs text-[#718096]">
            No live trip requests available right now.
          </div>
        ) : (
          <div className="space-y-3.5">
            {recentTrips.map((trip) => {
              const destImage = getDestinationImage(trip.circuit_title, trip.destination, trip.origin);
              return (
                <div
                  key={trip.id}
                  className="bg-white rounded-2xl border border-[#E5EAF0] shadow-xs overflow-hidden transition-all hover:border-[#075E54]/40"
                >
                  {/* Destination Photo Header matching Column 5 */}
                  <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-slate-100">
                    <Image
                      src={destImage}
                      alt={trip.circuit_title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 600px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* Top-left: REQ #TRP-... badge */}
                    <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs text-[#075E54] text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                      REQ #{trip.trip_code}
                    </div>

                    {/* Top-right: Duration pill */}
                    <div className="absolute top-2.5 right-2.5 bg-[#075E54] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs">
                      {trip.duration.split(" ")[0]}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2.5">
                    <h4 className="font-bold text-[#172B2A] text-sm sm:text-base">
                      {trip.circuit_title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#718096]">
                      <span className="flex items-center gap-1 font-medium text-[#172B2A]">
                        <Calendar className="w-3.5 h-3.5 text-[#075E54]" />
                        {trip.start_date}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#718096]" />
                        {trip.travellers_count} Travellers
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Luggage className="w-3.5 h-3.5 text-[#718096]" />
                        {trip.luggage_bags} Bags
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-sm text-[#172B2A]">
                        Budget: <span className="text-[#075E54]">₹{trip.target_budget.toLocaleString("en-IN")}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuotingTrip(trip)}
                      className="w-full py-2.5 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>Submit Quote →</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Registered Fleet Vehicles List */}
      <div className="space-y-3 pt-2">
        <h3 className="font-bold text-[#172B2A] text-sm sm:text-base">
          Registered Fleet Vehicles ({vehicles.length})
        </h3>

        {loading ? (
          <div className="bg-white rounded-2xl p-6 border border-[#E5EAF0] text-center space-y-2">
            <div className="w-6 h-6 mx-auto border-3 border-[#075E54] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#718096] font-medium">Loading fleet data...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-[#E5EAF0] text-center space-y-2 shadow-xs">
            <Car className="w-6 h-6 mx-auto text-[#075E54]" />
            <h4 className="font-semibold text-[#172B2A] text-xs sm:text-sm">No Vehicles Registered Yet</h4>
            <p className="text-xs text-[#718096]">Add your commercial vehicle to start submitting quotes.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {vehicles.map((v) => {
              const vImg = getVehicleImage(v.category, v.name);
              return (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E5EAF0] shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-11 rounded-xl overflow-hidden relative bg-slate-100 shrink-0 border border-[#E5EAF0]">
                      <Image
                        src={vImg}
                        alt={v.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#172B2A] text-xs sm:text-sm">{v.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#718096] mt-0.5">
                        <span className="font-mono text-[#172B2A] font-medium">
                          {v.registration_number}
                        </span>
                        <span>·</span>
                        <span>{v.seating_capacity} Seats</span>
                        <span>·</span>
                        <span>{v.luggage_capacity} Bags</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DDF7ED] text-[#075E54] shrink-0">
                    {v.status || "Active"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Confirmed Operator Bookings */}
      {bookings.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <h3 className="font-bold text-[#172B2A] text-sm">
            Confirmed Assigned Trips ({bookings.length})
          </h3>
          <div className="space-y-2.5">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-4 border border-[#E5EAF0] shadow-xs flex items-center justify-between text-xs gap-3"
              >
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#075E54] bg-[#DDF7ED] px-2.5 py-0.5 rounded-full">
                    Booking #{b.booking_code}
                  </span>
                  <h4 className="font-semibold text-[#172B2A] mt-1.5">{b.circuit_title}</h4>
                  <p className="text-xs text-[#718096] mt-0.5">
                    Traveler: {b.traveler_name} · Vehicle: {b.vehicle_name} ({b.vehicle_reg})
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-[#075E54]">
                    ₹{b.total_amount.toLocaleString("en-IN")}
                  </span>
                  <span className="block text-[11px] font-medium text-[#075E54] mt-0.5">
                    {b.journey_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quote Submitter Modal */}
      {quotingTrip && (
        <QuoteSubmitterModal
          tripRequest={quotingTrip}
          onClose={() => setQuotingTrip(null)}
          onQuotationSubmitted={(quote) => {
            setQuotingTrip(null);
            loadData();
          }}
        />
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

