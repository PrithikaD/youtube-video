import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import CaptureClient from "./capture-client";

type CapturePageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function buildNextPath(searchParams: CapturePageProps["searchParams"]) {
  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    }
  });
  const query = params.toString();
  return `/capture${query ? `?${query}` : ""}`;
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    const next = buildNextPath(searchParams);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", data.user.id)
    .maybeSingle();

  return (
    <CaptureClient
      userId={data.user.id}
      profileName={profile?.full_name ?? null}
      profileAvatarUrl={profile?.avatar_url ?? null}
    />
  );
}
