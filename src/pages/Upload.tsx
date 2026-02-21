import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Upload as UploadIcon, FileSpreadsheet, FileText as FileTextIcon, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Document, JobStatus } from "@/contracts/impactcheck.v2";
import JobProgressCard from "@/components/JobProgressCard";

export default function Upload() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(() => {
    api.listDocuments(projectId).then(setDocs);
  }, [projectId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await api.uploadDocument(projectId, file);
    }
    setUploading(false);
    loadDocs();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExtract = async () => {
    const initial = await api.startExtract(projectId);
    setJob(initial);
    pollRef.current = setInterval(async () => {
      const status = await api.getJob(initial.id);
      setJob(status);
      if (status.status === "succeeded" || status.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 1500);
  };

  const fileIcon = (ft: string) => {
    if (ft === "csv" || ft === "xlsx") return <FileSpreadsheet className="h-4 w-4 text-primary" />;
    return <FileTextIcon className="h-4 w-4 text-primary" />;
  };

  const extractDone = job?.status === "succeeded";
  const extractFailed = job?.status === "failed";
  const extractRunning = job?.status === "running" || job?.status === "queued";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Upload</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Upload your hardware BOM, energy bills, or facility specs.</p>
      </div>

      {/* Project summary */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Name</span>
              <p className="font-semibold">{project.projectName}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Year</span>
              <p className="font-semibold">{project.year}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Region</span>
              <p className="font-semibold">{project.primaryRegion?.replace(/_/g, " ") || project.regions[0] || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card className="card-elevated border-0">
        <CardHeader>
          <CardTitle className="text-lg">Upload Files</CardTitle>
          <CardDescription>Drag and drop or browse for your data files.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="block border-2 border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.02] transition-all cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".csv,.xlsx,.json,.pdf"
              onChange={handleFileChange}
            />
            {uploading ? (
              <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
            ) : (
              <div className="h-14 w-14 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
                <UploadIcon className="h-6 w-6 text-primary" />
              </div>
            )}
            <p className="font-semibold text-foreground">{uploading ? "Uploading…" : "Drop files here or click to browse"}</p>
            <p className="text-xs mt-1.5 text-muted-foreground">CSV, XLSX, JSON, PDF supported</p>
          </label>
        </CardContent>
      </Card>

      {/* Document list */}
      {docs.length > 0 && (
        <Card className="card-elevated border-0">
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            <CardDescription>{docs.length} file(s) ready</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    {fileIcon(doc.fileType)}
                    <span className="font-mono text-sm">{doc.filename}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Check className="h-3.5 w-3.5" />
                    {doc.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction */}
      {docs.length > 0 && (
        <Card className="card-elevated border-0">
          <CardHeader>
            <CardTitle className="text-lg">Extract Activities</CardTitle>
            <CardDescription>Parse uploaded documents to extract carbon-relevant line items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {job && <JobProgressCard job={job} type="extract" />}
            {!extractRunning && !extractDone && (
              <Button onClick={handleExtract} className="gap-2 rounded-xl" disabled={extractRunning}>
                Run Extraction
              </Button>
            )}
            {extractRunning && (
              <Button disabled className="gap-2 rounded-xl">
                <Loader2 className="h-4 w-4 animate-spin" /> Extracting…
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/setup")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/activities")} disabled={!extractDone} className="gap-2 rounded-xl">
          Go to Activities <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
