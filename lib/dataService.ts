import { supabase } from "./supabase";
import { Booking, Profile, Quotation, TripRequest, Vehicle } from "./types";

class DataService {
  // --- TRIP REQUESTS ---
  async getTripRequests(travelerId?: string): Promise<TripRequest[]> {
    try {
      let query = supabase.from("trip_requests").select("*").order("created_at", { ascending: false });
      if (travelerId) {
        query = query.eq("traveler_id", travelerId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as TripRequest[];
      }
    } catch (err) {
      console.warn("Supabase trip_requests fetch:", err);
    }

    // Try API route
    try {
      const res = await fetch("/api/trips" + (travelerId ? `?traveler_id=${travelerId}` : ""));
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch {
      // API route unreachable
    }

    return [];
  }

  async getTripRequestById(id: string): Promise<TripRequest | null> {
    try {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("*")
        .or(`id.eq.${id},trip_code.eq.${id}`)
        .maybeSingle();
      if (!error && data) return data as TripRequest;
    } catch {
      // Continue
    }

    const all = await this.getTripRequests();
    return all.find((t) => t.id === id || t.trip_code === id) || null;
  }

  async createTripRequest(
    request: Omit<TripRequest, "id" | "trip_code" | "quotes_count" | "status">
  ): Promise<TripRequest> {
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // fallback to direct supabase insert
    }

    const tripCode = `TRP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTrip: TripRequest = {
      ...request,
      id: `trp_${Date.now()}`,
      trip_code: tripCode,
      status: "open",
      quotes_count: 0,
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("trip_requests").insert([newTrip]);
    } catch (e) {
      console.warn("Direct Supabase insert:", e);
    }

    return newTrip;
  }

  // --- QUOTATIONS ---
  async getQuotations(tripRequestId?: string): Promise<Quotation[]> {
    try {
      let query = supabase.from("quotations").select("*").order("total_quote", { ascending: true });
      if (tripRequestId) {
        query = query.eq("trip_request_id", tripRequestId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Quotation[];
      }
    } catch (err) {
      console.warn("Supabase quotations fetch:", err);
    }

    try {
      const res = await fetch("/api/quotations" + (tripRequestId ? `?trip_request_id=${tripRequestId}` : ""));
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch {
      // Continue
    }

    return [];
  }

  async submitQuotation(quoteData: Omit<Quotation, "id" | "status" | "created_at">): Promise<Quotation> {
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const errJson = await res.json();
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    } catch (e: any) {
      if (e.message && !e.message.includes("fetch")) throw e;
    }

    const newQuote: Quotation = {
      ...quoteData,
      id: `quo_${Date.now()}`,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("quotations").insert([newQuote]);
    } catch (e) {
      console.warn("Direct Supabase quote insert:", e);
    }

    return newQuote;
  }

  // --- VEHICLES ---
  async getVehicles(operatorId?: string): Promise<Vehicle[]> {
    try {
      let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (operatorId) {
        query = query.eq("operator_id", operatorId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Vehicle[];
      }
    } catch (err) {
      console.warn("Supabase vehicles fetch:", err);
    }

    try {
      const res = await fetch("/api/vehicles" + (operatorId ? `?operator_id=${operatorId}` : ""));
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch {
      // Continue
    }

    return [];
  }

  async registerVehicle(vehicleData: Omit<Vehicle, "id" | "status" | "created_at">): Promise<Vehicle> {
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleData),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const errJson = await res.json();
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    } catch (e: any) {
      if (e.message && !e.message.includes("fetch")) throw e;
    }

    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `veh_${Date.now()}`,
      status: "Available",
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("vehicles").insert([newVehicle]);
    } catch (e) {
      console.warn("Direct Supabase vehicle insert:", e);
    }

    return newVehicle;
  }

  // --- BOOKINGS ---
  async getBookings(travelerId?: string): Promise<Booking[]> {
    try {
      let query = supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (travelerId) {
        query = query.eq("traveler_id", travelerId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Booking[];
      }
    } catch (err) {
      console.warn("Supabase bookings fetch:", err);
    }

    try {
      const res = await fetch("/api/bookings" + (travelerId ? `?traveler_id=${travelerId}` : ""));
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch {
      // Continue
    }

    return [];
  }

  async confirmBooking(bookingData: Omit<Booking, "id" | "booking_code" | "created_at">): Promise<Booking> {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      const errJson = await res.json();
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    } catch (e: any) {
      if (e.message && !e.message.includes("fetch")) throw e;
    }

    const bookingCode = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newBooking: Booking = {
      ...bookingData,
      id: `bk_${Date.now()}`,
      booking_code: bookingCode,
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("bookings").insert([newBooking]);
    } catch (e) {
      console.warn("Direct Supabase booking insert:", e);
    }

    return newBooking;
  }

  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      // Resolve caller's auth token to authenticate with the server-side API
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: bookingId, journey_status: "Cancelled" }),
      });

      if (res.ok) return true;

      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Cancellation failed with status ${res.status}`);
    } catch (err: any) {
      console.error("Secure cancelBooking failed:", err);
      // NOTE: Direct client-side Supabase update fallback has been permanently removed
      // to ensure all cancellations execute atomic cascades and enforce server-side ownership.
      throw err;
    }
  }

  // --- ADMIN VERIFICATION ---
  async getAdminOperators(): Promise<any[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/operators", { headers });
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch (err) {
      console.warn("getAdminOperators failed:", err);
    }
    return [];
  }

  async reviewOperator(
    operatorId: string,
    action: "approve" | "reject",
    reason?: string,
    notes?: string
  ): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers,
      body: JSON.stringify({
        operator_id: operatorId,
        action,
        reason,
        notes,
      }),
    });
    return await res.json();
  }
}

export const dataService = new DataService();
