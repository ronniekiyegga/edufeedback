import type { StudentPage } from "./student-page.schema";

type StudentTableProps = {
  students: StudentPage["items"];
};

export function StudentTable({ students }: StudentTableProps) {
  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="scrollbar-thin relative w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">
            Students ordered by surname, then student ID
          </caption>
          <thead
            className="sticky top-0 z-20 text-slate-400"
            style={{
              background:
                "linear-gradient(180deg, #FBFBFB 68.72%, #F4F7FF 130.66%)",
            }}
          >
            <tr className="border-b">
              <th
                scope="col"
                className="h-12 rounded-l-sm py-4 pl-8 pr-4 text-left align-middle text-xs font-semibold text-slate-600"
              >
                Student
              </th>
              <th
                scope="col"
                className="h-12 rounded-r-sm px-4 py-4 text-left align-middle text-xs font-semibold text-slate-600"
              >
                Student reference
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {students.map((student) => (
              <tr
                key={student.id}
                className="hover-gradient relative h-16 border-b border-l-2 border-l-transparent transition-all duration-200 ease-in-out"
              >
                <th
                  scope="row"
                  className="py-2 pl-8 pr-4 text-left align-middle text-xs font-normal text-muted-foreground"
                >
                  {student.firstName
                    ? `${student.firstName} ${student.surname}`
                    : student.surname}
                </th>
                <td className="break-all px-4 py-2 align-middle text-xs text-muted-foreground">
                  {student.institutionStudentRef}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
