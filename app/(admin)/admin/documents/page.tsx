import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getPineconeFiles } from "@/lib/files";
import FilesTable from "./components/files-table";

export default async function Page() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["files"],
    queryFn: getPineconeFiles,
  });

  return (
    <div className="p-6 pt-0">
      <h3 className="text-2xl font-medium">Documents</h3>
      <div className="mt-6 flex flex-col gap-y-4">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FilesTable />
        </HydrationBoundary>
      </div>
    </div>
  );
}
