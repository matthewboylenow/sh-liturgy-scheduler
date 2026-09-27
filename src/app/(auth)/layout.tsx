import { env } from "@/lib/env";
import { AuthFrame } from "@/components/auth-frame";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame parish={env.parishName()}>{children}</AuthFrame>;
}
