export type UserRole = "traveller" | "operator" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: "traveller" | "operator" | "both" | "admin";
  operator_name?: string;
  operator_code?: string;
  rating?: number;
  reviews_count?: number;
  verified?: boolean;
  rejection_reason?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  created_at?: string;
}

export interface ComplianceDocument {
  doc_type: "commercial_rc" | "tourist_permit" | "fitness_cert" | "commercial_insurance" | "puc_cert";
  title: string;
  doc_number: string;
  issuing_authority: string;
  expiry_date: string;
  verified: boolean;
  file_url?: string;
  notes?: string;
}

export interface VerificationAuditEntry {
  id: string;
  operator_id: string;
  operator_name: string;
  action: "approved" | "rejected" | "submitted";
  decided_by: string;
  decided_at: string;
  reason?: string;
  notes?: string;
}

export interface OperatorVerificationAudit {
  id: string;
  operator_id: string;
  operator_name: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  action: "approved" | "rejected" | "suspended" | "revoked";
  previous_state?: boolean;
  new_state: boolean;
  decision_reason?: string | null;
  notes?: string | null;
  correlation_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface OperatorDocument {
  id: string;
  operator_id: string;
  vehicle_id?: string | null;
  doc_type: "commercial_rc" | "tourist_permit" | "fitness_cert" | "commercial_insurance" | "puc_cert" | "driver_license" | "other";
  title: string;
  doc_number?: string | null;
  issuing_authority?: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: "pending" | "approved" | "rejected" | "expired";
  issue_date?: string | null;
  expiry_date?: string | null;
  reviewed_by?: string | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorVerificationDetail {
  profile: Profile;
  vehicles: Vehicle[];
  documents: ComplianceDocument[];
  auditHistory: VerificationAuditEntry[];
  verificationStatus: "verified" | "pending" | "rejected";
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
  operator_phone?: string;
  driver_phone?: string;
  pickup_date?: string;
  start_date?: string;
  return_date?: string;
  created_at?: string;
}
