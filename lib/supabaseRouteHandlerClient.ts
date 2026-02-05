import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<ReturnType<typeof cookies>["set"]>[2];
};

export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesList) {
          cookiesList.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options });
          });
        },
      },
    }
  );

  return { supabase, cookiesToSet };
}
