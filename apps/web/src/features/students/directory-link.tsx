import Link from "next/link";
import type { ComponentProps } from "react";

export const toolbarControlClass =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-gray-200 bg-background px-3 text-xs font-normal text-zinc-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const directoryLinkClass =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

type DirectoryLocation = {
  year?: number;
  search?: string;
  cursor?: string;
};

export function directoryHref({
  year,
  search,
  cursor,
}: DirectoryLocation = {}): string {
  const parameters = new URLSearchParams();

  if (year !== undefined) {
    parameters.set("year", String(year));
  }

  if (search) {
    parameters.set("q", search);
  }

  if (cursor) {
    parameters.set("cursor", cursor);
  }

  const query = parameters.toString();
  return query ? `/?${query}` : "/";
}

export function DirectoryLink(props: ComponentProps<typeof Link>) {
  return <Link className={directoryLinkClass} {...props} />;
}
