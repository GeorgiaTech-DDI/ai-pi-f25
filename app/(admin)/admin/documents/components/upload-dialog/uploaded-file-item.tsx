"use client";

import {
  FileText,
  FileCode,
  FileSignature,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { filesize } from "filesize";

interface UploadedFileItemProps {
  file: File;
  onDelete: (file: File) => void;
  isUploading?: boolean;
  progress?: number;
  error?: string;
  className?: string;
}

export function UploadedFileItem({
  file,
  onDelete,
  isUploading = false,
  progress = 0,
  error,
  className,
}: UploadedFileItemProps) {
  const fullFileName = file.name;
  const lastDotIndex = fullFileName.lastIndexOf(".");
  const baseName =
    lastDotIndex !== -1
      ? fullFileName.substring(0, lastDotIndex)
      : fullFileName;
  const extension =
    lastDotIndex !== -1 ? fullFileName.substring(lastDotIndex) : "";

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf")
      return <FileSignature className="h-8 w-8 text-red-500" />;
    if (ext === "md") return <FileCode className="h-8 w-8 text-blue-500" />;
    return <FileText className="text-muted-foreground h-8 w-8" />;
  };

  return (
    <div
      className={cn(
        "bg-card relative flex flex-col gap-3 rounded-lg border p-4 shadow-sm transition-all",
        error ? "border-destructive/50" : "border-border",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {error ? (
            <AlertCircle className="text-destructive h-8 w-8" />
          ) : (
            getFileIcon(file.name)
          )}
        </div>

        {/* Middle Truncation Logic */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex w-full text-sm leading-none font-medium">
            <span className="truncate">{baseName}</span>
            <span className="flex-shrink-0">{extension}</span>
          </div>

          <span className="text-muted-foreground text-xs">
            {filesize(file.size)}
            {error && (
              <span className="text-destructive ml-2 italic">• {error}</span>
            )}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          onClick={() => onDelete(file)}
          disabled={isUploading && progress < 100 && !error}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isUploading && !error && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
            <span>{progress === 100 ? "Processing..." : "Uploading..."}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
