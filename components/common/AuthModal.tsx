"use client";

import React, { useState } from "react";
import { X, Lock, Mail, User, Building, LogOut, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { UserRole } from "@/lib/types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, profile, role, signUp, signIn, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("traveller");
  const [operatorName, setOperatorName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          setErrorMsg("Please enter your full name");
          setSubmitting(false);
          return;
        }
        if (selectedRole === "operator" && !operatorName.trim()) {
          setErrorMsg("Please enter your transport or fleet company name");
          setSubmitting(false);
          return;
        }

        const res = await signUp(email, password, fullName, selectedRole, operatorName);
        if (res.error) {
          setErrorMsg(res.error);
        } else {
          setSuccessMsg("Account registered successfully! You are now logged in.");
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error);
        } else {
          setSuccessMsg("Signed in successfully!");
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#004d40] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full">
              Tripvahan Security
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {user ? "Your Tripvahan Profile" : mode === "signin" ? "Welcome Back" : "Create Your Account"}
          </h2>
          <p className="text-xs text-emerald-100/80 mt-1">
            {user
              ? "Connected to verified Supabase PostgreSQL session"
              : mode === "signin"
              ? "Sign in to access your trip requests and fleet quotations"
              : "Register as a group traveller or commercial fleet partner"}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {user ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#004d40] text-white flex items-center justify-center font-bold text-base">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {profile?.full_name || "Tripvahan Member"}
                    </h3>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {role === "operator" ? "Commercial Fleet Partner" : "Traveller"}
                      </span>
                      {profile?.operator_name && (
                        <span className="text-[10px] font-semibold text-slate-600">
                          {profile.operator_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Active Supabase Auth Session</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    User UID: <span className="font-mono text-[10px]">{user.id.slice(0, 16)}...</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out of Account
              </button>
            </div>
          ) : (
            /* Sign in / Sign up form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {mode === "signup" && (
                <>
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Select Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRole("traveller")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          selectedRole === "traveller"
                            ? "bg-[#004d40] text-white border-[#004d40] shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Traveller / Group
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole("operator")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          selectedRole === "operator"
                            ? "bg-[#004d40] text-white border-[#004d40] shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Fleet Partner
                      </button>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rohan Sharma"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>

                  {/* Operator Business Name */}
                  {selectedRole === "operator" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Transport / Fleet Company Name
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={operatorName}
                          onChange={(e) => setOperatorName(e.target.value)}
                          placeholder="e.g. Rajputana Mobility Solutions"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-[#004d40] hover:bg-[#00382f] text-white font-extrabold text-xs shadow-md shadow-teal-900/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <span>Processing...</span>
                ) : mode === "signin" ? (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Register Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Mode switcher */}
              <div className="text-center pt-2">
                {mode === "signin" ? (
                  <p className="text-xs text-slate-500">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setErrorMsg(null);
                      }}
                      className="text-[#00594c] font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Already registered?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMsg(null);
                      }}
                      className="text-[#00594c] font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
