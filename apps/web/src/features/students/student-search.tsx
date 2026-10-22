import { Search } from "lucide-react";
import { MAX_SEARCH_LENGTH } from "./student-search.schema";

type StudentSearchProps = {
  search: string;
};

export function StudentSearch({ search }: StudentSearchProps) {
  return (
    <form
      action="/"
      method="get"
      role="search"
      aria-label="Student directory"
      className="flex w-full flex-wrap items-center gap-2 md:w-auto"
    >
      <div className="relative flex w-full md:w-auto md:min-w-0">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <label htmlFor="student-search" className="sr-only">
          Search by first name, surname or student reference
        </label>
        <input
          key={search}
          id="student-search"
          name="q"
          type="search"
          defaultValue={search}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="Search"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-gray-200 bg-background pl-9 pr-3 text-sm outline-offset-4 md:w-48"
        />
      </div>

      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Search
      </button>
    </form>
  );
}
