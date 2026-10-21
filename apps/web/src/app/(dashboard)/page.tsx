import { Suspense } from "react";
import { StudentDirectory } from "@/features/students/student-directory";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Home({ searchParams }: HomeProps) {
  return (
    <div className="relative flex w-full min-w-0 flex-col px-4 py-6 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground">
          Attainline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Student directory
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Browse student names and school references.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Demo workspace · Synthetic data only
        </p>
      </header>

      <Suspense
        fallback={
          <p role="status" className="py-8 text-slate-600">
            Loading students…
          </p>
        }
      >
        <StudentDirectory searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
