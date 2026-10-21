export type AiEngine = "groq_live" | "gemini_live" | "corridor_benchmark";

export interface VehicleRecommendation {
  category: string;
  name: string;
  pax_capacity: number;
  luggage_capacity: number;
  is_recommended: boolean;
  tier_tag: "Recommended" | "Budget Option" | "Spacious Alternative" | "Luxury Upgrade";
  suitability_reason: string;
  estimated_cost: number;
}

export interface IndicativeBudgetBreakdown {
  billable_km: number;
  per_km_rate: number;
  base_vehicle_cost: number;
  driver_allowance: number;
  state_permits_tolls: number;
  indicative_total: number;
  indicative_min: number;
  indicative_max: number;
  target_budget: number;
  budget_status: "within_budget" | "below_budget" | "above_budget" | "unspecified";
  budget_comparison_note: string;
}

export interface RouteIntelligence {
  distance_km: number;
  duration_hours: number;
  formatted_travel_time: string;
  source: "osrm_routing" | "corridor_benchmark" | "unavailable";
  source_label: string;
  retrieval_timestamp: string;
  intermediate_stops: string[];
}

export interface CorridorBenchmark {
  origin: string;
  destination: string;
  defaultStops: string[];
  distanceKm: number;
  durationHours: number;
  baseBudgetSedan: number;
  baseBudgetSuv: number;
  baseBudgetTempo: number;
}

