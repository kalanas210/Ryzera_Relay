import type { ReactNode } from "react";
import { Navigate, ScrollRestoration, useLocation } from "react-router";
import type { Role } from "@/api/client";
import { DemoBar } from "@/demo/DemoBar";
import { RoleProvider, useMe } from "./session";

/** Guards a role's routes: signed in as that role, or off to sign in and back again. */
export function RoleLayout({ appRole: role, children }: { appRole: Role; children: ReactNode }) {
  const me = useMe(role);
  const location = useLocation();
  if (me.isPending) {
    return <div className="flex min-h-dvh items-center justify-center t-body text-asphalt-500">Loading</div>;
  }
  if (me.isError && me.error.status === 401) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?role=${role}&next=${next}`} replace />;
  }
  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center t-body text-asphalt-700">
        Relay could not be reached. {me.error.message}
      </div>
    );
  }
  return (
    <RoleProvider role={role}>
      <ScrollRestoration />
      <DemoBar />
      {children}
    </RoleProvider>
  );
}
