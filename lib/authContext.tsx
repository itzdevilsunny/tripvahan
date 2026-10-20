"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Profile, UserRole } from "./types";

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, operatorName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  switchActiveRole: (newRole: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>("traveller");
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userMeta?: any) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
        if (data.role === "operator" || data.role === "traveller" || data.role === "admin") {
          setRole(data.role as UserRole);
        }
      } else {
        const isOperator = (userMeta?.role as UserRole) === "operator";
        const fallbackRole: UserRole = isOperator ? "operator" : "traveller";
        const fallbackProfile: Profile = {
          id: userId,
          full_name: userMeta?.full_name || userMeta?.name || "User",
          email: userMeta?.email || "",
          role: fallbackRole,
          operator_name: isOperator ? userMeta?.operator_name : undefined,
          verified: false,
          created_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        setRole(fallbackRole);
      }
    } catch {
      // In case Supabase schema is not yet executed
      setProfile(null);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id, currentUser.user_metadata);
      }
      setLoading(false);
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id, currentUser.user_metadata);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    chosenRole: UserRole,
    operatorName?: string
  ): Promise<{ error: string | null }> => {
    // Security restriction: Platform administrator privileges cannot be self-registered
    if (chosenRole === "admin") {
      return {
        error: "Security violation: Platform administrator accounts cannot be self-registered or created via public registration.",
      };
    }

    const safeRole: UserRole = chosenRole === "operator" ? "operator" : "traveller";

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: safeRole,
            operator_name: safeRole === "operator" ? (operatorName || null) : null,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // Attempt to create or upsert profile in public.profiles with safe role & unverified operator status
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            email,
            role: safeRole,
            operator_name: safeRole === "operator" ? (operatorName || null) : null,
            verified: false, // Security: All new operators require platform admin approval before quoting
            rating: safeRole === "operator" ? 4.90 : 5.0,
            reviews_count: 0,
          });
        } catch {
          // Ignore if table not yet created
        }
        await fetchProfile(data.user.id, {
          full_name: fullName,
          role: safeRole,
          operator_name: safeRole === "operator" ? operatorName : undefined,
          email,
        });
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to sign up" };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        await fetchProfile(data.user.id, data.user.user_metadata);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to sign in" };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole("traveller");
  };

  const switchActiveRole = (newRole: UserRole) => {
    setRole(newRole);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.user_metadata);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        signUp,
        signIn,
        signOut,
        switchActiveRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
