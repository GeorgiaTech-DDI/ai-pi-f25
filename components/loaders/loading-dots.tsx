import { cn } from "@/lib/utils";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <div className="bg-primary h-2 w-2 animate-bounce rounded-full" />
    </div>
  );
}
