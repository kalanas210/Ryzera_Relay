import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { SignIn } from "@/auth/SignIn";
import { DispatcherShell } from "@/roles/dispatcher/DispatcherShell";
import { LivePage } from "@/roles/dispatcher/live/LivePage";
import { PlanPage } from "@/roles/dispatcher/plan/PlanPage";
import { QueuePage } from "@/roles/dispatcher/Queue";
import { HandoverPage } from "@/roles/loader/Handover";
import { LoaderShell } from "@/roles/loader/LoaderShell";
import { LoadVehiclePage } from "@/roles/loader/LoadVehicle";
import { TonightPage } from "@/roles/loader/Tonight";
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
      { path: "plan", element: <PlanPage /> },
      { path: "live", element: <LivePage /> },
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
        <LoaderShell />
      </RoleLayout>
    ),
    children: [
      { index: true, element: <TonightPage /> },
      { path: "trips/:tripId", element: <LoadVehiclePage /> },
      { path: "trips/:tripId/handover", element: <HandoverPage /> },
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
