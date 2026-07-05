import { getAppSettings } from "@/lib/settings";
import { AppShellClient } from "@/components/ui/app-shell-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const settings = getAppSettings();

  return <AppShellClient settings={settings}>{children}</AppShellClient>;
}
