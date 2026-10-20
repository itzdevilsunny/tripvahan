import { supabase } from "./supabase";
import { Booking, Profile, Quotation, TripRequest, Vehicle } from "./types";

class DataService {
  /**
   * Helper method to obtain the current session's Bearer token
   * and configure standard HTTP headers.
   */
  private async getAuthHeaders(includeContentType: boolean = true): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (includeContentType) {
      headers["Content-Type"] = "application/json";
    }
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  // --- TRIP REQUESTS ---
  async getTripRequests(travelerId?: string): Promise<TripRequest[]> {
    try {
      const headers = await this.getAuthHeaders(false);
      const res = await fetch("/api/trips" + (travelerId ? `?traveler_id=${travelerId}` : ""), {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch (err) {
      console.warn("getTripRequests API fetch error:", err);
    }

    try {
      let query = supabase.from("trip_requests").select("*").order("created_at", { ascending: false });
      if (travelerId) {
        query = query.eq("traveler_id", travelerId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as TripRequest[];
      }
    } catch {
      // Continue
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
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Please sign in as a traveller to publish a trip request");
    }
    const res = await fetch("/api/trips", {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Failed to create trip request (HTTP ${res.status})`);
    }

    if (!json.data) {
      throw new Error("Invalid response from server during trip request creation");
    }

    return json.data;
  }

  // --- QUOTATIONS ---
  async getQuotations(tripRequestId?: string): Promise<Quotation[]> {
    try {
      const headers = await this.getAuthHeaders(false);
      const res = await fetch("/api/quotations" + (tripRequestId ? `?trip_request_id=${tripRequestId}` : ""), {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch (err) {
      console.warn("getQuotations API fetch error:", err);
    }

    try {
      let query = supabase.from("quotations").select("*").order("total_quote", { ascending: true });
      if (tripRequestId) {
        query = query.eq("trip_request_id", tripRequestId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Quotation[];
      }
    } catch {
      // Continue
    }

    return [];
  }

  async submitQuotation(quoteData: Omit<Quotation, "id" | "status" | "created_at">): Promise<Quotation> {
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Please sign in as a verified fleet operator to submit quotations");
    }

    const res = await fetch("/api/quotations", {
      method: "POST",
      headers,
      body: JSON.stringify(quoteData),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Quotation submission failed (HTTP ${res.status})`);
    }

    if (!json.data) {
      throw new Error("Invalid response format from server during quotation submission");
    }

    return json.data;
  }

  // --- VEHICLES ---
  async getVehicles(operatorId?: string): Promise<Vehicle[]> {
    try {
      const headers = await this.getAuthHeaders(false);
      const res = await fetch("/api/vehicles" + (operatorId ? `?operator_id=${operatorId}` : ""), {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch (err) {
      console.warn("getVehicles API fetch error:", err);
    }

    try {
      let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (operatorId) {
        query = query.eq("operator_id", operatorId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as Vehicle[];
      }
    } catch {
      // Continue
    }

    return [];
  }

  async registerVehicle(vehicleData: Omit<Vehicle, "id" | "status" | "created_at">): Promise<Vehicle> {
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Please sign in as an operator to register vehicles");
    }

    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers,
      body: JSON.stringify(vehicleData),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Vehicle registration failed (HTTP ${res.status})`);
    }

    if (!json.data) {
      throw new Error("Invalid response from server during vehicle registration");
    }

    return json.data;
  }

  // --- BOOKINGS ---
  async getBookings(travelerId?: string): Promise<Booking[]> {
    const headers = await this.getAuthHeaders(false);
    if (!headers["Authorization"]) {
      // Unauthenticated callers have no authorized booking records
      return [];
    }

    try {
      const res = await fetch("/api/bookings" + (travelerId ? `?traveler_id=${travelerId}` : ""), {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error(errJson.error || "Authentication required to access bookings");
        }
      }
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes("Authentication") ||
          err.message.includes("Forbidden") ||
          err.message.includes("Unauthorized"))
      ) {
        throw err;
      }
      console.warn("getBookings API fetch error:", err);
    }

    return [];
  }

  async confirmBooking(bookingData: Omit<Booking, "id" | "booking_code" | "created_at">): Promise<Booking> {
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Please sign in as a traveller to confirm this booking");
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers,
      body: JSON.stringify(bookingData),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Booking confirmation failed (HTTP ${res.status})`);
    }

    if (!json.data) {
      throw new Error("Invalid response from server during booking confirmation");
    }

    return json.data;
  }

  async cancelBooking(bookingId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Please sign in to cancel this booking");
    }

    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: bookingId, journey_status: "Cancelled" }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Cancellation failed with status ${res.status}`);
    }

    return true;
  }

  // --- ADMIN VERIFICATION ---
  async getAdminOperators(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders(false);
      if (!headers["Authorization"]) return [];

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
    const headers = await this.getAuthHeaders(true);
    if (!headers["Authorization"]) {
      throw new Error("Authentication required: Administrator session required");
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
