import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseRouteHandlerClient";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const { supabase, cookiesToSet } =
    await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const response = NextResponse.json({
    requiresEmailConfirmation: !data.session,
  });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
