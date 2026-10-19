"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import BottomNav, { TabType } from "@/components/BottomNav";
import PlanTripView from "@/components/traveller/PlanTripView";
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
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function Home() {
  const { role: authRole, switchActiveRole } = useAuth();
  const [role, setRole] = useState<UserRole>("traveller");
  const [currentTab, setCurrentTab] = useState<TabType>("offers");

  // Selection states
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
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
  const handleSelectCircuitFromExplore = () => {
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
        {/* Traveller Views */}
        {role === "traveller" && (
          <>
            {currentTab === "explore" && (
              <ExploreView onSelectCircuit={handleSelectCircuitFromExplore} />
            )}

            {currentTab === "plan" && (
              <PlanTripView onPublished={handleTripPublished} />
            )}

            {currentTab === "offers" && (
              <CabOffersView
                tripRequest={activeTrip}
                onSelectQuotation={handleSelectQuotation}
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
              />
            )}

            {currentTab === "plan" && (
              <PlanTripView onPublished={handleTripPublished} />
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
