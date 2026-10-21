import Link from "next/link";
import type { ComponentProps } from "react";

const directoryLinkClass =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

export function directoryHref(cursor?: string): string {
  return cursor ? `/?${new URLSearchParams({ cursor })}` : "/";
}

export function DirectoryLink(props: ComponentProps<typeof Link>) {
  return <Link className={directoryLinkClass} {...props} />;
}
