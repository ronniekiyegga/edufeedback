import type { ReactNode } from "react";
import type { StudentPage } from "./student-page.schema";

const columns = ["Student", "Student reference", "Year group", "Class"];

function TableFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="scrollbar-thin relative w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] caption-bottom text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead
            className="sticky top-0 z-20 text-slate-400"
            style={{
              background:
                "linear-gradient(180deg, #FBFBFB 68.72%, #F4F7FF 130.66%)",
            }}
          >
            <tr className="border-b">
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`h-12 py-4 text-left align-middle text-xs font-semibold text-slate-600 ${
                    index === 0 ? "rounded-l-sm pl-8 pr-4" : "px-4"
                  } ${index === columns.length - 1 ? "rounded-r-sm" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

const cellClass = "px-4 py-2 align-middle text-xs text-muted-foreground";

type StudentTableProps = {
  students: StudentPage["items"];
  caption: string;
  emptyMessage: string;
};

export function StudentTable({ students, caption, emptyMessage }: StudentTableProps) {
  return (
    <TableFrame caption={caption}>
      {students.length === 0 ? (
        <tr>
          <td
            colSpan={columns.length}
            className="h-24 text-center text-xs text-muted-foreground"
          >
            {emptyMessage}
          </td>
        </tr>
      ) : (
        students.map((student) => (
          <tr
            key={student.id}
            className="hover-gradient relative h-16 border-b border-l-2 border-l-transparent transition-all duration-200 ease-in-out"
          >
            <th
              scope="row"
              className="max-w-56 truncate py-2 pl-8 pr-4 text-left align-middle text-xs font-normal text-muted-foreground"
            >
              {student.firstName
                ? `${student.firstName} ${student.surname}`
                : student.surname}
            </th>
            <td className={`${cellClass} break-all`}>
              {student.institutionStudentRef}
            </td>
            <td className={`${cellClass} whitespace-nowrap`}>
              Year {student.yearGroup}
            </td>
            <td className={`${cellClass} whitespace-nowrap`}>
              {student.classGroup ?? (
                <span className="text-slate-400">Not recorded</span>
              )}
            </td>
          </tr>
        ))
      )}
    </TableFrame>
  );
}

const skeletonWidths = ["w-28", "w-20", "w-12", "w-10"];

export function StudentTableSkeleton() {
  return (
    <div role="status" aria-label="Loading students">
      <TableFrame caption="Loading students">
        {Array.from({ length: 10 }, (_, row) => (
          <tr
            key={row}
            aria-hidden="true"
            className="h-16 border-b border-l-2 border-l-transparent"
          >
            {skeletonWidths.map((width, index) => (
              <td
                key={width}
                className={`py-2 align-middle ${index === 0 ? "pl-8 pr-4" : "px-4"}`}
              >
                <div className={`h-4 ${width} animate-pulse rounded-md bg-gray-100`} />
              </td>
            ))}
          </tr>
        ))}
      </TableFrame>
    </div>
  );
}
