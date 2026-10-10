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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar workspaceId={workspaceId} workspaceName="Exporter Workspace" />
      <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900">
        {children}
      </main>
      <TradeCopilot workspaceId={workspaceId} />
    </div>
  );
}
