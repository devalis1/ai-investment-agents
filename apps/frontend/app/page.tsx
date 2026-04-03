import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-end gap-3">
        <ThemeToggle />
      </div>
      <DashboardClient />
    </main>
  );
}
