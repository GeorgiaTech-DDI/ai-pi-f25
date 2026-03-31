import { Checkbox } from "@/components/ui/checkbox";
import { PineconeFile } from "@/lib/files/types";
import { ColumnDef } from "@tanstack/react-table";
import { File, Trash } from "lucide-react";
import { filesize } from "filesize";
import { Button } from "@/components/ui/button";
import FileRowButton from "./file-row-button";

export const columns: ColumnDef<PineconeFile>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && undefined)
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    size: 20,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "metadata.filename",
    header: "Name",
    cell: ({ getValue }) => {
      const filename = getValue() as string;
      return (
        <div className="flex items-center gap-x-2">
          <File className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{filename}</span>
        </div>
      );
    },
    size: 250,
    enableSorting: true,
  },
  {
    accessorKey: "metadata.uploadDate",
    header: "Uploaded",
    cell: ({ getValue }) => {
      const date = getValue() as string;
      const dateObj = new Date(date);
      return dateObj.toLocaleString();
    },
    enableSorting: true,
  },
  {
    accessorKey: "metadata.fileSize",
    header: "Size",
    cell: ({ getValue }) => {
      const fileSize = getValue() as number;
      return filesize(fileSize);
    },
    size: 100,
  },
  {
    accessorKey: "metadata.chunkCount",
    header: "Chunk Count",
    size: 100,
  },
  {
    accessorKey: "metadata.description",
    header: "Description",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const file = row.original;
      return <FileRowButton file={file} />;
    },
    size: 30,
    enableSorting: false,
    enableHiding: false,
  },
];
