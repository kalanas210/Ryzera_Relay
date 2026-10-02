import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { ApiError, api, type Role } from "@/api/client";
import type { Account, DemoState, Me } from "@/api/types";

const RoleContext = createContext<Role | null>(null);

/** Everything under a role's route acts as that role. */
export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  const role = useContext(RoleContext);
  if (!role) throw new Error("useRole outside a role route");
  return role;
}

/** The driver's phone opens with no signal too: who is signed in is kept on the phone, and checked again as soon as
 *  Relay can be reached. Only the driver's: every other role works at a desk or a dock with a connection. */
const KEPT_ROLES: ReadonlySet<Role> = new Set(["driver"]);

function keptMe(role: Role): Me | undefined {
  if (!KEPT_ROLES.has(role)) return undefined;
  try {
    const raw = localStorage.getItem(`relay.me.${role}`);
    return raw ? (JSON.parse(raw) as Me) : undefined;
  } catch {
    return undefined;
  }
}

function keepMe(role: Role, me: Me | null) {
  if (!KEPT_ROLES.has(role)) return;
  try {
    if (me) localStorage.setItem(`relay.me.${role}`, JSON.stringify(me));
    else localStorage.removeItem(`relay.me.${role}`);
  } catch {
    // nothing kept: the phone asks Relay each time
  }
}

export function useMe(role: Role) {
  return useQuery<Me, ApiError>({
    queryKey: ["me", role],
    queryFn: async ({ signal }) => {
      try {
        const me = await api.get<Me>("/api/auth/me", { role, signal });
        keepMe(role, me);
        return me;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) keepMe(role, null);
        throw error;
      }
    },
    initialData: () => keptMe(role),
    initialDataUpdatedAt: 0, // kept, never fresh: Relay is asked again at once
    retry: (count, error) => error.status !== 401 && !error.offline && count < 2,
    staleTime: 60_000,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: ({ signal }) => api.get<Account[]>("/api/auth/accounts", { signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password?: string; pin?: string }) =>
      input.pin
        ? api.post<Me>("/api/auth/pin", { username: input.username, pin: input.pin })
        : api.post<Me>("/api/auth/login", { username: input.username, password: input.password }),
    onSuccess: (me) => client.setQueryData(["me", me.role], me),
  });
}

export function useSignOut(role: Role) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/api/auth/logout", {}, { role }),
    onSuccess: () => {
      keepMe(role, null);
      client.removeQueries({ queryKey: ["me", role] });
    },
  });
}

export function useDemoState() {
  return useQuery<DemoState, ApiError>({
    queryKey: ["demo"],
    queryFn: ({ signal }) => api.get<DemoState>("/api/demo/state", { signal }),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
