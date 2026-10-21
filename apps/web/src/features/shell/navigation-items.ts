import { Users, type LucideIcon } from "lucide-react";

type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navigationItems: NavigationItem[] = [
  { title: "Students", href: "/", icon: Users },
];
