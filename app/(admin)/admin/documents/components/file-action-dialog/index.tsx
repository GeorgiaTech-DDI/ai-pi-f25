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
import { Loader2 } from "lucide-react";
import { Dropzone } from "@/components/dropzone";
import { UploadedFileItem } from "./uploaded-file-item";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface FileActionProps {
  title: string;
  descriptionLabel: string;
  submitLabel: string;
  loadingLabel: string;
  trigger?: React.ReactElement;
  onAction: (formData: FormData) => Promise<void> | void;
  isPending: boolean;
  initialDescription?: string;
  extraData?: Record<string, string>;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function FileActionDialog({
  title,
  descriptionLabel,
  submitLabel,
  loadingLabel,
  trigger,
  onAction,
  isPending,
  initialDescription = "",
  extraData = {},
  open,
  setOpen,
}: FileActionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState(initialDescription);

  const handleSubmit = async (formData: FormData) => {
    if (file) formData.append("file", file);
    if (description) formData.append("description", description);

    Object.entries(extraData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      await onAction(formData);
      setFile(null);
      setDescription("");
    } catch (error) {}
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isPending) {
          setFile(null);
          setDescription(initialDescription);
        }
        setOpen(o);
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent className="min-w-[600px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{descriptionLabel}</DialogDescription>
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
                  {loadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
