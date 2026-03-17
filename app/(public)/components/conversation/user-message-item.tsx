import { cn } from "@/lib/utils";

export function UserMessageItem({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <p className="px-4 py-2 rounded-md bg-secondary">{message}</p>
    </div>
  );
}
