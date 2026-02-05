import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";

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
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );
  response.headers.set("Vary", "Origin");
  return response;
}

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(request, response);
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthedClient(request: Request) {
  const token = getBearerToken(request);
  if (token) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    const { data, error } = await supabase.auth.getUser(token);
    return { supabase, user: data.user, error };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: data.user, error };
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthedClient(request);
  if (authError || !user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    return withCors(request, response);
  }

  const { data, error } = await supabase
    .from("boards")
    .select("id,title,slug,is_public")
    .eq("creator_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return withCors(request, response);
  }

  const response = NextResponse.json({ boards: data ?? [] }, { status: 200 });
  return withCors(request, response);
}

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthedClient(request);
  if (authError || !user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    return withCors(request, response);
  }

  let body: { title?: string; isPublic?: boolean; description?: string };
  try {
    body = await request.json();
  } catch {
    const response = NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
    return withCors(request, response);
  }

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const isPublic = Boolean(body.isPublic);
  const baseSlug = slugify(title);

  if (!title || !baseSlug) {
    const response = NextResponse.json(
      { error: "Board title is required" },
      { status: 400 }
    );
    return withCors(request, response);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from("boards")
      .insert({
        creator_id: user.id,
        title,
        description: description || null,
        slug,
        is_public: isPublic,
      })
      .select("id,title,slug,is_public")
      .single();

    if (!error && data) {
      const response = NextResponse.json({ board: data }, { status: 201 });
      return withCors(request, response);
    }

    if (error?.code === "23505") {
      continue;
    }

    const response = NextResponse.json(
      { error: error?.message ?? "Unable to create board" },
      { status: 500 }
    );
    return withCors(request, response);
  }

  const response = NextResponse.json(
    { error: "Unable to create a unique board slug" },
    { status: 409 }
  );
  return withCors(request, response);
}
