import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { replacePineconeFile } from "@/lib/files";
import { PineconeFile } from "@/lib/files/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, MoreVertical, Replace, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteFile } from "../../_actions";
import DeleteFileAlertDialog from "../delete-file-alert-dialog";
import FileActionDialog from "../file-action-dialog";

export default function FileRowButton({ file }: { file: PineconeFile }) {
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);

  const { mutate: deleteMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteFile,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["files"] });
      setIsDeleteDialogOpen(false);
      toast.success("File deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });

  const { mutateAsync: replaceMutation, isPending: isReplacing } = useMutation({
    mutationFn: replacePineconeFile,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["files"] });
      setIsReplaceDialogOpen(false);
      toast.success("File replaced successfully");
    },
    onError: () => {
      toast.error("Failed to replace file");
    },
  });

  const handleDownload = () => {
    const fileUrl = file.metadata.downloadUrl;
    if (!fileUrl) {
      toast.error("File has no URL assigned");
      return;
    }

    window.location.assign(
      `/api/files/download?url=${encodeURIComponent(fileUrl)}`
    );
    toast.success("Download completed");
  };

  return (
    <>
      <DeleteFileAlertDialog
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onConfirm={() => deleteMutation(file.metadata.fileUUID)}
        isDeleting={isDeleting}
      />

      <FileActionDialog
        isPending={isReplacing}
        onAction={(formData) => replaceMutation(formData)}
        extraData={{ oldFileUUID: file.metadata.fileUUID }}
        title="Replace File"
        descriptionLabel="Accepts .pdf, .md, and .txt"
        open={isReplaceDialogOpen}
        setOpen={setIsReplaceDialogOpen}
        submitLabel="Replace"
        loadingLabel="Replacing..."
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="hover:bg-red-500">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent>
          {file.metadata.downloadUrl && (
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="size-4" /> Download
            </DropdownMenuItem>
          )}
          {file.metadata.filename && (
            <DropdownMenuItem onClick={() => setIsReplaceDialogOpen(true)}>
              <Replace className="size-4" /> Replace
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash className="text-destructive size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
