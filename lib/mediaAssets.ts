// Curated authentic destination and vehicle assets for Tripvahan

export const DESTINATION_IMAGES = {
  agra: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80", // Taj Mahal, Agra
  jaipur: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80", // Hawa Mahal / Amber Fort, Jaipur
  delhi: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=800&q=80", // India Gate, New Delhi
  goldenTriangle: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
  rishikesh: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
  haridwar: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
  manali: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  highwayHero: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=900&q=80",
  defaultTrip: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
};

export const VEHICLE_IMAGES = {
  urbania: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80", // Commercial Minibus / Urbania
  tempo: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
  innova: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80", // Premium SUV
  coach: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80", // Luxury Bus
  sedan: "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=800&q=80", // Sedan
  fleetVan: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
};

/**
 * Returns an authentic destination banner image based on origin/destination/circuit text.
 */
export function getDestinationImage(title: string, destination?: string, origin?: string): string {
  const combined = `${title} ${destination || ""} ${origin || ""}`.toLowerCase();
  if (combined.includes("jaipur") || combined.includes("amer") || combined.includes("rajasthan")) {
    return DESTINATION_IMAGES.jaipur;
  }
  if (combined.includes("agra") || combined.includes("taj mahal") || combined.includes("golden triangle")) {
    return DESTINATION_IMAGES.agra;
  }
  if (combined.includes("delhi") || combined.includes("ncr") || combined.includes("dwarka")) {
    return DESTINATION_IMAGES.delhi;
  }
  if (combined.includes("rishikesh") || combined.includes("haridwar") || combined.includes("ganga")) {
    return DESTINATION_IMAGES.rishikesh;
  }
  if (combined.includes("manali") || combined.includes("shimla") || combined.includes("himachal")) {
    return DESTINATION_IMAGES.manali;
  }
  return DESTINATION_IMAGES.defaultTrip;
}

/**
 * Returns an authentic vehicle image based on category or class string.
 */
export function getVehicleImage(vehicleClass?: string, vehicleName?: string): string {
  const combined = `${vehicleClass || ""} ${vehicleName || ""}`.toLowerCase();
  if (combined.includes("innova") || combined.includes("suv") || combined.includes("crysta")) {
    return VEHICLE_IMAGES.innova;
  }
  if (combined.includes("coach") || combined.includes("bharatbenz") || combined.includes("bus")) {
    return VEHICLE_IMAGES.coach;
  }
  if (combined.includes("sedan") || combined.includes("dzire") || combined.includes("etios")) {
    return VEHICLE_IMAGES.sedan;
  }
  return VEHICLE_IMAGES.urbania;
}
