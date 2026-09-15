import { create } from "zustand";
import { listLeads, updateLeadStatus } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { LeadDto } from "@/types/leads";

export type AdminLeadsStatus = "idle" | "loading" | "success" | "error";
export type LeadStatusFilter = "ALL" | "NEW" | "CONTACTED" | "CLOSED";

export interface AdminLeadsState {
  status: AdminLeadsStatus;
  leads: LeadDto[];
  statusFilter: LeadStatusFilter;
  error: string | null;
  updatingIds: Record<string, boolean>;
  load: () => Promise<void>;
  setStatusFilter: (filter: LeadStatusFilter) => void;
  setLeadStatus: (id: string, status: "CONTACTED" | "CLOSED") => Promise<boolean>;
}

/** Admin lead list/status-update (Spec 21 AC-4). */
export const useAdminLeadsStore = create<AdminLeadsState>((set, get) => ({
  status: "idle",
  leads: [],
  statusFilter: "ALL",
  error: null,
  updatingIds: {},

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const { statusFilter } = get();
      const leads = await listLeads(statusFilter === "ALL" ? undefined : statusFilter);
      set({ status: "success", leads });
    } catch (err) {
      set({ status: "error", error: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
    }
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter });
    void get().load();
  },

  setLeadStatus: async (id, status) => {
    set((state) => ({ updatingIds: { ...state.updatingIds, [id]: true } }));
    try {
      const updated = await updateLeadStatus(id, { status });
      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? updated : l)),
        updatingIds: { ...state.updatingIds, [id]: false },
      }));
      return true;
    } catch {
      set((state) => ({ updatingIds: { ...state.updatingIds, [id]: false } }));
      return false;
    }
  },
}));
