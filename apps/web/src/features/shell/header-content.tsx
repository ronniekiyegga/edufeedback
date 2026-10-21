"use client";

import { usePathname } from "next/navigation";
import { navigationItems } from "./navigation-items";
import { SidebarTrigger } from "./sidebar/sidebar";

export function HeaderContent() {
  const pathname = usePathname();
  const pageTitle = navigationItems.find((item) => item.href === pathname)?.title;

  return (
    <header className="mb-2 flex h-16 shrink-0 items-center justify-between gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 lg:pr-4">
      <div className="mt-0 flex items-center gap-2 px-6 lg:px-6">
        <SidebarTrigger />
        <div aria-hidden className="mr-1 h-4 w-px shrink-0 bg-gray-200" />
        {pageTitle && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground sm:gap-2.5">
              <li className="inline-flex items-center gap-1.5">
                <span aria-current="page" className="font-normal text-foreground">
                  {pageTitle}
                </span>
              </li>
            </ol>
          </nav>
        )}
      </div>
    </header>
  );
}
