import { Badge } from "../ui/badge";

export default function Header({
  rightContent,
  leftItem,
}: {
  rightContent: React.ReactNode;
  leftItem: React.ReactNode;
}) {
  return (
    <header
      className="bg-background sticky top-0 z-10 flex w-full items-center justify-between p-4"
      data-header
    >
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex items-center justify-center gap-2">
          {leftItem}
          <h2 className="text-lg font-bold">AI PI</h2>
        </div>
        <Badge
          className="h-4 border-amber-500 text-xs text-amber-500"
          variant="outline"
        >
          Beta
        </Badge>
      </div>
      {rightContent}
    </header>
  );
}
