import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { data: tripData, error: tripError } = await supabase
      .from("trip_requests")
      .select("id")
      .limit(1);

    const hasTables = !tripError || tripError.code !== "PGRST205";

    return NextResponse.json({
      status: "online",
      supabaseUrl,
      hasTables,
      error: tripError ? { message: tripError.message, code: tripError.code } : null,
      message: hasTables
        ? "Connected to Supabase PostgreSQL database tables!"
        : "Supabase connected. Run schema.sql in Supabase SQL editor to create live cloud tables.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
