import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { LoginForm } from "./_components/login-form";

export default async function Home() {
  const token = cookies().get("token")?.value;
  if (token) {
    try {
      const payload = await verifyJwt(token);
      redirect(payload.role === "MANAGER" ? "/manager" : "/nurse");
    } catch {
      // Invalid token — fall through to login
    }
  }

  return <LoginForm />;
}
