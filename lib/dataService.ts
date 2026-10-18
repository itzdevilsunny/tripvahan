import { supabase } from "./supabase";
import { Booking, Profile, Quotation, TripRequest, Vehicle } from "./types";

class DataService {
  private hasSupabaseTables: boolean | null = null;

  async checkSupabaseConnection(): Promise<{ connected: boolean; hasTables: boolean; message: string }> {
    try {
      const { error } = await supabase.from("trip_requests").select("id").limit(1);
      if (error) {
        if (error.code === "PGRST205") {
          this.hasSupabaseTables = false;
          return {
            connected: true,
            hasTables: false,
            message: "Connected to Supabase project. SQL Schema pending execution in Supabase SQL Editor.",
          };
        }
        return {
          connected: false,
          hasTables: false,
          message: error.message || "Failed to query Supabase",
        };
      }
      this.hasSupabaseTables = true;
      return {
        connected: true,
        hasTables: true,
        message: "Live Supabase PostgreSQL connection active and synchronized!",
      };
    } catch (e: any) {
      return { connected: false, hasTables: false, message: e.message };
    }
  }

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
}

export const dataService = new DataService();
