import { supabase } from "./supabase";
import { Booking, Profile, Quotation, TripRequest, Vehicle } from "./types";

// Seed data based on live marketplace prototype shown in designs
const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: "veh_urb_01",
    operator_id: "op_rajputana",
    operator_name: "Rajputana Mobility Solutions",
    name: "Force Urbania Executive Class",
    category: "Urbania / Tempo",
    registration_number: "DL 01 TA 9821",
    seating_capacity: 13,
    luggage_capacity: 12,
    model_year: 2023,
    features: [
      "13 Luxury Recliners (2+1)",
      "Low-step Entry",
      "Individual USB Ports",
      "Dual AC",
      "Waterproof Carrier",
    ],
    compliance_status: "Commercial Yellow Board Valid",
    speed_governor_status: "Speed-Gov: 80 km/h Active",
    status: "Available",
    image_url:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "veh_tempo_01",
    operator_id: "op_ganesh",
    operator_name: "Shree Ganesh Roadlines",
    name: "Force Tempo Traveller AC (2021)",
    category: "Urbania / Tempo",
    registration_number: "RJ 14 PA 4421",
    seating_capacity: 17,
    luggage_capacity: 14,
    model_year: 2021,
    features: ["Pushback Seats", "Dual Blower AC", "Luggage Carrier", "Audio System"],
    compliance_status: "Commercial Yellow Board Valid",
    speed_governor_status: "Speed-Gov: 80 km/h Active",
    status: "Available",
    image_url:
      "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "veh_coach_01",
    operator_id: "op_ncr",
    operator_name: "NCR Tourist Coach Services",
    name: "BharatBenz AC Executive Coach (2023)",
    category: "Coach / Minibus",
    registration_number: "DL 01 EB 7744",
    seating_capacity: 19,
    luggage_capacity: 16,
    model_year: 2023,
    features: [
      "Air Suspension",
      "VIP Plush Seating",
      "Chiller Box",
      "Individual Reading Lights",
      "Rear Dedicated Boot",
    ],
    compliance_status: "Commercial Yellow Board Valid",
    speed_governor_status: "Speed-Gov: 80 km/h Active",
    status: "Available",
    image_url:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
  },
  {
    id: "veh_innova_01",
    operator_id: "op_rajputana",
    operator_name: "Rajputana Mobility Solutions",
    name: "Toyota Innova Crysta ZX 7-Seater",
    category: "Innova Crysta",
    registration_number: "DL 01 TA 3311",
    seating_capacity: 7,
    luggage_capacity: 5,
    model_year: 2024,
    features: ["Captain Seats", "Dual Climate AC", "All-India Permit", "Fastag"],
    compliance_status: "Commercial Yellow Board Valid",
    speed_governor_status: "Speed-Gov: 80 km/h Active",
    status: "Available",
    image_url:
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
  },
];

