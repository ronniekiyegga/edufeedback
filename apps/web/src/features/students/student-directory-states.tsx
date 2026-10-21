import { DirectoryLink, directoryHref } from "./directory-link";

export function InvalidCursor() {
  return (
    <section aria-labelledby="invalid-page-title" className="space-y-4">
      <h2 id="invalid-page-title" className="text-lg font-semibold">
        This page link is invalid
      </h2>
      <p className="text-slate-600">
        Return to the beginning of the student directory.
      </p>
      <DirectoryLink href={directoryHref()}>Back to first page</DirectoryLink>
    </section>
  );
}

export function DirectoryUnavailable({ cursor }: { cursor?: string }) {
  return (
    <section aria-labelledby="unavailable-title" className="space-y-4">
      <h2 id="unavailable-title" className="text-lg font-semibold">
        We couldn’t load the directory
      </h2>
      <p className="text-slate-600">
        Student information is temporarily unavailable. Try again.
      </p>
      <DirectoryLink href={directoryHref(cursor)}>Try again</DirectoryLink>
    </section>
  );
}

export function EmptyDirectory({ isFirstPage }: { isFirstPage: boolean }) {
  return (
    <section
      aria-labelledby="empty-title"
      className="rounded-lg border border-border bg-white p-8"
    >
      <h2 id="empty-title" className="text-lg font-semibold">
        {isFirstPage ? "No students yet" : "No students on this page"}
      </h2>
      <p className="mt-2 text-slate-600">
        {isFirstPage
          ? "Students will appear here when demo records are available."
          : "The directory may have changed. Return to the first page."}
      </p>
    </section>
  );
}
