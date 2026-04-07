import { Badge } from "../ui/badge";
import Image from "next/image";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function Logo({
  className,
  showText = true,
  imageClassname,
  textClassname,
}: {
  className?: string;
  showText?: boolean;
  imageClassname?: string;
  textClassname?: string;
}) {
  return (
    <Link href="/">
      <div className={cn("flex flex-row items-center gap-x-2", className)}>
        <Image
          src="/images/logo.svg"
          alt="AI PI Logo"
          width={32}
          height={32}
          className={cn("h-8 w-auto", imageClassname)}
        />

        {showText && (
          <h2 className={cn("text-lg font-bold", textClassname)}>AI PI</h2>
        )}
        <Badge
          className="h-4 border-amber-500 text-xs text-amber-500"
          variant="outline"
        >
          Beta
        </Badge>
      </div>
    </Link>
  );
}
