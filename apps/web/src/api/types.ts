import type { Role } from "./client";

export type Me = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  depot: string | null;
  outlet_id: string | null;
  vehicle_id: string | null;
  locale: string;
};

export type Account = {
  username: string;
  display_name: string;
  role: Role;
  detail: string;
  uses_pin: boolean;
  hint: string;
};

export type Moment = { key: string; label: string; at: string; passed: boolean };

export type DemoState = {
  demo_mode: boolean;
  workspace: { code: string; label: string; is_default: boolean };
  now: string;
  rate: number;
  moments: Moment[];
  next: Moment | null;
};
