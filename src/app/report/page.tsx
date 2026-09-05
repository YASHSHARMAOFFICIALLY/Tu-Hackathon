import { ComingSoon } from "@/components/landing/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Report an issue"
      description="A short form: what the problem is, where it is, and a category. It runs a duplicate check against open reports before it submits, then gives you a reference number."
      endpoint="POST /api/issues"
    />
  );
}
