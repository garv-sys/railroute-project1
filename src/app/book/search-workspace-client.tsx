"use client";

import { useSearchParams } from "next/navigation";

import { RailRouteSearchWorkspace } from "@/components/railroute-super-app";

export function SearchWorkspaceClient() {
  const params = useSearchParams();

  return (
    <RailRouteSearchWorkspace
      initialSource={params.get("source") || ""}
      initialDestination={params.get("destination") || ""}
      initialDate={params.get("date") || undefined}
      initialClassType={params.get("classType") || undefined}
    />
  );
}
