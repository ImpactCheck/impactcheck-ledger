import type {
  Project,
  Document,
  JobStatus,
  ExtractedActivity,
  ActivityEstimate,
  Report,
  Recommendation,
  DeploymentPlan,
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

  // Documents
  uploadDocument(projectId: string, file: File): Promise<Document>;
  listDocuments(projectId: string): Promise<Document[]>;

  // Extraction
  startExtract(projectId: string): Promise<JobStatus>;
  getJob(jobId: string): Promise<JobStatus>;

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

  // Report
  getReport(projectId: string): Promise<Report>;

  // Recommendations
  generateRecommendations(projectId: string): Promise<Recommendation[]>;
  finalizeStrategy(
    projectId: string,
    recommendationIds: string[]
  ): Promise<{ strategyText: string }>;

  // Deploy
  deployCrusoe(projectId: string): Promise<DeploymentPlan>;
  getDeploymentStatus(projectId: string): Promise<DeploymentPlan>;
}