export const KNOWN_CORRIDORS: Record<string, CorridorBenchmark> = {
  "delhi-manali": {
    origin: "Delhi NCR",
    destination: "Manali",
    defaultStops: ["Chandigarh", "Kullu Valley"],
    distanceKm: 1150,
    durationHours: 24,
    baseBudgetSedan: 18000,
    baseBudgetSuv: 24000,
    baseBudgetTempo: 38000,
  },
  "delhi-jaipur": {
    origin: "Delhi NCR",
    destination: "Jaipur",
    defaultStops: ["Neemrana Fort", "Amer Fort"],
    distanceKm: 560,
    durationHours: 10,
    baseBudgetSedan: 9500,
    baseBudgetSuv: 14000,
    baseBudgetTempo: 22000,
  },
  "delhi-agra": {
    origin: "Delhi NCR",
    destination: "Agra",
    defaultStops: ["Mathura / Vrindavan", "Taj Mahal"],
    distanceKm: 480,
    durationHours: 8,
    baseBudgetSedan: 8000,
    baseBudgetSuv: 12000,
    baseBudgetTempo: 18000,
  },
  "delhi-rishikesh": {
    origin: "Delhi NCR",
    destination: "Rishikesh",
    defaultStops: ["Haridwar Ghats", "Triveni Ghat"],
    distanceKm: 520,
    durationHours: 11,
    baseBudgetSedan: 9000,
    baseBudgetSuv: 13500,
    baseBudgetTempo: 20000,
  },
  "delhi-shimla": {
    origin: "Delhi NCR",
    destination: "Shimla",
    defaultStops: ["Pinjore Gardens", "Kalka"],
    distanceKm: 720,
    durationHours: 14,
    baseBudgetSedan: 12000,
    baseBudgetSuv: 17500,
    baseBudgetTempo: 28000,
  },
  "delhi-chandigarh": {
    origin: "Delhi NCR",
    destination: "Chandigarh",
    defaultStops: ["Karnal Lake", "Kurukshetra"],
    distanceKm: 500,
    durationHours: 9,
    baseBudgetSedan: 7000,
    baseBudgetSuv: 10500,
    baseBudgetTempo: 16000,
  },
  "delhi-amritsar": {
    origin: "Delhi NCR",
    destination: "Amritsar",
    defaultStops: ["Murthal", "Jalandhar"],
    distanceKm: 920,
    durationHours: 16,
    baseBudgetSedan: 13000,
    baseBudgetSuv: 18000,
    baseBudgetTempo: 28000,
  },
  "delhi-dharamshala": {
    origin: "Delhi NCR",
    destination: "Dharamshala",
    defaultStops: ["Kangra Valley", "McLeodganj"],
    distanceKm: 980,
    durationHours: 19,
    baseBudgetSedan: 15000,
    baseBudgetSuv: 21000,
    baseBudgetTempo: 32000,
  },
  "delhi-nainital": {
    origin: "Delhi NCR",
    destination: "Nainital",
    defaultStops: ["Moradabad", "Kathgodam"],
    distanceKm: 640,
    durationHours: 14,
    baseBudgetSedan: 11000,
    baseBudgetSuv: 15500,
    baseBudgetTempo: 24000,
  },
  "delhi-mussoorie": {
    origin: "Delhi NCR",
    destination: "Mussoorie",
    defaultStops: ["Dehradun", "Kempty Falls"],
    distanceKm: 610,
    durationHours: 13,
    baseBudgetSedan: 10500,
    baseBudgetSuv: 15000,
    baseBudgetTempo: 23000,
  },
  "bangalore-ooty": {
    origin: "Bangalore",
    destination: "Ooty",
    defaultStops: ["Mysore Palace", "Bandipur National Park"],
    distanceKm: 580,
    durationHours: 12,
    baseBudgetSedan: 11000,
    baseBudgetSuv: 16000,
    baseBudgetTempo: 26000,
  },
  "bangalore-mysore": {
    origin: "Bangalore",
    destination: "Mysore",
    defaultStops: ["Ramanagara", "Srirangapatna"],
    distanceKm: 300,
    durationHours: 6,
    baseBudgetSedan: 5500,
    baseBudgetSuv: 8000,
    baseBudgetTempo: 12500,
  },
  "bangalore-coorg": {
    origin: "Bangalore",
    destination: "Coorg",
    defaultStops: ["Kushalnagar", "Madikeri"],
    distanceKm: 520,
    durationHours: 11,
    baseBudgetSedan: 10000,
    baseBudgetSuv: 14500,
    baseBudgetTempo: 23000,
  },
  "mumbai-pune": {
    origin: "Mumbai",
    destination: "Pune",
    defaultStops: ["Lonavala Expressway", "Khandala"],
    distanceKm: 300,
    durationHours: 6,
    baseBudgetSedan: 5000,
    baseBudgetSuv: 7500,
    baseBudgetTempo: 12000,
  },
  "mumbai-goa": {
    origin: "Mumbai",
    destination: "Goa",
    defaultStops: ["Lonavala", "Kolhapur"],
    distanceKm: 1180,
    durationHours: 22,
    baseBudgetSedan: 19000,
    baseBudgetSuv: 26000,
    baseBudgetTempo: 42000,
  },
  "jaipur-udaipur": {
    origin: "Jaipur",
    destination: "Udaipur",
    defaultStops: ["Ajmer Sharif", "Pushkar Lake"],
    distanceKm: 790,
    durationHours: 13,
    baseBudgetSedan: 12000,
    baseBudgetSuv: 17000,
    baseBudgetTempo: 26000,
  },
};

export function matchVehicleClass(pax: number, bags: number): string {
  if (pax <= 4 && bags <= 3) return "Executive Sedan (Dzire / Etios)";
  if (pax <= 7 && bags <= 6) return "Innova Crysta / Premium SUV (6+1 / 7+1)";
  if (pax <= 16 && bags <= 14) return "Force Urbania / Tempo (12-16 Seater)";
  return "BharatBenz Executive Coach (19-26 Seater)";
}

