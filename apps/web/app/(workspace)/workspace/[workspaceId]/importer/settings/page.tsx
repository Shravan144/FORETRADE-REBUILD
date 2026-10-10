"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ImporterSettingsRedirect({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/workspace/${workspaceId}/importer/profile`);
  }, [workspaceId, router]);

  return null;
}
