"use client";

import { useAdminLeadsStore, type LeadStatusFilter } from "@/state/adminLeadsStore";

const STATUS_FILTERS: LeadStatusFilter[] = ["ALL", "NEW", "CONTACTED", "CLOSED"];

/** Admin lead list (Spec 21 AC-4) — status filter + a per-row status control (NEW is
 * system-set on creation and never offered here, matching the backend's own restriction). */
export function LeadsTable() {
  const status = useAdminLeadsStore((s) => s.status);
  const leads = useAdminLeadsStore((s) => s.leads);
  const statusFilter = useAdminLeadsStore((s) => s.statusFilter);
  const error = useAdminLeadsStore((s) => s.error);
  const updatingIds = useAdminLeadsStore((s) => s.updatingIds);
  const setStatusFilter = useAdminLeadsStore((s) => s.setStatusFilter);
  const setLeadStatus = useAdminLeadsStore((s) => s.setLeadStatus);
  const load = useAdminLeadsStore((s) => s.load);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter leads by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            aria-pressed={statusFilter === f}
            className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              statusFilter === f
                ? "border-white bg-white text-black"
                : "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="text-sm text-white/50">Loading leads…</p>}

      {status === "error" && (
        <div role="alert" className="flex items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="focus-ring underline">
            Retry
          </button>
        </div>
      )}

      {status === "success" && leads.length === 0 && <p className="text-sm text-white/50">No leads match this filter.</p>}

      {status === "success" && leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only">Leads</caption>
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Name</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Email</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Vehicle</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Type</th>
                <th scope="col" className="py-2 pr-4 text-left text-xs uppercase tracking-wide text-white/50">Status</th>
                <th scope="col" className="py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-white/90">{lead.name}</td>
                  <td className="py-2 pr-4 text-white/70">{lead.email}</td>
                  <td className="py-2 pr-4 text-white/70">{lead.vehicleSlug}</td>
                  <td className="py-2 pr-4 text-white/70">{lead.requestType}</td>
                  <td className="py-2 pr-4 text-white/70">{lead.status}</td>
                  <td className="py-2">
                    {lead.status !== "CLOSED" && (
                      <div className="flex gap-2">
                        {lead.status === "NEW" && (
                          <button
                            type="button"
                            disabled={updatingIds[lead.id]}
                            onClick={() => setLeadStatus(lead.id, "CONTACTED")}
                            className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:opacity-50"
                          >
                            Mark Contacted
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updatingIds[lead.id]}
                          onClick={() => setLeadStatus(lead.id, "CLOSED")}
                          className="focus-ring rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white disabled:opacity-50"
                        >
                          Mark Closed
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
