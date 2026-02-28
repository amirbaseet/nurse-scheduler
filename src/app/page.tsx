import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  const token = cookies().get("token");
  if (token) {
    redirect("/manager");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">NurseScheduler Pro</h1>
        <p className="mt-2 text-muted-foreground">Login page coming soon</p>
      </div>
    </main>
  );
}
