import { NextResponse } from "next/server";
import {
  type AiEngine,
  type VehicleRecommendation,
  type IndicativeBudgetBreakdown,
  type RouteIntelligence,
  evaluateVehicleSuitability,
  calculateIndicativeBudget,
  resolveRouteIntelligence,
  parsePromptWithNlp,
} from "@/lib/aiTripEngine";

export type {
  AiEngine,
  VehicleRecommendation,
  IndicativeBudgetBreakdown,
  RouteIntelligence,
};

export interface AiPlanRequest {
  prompt: string;
}

export interface AiPlanResponse {
  success: boolean;
  engine: AiEngine;
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
    luggage_warning?: string | null;
    target_budget: number;
    indicative_budget_min: number;
    indicative_budget_max: number;
    distance_km: number;
    duration_hours: number;
    formatted_travel_time: string;
    matched_vehicle_class: string;
    vehicle_recommendations: VehicleRecommendation[];
    budget_breakdown: IndicativeBudgetBreakdown;
    route_intelligence: RouteIntelligence;
    amenities: string[];
    itinerary_highlights: string[];
    user_facts: {
      origin: string;
      destination: string;
      passengers: number;
      adults: number;
      children: number;
      seniors: number;
      luggage_bags: number;
      budget?: number;
      duration_requested?: string;
    };
    ai_suggestions: {
      suggested_stops: string[];
      vehicle_class_recommendation: string;
      recommended_amenities: string[];
      vehicle_recommendations?: VehicleRecommendation[];
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

// LAYER 1: Call Groq API (Primary LLM Provider)
async function callGroqLive(prompt: string, apiKey: string): Promise<any | null> {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const systemPrompt = `You are the Tripvahan AI Travel Assistant for group outstation travel in India.
Your task is to extract structured trip intent from the user's natural language request into JSON.
Never invent fake fleet operators, fake ratings, or fake driver names.
Extract the user's requested numbers accurately. Do not invent missing facts.
Conform strictly to this JSON format:
{
  "origin": string,
  "destination": string,
  "stops": string[],
  "circuit_type": "Multi-day circuit" | "Round Trip" | "One-Way Outstation",
  "days_count": number,
  "travellers_count": number,
  "adults_count": number,
  "children_count": number,
  "seniors_count": number,
  "luggage_bags": number,
  "target_budget": number,
  "itinerary_highlights": string[]
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User Trip Description: "${prompt}"` },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    return null;
  }
}

