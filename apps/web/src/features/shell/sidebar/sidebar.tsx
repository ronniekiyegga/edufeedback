"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { PanelLeft, X } from "lucide-react";
import {
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { twMerge } from "tailwind-merge";
import { useSidebar } from "./sidebar-context";

const SIDEBAR_WIDTH_MOBILE = "18rem";

export function Sidebar({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <MobileSidebar
        open={openMobile}
        onOpenChange={setOpenMobile}
      >
        {children}
      </MobileSidebar>
    );
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : ""}
      data-side="left"
    >
      <div className="relative w-(--sidebar-width) border-r bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon)" />
      <div
        className={twMerge(
          "fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) border-r transition-[left,right,width,box-shadow] duration-200 ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[state=expanded]:shadow-[2px_0_5px_rgba(0,0,0,0.03)] md:flex",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="flex h-full w-full flex-col group-data-[state=collapsed]:sidebar-collapsed-shadow"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileSidebar({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { triggerRef } = useSidebar();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          data-sidebar="sidebar"
          data-mobile="true"
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 h-full w-(--sidebar-width) bg-white p-0 text-sidebar-foreground shadow-lg data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in"
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="flex h-full w-full flex-col p-2">{children}</div>
          <Dialog.Close
            ref={closeRef}
            className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity not-focus-visible:sr-only hover:opacity-100"
          >
            <X aria-hidden className="h-4 w-4" />
            <span className="sr-only">Close navigation</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: ComponentProps<"button">) {
  const { toggleSidebar, isMobile, open, openMobile, triggerRef } =
    useSidebar();

  return (
    <button
      ref={triggerRef}
      type="button"
      data-sidebar="trigger"
      aria-expanded={isMobile ? openMobile : open}
      className={twMerge(
        "relative h-5 w-5 after:absolute after:-inset-1",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft
        aria-hidden
        size={16}
        strokeWidth={1.3}
        absoluteStrokeWidth
        color="#000000"
        className="cursor-pointer opacity-70 transition-all hover:opacity-90"
      />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
}

export function SidebarRail() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className="absolute inset-y-0 -right-4 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[state=collapsed]:cursor-e-resize group-data-[state=expanded]:cursor-w-resize sm:flex"
    />
  );
}

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={twMerge(
        "relative flex w-full flex-1 flex-col bg-background",
        className,
      )}
      {...props}
    />
  );
}
