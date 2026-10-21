import { DirectoryLink, directoryHref } from "./directory-link";
import { getStudents } from "./student.api";
import {
  DirectoryUnavailable,
  EmptyDirectory,
  InvalidCursor,
} from "./student-directory-states";
import { StudentTable } from "./student-table";

type StudentDirectoryProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function StudentDirectory({ searchParams }: StudentDirectoryProps) {
  const { cursor } = await searchParams;

  // Repeated or empty cursor parameters cannot be a cursor the API issued.
  if (cursor !== undefined && (typeof cursor !== "string" || cursor === "")) {
    return <InvalidCursor />;
  }

  const result = await getStudents(cursor);

  if (result.status === "invalid-cursor") {
    return <InvalidCursor />;
  }

  if (result.status === "unavailable") {
    return <DirectoryUnavailable cursor={cursor} />;
  }

  const { items, nextCursor } = result.data;

  return (
    <div className="space-y-5">
      {items.length > 0 ? (
        <>
          <p className="text-sm text-slate-600">
            Showing {items.length} {items.length === 1 ? "student" : "students"}
          </p>
          <StudentTable students={items} />
        </>
      ) : (
        <EmptyDirectory isFirstPage={!cursor} />
      )}

      <nav
        aria-label="Student directory pagination"
        className="flex flex-wrap items-center justify-end gap-2 rounded-b-lg py-2"
      >
        {cursor && (
          <DirectoryLink href={directoryHref()}>First page</DirectoryLink>
        )}
        {nextCursor && (
          <DirectoryLink href={directoryHref(nextCursor)} rel="next">
            Next page
          </DirectoryLink>
        )}
      </nav>
    </div>
  );
}