// LAYER 3: Deterministic multi-tier vehicle suitability engine
export function evaluateVehicleSuitability(
  pax: number,
  bags: number,
  days: number,
  distanceKm: number,
  origin: string = "",
  destination: string = ""
): {
  recommendations: VehicleRecommendation[];
  primaryVehicle: string;
  luggageWarning: string | null;
} {
  const safePax = Math.max(1, pax);
  const safeBags = Math.max(0, bags);

  const sedanBudget = calculateIndicativeBudget(distanceKm, days, "Executive Sedan", 0, origin, destination).indicative_total;
  const suvBudget = calculateIndicativeBudget(distanceKm, days, "Innova Crysta", 0, origin, destination).indicative_total;
  const tempoBudget = calculateIndicativeBudget(distanceKm, days, "Urbania / Tempo", 0, origin, destination).indicative_total;
  const coachBudget = calculateIndicativeBudget(distanceKm, days, "Coach", 0, origin, destination).indicative_total;

  const recommendations: VehicleRecommendation[] = [];
  let primaryVehicle = "Force Urbania / Tempo (12-16 Seater)";
  let luggageWarning: string | null = null;

  if (safePax <= 4) {
    if (safeBags <= 3) {
      primaryVehicle = "Executive Sedan (Dzire / Etios)";
      recommendations.push({
        category: "Executive Sedan",
        name: "Maruti Dzire / Toyota Etios",
        pax_capacity: 4,
        luggage_capacity: 3,
        is_recommended: true,
        tier_tag: "Recommended",
        suitability_reason: "Optimal match for up to 4 travellers with light luggage. Fuel-efficient and cost-effective.",
        estimated_cost: sedanBudget,
      });
      recommendations.push({
        category: "Innova Crysta / Premium SUV",
        name: "Toyota Innova Crysta (6+1 / 7+1)",
        pax_capacity: 7,
        luggage_capacity: 6,
        is_recommended: false,
        tier_tag: "Spacious Alternative",
        suitability_reason: "Provides superior legroom and expanded boot space for long-distance highway comfort.",
        estimated_cost: suvBudget,
      });
      recommendations.push({
        category: "Urbania / Tempo",
        name: "Force Urbania Luxury (10-12 Seater)",
        pax_capacity: 12,
        luggage_capacity: 12,
        is_recommended: false,
        tier_tag: "Luxury Upgrade",
        suitability_reason: "Executive corporate format with wide captain pushback chairs and panoramic windows.",
        estimated_cost: tempoBudget,
      });
    } else {
      // 4 or fewer pax, but > 3 bags (e.g. 3 travellers with 8 bags)
      primaryVehicle = safeBags > 6 ? "Force Urbania / Tempo (12-16 Seater)" : "Innova Crysta / Premium SUV (6+1 / 7+1)";
      luggageWarning = safeBags > 6
        ? `${safeBags} luggage bags exceed typical SUV trunk limits; Tempo or overhead carrier rack ensures comfortable passenger seating without clutter.`
        : `${safeBags} bags exceed sedan trunk capacity; SUV or carrier rack recommended.`;

      if (safeBags > 6) {
        recommendations.push({
          category: "Urbania / Tempo",
          name: "Force Urbania / Tempo (12-16 Seater)",
          pax_capacity: 16,
          luggage_capacity: 14,
          is_recommended: true,
          tier_tag: "Recommended",
          suitability_reason: `Recommended because ${safeBags} bags will overcrowd a car trunk. Generous interior accommodates all luggage securely.`,
          estimated_cost: tempoBudget,
        });
        recommendations.push({
          category: "Innova Crysta / Premium SUV",
          name: "Toyota Innova Crysta (6+1 / 7+1)",
          pax_capacity: 7,
          luggage_capacity: 6,
          is_recommended: false,
          tier_tag: "Spacious Alternative",
          suitability_reason: `Accommodates ${safePax} passengers easily, but ${safeBags} bags will require an external waterproof roof rack.`,
          estimated_cost: suvBudget,
        });
        recommendations.push({
          category: "Executive Sedan",
          name: "Maruti Dzire / Toyota Etios",
          pax_capacity: 4,
          luggage_capacity: 3,
          is_recommended: false,
          tier_tag: "Budget Option",
          suitability_reason: `Passenger seating is adequate for ${safePax}, but trunk capacity (3 bags max) cannot fit ${safeBags} luggage bags.`,
          estimated_cost: sedanBudget,
        });
      } else {
        recommendations.push({
          category: "Innova Crysta / Premium SUV",
          name: "Toyota Innova Crysta (6+1 / 7+1)",
          pax_capacity: 7,
          luggage_capacity: 6,
          is_recommended: true,
          tier_tag: "Recommended",
          suitability_reason: `Seats ${safePax} travellers comfortably while handling ${safeBags} bags in the rear compartment.`,
          estimated_cost: suvBudget,
        });
        recommendations.push({
          category: "Urbania / Tempo",
          name: "Force Urbania / Tempo (12-16 Seater)",
          pax_capacity: 16,
          luggage_capacity: 14,
          is_recommended: false,
          tier_tag: "Spacious Alternative",
          suitability_reason: "Maximum legroom and luggage volume without using external roof carriers.",
          estimated_cost: tempoBudget,
        });
        recommendations.push({
          category: "Executive Sedan",
          name: "Maruti Dzire / Toyota Etios",
          pax_capacity: 4,
          luggage_capacity: 3,
          is_recommended: false,
          tier_tag: "Budget Option",
          suitability_reason: `Trunk capacity is restricted to 3 medium bags; excess luggage would intrude into passenger seating.`,
          estimated_cost: sedanBudget,
        });
      }
    }
  } else if (safePax <= 7) {
    if (safeBags <= 6) {
      primaryVehicle = "Innova Crysta / Premium SUV (6+1 / 7+1)";
      recommendations.push({
        category: "Innova Crysta / Premium SUV",
        name: "Toyota Innova Crysta (6+1 / 7+1)",
        pax_capacity: 7,
        luggage_capacity: 6,
        is_recommended: true,
        tier_tag: "Recommended",
        suitability_reason: `Perfect family fit for ${safePax} passengers with balanced luggage space and superior hill suspension.`,
        estimated_cost: suvBudget,
      });
      recommendations.push({
        category: "Urbania / Tempo",
        name: "Force Urbania / Tempo (12-16 Seater)",
        pax_capacity: 16,
        luggage_capacity: 14,
        is_recommended: false,
        tier_tag: "Spacious Alternative",
        suitability_reason: "High-roof vehicle allowing adults to stand and walk inside, with individual reclining pushback seats.",
        estimated_cost: tempoBudget,
      });
      recommendations.push({
        category: "Urbania / Tempo",
        name: "Force Urbania Luxury (10 Seater)",
        pax_capacity: 10,
        luggage_capacity: 10,
        is_recommended: false,
        tier_tag: "Luxury Upgrade",
        suitability_reason: "VIP executive setup featuring plush recliner chairs and dedicated rear boot.",
        estimated_cost: tempoBudget + 4000,
      });
    } else {
      primaryVehicle = "Force Urbania / Tempo (12-16 Seater)";
      luggageWarning = `${safeBags} bags with ${safePax} passengers will overcrowd an SUV boot; Tempo Traveller ensures cabin comfort.`;
      recommendations.push({
        category: "Urbania / Tempo",
        name: "Force Urbania / Tempo (12-16 Seater)",
        pax_capacity: 16,
        luggage_capacity: 14,
        is_recommended: true,
        tier_tag: "Recommended",
        suitability_reason: `Strongly recommended for ${safePax} pax + ${safeBags} bags. Keeps all luggage in the rear boot without compromising legroom.`,
        estimated_cost: tempoBudget,
      });
      recommendations.push({
        category: "Innova Crysta / Premium SUV",
        name: "Toyota Innova Crysta (6+1 / 7+1)",
        pax_capacity: 7,
        luggage_capacity: 6,
        is_recommended: false,
        tier_tag: "Budget Option",
        suitability_reason: `Seats all ${safePax} passengers, but ${safeBags} bags will require an overhead rooftop luggage carrier.`,
        estimated_cost: suvBudget,
      });
      recommendations.push({
        category: "Urbania / Tempo",
        name: "Force Urbania Luxury (10 Seater)",
        pax_capacity: 10,
        luggage_capacity: 12,
        is_recommended: false,
        tier_tag: "Luxury Upgrade",
        suitability_reason: "Luxury individual pushback captain seating with expansive luggage capacity.",
        estimated_cost: tempoBudget + 4000,
      });
    }
  } else if (safePax <= 16) {
    primaryVehicle = "Force Urbania / Tempo (12-16 Seater)";
    if (safeBags > 14) {
      luggageWarning = `${safeBags} luggage bags exceed standard rear boot capacity. Fleet partners will equip a certified waterproof roof carrier.`;
    }
    recommendations.push({
      category: "Urbania / Tempo",
      name: "Force Urbania / Tempo (12-16 Seater)",
      pax_capacity: 16,
      luggage_capacity: 14,
      is_recommended: true,
      tier_tag: "Recommended",
      suitability_reason: `Gold standard for group tours up to 16 passengers. Individual pushback seats, dual AC, and strong mountain torque.`,
      estimated_cost: tempoBudget,
    });
    recommendations.push({
      category: "Coach / Minibus",
      name: "BharatBenz Executive Coach (19-26 Seater)",
      pax_capacity: 26,
      luggage_capacity: 24,
      is_recommended: false,
      tier_tag: "Spacious Alternative",
      suitability_reason: "Offers extra wide aisles, under-floor cargo bays, and enhanced air suspension for larger groups.",
      estimated_cost: coachBudget,
    });
    recommendations.push({
      category: "Urbania / Tempo",
      name: "Force Urbania Luxury (12-14 Seater)",
      pax_capacity: 14,
      luggage_capacity: 12,
      is_recommended: false,
      tier_tag: "Luxury Upgrade",
      suitability_reason: "Modern European-style monocoque design, quiet cabin, and USB ports at every seat.",
      estimated_cost: tempoBudget + 5000,
    });
  } else {
    primaryVehicle = "BharatBenz Executive Coach (19-26 Seater)";
    recommendations.push({
      category: "Coach / Minibus",
      name: "BharatBenz Executive Coach (19-26 Seater)",
      pax_capacity: 26,
      luggage_capacity: 24,
      is_recommended: true,
      tier_tag: "Recommended",
      suitability_reason: `Mandatory single-vehicle standard for delegations over 16 travellers. Vast luggage bays and PA microphone system.`,
      estimated_cost: coachBudget,
    });
    recommendations.push({
      category: "Urbania / Tempo",
      name: "Dual Force Urbania / Tempo (2 x 12-Seater)",
      pax_capacity: 24,
      luggage_capacity: 24,
      is_recommended: false,
      tier_tag: "Spacious Alternative",
      suitability_reason: "Splitting into two smaller vehicles allows faster mountain hair-pin cornering and independent group flexibility.",
      estimated_cost: tempoBudget * 2,
    });
    recommendations.push({
      category: "Coach / Minibus",
      name: "Volvo / Scania Multi-Axle Luxury Coach (35+ Seater)",
      pax_capacity: 45,
      luggage_capacity: 40,
      is_recommended: false,
      tier_tag: "Luxury Upgrade",
      suitability_reason: "Maximum luxury interstate cruiser with sleeper/semi-sleeper reclining layout.",
      estimated_cost: coachBudget + 18000,
    });
  }

  return { recommendations, primaryVehicle, luggageWarning };
}

