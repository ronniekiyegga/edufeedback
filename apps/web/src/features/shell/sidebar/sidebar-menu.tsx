"use client";

import { Slot } from "@radix-ui/react-slot";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { useSidebar } from "./sidebar-context";

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-sidebar="header"
      className={twMerge("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-sidebar="content"
      className={twMerge(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-sidebar="group"
      className={twMerge("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-sidebar="group-label"
      className={twMerge(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-sidebar="menu"
      className={twMerge("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li
      data-sidebar="menu-item"
      className={twMerge("group/menu-item relative", className)}
      {...props}
    />
  );
}

const sidebarMenuButtonClass =
  "peer/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:bg-[linear-gradient(134deg,rgb(255,255,255)_20.34%,#fbf8fe_36.8%,rgba(252,249,255,0.87)_56.12%,rgba(255,255,255,0.757)_76.52%)] hover:text-sidebar-active focus-visible:ring-2 active:bg-none active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0";

type SidebarMenuButtonProps = ComponentProps<"button"> & {
  asChild?: boolean;
  tooltip?: string;
};

export function SidebarMenuButton({
  asChild = false,
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      data-sidebar="menu-button"
      className={twMerge(sidebarMenuButtonClass, className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          align="center"
          sideOffset={4}
          hidden={state !== "collapsed" || isMobile}
          className="z-50 ml-3 origin-(--radix-tooltip-content-transform-origin) animate-tooltip-in overflow-hidden rounded-md border-none bg-white px-4 py-1.5 text-xs text-sidebar-active shadow-[0px_8px_20px_0_rgba(10,10,10,0.10)] transition hover:scale-[1.01] data-[state=closed]:animate-tooltip-out"
        >
          {tooltip}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
