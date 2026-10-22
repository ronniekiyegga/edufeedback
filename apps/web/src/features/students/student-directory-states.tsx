import { DirectoryLink, directoryHref } from "./directory-link";
import { MAX_SEARCH_LENGTH } from "./student-search.schema";

export function InvalidCursor({ search }: { search?: string }) {
  return (
    <section aria-labelledby="invalid-page-title" className="space-y-4">
      <h2 id="invalid-page-title" className="text-lg font-semibold">
        This page link is invalid
      </h2>
      <p className="text-slate-600">
        Return to the beginning of the student directory.
      </p>
      <DirectoryLink href={directoryHref({ search })}>
        Back to first page
      </DirectoryLink>
    </section>
  );
}

export function InvalidSearch() {
  return (
    <section aria-labelledby="invalid-search-title" className="space-y-4">
      <h2 id="invalid-search-title" className="text-lg font-semibold">
        This search link is invalid
      </h2>
      <p className="text-slate-600">
        Use one search term of up to {MAX_SEARCH_LENGTH} characters.
      </p>
      <DirectoryLink href={directoryHref()}>Back to directory</DirectoryLink>
    </section>
  );
}

export function DirectoryUnavailable({
  cursor,
  search,
}: {
  cursor?: string;
  search?: string;
}) {
  return (
    <section aria-labelledby="unavailable-title" className="space-y-4">
      <h2 id="unavailable-title" className="text-lg font-semibold">
        We couldn’t load the directory
      </h2>
      <p className="text-slate-600">
        Student information is temporarily unavailable. Try again.
      </p>
      <DirectoryLink href={directoryHref({ cursor, search })}>
        Try again
      </DirectoryLink>
    </section>
  );
}

export function EmptyDirectory({
  isFirstPage,
  isSearching = false,
}: {
  isFirstPage: boolean;
  isSearching?: boolean;
}) {
  const title = !isFirstPage
    ? "No students on this page"
    : isSearching
      ? "No matching students"
      : "No students yet";

  const description = !isFirstPage
    ? "The directory may have changed. Return to the first page."
    : isSearching
      ? "Try a different first name, surname or student reference."
      : "Students will appear here when demo records are available.";

  return (
    <section
      aria-labelledby="empty-title"
      className="rounded-lg border border-border bg-white p-8"
    >
      <h2 id="empty-title" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-2 text-slate-600">{description}</p>
    </section>
  );
}
