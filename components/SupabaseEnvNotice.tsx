type SupabaseEnvNoticeProps = {
  title?: string;
};

export default function SupabaseEnvNotice({
  title = "Supabase setup required",
}: SupabaseEnvNoticeProps) {
  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-amber-900">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your{" "}
          <code>.env.local</code> file, then restart <code>npm run dev</code>.
        </p>
      </div>
    </main>
  );
}
