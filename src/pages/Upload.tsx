import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Upload as UploadIcon, FileSpreadsheet,
  FileText as FileTextIcon, FileCode, File, Check, Loader2,
  ChevronRight, Lightbulb, Info, Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Document } from "@/contracts/impactcheck.v2";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function fileIcon(fileType: string) {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return <FileTextIcon className="h-4 w-4 text-red-500" />;
    case "xlsx":
    case "csv":
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    case "json":
      return <FileCode className="h-4 w-4 text-blue-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Upload() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await api.deleteDocument(projectId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("File removed");
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  };

  const hasDocs = docs.length > 0;
  const readyDocs = docs.filter((d) => d.status === "ready").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <p className="step-number mb-1">Step 02</p>
        <h1 className="text-2xl font-bold tracking-tight">Data Collection</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Upload hardware BOMs, energy bills, or facility specs. CSV, XLSX, JSON, and PDF supported.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Main panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Upload area */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Upload Files</CardTitle>
                  <CardDescription>Drag and drop files here, or click to browse.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled>
                    History
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled>
                    Connect Cloud
                  </Button>
                </div>
              </div>
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
                    <CardDescription className="mt-0.5">
                      {docs.length} file{docs.length !== 1 ? "s" : ""} · {readyDocs} ready
                    </CardDescription>
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
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        {doc.status === "processing" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground">Analyzing…</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5 text-primary" />
                            <span className="text-primary font-medium">Ready</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete file"
                      >
                        {deletingId === doc.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Auto-proceed prompt */}
          {justUploaded && hasDocs && (
            <button
              onClick={() => navigate("/emissions")}
              className="w-full auto-start-banner flex items-center justify-between cursor-pointer group hover:opacity-90 transition-opacity text-left"
            >
              <div>
                <p className="text-sm font-semibold text-primary">Files uploaded successfully</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ready to calculate emissions — click to continue
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}

          {/* Footer status + navigation */}
          {hasDocs && (
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 border border-border/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{docs.length}</span> documents ·{" "}
                <span className="font-semibold text-primary">{readyDocs}</span> ready
              </span>
              <Button onClick={() => navigate("/emissions")} className="gap-2 rounded-xl">
                Continue to Emissions <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/setup")} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {!hasDocs && (
              <Button onClick={() => navigate("/emissions")} disabled={!hasDocs} className="gap-2 rounded-xl">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Right AI tips panel ──────────────────────────────────── */}
        <div className="w-72 shrink-0 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 sticky top-8">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">AI Extraction Tips</h3>
            </div>

            <TipSection
              title="Energy Bills"
              tips={["kWh usage per billing period", "Provider & tariff type", "Meter number & site ID"]}
            />
            <TipSection
              title="Cloud Invoices"
              tips={["Instance type & size (e.g. m5.xlarge)", "Region (us-east-1, eu-west-1)", "Usage hours & GB transferred"]}
            />
            <TipSection
              title="Hardware Manifests"
              tips={["Model numbers & quantities", "Power rating (TDP in watts)", "Manufacture year"]}
            />

            <div className="rounded-xl bg-primary/8 border border-primary/15 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-primary mb-0.5">Pro Tip</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Upload multiple files together — the AI will cross-reference them for higher accuracy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TipSection({ title, tips }: { title: string; tips: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
