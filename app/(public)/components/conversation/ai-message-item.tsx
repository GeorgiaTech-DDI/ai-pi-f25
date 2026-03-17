import { cn } from "@/lib/utils";

export function AIMessageItem({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return <div className={cn("", className)}>{message}</div>;
}