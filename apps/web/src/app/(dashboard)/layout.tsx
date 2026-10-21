import type { ReactNode } from "react";
import { DashboardShell } from "@/features/shell/dashboard-shell";

const demoIdentity = {
  name: "Demo teacher",
  description: "Synthetic demo · not signed in",
  initials: "DT",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardShell identity={demoIdentity} schoolName="Demo school">
      {children}
    </DashboardShell>
  );
}
