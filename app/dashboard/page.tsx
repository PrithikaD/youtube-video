"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowserClient";

const DashboardClient = dynamic(() => import("./dashboard-client"), {
  ssr: false,
  loading: () => <p>Loading dashboard...</p>,
});

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  if (!ready) return <p className="p-8">Loading dashboard...</p>;

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <Link className="text-sm underline" href="/logout">
          Log out
        </Link>
      </div>

      <div className="mt-6">
        <DashboardClient />
      </div>
    </main>
  );
}
