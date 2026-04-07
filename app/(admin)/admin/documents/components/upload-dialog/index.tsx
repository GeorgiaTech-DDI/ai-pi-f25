"use client";

import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { Dropzone } from "@/components/dropzone";
import { UploadedFileItem } from "./uploaded-file-item";
import { useMutation } from "@tanstack/react-query";
import { uploadPineconeFile } from "@/lib/files";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // note also controlled in next.config.js

export default function UploadDialog() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const [open, setOpen] = useState(false);

  const { mutateAsync: uploadFile, isPending } = useMutation({
    mutationFn: uploadPineconeFile,
    onSuccess: () => {
      setOpen(false);
      setFile(null);
      setDescription("");
    },
    onError: (error) => {
      console.error("Upload failed", error);
    },
  });

  const handleUpload = (formData: FormData) => {
    if (file) formData.append("file", file);
    if (description) formData.append("description", description);
    uploadFile(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4" /> Upload File
          </Button>
        }
      />

      <DialogContent className="min-w-[600px]">
        <form action={handleUpload}>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>Accepts .pdf, .md, and .txt</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!file ? (
              <Dropzone
                accept={{
                  "application/pdf": [".pdf"],
                  "text/markdown": [".md"],
                  "text/plain": [".txt"],
                }}
                maxSize={MAX_FILE_SIZE_BYTES}
                onDrop={(files) => setFile(files[0])}
                containerClassName="h-64"
              />
            ) : (
              <div className="flex w-full flex-col gap-y-4">
                <UploadedFileItem file={file} onDelete={() => setFile(null)} />
                <Input
                  name="description"
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              }
            />

            <Button type="submit" disabled={!file || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
