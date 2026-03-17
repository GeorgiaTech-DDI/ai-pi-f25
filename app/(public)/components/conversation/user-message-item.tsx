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
      <p>{message}</p>
    </div>
  );
}
