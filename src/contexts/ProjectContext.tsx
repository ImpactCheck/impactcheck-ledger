import { createContext, useContext, useState, ReactNode } from "react";

export type UseCase = "company" | "investor" | "regulator" | "other";

export interface ProjectConfig {
  projectName: string;
  year: number;
  regions: string[];
  useCase: UseCase;
  primaryRegion: string;
  comparisonRegions: string[];
  baselineFootprintKgCO2e?: number;
  currentProjectId: string | null;
  deployOptIn: boolean;
}

const DEFAULT_PROJECT: ProjectConfig = {
  projectName: "Untitled Project",
  year: 2026,
  regions: [],
  useCase: "company",
  primaryRegion: "",
  comparisonRegions: [],
  baselineFootprintKgCO2e: undefined,
  currentProjectId: localStorage.getItem("currentProjectId"),
  deployOptIn: false,
};

interface ProjectContextValue {
  project: ProjectConfig;
  setProject: (p: ProjectConfig) => void;
  updateProject: (partial: Partial<ProjectConfig>) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProjectState] = useState<ProjectConfig>(DEFAULT_PROJECT);

  const setProject = (p: ProjectConfig) => {
    if (p.currentProjectId) localStorage.setItem("currentProjectId", p.currentProjectId);
    setProjectState(p);
  };

  const updateProject = (partial: Partial<ProjectConfig>) =>
    setProjectState((prev) => {
      const next = { ...prev, ...partial };
      if (partial.currentProjectId) localStorage.setItem("currentProjectId", partial.currentProjectId);
      return next;
    });

  return (
    <ProjectContext.Provider value={{ project, setProject, updateProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

const FALLBACK: ProjectContextValue = {
  project: DEFAULT_PROJECT,
  setProject: () => {},
  updateProject: () => {},
};

export function useProject() {
  const ctx = useContext(ProjectContext);
  // Return fallback during HMR transitions instead of crashing
  return ctx ?? FALLBACK;
}
