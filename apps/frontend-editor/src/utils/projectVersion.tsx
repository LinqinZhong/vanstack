import { createContext, useContext, type ReactNode } from 'react';

const ProjectVersionContext = createContext<string | null>(null);

export function ProjectVersionProvider({
  versionId,
  children,
}: {
  versionId: string | null;
  children: ReactNode;
}) {
  return <ProjectVersionContext.Provider value={versionId}>{children}</ProjectVersionContext.Provider>;
}

export function useProjectVersionId() {
  return useContext(ProjectVersionContext);
}
