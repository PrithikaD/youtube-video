import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getSupabaseConfigError } from "../../lib/supabaseConfig";
import SupabaseEnvNotice from "../../components/SupabaseEnvNotice";
const DashboardClient = dynamic(() => import("./dashboard-client"), {
  ssr: false,
  loading: () => <p>Loading dashboard...</p>,
});

export default async function DashboardPage() {
  const configError = getSupabaseConfigError();
  if (configError) {
    return <SupabaseEnvNotice />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
