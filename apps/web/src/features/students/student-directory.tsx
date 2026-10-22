import Link from "next/link";
import { academicYearParamSchema, formatAcademicYear } from "./academic-year";
import { AcademicYearTabs } from "./academic-year-tabs";
import {
  DirectoryLink,
  directoryHref,
  toolbarControlClass,
} from "./directory-link";
import {
  getAcademicYears,
  getStudents,
  type StudentPageResult,
} from "./student.api";
import {
  DirectoryUnavailable,
  InvalidAcademicYear,
  InvalidCursor,
  InvalidSearch,
  NoEnrolments,
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
  const requestedYear = academicYearParamSchema.safeParse(parameters.year);

  if (!requestedYear.success) {
    return <InvalidAcademicYear search={search} />;
  }

  const { cursor } = parameters;

  if (cursor !== undefined && (typeof cursor !== "string" || cursor === "")) {
    return <InvalidCursor year={requestedYear.data} search={search} />;
  }

  const years = await getAcademicYears();

  if (years.status === "unavailable") {
    return (
      <DirectoryUnavailable
        year={requestedYear.data}
        search={search}
        cursor={cursor}
      />
    );
  }

  const [currentYear] = years.data;

  if (currentYear === undefined) {
    return <NoEnrolments />;
  }

  const year = requestedYear.data ?? currentYear;

  if (!years.data.includes(year)) {
    return <InvalidAcademicYear search={search} />;
  }

  const result = await getStudents({ academicYearStart: year, cursor, search });

  return (
    <div className="flex w-full flex-col justify-start gap-1 space-y-4">
      <div className="flex w-full flex-col items-stretch justify-between gap-2 md:flex-row md:items-center">
        <AcademicYearTabs years={years.data} selectedYear={year} search={search} />
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap">
          <StudentSearch search={search ?? ""} year={year} />
          {search && (
            <Link href={directoryHref({ year })} className={toolbarControlClass}>
              Clear search
            </Link>
          )}
        </div>
      </div>

      <DirectoryResult result={result} year={year} cursor={cursor} search={search} />
    </div>
  );
}

type DirectoryResultProps = {
  result: StudentPageResult;
  year: number;
  cursor?: string;
  search?: string;
};

function DirectoryResult({ result, year, cursor, search }: DirectoryResultProps) {
  if (result.status === "invalid-cursor") {
    return <InvalidCursor year={year} search={search} />;
  }

  if (result.status === "unavailable") {
    return <DirectoryUnavailable year={year} search={search} cursor={cursor} />;
  }

  const { items, nextCursor } = result.data;
  const yearLabel = formatAcademicYear(year);

  const emptyMessage = cursor
    ? "No students on this page. Return to the first page."
    : search
      ? `No students in ${yearLabel} match this search.`
      : `No students are enrolled in ${yearLabel}.`;

  return (
    <div className="flex flex-col gap-4">
      <StudentTable
        students={items}
        caption={`Students enrolled in ${yearLabel}, ordered by surname`}
        emptyMessage={emptyMessage}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-lg py-2">
        <p className="text-xs text-muted-foreground">
          {items.length > 0 &&
            `Showing ${items.length} ${items.length === 1 ? "student" : "students"} · ${yearLabel}`}
        </p>
        <nav
          aria-label="Student directory pagination"
          className="flex items-center gap-2"
        >
          {cursor && (
            <DirectoryLink href={directoryHref({ year, search })}>
              First page
            </DirectoryLink>
          )}
          {nextCursor && (
            <DirectoryLink
              href={directoryHref({ year, search, cursor: nextCursor })}
              rel="next"
            >
              Next page
            </DirectoryLink>
          )}
        </nav>
      </div>
    </div>
  );
}
