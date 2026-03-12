import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white border border-primary hover:brightness-95 focus-visible:ring-4 focus-visible:ring-primary/20",
  secondary:
    "bg-secondary text-textMain border border-secondary hover:brightness-95 focus-visible:ring-4 focus-visible:ring-secondary/30",
  ghost:
    "bg-white text-textMain border border-surface hover:bg-surface focus-visible:ring-4 focus-visible:ring-primary/20",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={cn(
        "inline-flex min-w-[44px] items-center justify-center rounded-xl font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
