import { ComingSoon } from "@/components/landing/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Track a report"
      description="Enter the reference number you were given and see the full timeline: when it was acknowledged, which department picked it up, and how it was resolved. No account needed."
      endpoint="GET /api/public/issues/:number"
    />
  );
}
