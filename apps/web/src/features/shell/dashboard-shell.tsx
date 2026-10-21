import type { ReactNode } from "react";
import { HeaderContent } from "./header-content";
import { Navigation, type DemoIdentity } from "./navigation";
import { SidebarInset } from "./sidebar/sidebar";
import { SidebarProvider } from "./sidebar/sidebar-context";

type DashboardShellProps = {
  children: ReactNode;
  identity: DemoIdentity;
  schoolName: string;
};

export function DashboardShell({
  children,
  identity,
  schoolName,
}: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Navigation identity={identity} schoolName={schoolName} />
      <SidebarInset
        id="main-content"
        className="min-w-0 overflow-x-hidden px-1 lg:pr-4"
      >
        <HeaderContent />
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-2 pt-0 sm:p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
