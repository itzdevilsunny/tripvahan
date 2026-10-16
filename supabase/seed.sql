-- ====================================================================
-- TRIPVAHAN SEED DATA FOR SUPABASE
-- Run this in your Supabase SQL Editor after running schema.sql
-- ====================================================================

-- 1. Seed Profiles
INSERT INTO public.profiles (id, full_name, email, phone, role, operator_name, operator_code, rating, reviews_count, verified)
VALUES
  ('usr_rohan', 'Rohan Sharma', 'rohan.sharma@example.com', '+91 98112 34567', 'traveller', NULL, NULL, 5.0, 3, true),
  ('op_rajputana', 'Capt. Vikram Singh', 'vikram@rajputanamobility.com', '+91 98290 88776', 'operator', 'Rajputana Mobility Solutions', 'DL-OP-409', 4.92, 143, true),
  ('op_ganesh', 'Ganesh Khandelwal', 'ganesh@shreeganeshroads.in', '+91 94140 12345', 'operator', 'Shree Ganesh Roadlines', 'RJ-OP-112', 4.66, 82, true),
  ('op_ncr', 'Harpreet Singh', 'harpreet@ncrtourist.com', '+91 99100 55432', 'operator', 'NCR Tourist Coach Services', 'DL-OP-890', 4.98, 210, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Vehicles
INSERT INTO public.vehicles (id, operator_id, operator_name, name, category, registration_number, seating_capacity, luggage_capacity, model_year, features, compliance_status, speed_governor_status, status, image_url)
VALUES
  ('veh_urb_01', 'op_rajputana', 'Rajputana Mobility Solutions', 'Force Urbania Executive Class', 'Urbania / Tempo', 'DL 01 TA 9821', 13, 12, 2023, 
   ARRAY['13 Luxury Recliners (2+1)', 'Low-step Entry', 'Individual USB Ports', 'Dual AC', 'Waterproof Carrier'], 
   'Commercial Yellow Board Valid', 'Speed-Gov: 80 km/h Active', 'Available', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'),
  ('veh_tempo_01', 'op_ganesh', 'Shree Ganesh Roadlines', 'Force Tempo Traveller AC 17-Seater', 'Urbania / Tempo', 'RJ 14 PA 4421', 17, 14, 2021, 
   ARRAY['Pushback Seats', 'Dual Blower AC', 'Luggage Carrier', 'Audio System'], 
   'Commercial Yellow Board Valid', 'Speed-Gov: 80 km/h Active', 'Available', 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80'),
  ('veh_coach_01', 'op_ncr', 'NCR Tourist Coach Services', 'BharatBenz AC Executive Coach', 'Coach / Minibus', 'DL 01 EB 7744', 19, 16, 2023, 
   ARRAY['Air Suspension', 'VIP Plush Seating', 'Chiller Box', 'Individual Reading Lights', 'Rear Dedicated Boot'], 
   'Commercial Yellow Board Valid', 'Speed-Gov: 80 km/h Active', 'Available', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'),
  ('veh_innova_01', 'op_rajputana', 'Rajputana Mobility Solutions', 'Toyota Innova Crysta ZX 7-Seater', 'Innova Crysta', 'DL 01 TA 3311', 7, 5, 2024, 
   ARRAY['Captain Seats', 'Dual Climate AC', 'All-India Permit', 'Fastag'], 
   'Commercial Yellow Board Valid', 'Speed-Gov: 80 km/h Active', 'Available', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Trip Requests
INSERT INTO public.trip_requests (id, trip_code, traveler_id, traveler_name, circuit_title, origin, destination, stops, circuit_type, distance_km, start_date, end_date, duration, pickup_time, pickup_address, travellers_count, adults_count, seniors_count, luggage_bags, matched_vehicle_class, indicative_budget_min, indicative_budget_max, target_budget, amenities, status, quotes_count)
VALUES
  ('trp_9042', 'TRP-9042', 'usr_rohan', 'Rohan Sharma', 'Delhi → Agra → Jaipur (Golden Triangle)', 'Delhi NCR', 'Jaipur', 
   '["New Delhi Pickup", "Agra Fort & Taj Mahal", "Fatehpur Sikri", "Amer Fort, Jaipur"]'::jsonb, 
   'Multi-day circuit', 680, '2026-10-24', '2026-10-27', '3D / 2N', '06:30 AM', 'Dwarka Sector 10, New Delhi', 12, 10, 2, 12, 
   'Executive Minibus / Tempo Traveller (12-16 Seater)', 22000, 26000, 24500, 
   ARRAY['Dual AC & Reclining Pushback Seats', 'Waterproof Carrier Roof Rack', 'Bilingual Driver (Hindi & English)'], 
   'bidding', 3),
  ('trp_8831', 'TRP-8831', 'usr_priya', 'Priya Malhotra', 'Delhi ⇄ Haridwar & Rishikesh Pilgrimage', 'Delhi NCR', 'Rishikesh', 
   '["Delhi Pickup", "Har Ki Pauri, Haridwar", "Ram Jhula, Rishikesh", "Triveni Ghat Aarti"]'::jsonb, 
   'Round Trip', 520, '2026-10-21', '2026-10-22', '2D / 1N', '05:00 AM', 'Vasant Kunj, New Delhi', 6, 6, 0, 5, 
   'Innova Crysta (6+1 / 7+1)', 14000, 18000, 16500, 
   ARRAY['AC', 'Hindi Speaking Driver', 'Carrier'], 
   'open', 0),
  ('trp_7109', 'TRP-7109', 'usr_corporate', 'Neeraj Verma (Corporate)', 'IGI Airport T3 → Neemrana Fort Offsite', 'IGI Airport T3', 'Neemrana Fort', 
   '["Terminal 3 Corporate Gate", "Neemrana Fort Palace"]'::jsonb, 
   'One-Way Outstation', 135, '2026-10-20', '2026-10-20', 'Immediate Dispatch', '11:00 AM', 'Indira Gandhi International Airport T3', 4, 4, 0, 6, 
   'Premium Sedan / Innova', 4200, 5000, 4800, 
   ARRAY['Executive Comfort', 'Luggage Boot', 'Express Highway Tolls Included'], 
   'open', 0)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Quotations for TRP-9042
INSERT INTO public.quotations (id, trip_request_id, trip_code, operator_id, operator_name, operator_rating, reviews_count, vehicle_id, vehicle_name, vehicle_category, vehicle_reg, vehicle_image, model_year, badge, base_vehicle_fuel_rate, driver_night_allowance, tolls_state_permit_taxes, total_quote, per_person_fare, inclusions, exclusions, validity_hours, operator_note, status)
VALUES
  ('quo_rajputana_01', 'trp_9042', 'TRP-9042', 'op_rajputana', 'Royal Rajputana Fleet Mobility', 4.92, 143, 'veh_urb_01', 'Force Urbania Executive Class', 'Urbania / Tempo', 'DL 01 TA 9821', 
   'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80', 2023, 'Best Match • Tier-1 Partner', 
   18500, 2000, 4300, 24800, 2066, 
   ARRAY['750 km Fuel Included', 'UP & RJ Border Permits Included', 'Driver Night Bata Included', 'FASTag Tolls Pre-paid', 'Dual AC running full trip', 'Senior low-step stool'], 
   ARRAY['Monument entry tickets', 'Hotel overnight parking if charged'], 
   48, 'Namaste Rohan, sanitized 13-seater Urbania ready with senior-friendly low-step boarding and large rear boot.', 'pending'),

  ('quo_ganesh_01', 'trp_9042', 'TRP-9042', 'op_ganesh', 'Shree Ganesh Roadlines', 4.66, 82, 'veh_tempo_01', 'Force Tempo Traveller AC (2021)', 'Urbania / Tempo', 'RJ 14 PA 4421', 
   'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80', 2021, 'Best Economy Choice', 
   16500, 2000, 3000, 21500, 1791, 
   ARRAY['Fuel for 700 km', 'Driver night stay', 'All highway tolls on route'], 
   ARRAY['Interstate border permits (approx ₹2,200) payable separately at RTO checkpoint by passenger'], 
   48, 'Standard 17-seater Tempo with pushback seats. Highly experienced hill & highway driver.', 'pending'),

  ('quo_ncr_01', 'trp_9042', 'TRP-9042', 'op_ncr', 'NCR Tourist Coach Services', 4.98, 210, 'veh_coach_01', 'BharatBenz AC Executive Coach (2023)', 'Coach / Minibus', 'DL 01 EB 7744', 
   'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80', 2023, 'Ultra Premium Class', 
   21000, 2000, 5000, 28000, 2333, 
   ARRAY['Air Suspension Ride', 'All border taxes & entry permits', 'Chilled water bottles on board', 'Driver Bata', 'Zero extra surcharge'], 
   ARRAY['Sightseeing guide charges', 'Parking fee at monument grounds'], 
   48, 'Luxury VIP mini-coach with air-suspension for ultra-smooth travel across Rajasthan highways.', 'pending')
ON CONFLICT (id) DO NOTHING;
