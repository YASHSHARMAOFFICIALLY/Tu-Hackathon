import { ComingSoon } from "@/components/landing/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Live issues"
      description="Every open report in the city, filterable by status, category, priority and department. Personal details of reporters are never included in this view."
      endpoint="GET /api/issues"
    />
  );
}
