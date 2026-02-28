import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import { ManagerSidebar } from "@/components/manager-sidebar";
import { ManagerTopBar } from "@/components/manager-topbar";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/");

  let userName = "Manager";
  try {
    const payload = await verifyJwt(token);
    if (payload.role !== "MANAGER") redirect("/");
    userName = payload.name;
  } catch {
    redirect("/");
  }

  return (
    <div className="flex h-screen">
      <ManagerSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ManagerTopBar userName={userName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
