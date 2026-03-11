import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<CardProps>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-toss)] border border-surface bg-white shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
