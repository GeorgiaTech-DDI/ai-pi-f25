import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Context } from "@/lib/types";
import { FileIcon, Search } from "lucide-react";

export default function ReferencesSheet({
  isOpen,
  onClose,
  contexts,
}: {
  isOpen: boolean;
  onClose: () => void;
  contexts: Context[];
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>References</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full overflow-y-auto">
          {contexts.map((context, index) => (
            <div key={index} className="p-4 space-y-1">
              <div className="flex flex-row items-center gap-2">
                {context.metadata.type === "document_chunk" ? (
                  <FileIcon className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <h3 className="font-medium">{context.metadata.filename}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                ...{context.metadata.text}...
              </p>
            </div>
          ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
