"use client";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={500}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs px-3 py-2 bg-gray-300 text-gray-900 text-xs rounded-md shadow-lg leading-snug"
        >
          {content}
          <RadixTooltip.Arrow className="fill-gray-300" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export function HelpTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="bottom"
          sideOffset={6}
          align="end"
          className="z-50 max-w-sm px-3 py-2 bg-gray-300 text-gray-900 text-xs rounded-md shadow-lg leading-relaxed whitespace-pre-line"
        >
          {content}
          <RadixTooltip.Arrow className="fill-gray-300" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
