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
      className="bg-background sticky top-0 z-10 flex w-full items-center justify-between p-4 border-b"
      data-header
    >
      {leftItem}
      {rightContent}
    </header>
  );
}
