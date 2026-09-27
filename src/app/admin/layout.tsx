import { requireStaff } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const admin = user.role === "admin";
  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/schedule", label: "Schedule" },
    { href: "/admin/people", label: "People" },
    ...(admin
      ? [
          { href: "/admin/ministries", label: "Ministries" },
          { href: "/admin/mass-times", label: "Mass times" },
          { href: "/admin/kiosks", label: "Kiosks" },
          { href: "/admin/log", label: "Log" },
        ]
      : []),
  ];
  return (
    <Shell user={user} area="admin" nav={nav}>
      {children}
    </Shell>
  );
}
