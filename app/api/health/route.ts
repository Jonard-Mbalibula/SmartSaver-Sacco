import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase";

export function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: hasSupabaseConfig()
  });
}
