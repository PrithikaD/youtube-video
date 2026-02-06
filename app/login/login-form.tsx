"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({
  nextParam,
}: {
  nextParam?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loginWithCookie(emailValue: string, passwordValue: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailValue, password: passwordValue }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    window.location.href = "/dashboard";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (mode === "login") {
      try {
        await loginWithCookie(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
        setLoading(false);
      }
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to authenticate.");
      return;
    }

    if (payload?.requiresEmailConfirmation) {
      setNotice("Check your email to confirm your account, then log in.");
      return;
    }

    const nextUrl =
      nextParam && nextParam.startsWith("/") ? nextParam : null;
    router.push(nextUrl ?? "/dashboard?onboarding=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            mode === "login" ? "bg-black text-white" : "bg-white"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            mode === "signup" ? "bg-black text-white" : "bg-white"
          }`}
        >
          Sign up
        </button>
      </div>

      <label className="block">
        <span className="text-sm text-gray-700">Email</span>
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">Password</span>
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
      </label>

      {error ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      ) : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "..." : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
