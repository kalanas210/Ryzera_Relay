import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { type ApiError, api, type Role } from "@/api/client";
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

export function useMe(role: Role) {
  return useQuery<Me, ApiError>({
    queryKey: ["me", role],
    queryFn: ({ signal }) => api.get<Me>("/api/auth/me", { role, signal }),
    retry: (count, error) => error.status !== 401 && count < 2,
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
