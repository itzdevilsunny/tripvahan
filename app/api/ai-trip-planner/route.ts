import { NextResponse } from "next/server";

export interface AiPlanRequest {
  prompt: string;
}

export interface AiPlanResponse {
  success: boolean;
  engine: "gemini_live" | "intelligent_nlp";
  needs_clarification?: boolean;
  clarification_questions?: string[];
  missing_fields?: string[];
  trip?: {
    origin: string;
    destination: string;
    stops: string[];
    circuit_title: string;
    circuit_type: "Multi-day circuit" | "Round Trip" | "One-Way Outstation" | string;
    duration: string;
    days_count: number;
    travellers_count: number;
    adults_count: number;
    children_count: number;
    seniors_count: number;
    luggage_bags: number;
    target_budget: number;
    indicative_budget_min: number;
    indicative_budget_max: number;
    distance_km: number;
    duration_hours: number;
    formatted_travel_time: string;
    matched_vehicle_class: string;
    amenities: string[];
    itinerary_highlights: string[];
    user_facts: {
      origin: string;
      destination: string;
      passengers: number;
      budget?: number;
      duration_requested?: string;
    };
    ai_suggestions: {
      suggested_stops: string[];
      vehicle_class_recommendation: string;
      recommended_amenities: string[];
    };
    disclaimer: string;
  };
  error?: string;
}

// In-memory sliding window rate limiter: 20 requests per minute per IP
const ipRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  const record = ipRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    ipRateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count += 1;
  return { allowed: true };
}

// Known corridors and benchmarks for intelligent NLP fallback
interface CorridorBenchmark {
  origin: string;
  destination: string;
  defaultStops: string[];
  distanceKm: number;
  durationHours: number;
  baseBudgetSedan: number;
  baseBudgetSuv: number;
  baseBudgetTempo: number;
}