const INITIAL_TRIPS: TripRequest[] = [
  {
    id: "trp_9042",
    trip_code: "TRP-9042",
    traveler_id: "usr_rohan",
    traveler_name: "Rohan S.",
    circuit_title: "Delhi NCR → Agra → Jaipur",
    origin: "Delhi NCR",
    destination: "Jaipur",
    stops: [
      "New Delhi Pickup (Dwarka Sec 10)",
      "Agra Fort & Taj Mahal",
      "Fatehpur Sikri",
      "Amer Fort, Jaipur",
    ],
    circuit_type: "Multi-day circuit",
    distance_km: 680,
    start_date: "Oct 24, 2026",
    end_date: "Oct 27, 2026",
    duration: "3D / 2N",
    pickup_time: "06:30 AM",
    pickup_address: "Dwarka Sector 10, New Delhi",
    travellers_count: 12,
    adults_count: 10,
    seniors_count: 2,
    luggage_bags: 12,
    matched_vehicle_class: "Executive Minibus / Tempo Traveller",
    indicative_budget_min: 22000,
    indicative_budget_max: 26000,
    target_budget: 24500,
    amenities: [
      "Dual AC & Reclining Pushback Seats",
      "Waterproof Carrier Roof Rack",
      "Bilingual Driver (Hindi & English)",
    ],
    status: "bidding",
    quotes_count: 3,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "trp_8831",
    trip_code: "TRP-8831",
    traveler_id: "usr_priya",
    traveler_name: "Priya Malhotra",
    circuit_title: "Delhi ⇄ Haridwar & Rishikesh",
    origin: "Delhi NCR",
    destination: "Rishikesh",
    stops: [
      "Delhi Pickup (Vasant Kunj)",
      "Har Ki Pauri, Haridwar",
      "Ram Jhula, Rishikesh",
      "Triveni Ghat Aarti",
    ],
    circuit_type: "Round Trip",
    distance_km: 520,
    start_date: "Tomorrow, 05:00 AM",
    duration: "2 Days / 1 Night",
    pickup_time: "05:00 AM",
    pickup_address: "Pocket 2, Vasant Kunj, New Delhi",
    travellers_count: 6,
    adults_count: 6,
    seniors_count: 0,
    luggage_bags: 5,
    matched_vehicle_class: "Innova Crysta (6+1 / 7+1)",
    indicative_budget_min: 14000,
    indicative_budget_max: 18000,
    target_budget: 16000,
    amenities: ["AC", "Carrier", "Tolls Included"],
    status: "open",
    quotes_count: 0,
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: "trp_7109",
    trip_code: "TRP-7109",
    traveler_id: "usr_corporate",
    traveler_name: "Corporate Offsite",
    circuit_title: "IGI Airport T3 → Neemrana Fort",
    origin: "IGI Airport T3",
    destination: "Neemrana Fort",
    stops: ["IGI Airport Terminal 3", "Neemrana Fort Palace"],
    circuit_type: "One-Way Outstation",
    distance_km: 135,
    start_date: "Today, Immediate",
    duration: "Immediate Dispatch",
    pickup_time: "11:00 AM",
    pickup_address: "IGI Airport Terminal 3 Commercial Lane",
    travellers_count: 4,
    adults_count: 4,
    seniors_count: 0,
    luggage_bags: 6,
    matched_vehicle_class: "Premium Sedan / Innova",
    indicative_budget_min: 4200,
    indicative_budget_max: 5000,
    target_budget: 4500,
    amenities: ["Executive Comfort", "Express Highway Tolls"],
    status: "open",
    quotes_count: 0,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
];

const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: "quo_rajputana_01",
    trip_request_id: "trp_9042",
    trip_code: "TRP-9042",
    operator_id: "op_rajputana",
    operator_name: "Royal Rajputana Fleet Mobility",
    operator_rating: 4.92,
    reviews_count: 143,
    vehicle_id: "veh_urb_01",
    vehicle_name: "Force Urbania Executive Class",
    vehicle_category: "Urbania / Tempo",
    vehicle_reg: "DL 01 TA 9821",
    vehicle_image:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    model_year: 2023,
    badge: "Best Match • Tier-1 Partner",
    base_vehicle_fuel_rate: 18500,
    driver_night_allowance: 2000,
    tolls_state_permit_taxes: 4300,
    total_quote: 24800,
    per_person_fare: 2066,
    inclusions: [
      "750 km Fuel Included",
      "UP & RJ Border Permits Included",
      "Driver Night Bata Included",
      "FASTag Tolls Pre-paid",
      "Senior low-step stool",
    ],
    exclusions: ["Monument entry tickets", "Hotel overnight parking if charged"],
    validity_hours: 48,
    operator_note:
      "Namaste Rohan, sanitized 13-seater Urbania ready with senior-friendly low-step boarding and large rear boot.",
    status: "pending",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "quo_ganesh_01",
    trip_request_id: "trp_9042",
    trip_code: "TRP-9042",
    operator_id: "op_ganesh",
    operator_name: "Shree Ganesh Roadlines",
    operator_rating: 4.66,
    reviews_count: 82,
    vehicle_id: "veh_tempo_01",
    vehicle_name: "Force Tempo Traveller AC (2021)",
    vehicle_category: "Urbania / Tempo",
    vehicle_reg: "RJ 14 PA 4421",
    vehicle_image:
      "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80",
    model_year: 2021,
    badge: "Best Economy Choice",
    base_vehicle_fuel_rate: 16500,
    driver_night_allowance: 2000,
    tolls_state_permit_taxes: 3000,
    total_quote: 21500,
    per_person_fare: 1791,
    inclusions: ["Fuel for 700 km", "Driver night stay", "All highway tolls on route"],
    exclusions: [
      "Interstate border permits (approx ₹2,200) payable separately at RTO checkpoint by passenger",
    ],
    validity_hours: 48,
    operator_note:
      "Standard 17-seater Tempo with pushback seats. Highly experienced hill & highway driver.",
    status: "pending",
    created_at: new Date(Date.now() - 2800000).toISOString(),
  },
  {
    id: "quo_ncr_01",
    trip_request_id: "trp_9042",
    trip_code: "TRP-9042",
    operator_id: "op_ncr",
    operator_name: "NCR Tourist Coach Services",
    operator_rating: 4.98,
    reviews_count: 210,
    vehicle_id: "veh_coach_01",
    vehicle_name: "BharatBenz AC Executive Coach (2023)",
    vehicle_category: "Coach / Minibus",
    vehicle_reg: "DL 01 EB 7744",
    vehicle_image:
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    model_year: 2023,
    badge: "Ultra Premium Class",
    base_vehicle_fuel_rate: 21000,
    driver_night_allowance: 2000,
    tolls_state_permit_taxes: 5000,
    total_quote: 28000,
    per_person_fare: 2333,
    inclusions: [
      "Air Suspension Ride",
      "All border taxes & entry permits",
      "Chilled water bottles on board",
      "Driver Bata",
      "Zero extra surcharge",
    ],
    exclusions: ["Sightseeing guide charges", "Parking fee at monument grounds"],
    validity_hours: 48,
    operator_note:
      "Luxury VIP mini-coach with air-suspension for ultra-smooth travel across Rajasthan highways.",
    status: "pending",
    created_at: new Date(Date.now() - 1900000).toISOString(),
  },
];

