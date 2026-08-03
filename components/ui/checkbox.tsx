"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-[1.05rem] w-[1.05rem] shrink-0 rounded-[0.3rem] border border-white/25 bg-white/5",
        "transition-all duration-300 ease-out",
        "hover:border-gold-400/60 hover:bg-white/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "data-[state=checked]:border-gold-400 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-gold-300 data-[state=checked]:to-gold-600",
        "data-[state=checked]:shadow-[0_0_16px_-2px_rgba(226,186,77,0.7)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-royal-950">
        <Check className="h-3 w-3 stroke-[3.5]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
