import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Upload as UploadIcon, FileSpreadsheet, FileText as FileTextIcon, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { Document } from "@/contracts/impactcheck.v2";

export default function Upload() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);

  useEffect(() => {
    api.listDocuments("prj_1").then(setDocs);
  }, []);

  const fileIcon = (ft: string) => {
    if (ft === "csv" || ft === "xlsx") return <FileSpreadsheet className="h-4 w-4 text-primary" />;
    return <FileTextIcon className="h-4 w-4 text-primary" />;
  };

  const statusPillClass = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30";
      case "processing":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
      case "error":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Upload</h1>
        <p className="text-muted-foreground mt-1">Upload your hardware BOM, energy bills, or facility specs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Files</CardTitle>
          <CardDescription>Drag and drop or browse for your data files.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer">
            <UploadIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">Drop files here or click to browse</p>
            <p className="text-xs mt-1">CSV, XLSX, JSON supported</p>
          </div>
        </CardContent>
      </Card>

      {docs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
            <CardDescription>{docs.length} file(s) ready</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    {fileIcon(doc.fileType)}
                    <span className="font-mono">{doc.filename}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusPillClass(doc.status)}`}
                  >
                    {doc.status === "ready" && <Check className="h-3 w-3" />}
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/setup")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/activities")} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
