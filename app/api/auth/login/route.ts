import { NextResponse } from "next/server";
import { getSupabaseConfigError } from "@/lib/supabaseConfig";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseRouteHandlerClient";

export async function POST(req: Request) {
  const configError = getSupabaseConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const { email, password } = await req.json();

  const { supabase, cookiesToSet } =
    await createSupabaseRouteHandlerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
