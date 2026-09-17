import type { Metadata } from "next";
import { ReservationConfirmation } from "@/components/reservations/ReservationConfirmation";

/** Spec 23, AC-1/AC-3: a single user's own reservation — never indexed or listed in
 * sitemap.xml (see robots.ts's matching disallow). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ReservationConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-16"
    >
      <ReservationConfirmation id={id} />
    </main>
  );
}
