import { type ComponentType, lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { SignIn } from "@/auth/SignIn";
import { RoleLayout } from "./RoleLayout";

/** Each role's screens load as their own chunk, so a driver's phone never downloads the dispatcher's board. */
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const dispatcher = () => import("@/roles/dispatcher");
const loader = () => import("@/roles/loader");
const store = () => import("@/roles/store");
const DispatcherShell = page(dispatcher, "DispatcherShell");
const QueuePage = page(dispatcher, "QueuePage");
const PlanPage = page(dispatcher, "PlanPage");
const LivePage = page(dispatcher, "LivePage");
const LoaderShell = page(loader, "LoaderShell");
const TonightPage = page(loader, "TonightPage");
const LoadVehiclePage = page(loader, "LoadVehiclePage");
const HandoverPage = page(loader, "HandoverPage");
const MyOrders = page(store, "MyOrders");
const PlaceOrder = page(store, "PlaceOrder");

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
      { path: "outlook", Component: page(dispatcher, "OutlookPage") },
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
        // the driver's run and its outbox wrap every driver screen
        Component: page(() => import("@/roles/driver"), "DriverShell"),
        children: [
          { index: true, Component: page(() => import("@/roles/driver"), "RunPage") },
          { path: "stops/:stopId", Component: page(() => import("@/roles/driver"), "StopPage") },
          { path: "stops/:stopId/proof", Component: page(() => import("@/roles/driver"), "ProofPage") },
          { path: "stops/:stopId/saved", Component: page(() => import("@/roles/driver"), "SavedPage") },
          { path: "report", Component: page(() => import("@/roles/driver"), "ReportPage") },
          { path: "report/:reason", Component: page(() => import("@/roles/driver"), "ReportPage") },
          { path: "summary", Component: page(() => import("@/roles/driver"), "SummaryPage") },
        ],
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
      { path: "notices/:noticeId", Component: page(store, "NoticePage") },
      { path: "orders/:orderRef/track", Component: page(store, "TrackerPage") },
      { path: "orders/:orderRef/receipt", Component: page(store, "ReceiptPage") },
    ],
  },
  { path: "*", element: <Navigate to="/signin" replace /> },
]);
