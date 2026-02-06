"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowserClient";

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

  async function login(emailValue: string, passwordValue: string) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue,
    });
    if (loginError) throw loginError;

    router.replace("/dashboard");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (mode === "login") {
      try {
        await login(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
        setLoading(false);
      }
      return;
    }

    const { error: signupError, data } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    if (!data.session) {
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
