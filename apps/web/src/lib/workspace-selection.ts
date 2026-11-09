export type WorkspaceOption = { id?: string; workspaceId?: string };

export const WORKSPACE_STORAGE_KEY = "radar-comercial:selected-workspace";

export function preferredWorkspaceId(workspaces: WorkspaceOption[]): string {
  const firstId = workspaces[0]?.id ?? workspaces[0]?.workspaceId ?? "";
  if (typeof window === "undefined") return firstId;
  const savedId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  return workspaces.some((workspace) => (workspace.id ?? workspace.workspaceId) === savedId)
    ? savedId ?? firstId
    : firstId;
}

export function rememberWorkspaceId(workspaceId: string): void {
  if (typeof window !== "undefined" && workspaceId) {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }
}
