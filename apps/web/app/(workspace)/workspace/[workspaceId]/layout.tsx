import { Sidebar } from "@/components/workspace/sidebar";
import TradeCopilot from "@/components/TradeCopilot";

export default async function WorkspaceViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-slate-100">
      <Sidebar workspaceId={workspaceId} workspaceName="Exporter Workspace" />
      <main className="flex-1 overflow-y-auto bg-[#0B0F19] text-slate-100">
        {children}
      </main>
      <TradeCopilot workspaceId={workspaceId} />
    </div>
  );
}