// LAYER 4: Deterministic commercial pricing calculator
export function calculateIndicativeBudget(
  distanceKm: number,
  days: number,
  category: string,
  userTargetBudget: number = 0,
  origin: string = "",
  destination: string = ""
): IndicativeBudgetBreakdown {
  const safeDays = Math.max(1, days || 1);
  const minDailyKm = 250;
  const billableKm = Math.max(distanceKm || 500, safeDays * minDailyKm);

  let perKmRate = 13;
  if (category.includes("Innova") || category.includes("SUV")) perKmRate = 19;
  else if (category.includes("Urbania") || category.includes("Tempo")) perKmRate = 27;
  else if (category.includes("Coach")) perKmRate = 42;

  const baseVehicleCost = billableKm * perKmRate;
  const driverAllowance = safeDays * 500;

  // Inter-state commercial taxes and tolls estimates
  let statePermitsTolls = 1500;
  const o = (origin || "").toLowerCase();
  const d = (destination || "").toLowerCase();
  if (
    (o.includes("delhi") && d.includes("manali")) ||
    (o.includes("delhi") && d.includes("shimla")) ||
    (o.includes("delhi") && d.includes("dharamshala"))
  ) {
    statePermitsTolls = 3200;
  } else if (
    (o.includes("delhi") && d.includes("jaipur")) ||
    (o.includes("delhi") && d.includes("udaipur"))
  ) {
    statePermitsTolls = 2200;
  } else if (o.includes("delhi") && d.includes("agra")) {
    statePermitsTolls = 1600;
  } else if (
    (o.includes("bangalore") && d.includes("ooty")) ||
    (o.includes("bangalore") && d.includes("coorg"))
  ) {
    statePermitsTolls = 2400;
  } else if (o.includes("mumbai") && d.includes("goa")) {
    statePermitsTolls = 3500;
  }

  const indicativeTotal = baseVehicleCost + driverAllowance + statePermitsTolls;
  const indicativeMin = Math.round(indicativeTotal * 0.95);
  const indicativeMax = Math.round(indicativeTotal * 1.10);

  let budgetStatus: "within_budget" | "below_budget" | "above_budget" | "unspecified" = "unspecified";
  let budgetComparisonNote = "Indicative market estimate calculated from billable kilometres, vehicle per-km tariff, and standard driver allowances.";

  if (userTargetBudget > 0) {
    if (userTargetBudget < indicativeMin) {
      budgetStatus = "below_budget";
      const diff = indicativeMin - userTargetBudget;
      budgetComparisonNote = `Your budget (₹${userTargetBudget.toLocaleString("en-IN")}) is ~₹${diff.toLocaleString("en-IN")} below typical commercial rates for this vehicle tier. Operators may propose standard or off-peak quotations.`;
    } else if (userTargetBudget >= indicativeMin && userTargetBudget <= indicativeMax) {
      budgetStatus = "within_budget";
      budgetComparisonNote = `Your budget (₹${userTargetBudget.toLocaleString("en-IN")}) aligns accurately with standard commercial fleet estimates for this itinerary.`;
    } else {
      budgetStatus = "above_budget";
      budgetComparisonNote = `Your budget (₹${userTargetBudget.toLocaleString("en-IN")}) provides comfortable flexibility for premium vehicle models or upgraded driver allowances.`;
    }
  }

  return {
    billable_km: billableKm,
    per_km_rate: perKmRate,
    base_vehicle_cost: baseVehicleCost,
    driver_allowance: driverAllowance,
    state_permits_tolls: statePermitsTolls,
    indicative_total: indicativeTotal,
    indicative_min: indicativeMin,
    indicative_max: indicativeMax,
    target_budget: userTargetBudget,
    budget_status: budgetStatus,
    budget_comparison_note: budgetComparisonNote,
  };
}

