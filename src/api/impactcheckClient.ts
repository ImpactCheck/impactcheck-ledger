import type {
  Project,
  Document,
  JobStatus,
  ExtractedActivity,
  ActivityEstimate,
  Report,
  Recommendation,
  RegionComplianceResult,
} from "@/contracts/impactcheck.v2";

export interface ImpactcheckClient {
  // Project
  createProject(params: {
    name: string;
    year: number;
    companyType: "ai_infra" | "other";
    primaryRegion: string;
    comparisonRegions?: string[];
  }): Promise<Project>;
  getProject(projectId: string): Promise<Project>;
  listProjects(): Promise<Project[]>;
  deleteProject(projectId: string): Promise<void>;

  // Documents
  uploadDocument(projectId: string, file: File): Promise<Document>;
  listDocuments(projectId: string): Promise<Document[]>;
  deleteDocument(projectId: string, documentId: string): Promise<void>;

  // Extraction
  startExtract(projectId: string): Promise<JobStatus>;
  getJob(jobId: string): Promise<JobStatus>;
  getActiveJob(projectId: string, type: string): Promise<JobStatus | null>;

  // Activities
  getActivities(projectId: string): Promise<ExtractedActivity[]>;
  updateActivities(
    projectId: string,
    activities: ExtractedActivity[]
  ): Promise<ExtractedActivity[]>;
  exportCsv(projectId: string): Promise<string>;

  // Mapping
  startMapping(projectId: string): Promise<JobStatus>;
  getEstimates(projectId: string): Promise<ActivityEstimate[]>;

  // Simulation (comparison regions)
  startSimulation(projectId: string): Promise<JobStatus>;
  getSimulationEstimates(projectId: string): Promise<ActivityEstimate[]>;

  // Report
  getReport(projectId: string): Promise<Report>;

  // Compliance (per-region regulatory compliance via Gemini)
  getCompliance(projectId: string): Promise<{ byRegion: Record<string, RegionComplianceResult> }>;

  // Recommendations
  // Recommendations (job-based)
  startRecommendations(projectId: string): Promise<JobStatus>;
  getRecommendations(projectId: string): Promise<Recommendation[]>;
  generateRecommendations(projectId: string): Promise<Recommendation[]>;
  finalizeStrategy(
    projectId: string,
    recommendationIds: string[]
  ): Promise<{ strategyText: string }>;

}
