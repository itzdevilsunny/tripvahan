export type UserRole = "traveller" | "operator";

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: "traveller" | "operator" | "both";
  operator_name?: string;
  operator_code?: string;
  rating?: number;
  reviews_count?: number;
  verified?: boolean;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  operator_id: string;
  operator_name: string;
  name: string;
  category: "Urbania / Tempo" | "Innova Crysta" | "Coach / Minibus" | "Executive Sedan" | string;
  registration_number: string;
  seating_capacity: number;
  luggage_capacity: number;
  model_year: number;
  features: string[];
  compliance_status: string;
  speed_governor_status: string;
  status: "Available" | "On Trip" | "Maintenance";
  image_url?: string;
  created_at?: string;
}

export interface TripRequest {
  id: string;
  trip_code: string;
  traveler_id: string;
  traveler_name: string;
  circuit_title: string;
  origin: string;
  destination: string;
  stops: string[];
  circuit_type: "Multi-day circuit" | "Round Trip" | "One-Way Outstation" | string;
  distance_km: number;
  start_date: string;
  end_date?: string;
  duration: string;
  pickup_time: string;
  pickup_address: string;
  travellers_count: number;
  adults_count: number;
  seniors_count: number;
  luggage_bags: number;
  matched_vehicle_class: string;
  indicative_budget_min: number;
  indicative_budget_max: number;
  target_budget: number;
  amenities: string[];
  status: "open" | "bidding" | "confirmed" | "completed" | "cancelled";
  quotes_count: number;
  created_at?: string;
}

export interface Quotation {
  id: string;
  trip_request_id: string;
  trip_code: string;
  operator_id: string;
  operator_name: string;
  operator_rating: number;
  reviews_count: number;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_category: string;
  vehicle_reg: string;
  vehicle_image?: string;
  model_year: number;
  badge?: "Best Match • Tier-1 Partner" | "Best Economy Choice" | "Ultra Premium Class" | string;
  base_vehicle_fuel_rate: number;
  driver_night_allowance: number;
  tolls_state_permit_taxes: number;
  total_quote: number;
  per_person_fare: number;
  inclusions: string[];
  exclusions: string[];
  validity_hours: number;
  operator_note: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at?: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  trip_request_id: string;
  quotation_id: string;
  traveler_id: string;
  traveler_name: string;
  operator_name: string;
  vehicle_name: string;
  vehicle_reg: string;
  circuit_title: string;
  duration: string;
  total_amount: number;
  per_person_amount: number;
  escrow_status: "Rate Lock Guaranteed" | "Secured in Escrow" | "Released to Operator";
  journey_status: "Confirmed" | "Dispatched" | "Ongoing" | "Completed" | "Cancelled";
  contract_signed: boolean;
  pickup_date?: string;
  start_date?: string;
  return_date?: string;
  created_at?: string;
}
