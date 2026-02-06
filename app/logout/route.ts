import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getSupabaseConfigError } from "../../lib/supabaseConfig";

export async function GET(request: Request) {
  const configError = getSupabaseConfigError();
  if (configError) {
    return NextResponse.redirect(
      new URL("/login?error=supabase_not_configured", request.url)
    );
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
