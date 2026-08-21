import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo-mark.svg"
        alt="ChulaPD Attendance"
        width={32}
        height={32}
        className={cn("size-8 rounded-lg", iconClassName)}
        priority
      />
      <span className="font-semibold tracking-tight">ChulaPD Attendance</span>
    </div>
  );
}
