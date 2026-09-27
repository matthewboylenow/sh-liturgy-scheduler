import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Shell
      user={user}
      area="volunteer"
      nav={[
        { href: "/app", label: "Home" },
        { href: "/app/schedule", label: "Sign up" },
        { href: "/app/mine", label: "My schedule" },
        { href: "/app/profile", label: "Profile" },
      ]}
    >
      {children}
    </Shell>
  );
}
