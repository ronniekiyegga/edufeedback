import { DirectoryLink, directoryHref } from "./directory-link";
import { getStudents, type StudentPageResult } from "./student.api";
import {
  DirectoryUnavailable,
  EmptyDirectory,
  InvalidCursor,
  InvalidSearch,
} from "./student-directory-states";
import { StudentSearch } from "./student-search";
import { studentSearchSchema } from "./student-search.schema";
import { StudentTable } from "./student-table";

type StudentDirectoryProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function StudentDirectory({ searchParams }: StudentDirectoryProps) {
  const parameters = await searchParams;
  const parsedSearch = studentSearchSchema.safeParse(parameters.q);

  if (!parsedSearch.success) {
    return <InvalidSearch />;
  }

  const search = parsedSearch.data || undefined;
  const { cursor } = parameters;

  if (cursor !== undefined && (typeof cursor !== "string" || cursor === "")) {
    return <InvalidCursor search={search} />;
  }

  const result = await getStudents({ cursor, search });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StudentSearch search={search ?? ""} />
        {search && (
          <DirectoryLink href={directoryHref()}>Clear search</DirectoryLink>
        )}
      </div>

      <DirectoryResult result={result} cursor={cursor} search={search} />
    </div>
  );
}

type DirectoryResultProps = {
  result: StudentPageResult;
  cursor?: string;
  search?: string;
};

function DirectoryResult({ result, cursor, search }: DirectoryResultProps) {
  if (result.status === "invalid-cursor") {
    return <InvalidCursor search={search} />;
  }

  if (result.status === "unavailable") {
    return <DirectoryUnavailable cursor={cursor} search={search} />;
  }

  const { items, nextCursor } = result.data;

  return (
    <>
      {items.length > 0 ? (
        <>
          <p className="text-sm text-slate-600">
            Showing {items.length} {items.length === 1 ? "student" : "students"}
          </p>
          <StudentTable students={items} />
        </>
      ) : (
        <EmptyDirectory isFirstPage={!cursor} isSearching={Boolean(search)} />
      )}

      <nav
        aria-label="Student directory pagination"
        className="flex flex-wrap items-center justify-end gap-2 rounded-b-lg py-2"
      >
        {cursor && (
          <DirectoryLink href={directoryHref({ search })}>First page</DirectoryLink>
        )}
        {nextCursor && (
          <DirectoryLink href={directoryHref({ cursor: nextCursor, search })} rel="next">
            Next page
          </DirectoryLink>
        )}
      </nav>
    </>
  );
}
