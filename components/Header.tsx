"use client";

import React, { useState, useEffect } from "react";
import { Car, LogIn, Bell } from "lucide-react";
import { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/authContext";
import AuthModal from "./common/AuthModal";

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenDbModal?: () => void;
  unreadCount?: number;
}

export default function Header({
  currentRole,
  onRoleChange,
  unreadCount = 0,
}: HeaderProps) {
  const { user, profile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5EAF0] shadow-xs transition-all">
        <div className="max-w-xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#075E54] flex items-center justify-center text-white shadow-xs">
              <Car className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-[#172B2A] tracking-tight text-base sm:text-lg">
                  Tripvahan
                </span>
                <span className="text-[9px] font-semibold bg-[#DDF7ED] text-[#075E54] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Verified
                </span>
              </div>
              <p className="text-[10px] text-[#718096] font-medium tracking-tight">
                {currentRole === "operator"
                  ? "Fleet Partner Console"
                  : currentRole === "admin"
                  ? "Platform Compliance & Verification Portal"
                  : "Group Travel & Cab Marketplace"}
              </p>
            </div>
          </div>

          {/* Three-Sided Platform Toggle Switcher (Traveler vs Partner vs Admin) */}
          <div className="flex items-center bg-[#F7F8FA] p-0.5 sm:p-1 rounded-full border border-[#E5EAF0] shadow-inner">
            <button
              type="button"
              onClick={() => onRoleChange("traveller")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 cursor-pointer ${
                currentRole === "traveller"
                  ? "bg-white text-[#172B2A] shadow-xs font-semibold"
                  : "text-[#718096] hover:text-[#172B2A]"
              }`}
            >
              Traveller
            </button>
            <button
              type="button"
              onClick={() => onRoleChange("operator")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                currentRole === "operator"
                  ? "bg-[#075E54] text-white shadow-xs font-semibold"
                  : "text-[#718096] hover:text-[#172B2A]"
              }`}
            >
              Partner
            </button>
            <button
              type="button"
              onClick={() => onRoleChange("admin")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                currentRole === "admin"
                  ? "bg-[#172B2A] text-[#DDF7ED] shadow-xs font-bold border border-emerald-800"
                  : "text-[#718096] hover:text-[#172B2A]"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Right side controls: Notification Bell & Auth / Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Notifications"
                className="relative p-1.5 rounded-full text-[#718096] hover:text-[#172B2A] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#075E54] ring-2 ring-white" />
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 top-10 w-72 sm:w-80 bg-white rounded-2xl border border-[#E5EAF0] shadow-lg p-3.5 z-50 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-2">
                    <span className="font-bold text-xs text-[#172B2A]">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-[11px] text-[#718096] hover:text-[#172B2A] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="py-6 text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Bell className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-[#172B2A]">No new notifications</p>
                    <p className="text-[11px] text-[#718096] max-w-[200px] mx-auto">
                      You will receive alerts here when quotes, booking status changes, or trip updates occur.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Auth trigger / Avatar */}
            {user ? (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-8 h-8 rounded-full bg-[#075E54] text-white flex items-center justify-center font-semibold text-xs shadow-xs hover:ring-2 hover:ring-[#075E54]/20 transition-all cursor-pointer"
                title={`${profile?.full_name || user.email} (Click to manage account)`}
              >
                {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || "U"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-8 h-8 rounded-full bg-[#E5EAF0] text-[#172B2A] hover:bg-[#DDF7ED] hover:text-[#075E54] flex items-center justify-center font-semibold text-xs transition-colors cursor-pointer"
                title="Sign In"
              >
                <LogIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
