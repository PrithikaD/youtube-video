import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  return null;
}

function withCors(request: Request, response: NextResponse) {
  const origin = getCorsOrigin(request);
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(request, response);
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    return withCors(request, response);
  }

  const { data, error } = await supabase
    .from("boards")
    .select("id,title,slug,is_public")
    .eq("creator_id", authData.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return withCors(request, response);
  }

  const response = NextResponse.json({ boards: data ?? [] }, { status: 200 });
  return withCors(request, response);
}
