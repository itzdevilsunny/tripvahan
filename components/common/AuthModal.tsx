"use client";

import React, { useState } from "react";
import { X, Lock, Mail, User, Building, LogOut, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
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

  const handleQuickSignIn = async (demoRole: "traveller" | "operator") => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const demoCreds =
      demoRole === "traveller"
        ? {
            email: "rohan.sharma@tripvahan.demo",
            pass: "DemoTraveller2026!",
            name: "Rohan Sharma",
            role: "traveller" as UserRole,
            operatorName: "",
          }
        : {
            email: "vikram.singh@tripvahan.demo",
            pass: "DemoOperator2026!",
            name: "Capt. Vikram Singh",
            role: "operator" as UserRole,
            operatorName: "Rajputana Mobility Solutions",
          };

    setEmail(demoCreds.email);
    setPassword(demoCreds.pass);

    try {
      // First attempt signIn
      const res = await signIn(demoCreds.email, demoCreds.pass);
      if (res.error) {
        // Automatically create account if not yet registered in this environment
        const upRes = await signUp(
          demoCreds.email,
          demoCreds.pass,
          demoCreds.name,
          demoCreds.role,
          demoCreds.operatorName
        );
        if (upRes.error) {
          setErrorMsg(upRes.error);
          return;
        }
      }
      setSuccessMsg(`Signed in as ${demoCreds.name}!`);
      setTimeout(() => {
        onClose();
      }, 900);
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-xl border border-[#E5EAF0] overflow-hidden relative">
        {/* Header */}
        <div className="bg-[#075E54] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] uppercase font-medium tracking-wider bg-white/15 text-white px-2.5 py-0.5 rounded-full">
              Tripvahan Security
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            {user ? "Your Tripvahan Profile" : mode === "signin" ? "Welcome Back" : "Create Your Account"}
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 font-normal">
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
              <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-[#E5EAF0]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#075E54] text-white flex items-center justify-center font-semibold text-base">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#172B2A]">
                      {profile?.full_name || "Tripvahan Member"}
                    </h3>
                    <p className="text-xs text-[#718096]">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#DDF7ED] text-[#075E54] uppercase">
                        {role === "operator" ? "Commercial Fleet Partner" : "Traveller"}
                      </span>
                      {profile?.operator_name && (
                        <span className="text-[11px] font-medium text-[#718096]">
                          {profile.operator_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#DDF7ED]/40 border border-[#075E54]/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[#172B2A]">
                <CheckCircle2 className="w-4 h-4 text-[#075E54] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#172B2A]">Active Session</p>
                  <p className="text-[#718096] text-[11px] mt-0.5">
                    User ID: <span className="font-mono text-[10px] text-[#172B2A]">{user.id.slice(0, 16)}...</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out of Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Hackathon Quick-Persona 1-Click Access */}
              <div className="bg-[#F7F8FA] border border-[#E5EAF0] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#075E54]" /> Hackathon Quick Access
                  </span>
                  <span className="text-[10px] text-[#718096]">1-Click Demo Login</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleQuickSignIn("traveller")}
                    className="p-2.5 rounded-xl bg-white border border-[#E5EAF0] hover:border-[#075E54] hover:bg-[#DDF7ED]/40 text-left transition-all cursor-pointer shadow-2xs group disabled:opacity-50"
                  >
                    <span className="text-xs font-bold text-[#172B2A] group-hover:text-[#075E54] block truncate">
                      Traveller Demo
                    </span>
                    <span className="text-[10px] text-[#718096] block truncate">Rohan Sharma</span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleQuickSignIn("operator")}
                    className="p-2.5 rounded-xl bg-white border border-[#E5EAF0] hover:border-[#075E54] hover:bg-[#DDF7ED]/40 text-left transition-all cursor-pointer shadow-2xs group disabled:opacity-50"
                  >
                    <span className="text-xs font-bold text-[#172B2A] group-hover:text-[#075E54] block truncate">
                      Fleet Partner Demo
                    </span>
                    <span className="text-[10px] text-[#718096] block truncate">Capt. Vikram Singh</span>
                  </button>
                </div>
              </div>

              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-[#E5EAF0]"></div>
                <span className="flex-shrink mx-2 text-[10px] font-medium text-[#718096] uppercase tracking-wider">
                  Or Sign In Manually
                </span>
                <div className="flex-grow border-t border-[#E5EAF0]"></div>
              </div>

              {/* Sign in / Sign up form */}
              <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-[#DDF7ED] border border-[#075E54]/20 flex items-start gap-2 text-xs text-[#075E54]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#075E54]" />
                  <span>{successMsg}</span>
                </div>
              )}

              {mode === "signup" && (
                <>
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-medium text-[#172B2A] mb-1.5">
                      Select Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRole("traveller")}
                        className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === "traveller"
                            ? "bg-[#075E54] text-white border-[#075E54] shadow-xs"
                            : "bg-[#F7F8FA] text-[#718096] border-[#E5EAF0] hover:text-[#172B2A]"
                        }`}
                      >
                        Traveller / Group
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole("operator")}
                        className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === "operator"
                            ? "bg-[#075E54] text-white border-[#075E54] shadow-xs"
                            : "bg-[#F7F8FA] text-[#718096] border-[#E5EAF0] hover:text-[#172B2A]"
                        }`}
                      >
                        Fleet Partner
                      </button>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-[#172B2A] mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#718096] absolute left-3 top-3" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rohan Sharma"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                      />
                    </div>
                  </div>

                  {/* Operator Business Name */}
                  {selectedRole === "operator" && (
                    <div>
                      <label className="block text-xs font-medium text-[#172B2A] mb-1">
                        Transport / Fleet Company Name
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-[#718096] absolute left-3 top-3" />
                        <input
                          type="text"
                          value={operatorName}
                          onChange={(e) => setOperatorName(e.target.value)}
                          placeholder="e.g. Rajputana Mobility Solutions"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-[#172B2A] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#718096] absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-[#172B2A] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#718096] absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#172B2A] focus:outline-none focus:border-[#075E54]"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white font-medium text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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
                  <p className="text-xs text-[#718096]">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setErrorMsg(null);
                      }}
                      className="text-[#075E54] font-medium hover:underline cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-[#718096]">
                    Already registered?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMsg(null);
                      }}
                      className="text-[#075E54] font-medium hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  </div>
);
}

