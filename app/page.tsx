"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import BottomNav, { TabType } from "@/components/BottomNav";
import PlanTripView, { InitialCircuit } from "@/components/traveller/PlanTripView";
import CabOffersView from "@/components/traveller/CabOffersView";
import BookingModal from "@/components/traveller/BookingModal";
import BookingsView from "@/components/traveller/BookingsView";
import ExploreView from "@/components/traveller/ExploreView";
import TripRequestsMarketplace from "@/components/operator/TripRequestsMarketplace";
import QuoteSubmitterModal from "@/components/operator/QuoteSubmitterModal";
import PartnerHubView from "@/components/operator/PartnerHubView";
import AdminVerificationDashboard from "@/components/admin/AdminVerificationDashboard";
import { Booking, Quotation, TripRequest, UserRole } from "@/lib/types";
import { dataService } from "@/lib/dataService";
import { useAuth } from "@/lib/authContext";
import { CheckCircle2, ArrowRight, Sparkles, ChevronDown, ChevronUp, ShieldCheck, Car } from "lucide-react";

export default function Home() {
  const { role: authRole, switchActiveRole } = useAuth();
  const [role, setRole] = useState<UserRole>("traveller");
  const [currentTab, setCurrentTab] = useState<TabType>("explore");

  // Selection states
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [selectedCircuit, setSelectedCircuit] = useState<InitialCircuit | null>(null);
  const [showHackathonGuide, setShowHackathonGuide] = useState(true);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<Quotation | null>(null);
  const [quoteTargetTrip, setQuoteTargetTrip] = useState<TripRequest | null>(null);

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showQuoteSubmitterModal, setShowQuoteSubmitterModal] = useState(false);

  // Dynamic counts from database
  const [offersCount, setOffersCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const refreshCounts = async () => {
    const trips = await dataService.getTripRequests();
    setRequestsCount(trips.length);
    if (!activeTrip && trips.length > 0) {
      setActiveTrip(trips[0]);
    }
    const quotes = await dataService.getQuotations(activeTrip?.id);
    setOffersCount(quotes.length);
  };

  useEffect(() => {
    refreshCounts();
  }, [activeTrip?.id]);

  useEffect(() => {
    if (authRole) {
      setRole(authRole);
    }
  }, [authRole]);

  // Handle Role change
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    switchActiveRole(newRole);
    if (newRole === "traveller") {
      if (currentTab === "requests" || currentTab === "partner_hub") {
        setCurrentTab("offers");
      }
    } else if (newRole === "operator") {
      if (currentTab === "plan" || currentTab === "offers" || currentTab === "bookings") {
        setCurrentTab("requests");
      }
    }
  };

  // Traveler publishes trip
  const handleTripPublished = (newTrip: TripRequest) => {
    setActiveTrip(newTrip);
    setSelectedCircuit(null);
    refreshCounts();
    showToast(
      `Trip request #${newTrip.trip_code} published! Verified fleet partners are now discovering your itinerary.`
    );
    setCurrentTab("offers");
  };

  // Traveler selects quote
  const handleSelectQuotation = (quotation: Quotation) => {
    setSelectedQuoteForBooking(quotation);
    setShowBookingModal(true);
  };

  // Traveler confirms booking
  const handleBookingConfirmed = (booking: Booking) => {
    refreshCounts();
    showToast(`Booking ${booking.booking_code} confirmed! Fleet partner dispatched.`);
    setShowBookingModal(false);
    setSelectedQuoteForBooking(null);
    setCurrentTab("bookings");
  };

  // Operator clicks "Review & Quote" on a trip request
  const handleSelectTripForQuote = (trip: TripRequest) => {
    setQuoteTargetTrip(trip);
    setShowQuoteSubmitterModal(true);
  };

  // Operator submits quotation
  const handleQuotationSubmitted = (quote: Quotation) => {
    setShowQuoteSubmitterModal(false);
    refreshCounts();
    showToast(
      `Quotation ₹${quote.total_quote.toLocaleString("en-IN")} submitted to traveler console!`
    );
  };

  // Traveler picks circuit from Explore
  const handleSelectCircuitFromExplore = (circuit: InitialCircuit) => {
    setSelectedCircuit(circuit);
    setCurrentTab("plan");
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col text-[#172B2A] selection:bg-[#DDF7ED] selection:text-[#075E54]">
      {/* Sticky Header with Two-Sided Switcher & Auth */}
      <Header
        currentRole={role}
        onRoleChange={handleRoleChange}
        unreadCount={0}
      />

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-[#172B2A] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-[#DDF7ED] shrink-0" />
          <p className="text-xs font-normal leading-snug flex-1">{toastMessage}</p>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 w-full">
        {/* Interactive Hackathon Demo Guide Banner */}
        {showHackathonGuide && (
          <div className="max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-1">
            <div className="bg-gradient-to-r from-[#172B2A] to-[#075E54] text-white rounded-2xl p-3.5 shadow-sm border border-emerald-900/60 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#DDF7ED] text-[#075E54] flex items-center justify-center font-bold text-xs">
                    🚀
                  </span>
                  <div>
                    <h2 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                      Hackathon Demo Walkthrough
                      <span className="bg-[#DDF7ED]/20 text-[#DDF7ED] text-[9px] px-1.5 py-0.2 rounded-full font-semibold">
                        Full Lifecycle Active
                      </span>
                    </h2>
                    <p className="text-[10px] text-emerald-100/80">
                      Follow 3 simple steps to experience the complete marketplace:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHackathonGuide(false)}
                  className="text-white/60 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
                  title="Dismiss guide"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2.5 border-t border-white/10 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("traveller");
                    setCurrentTab("explore");
                  }}
                  className={`p-2 rounded-xl text-left transition-all cursor-pointer ${
                    role === "traveller"
                      ? "bg-white text-[#172B2A] font-semibold shadow-xs"
                      : "bg-white/10 hover:bg-white/15 text-white"
                  }`}
                >
                  <span className="block font-bold text-[10px]">1. Traveller</span>
                  <span className="block text-[9px] opacity-80 truncate">Pick circuit & publish</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("operator");
                    setCurrentTab("requests");
                  }}
                  className={`p-2 rounded-xl text-left transition-all cursor-pointer ${
                    role === "operator"
                      ? "bg-[#DDF7ED] text-[#075E54] font-semibold shadow-xs"
                      : "bg-white/10 hover:bg-white/15 text-white"
                  }`}
                >
                  <span className="block font-bold text-[10px]">2. Fleet Partner</span>
                  <span className="block text-[9px] opacity-80 truncate">Bid & submit quote</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange("admin");
                  }}
                  className={`p-2 rounded-xl text-left transition-all cursor-pointer ${
                    role === "admin"
                      ? "bg-amber-300 text-amber-950 font-semibold shadow-xs"
                      : "bg-white/10 hover:bg-white/15 text-white"
                  }`}
                >
                  <span className="block font-bold text-[10px]">3. Admin Portal</span>
                  <span className="block text-[9px] opacity-80 truncate">Strict Server Gate</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Traveller Views */}
        {role === "traveller" && (
          <>
            {currentTab === "explore" && (
              <ExploreView
                onSelectCircuit={handleSelectCircuitFromExplore}
                onOpenAiPlanner={() => setCurrentTab("plan")}
              />
            )}

            {currentTab === "plan" && (
              <PlanTripView
                onPublished={handleTripPublished}
                initialCircuit={selectedCircuit}
                onClearInitialCircuit={() => setSelectedCircuit(null)}
              />
            )}

            {currentTab === "offers" && (
              <CabOffersView
                tripRequest={activeTrip}
                onSelectQuotation={handleSelectQuotation}
                onPlanNewTrip={() => setCurrentTab("plan")}
              />
            )}

            {currentTab === "bookings" && (
              <BookingsView onPlanNewTrip={() => setCurrentTab("plan")} />
            )}

            {/* Fallback if user clicked operator tab while in traveler mode */}
            {currentTab === "requests" && (
              <TripRequestsMarketplace onSelectForQuote={handleSelectTripForQuote} />
            )}
            {currentTab === "partner_hub" && <PartnerHubView />}
          </>
        )}

        {/* Operator / Fleet Partner Views */}
        {role === "operator" && (
          <>
            {currentTab === "requests" && (
              <TripRequestsMarketplace onSelectForQuote={handleSelectTripForQuote} />
            )}

            {currentTab === "partner_hub" && <PartnerHubView />}

            {currentTab === "explore" && (
              <ExploreView onSelectCircuit={handleSelectCircuitFromExplore} />
            )}

            {currentTab === "offers" && (
              <CabOffersView
                tripRequest={activeTrip}
                onSelectQuotation={handleSelectQuotation}
                onPlanNewTrip={() => setCurrentTab("plan")}
              />
            )}

            {currentTab === "plan" && (
              <PlanTripView
                onPublished={handleTripPublished}
                initialCircuit={selectedCircuit}
                onClearInitialCircuit={() => setSelectedCircuit(null)}
              />
            )}

            {currentTab === "bookings" && (
              <BookingsView onPlanNewTrip={() => setCurrentTab("plan")} />
            )}
          </>
        )}

        {/* Admin Verification Dashboard */}
        {role === "admin" && (
          <AdminVerificationDashboard />
        )}
      </main>

      {/* Booking Review & Lock Modal */}
      <BookingModal
        quotation={selectedQuoteForBooking}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedQuoteForBooking(null);
        }}
        onBookingConfirmed={handleBookingConfirmed}
      />

      {/* Operator Quotation Submitter Modal */}
      <QuoteSubmitterModal
        tripRequest={quoteTargetTrip}
        onClose={() => {
          setShowQuoteSubmitterModal(false);
          setQuoteTargetTrip(null);
        }}
        onQuotationSubmitted={handleQuotationSubmitted}
      />

      {/* Fixed Bottom Navigation Bar (Hidden in Admin Console) */}
      {role !== "admin" && (
        <BottomNav
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
          role={role}
          offersCount={offersCount}
          requestsCount={requestsCount}
        />
      )}
    </div>
  );
}