const KNOWN_CORRIDORS: Record<string, CorridorBenchmark> = {
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

// Vehicle matching capacity matrix
function matchVehicleClass(pax: number, bags: number): string {
  if (pax <= 4 && bags <= 4) return "Executive Sedan (Dzire / Etios)";
  if (pax <= 7 && bags <= 6) return "Innova Crysta / Premium SUV (6+1 / 7+1)";
  if (pax <= 16 && bags <= 14) return "Force Urbania / Tempo (12-16 Seater)";
  return "BharatBenz Executive Coach (19-26 Seater)";
}

// Rule-based deterministic NLP extractor
function parsePromptWithNlp(prompt: string): {
  success: boolean;
  needsClarification: boolean;
  missingFields: string[];
  clarificationQuestions: string[];
  parsedData?: any;
} {
  const p = prompt.toLowerCase();

  // 1. Extract Origin and Destination
  let origin = "";
  let destination = "";
  let matchedCorridorKey = "";

  // Common location dictionary
  const LOCATIONS = [
    "delhi ncr", "delhi", "new delhi", "manali", "jaipur", "agra", "rishikesh",
    "haridwar", "shimla", "chandigarh", "amritsar", "dharamshala", "nainital",
    "mussoorie", "varanasi", "bangalore", "bengaluru", "mysore", "ooty", "coorg",
    "mumbai", "pune", "goa", "udaipur", "jodhpur", "jaisalmer", "neemrana"
  ];

  // Try pattern: "from [loc1] to [loc2]"
  const fromToMatch = p.match(/(?:from|starting\s+(?:at|from))\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:[\.,\s]|$)/i);
  if (fromToMatch) {
    const rawOrigin = fromToMatch[1].trim();
    const rawDest = fromToMatch[2].trim();
    for (const loc of LOCATIONS) {
      if (rawOrigin.includes(loc)) origin = loc;
      if (rawDest.includes(loc)) destination = loc;
    }
  }

  // Try pattern: "[loc1] to [loc2]"
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

  // If still missing, check known locations mentioned in prompt
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
      // Default origin to Delhi NCR if only destination found
      destination = foundLocs[0];
      if (destination !== "delhi" && destination !== "new delhi" && destination !== "delhi ncr") {
        origin = "delhi ncr";
      }
    }
  }

  // Capitalize properly
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
  const corridorKey = `${cleanOrigin.toLowerCase().replace(/\s+/g, "")}-${cleanDestination.toLowerCase()}`;
  const benchmark = KNOWN_CORRIDORS[corridorKey] || KNOWN_CORRIDORS[`delhi-${cleanDestination.toLowerCase()}`] || null;

  // 2. Extract Duration & Days
  let days = 3;
  const daysMatch = p.match(/(\d+)\s*(?:-|to)?\s*(?:day|days|d\b)/i);
  if (daysMatch) {
    days = parseInt(daysMatch[1], 10);
  } else if (p.includes("weekend")) {
    days = 2;
  } else if (p.includes("week")) {
    days = 7;
  }

  const nights = Math.max(1, days - 1);
  const durationStr = `${days} Days, ${nights} Nights`;

  // 3. Extract Passenger Counts
  let totalPax = 4;
  let adults = 4;
  let children = 0;
  let seniors = 0;

  // Look for total people/pax
  const paxMatch = p.match(/(\d+)\s*(?:people|pax|passengers|persons|adults|members|travelers|travellers)/i);
  if (paxMatch) {
    totalPax = parseInt(paxMatch[1], 10);
    adults = totalPax;
  }

  // Look for children
  const childMatch = p.match(/(\d+)\s*(?:children|kids|child)/i);
  if (childMatch) {
    children = parseInt(childMatch[1], 10);
    if (children < totalPax) {
      adults = totalPax - children;
    } else {
      totalPax += children;
    }
  }

  // Look for seniors
  const seniorMatch = p.match(/(\d+)\s*(?:senior|seniors|elderly|elders|parents)/i);
  if (seniorMatch) {
    seniors = parseInt(seniorMatch[1], 10);
    if (seniors < adults) {
      adults -= seniors;
    }
  }

  // 4. Extract Luggage
  let luggage = Math.min(totalPax, 12);
  const bagMatch = p.match(/(\d+)\s*(?:bags|bag|luggage|suitcases|trolleys)/i);
  if (bagMatch) {
    luggage = parseInt(bagMatch[1], 10);
  } else if (p.includes("heavy luggage") || p.includes("lots of luggage")) {
    luggage = totalPax + 2;
  } else if (p.includes("light luggage") || p.includes("backpacks")) {
    luggage = Math.max(2, Math.floor(totalPax / 2));
  }

  // 5. Extract Budget
  let budget = 0;
  // Match "35,000" or "₹35000" or "35k" or "35000"
  const kBudgetMatch = p.match(/(?:₹|rs\.?|inr|budget\s*(?:of|is|:)?\s*)?\s*(\d+)\s*k\b/i);
  const numBudgetMatch = p.match(/(?:₹|rs\.?|inr|budget\s*(?:of|is|:)?\s*)\s*(\d{1,3}(?:,\d{3})+|\d{4,6})/i);

  if (kBudgetMatch) {
    budget = parseInt(kBudgetMatch[1], 10) * 1000;
  } else if (numBudgetMatch) {
    budget = parseInt(numBudgetMatch[1].replace(/,/g, ""), 10);
  } else {
    // Benchmark indicative calculation based on vehicle and days
    const matchedClass = matchVehicleClass(totalPax, luggage);
    if (benchmark) {
      if (matchedClass.includes("Sedan")) budget = benchmark.baseBudgetSedan;
      else if (matchedClass.includes("SUV") || matchedClass.includes("Innova")) budget = benchmark.baseBudgetSuv;
      else budget = benchmark.baseBudgetTempo;
      // Scale by days if > 3
      if (days > 3) budget = Math.round(budget * (1 + (days - 3) * 0.25));
    } else {
      // Guard: Do not fabricate a budget if not provided by user and corridor is unindexed
      budget = 0;
    }
  }

  // If corridor is unknown and no budget was specified by the traveller, ask for clarification
  if (!benchmark && budget === 0) {
    return {
      success: false,
      needsClarification: true,
      missingFields: ["budget", "verified_corridor"],
      clarificationQuestions: [
        `Pre-verified highway benchmarks are not currently indexed for ${cleanOrigin} to ${cleanDestination}. Please state your target budget (e.g. ₹25,000), or select from verified corridors like Delhi–Manali, Delhi–Jaipur, Bangalore–Ooty, or Mumbai–Goa.`,
      ],
    };
  }

  // Detect One-Way vs Round Trip
  const isOneWay = p.includes("one way") || p.includes("one-way") || p.includes("single drop");
  const circuitType = isOneWay ? "One-Way Outstation" : (days > 1 ? "Multi-day circuit" : "Round Trip");

  // 6. Matched Vehicle Class & Amenities
  const matchedVehicle = matchVehicleClass(totalPax, luggage);
  const amenities = [
    "Dual AC & Reclining Pushback Seats",
    "Waterproof Carrier Roof Rack",
    "Bilingual Driver (Hindi & English)",
  ];
  if (p.includes("music") || p.includes("audio")) amenities.push("Bluetooth Audio System");
  if (p.includes("wifi") || p.includes("charger")) amenities.push("USB High-Speed Charging Ports");

  // 7. Distance & Travel Time Estimates (Strictly derived or flagged as unbenchmarked)
  let distanceKm = 0;
  let durationHours = 0;
  let formattedTravelTime = "Custom route — highway distance pending operator quotation";

  if (benchmark) {
    distanceKm = isOneWay ? Math.round(benchmark.distanceKm / 2) : benchmark.distanceKm;
    durationHours = isOneWay ? Math.round(benchmark.durationHours / 2) : benchmark.durationHours;
    formattedTravelTime = `~${durationHours} hrs total drive time (indicative estimate)`;
    if (isOneWay && budget > 0 && !numBudgetMatch && !kBudgetMatch) {
      budget = Math.round(budget * 0.65);
    }
  }

  // 8. Day-by-Day Suggested Itinerary Highlights
  const stops = benchmark ? benchmark.defaultStops : [`En-route highway transit`, `${cleanDestination} Central`];
  const highlights = [];
  highlights.push(`Day 1: Departure from ${cleanOrigin} → En-route highway transit to ${stops[0] || cleanDestination}`);
  for (let i = 2; i < days; i++) {
    highlights.push(`Day ${i}: Sightseeing across ${cleanDestination} & regional attractions`);
  }
  highlights.push(`Day ${days}: Leisure morning in ${cleanDestination} → Return journey to ${cleanOrigin}`);

  const disclaimerText = benchmark
    ? "Indicative estimates only. Exact quotes and binding rates will be provided by verified commercial fleet partners upon publishing your request."
    : "Custom corridor without pre-indexed benchmarks. Vehicle allocation and exact highway distance will be provided by verified commercial fleet partners upon publishing your request.";

  return {
    success: true,
    needsClarification: false,
    missingFields: [],
    clarificationQuestions: [],
    parsedData: {
      origin: cleanOrigin,
      destination: cleanDestination,
      stops,
      circuit_title: `${cleanOrigin} → ${cleanDestination}`,
      circuit_type: circuitType,
      duration: durationStr,
      days_count: days,
      travellers_count: totalPax,
      adults_count: adults,
      children_count: children,
      seniors_count: seniors,
      luggage_bags: luggage,
      target_budget: budget,
      indicative_budget_min: Math.round(budget * 0.9),
      indicative_budget_max: Math.round(budget * 1.1),
      distance_km: distanceKm,
      duration_hours: durationHours,
      formatted_travel_time: formattedTravelTime,
      matched_vehicle_class: matchedVehicle,
      amenities,
      itinerary_highlights: highlights,
      user_facts: {
        origin: cleanOrigin,
        destination: cleanDestination,
        passengers: totalPax,
        budget: budget > 0 ? budget : undefined,
        duration_requested: durationStr,
      },
      ai_suggestions: {
        suggested_stops: stops,
        vehicle_class_recommendation: matchedVehicle,
        recommended_amenities: amenities,
      },
      disclaimer: disclaimerText,
    },
  };
}

