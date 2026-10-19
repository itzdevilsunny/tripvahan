"use client";

import React from "react";
import { Compass, Plus, Tag, Search, Car, CalendarCheck } from "lucide-react";
import { UserRole } from "@/lib/types";

export type TabType = "explore" | "plan" | "offers" | "requests" | "partner_hub" | "bookings";

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  role: UserRole;
  offersCount?: number;
  requestsCount?: number;
}

export default function BottomNav({
  currentTab,
  onTabChange,
  role,
  offersCount = 3,
  requestsCount = 8,
}: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5EAF0] shadow-md py-1 safe-area-pb">
      <div className="max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-around">
        {/* Explore */}
        <button
          type="button"
          onClick={() => onTabChange("explore")}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium transition-colors ${
            currentTab === "explore"
              ? "text-[#075E54] font-semibold"
              : "text-[#718096] hover:text-[#172B2A]"
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>Explore</span>
        </button>

        {/* Plan Trip - Primary Action Button */}
        <button
          type="button"
          onClick={() => onTabChange("plan")}
          className="flex flex-col items-center justify-center -mt-4 group"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 active:scale-95 ${
              currentTab === "plan"
                ? "bg-[#075E54] ring-4 ring-[#DDF7ED]"
                : "bg-[#075E54]"
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span
            className={`text-[10px] font-medium mt-1 ${
              currentTab === "plan" ? "text-[#075E54] font-semibold" : "text-[#718096]"
            }`}
          >
            Plan Trip
          </span>
        </button>

        {/* Cab Offers (Traveler quotations) */}
        <button
          type="button"
          onClick={() => onTabChange("offers")}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium relative transition-colors ${
            currentTab === "offers"
              ? "text-[#075E54] font-semibold"
              : "text-[#718096] hover:text-[#172B2A]"
          }`}
        >
          <Tag className="w-5 h-5 mb-0.5" />
          <span>Cab Offers</span>
          {offersCount > 0 && (
            <span className="absolute top-0 right-2 w-4 h-4 bg-[#075E54] text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {offersCount}
            </span>
          )}
        </button>

        {/* Trip Requests (Operator marketplace feed) */}
        <button
          type="button"
          onClick={() => onTabChange("requests")}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium relative transition-colors ${
            currentTab === "requests"
              ? "text-[#075E54] font-semibold"
              : "text-[#718096] hover:text-[#172B2A]"
          }`}
        >
          <Search className="w-5 h-5 mb-0.5" />
          <span>Trip Requests</span>
          {requestsCount > 0 && (
            <span className="absolute top-0 right-2 w-4 h-4 bg-[#075E54] text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {requestsCount}
            </span>
          )}
        </button>

        {/* Partner Hub / Bookings */}
        <button
          type="button"
          onClick={() => onTabChange(role === "operator" ? "partner_hub" : "bookings")}
          className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium transition-colors ${
            currentTab === "partner_hub" || currentTab === "bookings"
              ? "text-[#075E54] font-semibold"
              : "text-[#718096] hover:text-[#172B2A]"
          }`}
        >
          {role === "operator" ? (
            <>
              <Car className="w-5 h-5 mb-0.5" />
              <span>Partner Hub</span>
            </>
          ) : (
            <>
              <CalendarCheck className="w-5 h-5 mb-0.5" />
              <span>Bookings</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
