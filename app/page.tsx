import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabaseServer";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="p-8">
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6">
        <h1 className="text-4xl font-bold">Context Board</h1>
        <p className="text-base italic text-gray-600">the era of curators</p>
        <Link
          href="/login"
          className="w-fit rounded-xl bg-black px-5 py-2.5 text-white"
        >
          Let's get started
        </Link>
      </div>
    </main>
  );
}
