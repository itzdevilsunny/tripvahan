"use client";

import React, { useState, useEffect } from "react";
import { Bell, ShieldCheck, Database, Compass, Car } from "lucide-react";
import { UserRole } from "@/lib/types";
import { dataService } from "@/lib/dataService";

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenDbModal: () => void;
  unreadCount?: number;
}

export default function Header({
  currentRole,
  onRoleChange,
  onOpenDbModal,
  unreadCount = 2,
}: HeaderProps) {
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; hasTables: boolean } | null>(null);

  useEffect(() => {
    dataService.checkSupabaseConnection().then((res) => {
      setDbStatus({ connected: res.connected, hasTables: res.hasTables });
    });
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#004d40] to-[#00796b] flex items-center justify-center text-white shadow-sm shadow-teal-900/20">
            <Car className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                Tripvahan
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-[#00594c] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium tracking-tight">
              AllRouteBook Cab Connect
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
            Travel
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
            Partner / Host
          </button>
        </div>

        {/* Right side controls: Supabase status & Notification / Profile */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDbModal}
            title="Supabase PostgreSQL Connection & Migration"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 hover:bg-teal-100 border border-teal-200/80 text-teal-800 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Supabase</span>
            <span
              className={`w-2 h-2 rounded-full ${
                dbStatus?.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
          </button>

          {/* Bell Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700 cursor-pointer overflow-hidden shadow-xs"
            title={currentRole === "traveller" ? "Rohan S. (Traveller)" : "DL-OP-409 Capt. Vikram"}
          >
            {currentRole === "traveller" ? (
              <span className="bg-emerald-100 text-emerald-900 w-full h-full flex items-center justify-center text-xs">
                RS
              </span>
            ) : (
              <span className="bg-[#004d40] text-white w-full h-full flex items-center justify-center text-xs">
                RM
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
