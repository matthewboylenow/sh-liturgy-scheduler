import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(isStaff(user) ? "/admin" : "/app");
}
