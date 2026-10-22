import Link from "next/link";
import type { ComponentProps } from "react";

const directoryLinkClass =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

type DirectoryLocation = {
  cursor?: string;
  search?: string;
};

export function directoryHref({ cursor, search }: DirectoryLocation = {}): string {
  const parameters = new URLSearchParams();

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
