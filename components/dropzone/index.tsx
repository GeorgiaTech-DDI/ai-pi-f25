"use client";

import { cn } from "@/lib/utils";
import { filesize } from "filesize";
import { UploadCloud } from "lucide-react";
import { DropzoneOptions, FileRejection, useDropzone } from "react-dropzone";

interface DropzoneProps extends DropzoneOptions {
  containerClassName?: string;
  dropMessage?: string;
  onFilesRejected?: (fileRejections: FileRejection[]) => void;
}

export function Dropzone({
  onDrop,
  onFilesRejected,
  accept,
  maxFiles,
  maxSize,
  minSize,
  multiple = true,
  disabled = false,
  containerClassName,
  dropMessage = "Drag & drop files here, or click to select",
  ...props
}: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      onDropRejected: onFilesRejected,
      accept,
      maxFiles,
      maxSize,
      minSize,
      multiple,
      disabled,
      ...props,
    });

  return (
    <div className="w-full space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "group border-muted-foreground/25 bg-muted/50 hover:bg-muted relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors",
          isDragActive && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-60",
          containerClassName
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="bg-background ring-muted-foreground/20 rounded-full p-3 shadow-sm ring-1 ring-inset">
            <UploadCloud
              className={cn(
                "text-muted-foreground h-6 w-6",
                isDragActive && "text-primary"
              )}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? "Drop them now!" : dropMessage}
            </p>
            {maxSize && (
              <p className="text-muted-foreground text-xs">
                Max file size: {filesize(maxSize, { round: 0 })}
              </p>
            )}
          </div>
        </div>
      </div>

      {fileRejections.length > 0 && (
        <ul className="text-destructive mt-2 list-inside list-disc text-xs">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name}>
              {file.name} - {errors.map((e) => e.message).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
