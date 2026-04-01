"use client";

import { Dropzone } from "@/components/dropzone";
import { Button } from "@/components/ui/button";
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
import { Plus } from "lucide-react";
import { useState } from "react";
import { UploadedFileItem } from "./uploaded-file-item";
import { Input } from "@/components/ui/input";

export default function UploadDialog() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setFile(null);
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Upload File
      </DialogTrigger>
      <DialogContent className="w-1/4 max-w-none min-w-[600px] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Accepts .pdf, .md, and .txt files up to 5 MB.
          </DialogDescription>
        </DialogHeader>
        {!file ? (
          <Dropzone
            accept={{
              "application/pdf": [".pdf"],
              "text/markdown": [".md"],
              "text/plain": [".txt"],
            }}
            maxSize={1024 * 1024 * 5}
            onDrop={(files) => setFile(files[0])}
            containerClassName="h-64"
          />
        ) : (
          <div className="flex w-full flex-col gap-y-4">
            <UploadedFileItem file={file} onDelete={() => setFile(null)} />
            <Input placeholder="Description (optional)" />
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose render={<Button />}>Upload</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
