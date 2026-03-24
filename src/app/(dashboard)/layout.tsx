import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NavSidebar } from "@/components/nav-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
