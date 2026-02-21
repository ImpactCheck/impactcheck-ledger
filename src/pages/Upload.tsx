import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Upload as UploadIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const navigate = useNavigate();

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
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer">
            <UploadIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">Drop files here or click to browse</p>
            <p className="text-xs mt-1">CSV, XLSX, JSON supported</p>
          </div>
        </CardContent>
      </Card>

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
