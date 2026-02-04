"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseBrowserClient";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === "signup" && !data.session) {
      setNotice("Check your email to confirm your account, then log in.");
      return;
    }

    router.push(mode === "signup" ? "/dashboard?onboarding=1" : "/dashboard");
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
        {loading ? "…" : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
