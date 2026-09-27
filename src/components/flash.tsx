import { Alert } from "@/components/ui";

export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (!sp.error && !sp.ok) return null;
  return (
    <div className="mb-4 space-y-2">
      {sp.error && <Alert kind="error">{sp.error}</Alert>}
      {sp.ok && <Alert kind="success">{sp.ok}</Alert>}
    </div>
  );
}