const INITIAL_BOOKINGS: Booking[] = [];

// Local storage keys for persistent offline/fallback cache
const STORAGE_KEYS = {
  VEHICLES: "tripvahan_vehicles_live",
  TRIPS: "tripvahan_trips_live",
  QUOTES: "tripvahan_quotes_live",
  BOOKINGS: "tripvahan_bookings_live",
};

class DataService {
  private hasSupabaseTables: boolean | null = null;

  private getLocal<T>(key: string, fallback: T[]): T[] {
    if (typeof window === "undefined") return fallback;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return JSON.parse(stored);
    } catch {
      return fallback;
    }
  }

  private setLocal<T>(key: string, data: T[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn("Local storage write error:", e);
    }
  }

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
  async getTripRequests(): Promise<TripRequest[]> {
    if (this.hasSupabaseTables) {
      try {
        const { data, error } = await supabase
          .from("trip_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) return data as TripRequest[];
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to local store", err);
      }
    }
    return this.getLocal<TripRequest>(STORAGE_KEYS.TRIPS, INITIAL_TRIPS);
  }

  async getTripRequestById(id: string): Promise<TripRequest | null> {
    const list = await this.getTripRequests();
    return list.find((t) => t.id === id || t.trip_code === id) || null;
  }

  async createTripRequest(request: Omit<TripRequest, "id" | "trip_code" | "quotes_count" | "status">): Promise<TripRequest> {
    const randomCode = `TRP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTrip: TripRequest = {
      ...request,
      id: `trp_${Date.now()}`,
      trip_code: randomCode,
      status: "open",
      quotes_count: 0,
      created_at: new Date().toISOString(),
    };

    // Save locally
    const current = this.getLocal<TripRequest>(STORAGE_KEYS.TRIPS, INITIAL_TRIPS);
    const updated = [newTrip, ...current];
    this.setLocal(STORAGE_KEYS.TRIPS, updated);

    // Sync to Supabase if schema exists
    try {
      await supabase.from("trip_requests").insert([newTrip]);
    } catch (e) {
      console.warn("Supabase sync pending", e);
    }

    return newTrip;
  }

  // --- QUOTATIONS ---
  async getQuotations(tripRequestId?: string): Promise<Quotation[]> {
    let allQuotes: Quotation[] = [];
    if (this.hasSupabaseTables) {
      try {
        let query = supabase.from("quotations").select("*").order("total_quote", { ascending: true });
        if (tripRequestId) {
          query = query.eq("trip_request_id", tripRequestId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          allQuotes = data as Quotation[];
        }
      } catch (err) {
        console.warn("Supabase quote fetch failed", err);
      }
    }

    if (allQuotes.length === 0) {
      allQuotes = this.getLocal<Quotation>(STORAGE_KEYS.QUOTES, INITIAL_QUOTATIONS);
    }

    if (tripRequestId) {
      return allQuotes.filter((q) => q.trip_request_id === tripRequestId || q.trip_code === tripRequestId);
    }
    return allQuotes;
  }

  async submitQuotation(quoteData: Omit<Quotation, "id" | "status" | "created_at">): Promise<Quotation> {
    const newQuote: Quotation = {
      ...quoteData,
      id: `quo_${Date.now()}`,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Update local quotes
    const currentQuotes = this.getLocal<Quotation>(STORAGE_KEYS.QUOTES, INITIAL_QUOTATIONS);
    const updatedQuotes = [newQuote, ...currentQuotes];
    this.setLocal(STORAGE_KEYS.QUOTES, updatedQuotes);

    // Update trip's quotes_count and status to 'bidding'
    const trips = this.getLocal<TripRequest>(STORAGE_KEYS.TRIPS, INITIAL_TRIPS);
    const tripIndex = trips.findIndex(
      (t) => t.id === newQuote.trip_request_id || t.trip_code === newQuote.trip_code
    );
    if (tripIndex !== -1) {
      trips[tripIndex].quotes_count = (trips[tripIndex].quotes_count || 0) + 1;
      trips[tripIndex].status = "bidding";
      this.setLocal(STORAGE_KEYS.TRIPS, trips);
    }

    // Try Supabase insert
    try {
      await supabase.from("quotations").insert([newQuote]);
      if (tripIndex !== -1) {
        await supabase
          .from("trip_requests")
          .update({ quotes_count: trips[tripIndex].quotes_count, status: "bidding" })
          .eq("id", trips[tripIndex].id);
      }
    } catch (e) {
      console.warn("Supabase quote insert failed", e);
    }

    return newQuote;
  }

  // --- BOOKING CONFIRMATION ---
  async confirmBooking(quotationId: string): Promise<Booking> {
    const quotes = await this.getQuotations();
    const targetQuote = quotes.find((q) => q.id === quotationId);
    if (!targetQuote) throw new Error("Quotation not found");

    const trip = await this.getTripRequestById(targetQuote.trip_request_id);

    const booking: Booking = {
      id: `bkg_${Date.now()}`,
      booking_code: `BKG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      trip_request_id: targetQuote.trip_request_id,
      quotation_id: targetQuote.id,
      traveler_id: trip?.traveler_id || "usr_rohan",
      traveler_name: trip?.traveler_name || "Rohan S.",
      operator_name: targetQuote.operator_name,
      vehicle_name: targetQuote.vehicle_name,
      vehicle_reg: targetQuote.vehicle_reg,
      circuit_title: trip?.circuit_title || "Delhi NCR → Agra → Jaipur",
      duration: trip?.duration || "3D / 2N",
      total_amount: targetQuote.total_quote,
      per_person_amount: targetQuote.per_person_fare,
      escrow_status: "Secured in Escrow",
      journey_status: "Confirmed",
      contract_signed: true,
      pickup_date: trip?.start_date,
      created_at: new Date().toISOString(),
    };

    // Save booking
    const bookings = this.getLocal<Booking>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    this.setLocal(STORAGE_KEYS.BOOKINGS, [booking, ...bookings]);

    // Mark quote as accepted, others declined
    const updatedQuotes = quotes.map((q) => {
      if (q.trip_request_id === targetQuote.trip_request_id) {
        return {
          ...q,
          status: q.id === targetQuote.id ? ("accepted" as const) : ("declined" as const),
        };
      }
      return q;
    });
    this.setLocal(STORAGE_KEYS.QUOTES, updatedQuotes);

    // Mark trip as confirmed
    const trips = this.getLocal<TripRequest>(STORAGE_KEYS.TRIPS, INITIAL_TRIPS);
    const tripIdx = trips.findIndex((t) => t.id === targetQuote.trip_request_id);
    if (tripIdx !== -1) {
      trips[tripIdx].status = "confirmed";
      this.setLocal(STORAGE_KEYS.TRIPS, trips);
    }

    // Mark vehicle as 'On Trip'
    const vehicles = this.getLocal<Vehicle>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    const vIdx = vehicles.findIndex((v) => v.id === targetQuote.vehicle_id);
    if (vIdx !== -1) {
      vehicles[vIdx].status = "On Trip";
      this.setLocal(STORAGE_KEYS.VEHICLES, vehicles);
    }

    // Try Supabase write
    try {
      await supabase.from("bookings").insert([booking]);
      await supabase.from("quotations").update({ status: "accepted" }).eq("id", targetQuote.id);
      await supabase.from("trip_requests").update({ status: "confirmed" }).eq("id", targetQuote.trip_request_id);
      await supabase.from("vehicles").update({ status: "On Trip" }).eq("id", targetQuote.vehicle_id);
    } catch (e) {
      console.warn("Supabase booking sync", e);
    }

    return booking;
  }

  // --- VEHICLES ---
  async getVehicles(operatorId?: string): Promise<Vehicle[]> {
    let list: Vehicle[] = [];
    if (this.hasSupabaseTables) {
      try {
        let query = supabase.from("vehicles").select("*");
        if (operatorId) query = query.eq("operator_id", operatorId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) list = data as Vehicle[];
      } catch (err) {
        console.warn("Supabase vehicles fetch failed", err);
      }
    }

    if (list.length === 0) {
      list = this.getLocal<Vehicle>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    }

    if (operatorId) {
      return list.filter((v) => v.operator_id === operatorId);
    }
    return list;
  }

  async registerVehicle(vehicleData: Omit<Vehicle, "id" | "created_at">): Promise<Vehicle> {
    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `veh_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    const current = this.getLocal<Vehicle>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    const updated = [newVehicle, ...current];
    this.setLocal(STORAGE_KEYS.VEHICLES, updated);

    try {
      await supabase.from("vehicles").insert([newVehicle]);
    } catch (e) {
      console.warn("Supabase vehicle sync", e);
    }

    return newVehicle;
  }

  // --- BOOKINGS ---
  async getBookings(): Promise<Booking[]> {
    if (this.hasSupabaseTables) {
      try {
        const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
        if (!error && data && data.length > 0) return data as Booking[];
      } catch (err) {
        console.warn("Supabase bookings fetch failed", err);
      }
    }
    return this.getLocal<Booking>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
  }
}

export const dataService = new DataService();
