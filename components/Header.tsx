"use client";

import React, { useState, useEffect } from "react";
import { Car, LogIn } from "lucide-react";
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

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-3 sm:px-6 py-2.5 transition-all">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#004d40] flex items-center justify-center text-white shadow-xs">
              <Car className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                  Tripvahan
                </span>
                <span className="text-[9px] font-bold bg-emerald-100 text-[#00594c] px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Verified
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-semibold tracking-tight">
                Group Travel & Cab Marketplace
              </p>
            </div>
          </div>

          {/* Two-Sided Marketplace Toggle Switcher (Travel vs Partner / Host) */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => onRoleChange("traveller")}
              className={`px-3 sm:px-4 py-1.2 sm:py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                currentRole === "traveller"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Traveller
            </button>
            <button
              type="button"
              onClick={() => onRoleChange("operator")}
              className={`px-3 sm:px-4 py-1.2 sm:py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                currentRole === "operator"
                  ? "bg-[#004d40] text-white shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fleet Partner
            </button>
          </div>

          {/* Right side controls: Auth / Profile */}
          <div className="flex items-center gap-2">
            {/* Auth trigger / Avatar */}
            {user ? (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-8 h-8 rounded-full bg-[#004d40] text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-teal-500 transition-all"
                title={`${profile?.full_name || user.email} (Click to manage account)`}
              >
                {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || "U"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#004d40] text-white hover:bg-[#00382f] shadow-xs transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
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
