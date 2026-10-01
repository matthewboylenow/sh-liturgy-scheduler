import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Shell
      user={user}
      area="volunteer"
      nav={[
        { href: "/app", label: "Home", icon: "home" },
        { href: "/app/schedule", label: "Sign up", icon: "plus" },
        { href: "/app/mine", label: "My schedule", icon: "calendar" },
        { href: "/app/profile", label: "Profile", icon: "person" },
      ]}
    >
      {children}
    </Shell>
  );
}
