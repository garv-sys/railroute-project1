import { Suspense } from "react";

import { SearchWorkspaceClient } from "./search-workspace-client";

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050816] text-white" />}>
      <SearchWorkspaceClient />
    </Suspense>
  );
}