// LAYER 1: Call Google Gemini API (Secondary / Fallback LLM Provider)
async function callGeminiLive(prompt: string, apiKey: string): Promise<any | null> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are the Tripvahan AI Travel Assistant for group outstation cab and tempo traveller travel in India.
Your task is to analyze the user's natural language trip request and produce a structured JSON object.
Never invent real fleet operators, fake ratings, or fake driver names.
Respond ONLY with valid JSON conforming to this structure:
{
  "origin": string,
  "destination": string,
  "stops": string[],
  "circuit_type": "Multi-day circuit" | "Round Trip" | "One-Way Outstation",
  "days_count": number,
  "travellers_count": number,
  "adults_count": number,
  "children_count": number,
  "seniors_count": number,
  "luggage_bags": number,
  "target_budget": number,
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

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Prompt cannot be empty. Please describe your desired trip." },
        { status: 400 }
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: "Prompt exceeds maximum allowed length of 1,000 characters" },
        { status: 400 }
      );
    }

    const trimmedPrompt = prompt.trim();

    // Provider Strategy:
    // 1. Groq (Primary, fast NLU)
    // 2. Gemini 2.5 Flash (Secondary / Fallback)
    // 3. Deterministic NLP + Corridor Benchmarks (Tertiary Fallback)
    const groqKey = process.env.GROQ_API_KEY || null;
    const geminiKey = process.env.GEMINI_API_KEY || null;

    let rawExtract: any = null;
    let engine: AiEngine = "corridor_benchmark";

    if (groqKey) {
      rawExtract = await callGroqLive(trimmedPrompt, groqKey);
      if (rawExtract && rawExtract.origin && rawExtract.destination) {
        engine = "groq_live";
      }
    }

    if (!rawExtract && geminiKey) {
      rawExtract = await callGeminiLive(trimmedPrompt, geminiKey);
      if (rawExtract && rawExtract.origin && rawExtract.destination) {
        engine = "gemini_live";
      }
    }

    // If both LLMs were unavailable or failed, use deterministic NLP extractor
    let origin = "";
    let destination = "";
    let days = 3;
    let adults = 4;
    let children = 0;
    let seniors = 0;
    let totalPax = 4;
    let luggage = 4;
    let userBudget = 0;
    let circuitType = "Multi-day circuit";
    let stops: string[] = [];
    let itineraryHighlights: string[] = [];
    let isOneWay = false;

    if (rawExtract && rawExtract.origin && rawExtract.destination) {
      origin = rawExtract.origin;
      destination = rawExtract.destination;
      days = Math.max(1, rawExtract.days_count || 3);
      children = Math.max(0, rawExtract.children_count || 0);
      seniors = Math.max(0, rawExtract.seniors_count || 0);

      // Canonical passenger count logic
      if (typeof rawExtract.adults_count === "number" && rawExtract.adults_count > 0) {
        adults = rawExtract.adults_count;
      } else if (typeof rawExtract.travellers_count === "number" && rawExtract.travellers_count > 0) {
        adults = Math.max(1, rawExtract.travellers_count - children - seniors);
      } else {
        adults = 4;
      }
      totalPax = adults + children + seniors;

      luggage = rawExtract.luggage_bags ?? totalPax;
      userBudget = rawExtract.target_budget || 0;
      circuitType = rawExtract.circuit_type || (days > 1 ? "Multi-day circuit" : "Round Trip");
      stops = rawExtract.stops || [];
      itineraryHighlights = rawExtract.itinerary_highlights || [];
      isOneWay = circuitType.toLowerCase().includes("one-way") || circuitType.toLowerCase().includes("single drop");
    } else {
      const nlpResult = parsePromptWithNlp(trimmedPrompt);
      if (nlpResult.needsClarification) {
        return NextResponse.json({
          success: false,
          engine: "corridor_benchmark",
          needs_clarification: true,
          missing_fields: nlpResult.missingFields,
          clarification_questions: nlpResult.clarificationQuestions,
          message: "We need a little more detail to build your itinerary. Please specify your starting city and destination.",
        });
      }

      const parsed = nlpResult.parsedData;
      origin = parsed.origin;
      destination = parsed.destination;
      days = parsed.days_count;
      adults = parsed.adults_count;
      children = parsed.children_count;
      seniors = parsed.seniors_count;
      totalPax = adults + children + seniors;
      luggage = parsed.luggage_bags;
      userBudget = parsed.target_budget;
      circuitType = parsed.circuit_type;
      isOneWay = parsed.is_one_way;
      engine = "corridor_benchmark";
    }

    // LAYER 2: Verified Route Intelligence (OSRM or Corridor Benchmark)
    const routeIntel = await resolveRouteIntelligence(origin, destination, isOneWay, stops);
    const distanceKm = routeIntel.distance_km;
    const durationHours = routeIntel.duration_hours;
    const formattedTravelTime = routeIntel.formatted_travel_time;

    // LAYER 3: Deterministic Vehicle Suitability
    const vehicleIntel = evaluateVehicleSuitability(totalPax, luggage, days, distanceKm, origin, destination, isOneWay);
    const matchedVehicle = vehicleIntel.primaryVehicle;
    const vehicleRecommendations = vehicleIntel.recommendations;
    const luggageWarning = vehicleIntel.luggageWarning;

    // LAYER 4: Deterministic Indicative Budget Engine
    const budgetBreakdown = calculateIndicativeBudget(
      distanceKm,
      days,
      matchedVehicle,
      userBudget,
      origin,
      destination,
      isOneWay
    );

    // Standard Amenities
    const amenities = [
      "Dual AC & Reclining Pushback Seats",
      "Waterproof Carrier Roof Rack",
      "Bilingual Driver (Hindi & English)",
      "Speed Governor Compliant (Commercial Yellow-Plate)",
    ];
    if (trimmedPrompt.toLowerCase().includes("music") || trimmedPrompt.toLowerCase().includes("audio")) {
      amenities.push("Bluetooth Audio System");
    }
    if (trimmedPrompt.toLowerCase().includes("charge") || trimmedPrompt.toLowerCase().includes("usb")) {
      amenities.push("USB High-Speed Charging Ports");
    }

    if (!itineraryHighlights || itineraryHighlights.length === 0) {
      itineraryHighlights = [
        `Day 1: Departure from ${origin} → En-route highway transit to ${stops[0] || destination}`,
      ];
      for (let i = 2; i < days; i++) {
        itineraryHighlights.push(`Day ${i}: Sightseeing across ${destination} & regional attractions`);
      }
      itineraryHighlights.push(
        `Day ${days}: Leisure morning in ${destination} → Return journey to ${origin}`
      );
    }

    const nights = Math.max(1, days - 1);
    const durationStr = `${days} Days, ${nights} Nights`;

    const disclaimer =
      "Indicative estimates only. Exact rates and vehicle allocations will be provided by verified fleet operators upon publication.";

    return NextResponse.json({
      success: true,
      engine,
      trip: {
        origin,
        destination,
        stops: routeIntel.intermediate_stops,
        circuit_title: `${origin} → ${destination}`,
        circuit_type: circuitType,
        duration: durationStr,
        days_count: days,
        travellers_count: totalPax,
        adults_count: adults,
        children_count: children,
        seniors_count: seniors,
        luggage_bags: luggage,
        luggage_warning: luggageWarning,
        target_budget: userBudget,
        indicative_budget_min: budgetBreakdown.indicative_min,
        indicative_budget_max: budgetBreakdown.indicative_max,
        distance_km: distanceKm,
        duration_hours: durationHours,
        formatted_travel_time: formattedTravelTime,
        matched_vehicle_class: matchedVehicle,
        vehicle_recommendations: vehicleRecommendations,
        budget_breakdown: budgetBreakdown,
        route_intelligence: routeIntel,
        amenities,
        itinerary_highlights: itineraryHighlights,
        user_facts: {
          origin,
          destination,
          passengers: totalPax,
          adults,
          children,
          seniors,
          luggage_bags: luggage,
          budget: userBudget > 0 ? userBudget : undefined,
          duration_requested: durationStr,
        },
        ai_suggestions: {
          suggested_stops: routeIntel.intermediate_stops,
          vehicle_class_recommendation: matchedVehicle,
          recommended_amenities: amenities,
          vehicle_recommendations: vehicleRecommendations,
        },
        disclaimer,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process trip planning request" },
      { status: 500 }
    );
  }
}
