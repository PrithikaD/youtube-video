import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("debug_cookie", "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
