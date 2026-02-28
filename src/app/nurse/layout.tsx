import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import { NurseShell } from "./_components/nurse-shell";

export default async function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/");

  let userName = "אחות";
  try {
    const payload = await verifyJwt(token);
    if (payload.role !== "NURSE") redirect("/");
    userName = payload.name;
  } catch {
    redirect("/");
  }

  return <NurseShell userName={userName}>{children}</NurseShell>;
}
