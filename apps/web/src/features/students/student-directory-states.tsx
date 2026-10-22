import { DirectoryLink, directoryHref } from "./directory-link";
import { MAX_SEARCH_LENGTH } from "./student-search.schema";

type DirectoryFilters = {
  year?: number;
  search?: string;
};

export function InvalidCursor({ year, search }: DirectoryFilters) {
  return (
    <section aria-labelledby="invalid-page-title" className="space-y-4">
      <h2 id="invalid-page-title" className="text-lg font-semibold">
        This page link is invalid
      </h2>
      <p className="text-slate-600">
        Return to the beginning of the student directory.
      </p>
      <DirectoryLink href={directoryHref({ year, search })}>
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

export function InvalidAcademicYear({ search }: Pick<DirectoryFilters, "search">) {
  return (
    <section aria-labelledby="invalid-year-title" className="space-y-4">
      <h2 id="invalid-year-title" className="text-lg font-semibold">
        This academic year isn’t available
      </h2>
      <p className="text-slate-600">
        Choose one of the academic years with enrolled students.
      </p>
      <DirectoryLink href={directoryHref({ search })}>
        Back to latest year
      </DirectoryLink>
    </section>
  );
}

export function NoEnrolments() {
  return (
    <section
      aria-labelledby="no-enrolments-title"
      className="rounded-lg border border-border bg-white p-8"
    >
      <h2 id="no-enrolments-title" className="text-lg font-semibold">
        No enrolments yet
      </h2>
      <p className="mt-2 text-slate-600">
        Students will appear here once they are enrolled in an academic year.
      </p>
    </section>
  );
}

export function DirectoryUnavailable({
  year,
  search,
  cursor,
}: DirectoryFilters & { cursor?: string }) {
  return (
    <section aria-labelledby="unavailable-title" className="space-y-4">
      <h2 id="unavailable-title" className="text-lg font-semibold">
        We couldn’t load the directory
      </h2>
      <p className="text-slate-600">
        Student information is temporarily unavailable. Try again.
      </p>
      <DirectoryLink href={directoryHref({ year, search, cursor })}>
        Try again
      </DirectoryLink>
    </section>
  );
}
