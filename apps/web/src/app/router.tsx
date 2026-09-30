import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { SignIn } from "@/auth/SignIn";
import { DispatcherShell } from "@/roles/dispatcher/DispatcherShell";
import { QueuePage } from "@/roles/dispatcher/Queue";
import { Placeholder } from "@/roles/Placeholder";
import { MyOrders } from "@/roles/store/MyOrders";
import { PlaceOrder } from "@/roles/store/PlaceOrder";
import { RoleLayout } from "./RoleLayout";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/signin" replace /> },
  { path: "/signin", element: <SignIn /> },
  {
    path: "/dispatcher",
    element: (
      <RoleLayout appRole="dispatcher">
        <DispatcherShell />
      </RoleLayout>
    ),
    children: [
      { index: true, element: <QueuePage /> },
      {
        path: "plan",
        element: (
          <Placeholder title="Plan board">The plan board opens once Wednesday's orders lock at 4:00 PM.</Placeholder>
        ),
      },
      {
        path: "live",
        element: <Placeholder title="Live runs">Runs appear here once the plan is published.</Placeholder>,
      },
      {
        path: "outlook",
        element: <Placeholder title="Capacity outlook">The six-week outlook for each depot.</Placeholder>,
      },
    ],
  },
  {
    path: "/loader",
    element: (
      <RoleLayout appRole="loader">
        <Outlet />
      </RoleLayout>
    ),
    children: [
      {
        index: true,
        element: (
          <Placeholder title="Tonight's loads">
            Loading lists appear when the dispatcher publishes the plan.
          </Placeholder>
        ),
      },
    ],
  },
  {
    path: "/driver",
    element: (
      <RoleLayout appRole="driver">
        <Outlet />
      </RoleLayout>
    ),
    children: [
      {
        index: true,
        element: (
          <Placeholder title="Today's run">Your run sheet appears when the dispatcher publishes the plan.</Placeholder>
        ),
      },
    ],
  },
  {
    path: "/store",
    element: (
      <RoleLayout appRole="store_manager">
        <Outlet />
      </RoleLayout>
    ),
    children: [
      { index: true, element: <MyOrders /> },
      { path: "order", element: <PlaceOrder /> },
    ],
  },
  { path: "*", element: <Navigate to="/signin" replace /> },
]);
