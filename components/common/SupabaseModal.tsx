"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Copy, Database, CloudCheck, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { dataService } from "@/lib/dataService";

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseModal({ isOpen, onClose }: SupabaseModalProps) {
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    hasTables: boolean;
    message: string;
  } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await dataService.checkSupabaseConnection();
      setStatus(res);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      testConnection();
    }
  }, [isOpen]);

  const copySqlSchema = () => {
    const sql = `-- TRIPVAHAN SUPABASE SCHEMA
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'traveller',
  operator_name TEXT,
  operator_code TEXT,
  rating NUMERIC DEFAULT 4.90,
  reviews_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  seating_capacity INT NOT NULL,
  luggage_capacity INT NOT NULL,
  model_year INT NOT NULL,
  features TEXT[] DEFAULT '{}',
  compliance_status TEXT DEFAULT 'Commercial Yellow Board Valid',
  speed_governor_status TEXT DEFAULT 'Speed-Gov: 80 km/h Active',
  status TEXT DEFAULT 'Available',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trip_requests (
  id TEXT PRIMARY KEY,
  trip_code TEXT NOT NULL UNIQUE,
  traveler_id TEXT NOT NULL,
  traveler_name TEXT NOT NULL,
  circuit_title TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  stops JSONB DEFAULT '[]'::jsonb,
  circuit_type TEXT NOT NULL,
  distance_km INT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  duration TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  travellers_count INT NOT NULL,
  adults_count INT DEFAULT 0,
  seniors_count INT DEFAULT 0,
  luggage_bags INT NOT NULL,
  matched_vehicle_class TEXT NOT NULL,
  indicative_budget_min NUMERIC,
  indicative_budget_max NUMERIC,
  target_budget NUMERIC NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open',
  quotes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id TEXT PRIMARY KEY,
  trip_request_id TEXT NOT NULL,
  trip_code TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_rating NUMERIC DEFAULT 4.90,
  reviews_count INT DEFAULT 0,
  vehicle_id TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_category TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  vehicle_image TEXT,
  model_year INT NOT NULL,
  badge TEXT,
  base_vehicle_fuel_rate NUMERIC NOT NULL,
  driver_night_allowance NUMERIC NOT NULL,
  tolls_state_permit_taxes NUMERIC NOT NULL,
  total_quote NUMERIC NOT NULL,
  per_person_fare NUMERIC NOT NULL,
  inclusions TEXT[] DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  validity_hours INT DEFAULT 48,
  operator_note TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_trip_vehicle_quote UNIQUE (trip_request_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  trip_request_id TEXT NOT NULL REFERENCES public.trip_requests(id) ON DELETE RESTRICT,
  quotation_id TEXT NOT NULL REFERENCES public.quotations(id) ON DELETE RESTRICT,
  traveler_id TEXT NOT NULL,
  traveler_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  circuit_title TEXT NOT NULL,
  duration TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  per_person_amount NUMERIC NOT NULL,
  escrow_status TEXT DEFAULT 'Secured in Escrow',
  journey_status TEXT DEFAULT 'Confirmed',
  contract_signed BOOLEAN DEFAULT true,
  pickup_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_trip_booking UNIQUE (trip_request_id),
  CONSTRAINT unique_vehicle_pickup_date UNIQUE (vehicle_reg, pickup_date)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Profiles Read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Self Profile Insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);
CREATE POLICY "Self Profile Update" ON public.profiles FOR UPDATE USING (auth.uid()::text = id OR auth.uid() IS NULL);

CREATE POLICY "Public Vehicles Read" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Operator Vehicle Insert" ON public.vehicles FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Vehicle Update" ON public.vehicles FOR UPDATE USING (auth.uid()::text = operator_id OR auth.uid() IS NULL);

CREATE POLICY "Public Trip Requests Read" ON public.trip_requests FOR SELECT USING (true);
CREATE POLICY "Traveler Trip Insert" ON public.trip_requests FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Trip Update" ON public.trip_requests FOR UPDATE USING (auth.uid()::text = traveler_id OR auth.uid() IS NULL);

CREATE POLICY "Public Quotations Read" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Operator Quote Insert" ON public.quotations FOR INSERT WITH CHECK (auth.uid()::text = operator_id OR auth.uid() IS NULL);
CREATE POLICY "Operator Quote Update" ON public.quotations FOR UPDATE USING (auth.uid()::text = operator_id OR auth.uid() IS NULL);

CREATE POLICY "Public Bookings Read" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Traveler Booking Insert" ON public.bookings FOR INSERT WITH CHECK (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
CREATE POLICY "Traveler Booking Update" ON public.bookings FOR UPDATE USING (auth.uid()::text = traveler_id OR auth.uid() IS NULL);
`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-[#004d40] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Supabase Cloud Database</h3>
              <p className="text-xs text-teal-100">Live PostgreSQL Data Service</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-teal-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              status?.hasTables
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : status?.connected
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {status?.hasTables ? (
              <span className="p-1 rounded-full bg-emerald-200 text-emerald-800">
                <Check className="w-4 h-4" />
              </span>
            ) : status?.connected ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-bold text-xs uppercase tracking-wider mb-0.5">
                {status?.hasTables
                  ? "Live Cloud Tables Synced"
                  : status?.connected
                  ? "Connected - Schema Ready to Run"
                  : "Connecting..."}
              </div>
              <p className="text-xs leading-relaxed">{status?.message}</p>
            </div>
          </div>

          {/* Connection Metadata */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Supabase Project URL</span>
              <span className="font-mono text-slate-800 text-[11px] truncate max-w-[200px]">
                https://ykaorzsoajfwuzibmgoo.supabase.co
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Key Type</span>
              <span className="font-mono text-emerald-700 font-semibold text-[11px]">
                sb_publishable (Client REST)
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Auto-Fallback & Sync</span>
              <span className="text-emerald-700 font-semibold">Active (Zero Data Loss)</span>
            </div>
          </div>

          {/* Quick Action: Copy SQL for Supabase SQL Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                Run Schema in Supabase Dashboard:
              </span>
              <a
                href="https://supabase.com/dashboard/project/ykaorzsoajfwuzibmgoo/sql"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#00594c] hover:underline flex items-center gap-1 font-semibold"
              >
                Open SQL Editor <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              type="button"
              onClick={copySqlSchema}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> SQL Schema Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy Complete SQL Migration (Tables & Policies)
                </>
              )}
            </button>
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-slate-200">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
              Re-test Connection
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
