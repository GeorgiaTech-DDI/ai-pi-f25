import { cn } from "@/lib/utils";

export default function Header({
  rightContent,
  leftItem,
  showBorder = true,
}: {
  rightContent: React.ReactNode;
  leftItem: React.ReactNode;
  showBorder?: boolean;
}) {
  return (
    <header
      className={cn(
        "bg-background sticky top-0 z-10 flex w-full items-center justify-between p-4",
        showBorder && "border-b"
      )}
      data-header
    >
      {leftItem}
      {rightContent}
    </header>
  );
}
