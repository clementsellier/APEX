import { Suspense } from "react";
import { PlaceholderHome } from "@/components/placeholder-home";

export default function Page() {
  return (
    <Suspense>
      <PlaceholderHome role="ADMIN" />
    </Suspense>
  );
}
