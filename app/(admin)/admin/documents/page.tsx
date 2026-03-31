import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getPineconeFiles } from "@/lib/files";
import FilesTable from "./components/files-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function Page() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["files"],
    queryFn: getPineconeFiles,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-medium">Documents</h3>
        <Button>
          <Plus className="h-4 w-4" /> Upload File
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FilesTable />
        </HydrationBoundary>
      </div>
    </div>
  );
}
