import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseRouteHandlerClient";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const redirectPath = nextParam?.startsWith("/") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_code`, url.origin)
    );
  }

  const { supabase, cookiesToSet } =
    await createSupabaseRouteHandlerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=oauth_exchange_failed`, url.origin)
    );
  }

  const response = NextResponse.redirect(new URL(redirectPath, url.origin));
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
