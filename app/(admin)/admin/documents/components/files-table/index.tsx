"use client";

import { useQuery } from "@tanstack/react-query";
import { getPineconeFiles } from "@/lib/files";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";

export default function FilesTable() {
  const { data = [] } = useQuery({
    queryKey: ["files"],
    queryFn: getPineconeFiles,
  });

  return <DataTable columns={columns} data={data} />;
}
