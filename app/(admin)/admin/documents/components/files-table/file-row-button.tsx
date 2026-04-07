import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { Download, MoreVertical, Trash } from "lucide-react";
import { useState } from "react";
import { deleteFile } from "../../_actions";
import { PineconeFile } from "@/lib/files/types";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Spinner } from "@/components/loaders/spinner";
export default function FileRowButton({ file }: { file: PineconeFile }) {
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { mutate: deleteMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      toast.success("File deleted successfully");
      queryClient.refetchQueries({ queryKey: ["files"] });
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });

  const handleDownload = () => {
    const fileUrl = file.metadata.downloadUrl;
    if (!fileUrl) {
      toast.error("File has no URL assigned");
      return;
    }

    window.location.assign(`${fileUrl}?download=1`);
    toast.success("Download started");
  };

  return (
    <>
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              file and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation(file.metadata.filename)}
              variant="destructive"
              disabled={isDeleting}
            >
              {isDeleting ? <Spinner /> : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {file.metadata.downloadUrl && (
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="size-4" /> Download
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