// LAYER 2: Route Intelligence Resolver
export async function resolveRouteIntelligence(
  origin: string,
  destination: string,
  isOneWay: boolean,
  stops: string[] = []
): Promise<RouteIntelligence> {
  const oKey = origin.toLowerCase().replace(/\s+/g, "");
  const dKey = destination.toLowerCase().replace(/\s+/g, "");
  const corridorKey = `${oKey}-${dKey}`;
  const benchmark =
    KNOWN_CORRIDORS[corridorKey] ||
    KNOWN_CORRIDORS[`delhi-${dKey}`] ||
    KNOWN_CORRIDORS[`${oKey}-${dKey.replace(/valley|fort|city/g, "").trim()}`] ||
    null;

  if (benchmark) {
    const distanceKm = isOneWay ? Math.round(benchmark.distanceKm / 2) : benchmark.distanceKm;
    const durationHours = isOneWay ? Math.round(benchmark.durationHours / 2) : benchmark.durationHours;
    return {
      distance_km: distanceKm,
      duration_hours: durationHours,
      formatted_travel_time: `~${durationHours} hrs total drive time (corridor benchmark)`,
      source: "corridor_benchmark",
      source_label: "Corridor benchmark estimate",
      retrieval_timestamp: new Date().toISOString(),
      intermediate_stops: stops.length > 0 ? stops : benchmark.defaultStops,
    };
  }

  try {
    const cleanOrigin = encodeURIComponent(origin.trim());
    const cleanDest = encodeURIComponent(destination.trim());

    const originRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${cleanOrigin}&format=json&limit=1`,
      { headers: { "User-Agent": "Tripvahan-TravelApp/1.0" }, signal: AbortSignal.timeout(3000) }
    );
    const destRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${cleanDest}&format=json&limit=1`,
      { headers: { "User-Agent": "Tripvahan-TravelApp/1.0" }, signal: AbortSignal.timeout(3000) }
    );

    if (originRes.ok && destRes.ok) {
      const originData = await originRes.json();
      const destData = await destRes.json();

      if (originData[0] && destData[0]) {
        const oLat = parseFloat(originData[0].lat);
        const oLon = parseFloat(originData[0].lon);
        const dLat = parseFloat(destData[0].lat);
        const dLon = parseFloat(destData[0].lon);

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=false`;
        const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(4000) });
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes[0]) {
            let roadKm = Math.round(osrmData.routes[0].distance / 1000);
            let roadHours = Math.round((osrmData.routes[0].duration / 3600) * 10) / 10;
            if (!isOneWay) {
              roadKm = Math.round(roadKm * 2);
              roadHours = Math.round(roadHours * 2);
            }
            return {
              distance_km: roadKm,
              duration_hours: roadHours,
              formatted_travel_time: `~${roadHours} hrs total drive time (live route)`,
              source: "osrm_routing",
              source_label: "Live route estimate (OSRM)",
              retrieval_timestamp: new Date().toISOString(),
              intermediate_stops: stops.length > 0 ? stops : [`${origin} Highway Exit`, `${destination} Arrival`],
            };
          }
        }
      }
    }
  } catch {
    // Live lookup timed out or service unavailable
  }

  return {
    distance_km: 0,
    duration_hours: 0,
    formatted_travel_time: "Route estimate unavailable",
    source: "unavailable",
    source_label: "Route estimate unavailable",
    retrieval_timestamp: new Date().toISOString(),
    intermediate_stops: stops,
  };
}

// Rule-based deterministic NLP extractor
export function parsePromptWithNlp(prompt: string): {
  success: boolean;
  needsClarification: boolean;
  missingFields: string[];
  clarificationQuestions: string[];
  parsedData?: any;
} {
  const p = prompt.toLowerCase();

  let origin = "";
  let destination = "";

  const LOCATIONS = [
    "delhi ncr", "delhi", "new delhi", "manali", "jaipur", "agra", "rishikesh",
    "haridwar", "shimla", "chandigarh", "amritsar", "dharamshala", "nainital",
    "mussoorie", "varanasi", "bangalore", "bengaluru", "mysore", "ooty", "coorg",
    "mumbai", "pune", "goa", "udaipur", "jodhpur", "jaisalmer", "neemrana"
  ];

  const fromToMatch = p.match(/(?:from|starting\s+(?:at|from))\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:[\.,\s]|$)/i);
  if (fromToMatch) {
    const rawOrigin = fromToMatch[1].trim();
    const rawDest = fromToMatch[2].trim();
    for (const loc of LOCATIONS) {
      if (rawOrigin.includes(loc)) origin = loc;
      if (rawDest.includes(loc)) destination = loc;
    }
  }

  if (!origin || !destination) {
    const directToMatch = p.match(/([a-z\s]+?)\s+(?:to|→|-)\s+([a-z\s]+?)(?:[\.,\s]|$)/i);
    if (directToMatch) {
      const p1 = directToMatch[1].trim();
      const p2 = directToMatch[2].trim();
      for (const loc of LOCATIONS) {
        if (!origin && p1.includes(loc)) origin = loc;
        if (!destination && p2.includes(loc)) destination = loc;
      }
    }
  }

  if (!origin || !destination) {
    const foundLocs: string[] = [];
    for (const loc of LOCATIONS) {
      if (p.includes(loc) && !foundLocs.includes(loc)) {
        foundLocs.push(loc);
      }
    }
    if (foundLocs.length >= 2) {
      origin = foundLocs[0];
      destination = foundLocs[1];
    } else if (foundLocs.length === 1) {
      destination = foundLocs[0];
      if (destination !== "delhi" && destination !== "new delhi" && destination !== "delhi ncr") {
        origin = "delhi ncr";
      }
    }
  }

  const formatCity = (city: string) => {
    if (city === "delhi" || city === "delhi ncr" || city === "new delhi") return "Delhi NCR";
    if (city === "bangalore" || city === "bengaluru") return "Bangalore";
    return city.charAt(0).toUpperCase() + city.slice(1);
  };

  if (!origin || !destination || origin === destination) {
    return {
      success: false,
      needsClarification: true,
      missingFields: [!origin ? "origin" : "", !destination ? "destination" : ""].filter(Boolean),
      clarificationQuestions: [
        "Where will your journey begin and what is your primary destination? (e.g. Delhi to Manali)",
      ],
    };
  }

  const cleanOrigin = formatCity(origin);
  const cleanDestination = formatCity(destination);

  let days = 3;
  const daysMatch = p.match(/(\d+)\s*(?:-|to)?\s*(?:day|days|d\b)/i);
  if (daysMatch) {
    days = parseInt(daysMatch[1], 10);
  } else if (p.includes("weekend")) {
    days = 2;
  } else if (p.includes("week")) {
    days = 7;
  }

  let totalPax = 4;
  let adults = 4;
  let children = 0;
  let seniors = 0;

  const paxMatch = p.match(/(\d+)\s*(?:people|pax|passengers|persons|adults|members|travelers|travellers)/i);
  if (paxMatch) {
    totalPax = parseInt(paxMatch[1], 10);
    adults = totalPax;
  }

  const childMatch = p.match(/(\d+)\s*(?:children|kids|child)/i);
  if (childMatch) {
    children = parseInt(childMatch[1], 10);
    if (children < totalPax) {
      adults = totalPax - children;
    } else {
      totalPax += children;
    }
  }

  const seniorMatch = p.match(/(\d+)\s*(?:senior|seniors|elderly|elders|parents)/i);
  if (seniorMatch) {
    seniors = parseInt(seniorMatch[1], 10);
    if (seniors < adults) {
      adults -= seniors;
    }
  }

  let luggage = Math.min(totalPax, 12);
  const bagMatch = p.match(/(\d+)\s*(?:bags|bag|luggage|suitcases|trolleys)/i);
  if (bagMatch) {
    luggage = parseInt(bagMatch[1], 10);
  } else if (p.includes("heavy luggage") || p.includes("lots of luggage")) {
    luggage = totalPax + 2;
  } else if (p.includes("light luggage") || p.includes("backpacks")) {
    luggage = Math.max(2, Math.floor(totalPax / 2));
  }

  let budget = 0;
  const kBudgetMatch = p.match(/(?:₹|rs\.?|inr|budget\s*(?:of|is|:)?\s*)?\s*(\d+)\s*k\b/i);
  const numBudgetMatch = p.match(/(?:₹|rs\.?|inr|budget\s*(?:of|is|:)?\s*)\s*(\d{1,3}(?:,\d{3})+|\d{4,6})/i);

  if (kBudgetMatch) {
    budget = parseInt(kBudgetMatch[1], 10) * 1000;
  } else if (numBudgetMatch) {
    budget = parseInt(numBudgetMatch[1].replace(/,/g, ""), 10);
  }

  const isOneWay = p.includes("one way") || p.includes("one-way") || p.includes("single drop");
  const circuitType = isOneWay ? "One-Way Outstation" : (days > 1 ? "Multi-day circuit" : "Round Trip");

  return {
    success: true,
    needsClarification: false,
    missingFields: [],
    clarificationQuestions: [],
    parsedData: {
      origin: cleanOrigin,
      destination: cleanDestination,
      circuit_type: circuitType,
      days_count: days,
      travellers_count: totalPax,
      adults_count: adults,
      children_count: children,
      seniors_count: seniors,
      luggage_bags: luggage,
      target_budget: budget,
      is_one_way: isOneWay,
    },
  };
}