// Call Google Gemini API if configured
async function callGeminiLive(prompt: string, apiKey: string): Promise<any | null> {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are the Tripvahan AI Travel Assistant for group outstation cab and tempo traveller travel in India.
Your task is to analyze the user's natural language trip request and produce a structured JSON object.
Never invent real fleet operators, fake ratings, or fake driver names.
Estimate realistic highway distances in km and travel duration.
Capacity rules:
- 1 to 4 passengers: "Executive Sedan (Dzire / Etios)"
- 5 to 7 passengers: "Innova Crysta / Premium SUV (6+1 / 7+1)"
- 8 to 16 passengers: "Force Urbania / Tempo (12-16 Seater)"
- 17+ passengers: "BharatBenz Executive Coach (19-26 Seater)"

Respond ONLY with valid JSON conforming to this structure:
{
  "origin": string,
  "destination": string,
  "stops": string[],
  "circuit_title": string,
  "circuit_type": "Multi-day circuit" | "Round Trip" | "One-Way Outstation",
  "duration": string,
  "days_count": number,
  "travellers_count": number,
  "adults_count": number,
  "children_count": number,
  "seniors_count": number,
  "luggage_bags": number,
  "target_budget": number,
  "distance_km": number,
  "duration_hours": number,
  "formatted_travel_time": string,
  "matched_vehicle_class": string,
  "amenities": string[],
  "itinerary_highlights": string[]
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Trip Description: "${prompt}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) return null;

    const parsed = JSON.parse(textContent);
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // Rate limit check: max 20 requests per minute per IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many trip requests. Please wait a moment before trying again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter || 30) } }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request: Expected JSON body with a prompt" },
        { status: 400 }
      );
    }

    const { prompt } = body;

    // Validate prompt presence and type
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Prompt cannot be empty. Please describe your desired trip." },
        { status: 400 }
      );
    }

    // Validate maximum character length
    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: "Prompt exceeds maximum allowed length of 1,000 characters" },
        { status: 400 }
      );
    }

    const trimmedPrompt = prompt.trim();

    // Check if live Gemini API key is configured in the environment
    const geminiKey = process.env.GEMINI_API_KEY || null;

    if (geminiKey) {
      const geminiResult = await callGeminiLive(trimmedPrompt, geminiKey);
      if (
        geminiResult &&
        geminiResult.origin &&
        geminiResult.destination &&
        geminiResult.travellers_count > 0
      ) {
        const budget = geminiResult.target_budget || 25000;
        const matchedClass = matchVehicleClass(
          geminiResult.travellers_count,
          geminiResult.luggage_bags || geminiResult.travellers_count
        );

        return NextResponse.json({
          success: true,
          engine: "gemini_live",
          trip: {
            origin: geminiResult.origin,
            destination: geminiResult.destination,
            stops: geminiResult.stops || [],
            circuit_title: geminiResult.circuit_title || `${geminiResult.origin} → ${geminiResult.destination}`,
            circuit_type: geminiResult.circuit_type || "Multi-day circuit",
            duration: geminiResult.duration || `${geminiResult.days_count || 3} Days`,
            days_count: geminiResult.days_count || 3,
            travellers_count: geminiResult.travellers_count,
            adults_count: geminiResult.adults_count ?? geminiResult.travellers_count,
            children_count: geminiResult.children_count || 0,
            seniors_count: geminiResult.seniors_count || 0,
            luggage_bags: geminiResult.luggage_bags || geminiResult.travellers_count,
            target_budget: budget,
            indicative_budget_min: Math.round(budget * 0.9),
            indicative_budget_max: Math.round(budget * 1.1),
            distance_km: geminiResult.distance_km || 600,
            duration_hours: geminiResult.duration_hours || 12,
            formatted_travel_time: geminiResult.formatted_travel_time || `~${geminiResult.duration_hours || 12} hrs total drive time`,
            matched_vehicle_class: matchedClass,
            amenities: geminiResult.amenities || [
              "Dual AC & Reclining Pushback Seats",
              "Waterproof Carrier Roof Rack",
            ],
            itinerary_highlights: geminiResult.itinerary_highlights || [
              `Day 1: Departure from ${geminiResult.origin}`,
              `Day 2: Exploration in ${geminiResult.destination}`,
              `Day 3: Return journey to ${geminiResult.origin}`,
            ],
            user_facts: {
              origin: geminiResult.origin,
              destination: geminiResult.destination,
              passengers: geminiResult.travellers_count,
              budget,
              duration_requested: geminiResult.duration,
            },
            ai_suggestions: {
              suggested_stops: geminiResult.stops || [],
              vehicle_class_recommendation: matchedClass,
              recommended_amenities: geminiResult.amenities || [],
            },
            disclaimer: "Indicative estimates only. Exact rates and vehicle allocations will be provided by verified fleet operators upon publication.",
          },
        });
      }
    }

    // Fallback: Intelligent Deterministic NLP Parser
    const nlpResult = parsePromptWithNlp(trimmedPrompt);

    if (nlpResult.needsClarification) {
      return NextResponse.json({
        success: false,
        engine: "intelligent_nlp",
        needs_clarification: true,
        missing_fields: nlpResult.missingFields,
        clarification_questions: nlpResult.clarificationQuestions,
        message: "We need a little more detail to build your itinerary. Please specify your starting city and destination.",
      });
    }

    return NextResponse.json({
      success: true,
      engine: "intelligent_nlp",
      trip: nlpResult.parsedData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process trip planning request" },
      { status: 500 }
    );
  }
}
