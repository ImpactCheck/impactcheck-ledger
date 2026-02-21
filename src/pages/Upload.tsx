import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Upload as UploadIcon, FileSpreadsheet,
  FileText as FileTextIcon, Check, Loader2, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Document } from "@/contracts/impactcheck.v2";
import { cn } from "@/lib/utils";

export default function Upload() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(() => {
    api.listDocuments(projectId).then(setDocs);
  }, [projectId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (!fileArr.length) return;
    setUploading(true);
    setJustUploaded(false);
    for (const file of fileArr) {
      await api.uploadDocument(projectId, file);
    }
    setUploading(false);
    setJustUploaded(true);
    loadDocs();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const fileIcon = (ft: string) => {
    if (ft === "csv" || ft === "xlsx")
      return <FileSpreadsheet className="h-4 w-4 text-primary" />;
    return <FileTextIcon className="h-4 w-4 text-primary" />;
  };

  const hasDocs = docs.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <p className="step-number mb-1">Step 2</p>
        <h1 className="text-2xl font-bold tracking-tight">Data Upload</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Upload hardware BOMs, energy bills, or facility specs. CSV, XLSX, JSON, and PDF supported.
        </p>
      </div>

      {/* Project summary */}
      <Card className="card-elevated border-0">
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Project
              </span>
              <p className="font-semibold mt-0.5 truncate">{project.projectName}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Year
              </span>
              <p className="font-semibold mt-0.5">{project.year}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Region
              </span>
              <p className="font-semibold mt-0.5 truncate">
                {project.primaryRegion?.replace(/_/g, " ") || project.regions[0] || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload Files</CardTitle>
          <CardDescription>Drag and drop files here, or click to browse.</CardDescription>
        </CardHeader>
        <CardContent>
          <label
            className={cn(
              "block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/40 hover:bg-primary/[0.02]",
              uploading && "pointer-events-none opacity-70"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".csv,.xlsx,.json,.pdf"
              onChange={handleFileChange}
            />
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                <p className="font-semibold text-foreground">Uploading…</p>
                <p className="text-xs mt-1 text-muted-foreground">Please wait</p>
              </>
            ) : dragOver ? (
              <>
                <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <UploadIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold text-primary">Drop to upload</p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <UploadIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold text-foreground">Drop files here or click to browse</p>
                <p className="text-xs mt-1.5 text-muted-foreground">CSV · XLSX · JSON · PDF</p>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Document list */}
      {hasDocs && (
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                <CardDescription className="mt-0.5">{docs.length} file{docs.length !== 1 ? "s" : ""} ready for extraction</CardDescription>
              </div>
              {docs.length > 0 && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {fileIcon(doc.fileType)}
                  <span className="font-mono text-sm truncate">{doc.filename}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary shrink-0 ml-3">
                  <Check className="h-3.5 w-3.5" />
                  <span className="capitalize">{doc.status}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Auto-proceed prompt — shown after a successful upload */}
      {justUploaded && hasDocs && (
        <button
          onClick={() => navigate("/activities")}
          className="w-full auto-start-banner flex items-center justify-between cursor-pointer group hover:opacity-90 transition-opacity text-left"
        >
          <div>
            <p className="text-sm font-semibold text-primary">Files uploaded successfully</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ready to extract activities — click to continue
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/setup")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={() => navigate("/activities")}
          disabled={!hasDocs}
          className="gap-2 rounded-xl"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
