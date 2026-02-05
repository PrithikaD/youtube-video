import LoginForm from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextParam = searchParams?.next ?? null;
  return (
    <main className="p-8 max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Log in</h1>
        <p className="text-sm text-gray-600">
          Use your email and password to access your dashboard.
        </p>
      </div>
      <LoginForm nextParam={nextParam} />
    </main>
  );
}
