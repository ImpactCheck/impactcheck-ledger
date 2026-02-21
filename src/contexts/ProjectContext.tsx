import { createContext, useContext, useState, ReactNode } from "react";

export interface ProjectConfig {
  projectName: string;
  year: number;
  regions: string[];
  companyType: "ai_infra" | "enterprise" | "startup" | "other";
}

const DEFAULT_PROJECT: ProjectConfig = {
  projectName: "Untitled Project",
  year: 2026,
  regions: [],
  companyType: "ai_infra",
};

interface ProjectContextValue {
  project: ProjectConfig;
  setProject: (p: ProjectConfig) => void;
  updateProject: (partial: Partial<ProjectConfig>) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectConfig>(DEFAULT_PROJECT);

  const updateProject = (partial: Partial<ProjectConfig>) =>
    setProject((prev) => ({ ...prev, ...partial }));

  return (
    <ProjectContext.Provider value={{ project, setProject, updateProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
