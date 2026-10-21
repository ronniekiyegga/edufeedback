"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { navigationItems } from "./navigation-items";
import { Sidebar, SidebarRail } from "./sidebar/sidebar";
import { useSidebar } from "./sidebar/sidebar-context";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar/sidebar-menu";

export type DemoIdentity = {
  name: string;
  description: string;
  initials: string;
};

type NavigationProps = {
  identity: DemoIdentity;
  schoolName: string;
};

const collapsibleTextClass =
  "whitespace-nowrap transition-[opacity,translate,scale] delay-200 duration-500 ease-out group-data-[collapsible=icon]:-translate-x-3 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 motion-reduce:transition-none";

function Avatar({ identity, size }: { identity: DemoIdentity; size: string }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        "flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600",
        size,
      )}
    >
      {identity.initials}
    </span>
  );
}

function IdentityCard({
  identity,
  isCollapsed,
}: {
  identity: DemoIdentity;
  isCollapsed: boolean;
}) {
  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center p-2">
        <Avatar identity={identity} size="size-9" />
        <span className="sr-only">{identity.name}</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg bg-[linear-gradient(160deg,#3976F5_16%,#3976F5_40%,#8415F4_60%,#6600CC_98%)] p-[.5px]">
      <div className="flex items-center gap-3 rounded-lg bg-white px-2 py-4 shadow-lg">
        <Avatar identity={identity} size="size-10" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-black">
            {identity.name}
          </span>
          <span className="mt-0.5 block truncate text-xs font-medium text-gray-500">
            {identity.description}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Navigation({ identity, schoolName }: NavigationProps) {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const isCollapsed = state === "collapsed" && !isMobile;

  function handleLinkClick() {
    if (isMobile) {
      setOpenMobile(false);
    } else if (state === "collapsed") {
      setOpen(true);
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className={twMerge("mb-0 py-2", isCollapsed ? "px-0" : "px-1")}>
          {isCollapsed ? (
            <SidebarGroupLabel className="mt-0! mb-4 flex items-center justify-center overflow-visible px-0 opacity-100!">
              <div className="relative flex h-[17px] w-8 items-center justify-center">
                <Image
                  src="/images/branding/collapsed-logo.svg"
                  alt="Attainline"
                  width={32}
                  height={17}
                  className="absolute inset-0 m-auto block"
                  priority
                />
              </div>
            </SidebarGroupLabel>
          ) : (
            <SidebarGroupLabel className="mb-6 flex items-center justify-between px-0">
              <span className="flex items-center gap-2">
                <Image
                  src="/images/branding/collapsed-logo.svg"
                  alt=""
                  width={22}
                  height={18}
                />
                <span className="text-sm font-semibold text-foreground">
                  Attainline
                </span>
              </span>
            </SidebarGroupLabel>
          )}

          <div className="flex flex-col gap-2">
            <div
              className={twMerge("px-2 py-1.5", isCollapsed && "sr-only")}
              title={schoolName}
            >
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Active school
              </p>
              <p className="truncate text-xs font-medium text-foreground">
                {schoolName}
              </p>
            </div>
            <IdentityCard identity={identity} isCollapsed={isCollapsed} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <nav aria-label="Main">
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link
                      href={item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      onClick={handleLinkClick}
                    >
                      <item.icon aria-hidden className="h-4 w-4" />
                      <span className={collapsibleTextClass}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
