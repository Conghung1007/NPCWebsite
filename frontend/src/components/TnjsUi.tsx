import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TNJS, type TnjsPillVariant } from "@/lib/tnjsTheme";

type TnjsPillTitleProps = {
  id?: string;
  children: ReactNode;
  variant?: TnjsPillVariant;
  className?: string;
};

/** Section title style from tnjs.vn — pill outline + end dots */
export function TnjsPillTitle({
  id,
  children,
  variant = "onLight",
  className,
}: TnjsPillTitleProps) {
  const onGreen = variant === "onGreen";

  return (
    <div className={cn("mb-3 flex justify-center", className)}>
      <h2
        id={id}
        className={cn(
          "inline-flex items-center gap-3 rounded-full border-2 px-5 py-2",
          "text-sm font-bold uppercase tracking-[0.12em]",
          "sm:px-8 sm:py-2.5 sm:text-base",
          onGreen ? "border-white text-white" : "text-neutral-900",
          variant === "onDark" && "text-white",
        )}
        style={onGreen ? undefined : { borderColor: TNJS.green }}
      >
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", onGreen && "bg-white")}
          style={onGreen ? undefined : { backgroundColor: TNJS.green }}
          aria-hidden
        />
        {children}
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", onGreen && "bg-white")}
          style={onGreen ? undefined : { backgroundColor: TNJS.green }}
          aria-hidden
        />
      </h2>
    </div>
  );
}

type TnjsOrangeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function TnjsOrangeButton({
  className,
  style,
  type = "button",
  ...props
}: TnjsOrangeButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-6 py-3",
        "text-sm font-bold uppercase tracking-wide text-white shadow-md",
        "transition-opacity hover:opacity-95 disabled:opacity-60",
        className,
      )}
      style={{ backgroundColor: TNJS.orange, ...style }}
      {...props}
    />
  );
}
