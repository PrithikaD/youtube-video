"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfigError } from "./supabaseConfig";

function parseCookieString(cookieString: string) {
  const result: Record<string, string> = {};
  if (!cookieString) return result;
  const parts = cookieString.split("; ");
  parts.forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const name = decodeURIComponent(part.slice(0, index));
    const value = decodeURIComponent(part.slice(index + 1));
    result[name] = value;
  });
  return result;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    expires?: Date;
    sameSite?: string | boolean;
    secure?: boolean;
  } = {}
) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  const path = options.path ?? "/";
  if (path) {
    cookie += `; Path=${path}`;
  }
  if (options.sameSite) {
    const sameSite =
      typeof options.sameSite === "string" ? options.sameSite : "Lax";
    cookie += `; SameSite=${sameSite}`;
  }
  if (options.secure) {
    cookie += "; Secure";
  }
  return cookie;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client is not available on the server.");
  }

  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
        cookies: {
          encode: "tokens-only",
          getAll() {
            const parsed = parseCookieString(document.cookie);
            return Object.keys(parsed).map((name) => ({
              name,
              value: parsed[name],
            }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              document.cookie = serializeCookie(name, value, options);
            });
          },
        },
      }
    );
  }

  return supabaseClient;
}
