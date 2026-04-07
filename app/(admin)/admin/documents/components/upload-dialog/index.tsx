"use client";

import { Button } from "@/components/ui/button";
import FileActionDialog from "../file-action-dialog";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadPineconeFile } from "@/lib/files";

export default function UploadDialog() {
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const [open, setOpen] = useState(false);

  const { mutateAsync: uploadFile, isPending } = useMutation({
    mutationFn: uploadPineconeFile,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["files"] });
      setOpen(false);
      setDescription("");
      setFile(null);
      toast.success("File uploaded successfully");
    },
    onError: (error) => {
      console.error("Upload failed", error);
      toast.error("Failed to upload file");
    },
  });

  const handleUpload = async (formData: FormData) => {
    if (file) formData.append("file", file);
    if (description) formData.append("description", description);
    await uploadFile(formData);
  };

  return (
    <FileActionDialog
      title="Upload File"
      descriptionLabel="Accepts .pdf, .md, and .txt"
      submitLabel="Upload"
      loadingLabel="Uploading..."
      open={open}
      setOpen={setOpen}
      onAction={handleUpload}
      isPending={isPending}
      trigger={
        <Button>
          <Upload className="mr-2 h-4 w-4" /> Upload
        </Button>
      }
    />
  );
}
