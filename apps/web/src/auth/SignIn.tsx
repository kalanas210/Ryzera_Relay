import { LayoutDashboard, type LucideIcon, Package, Store, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Role } from "@/api/client";
import type { Account } from "@/api/types";
import { useAccounts, useSignIn } from "@/app/session";
import { DemoBar } from "@/demo/DemoBar";
import { Button } from "@/design/Button";
import { Logo } from "@/design/Logo";
import { PinPad } from "@/design/PinPad";
import { cx } from "@/lib/cx";

export const HOME: Record<Role, string> = {
  dispatcher: "/dispatcher",
  loader: "/loader",
  driver: "/driver",
  store_manager: "/store",
};

const ROLES: { role: Role; title: string; where: string; icon: LucideIcon }[] = [
  {
    role: "store_manager",
    title: "Store manager",
    where: "Places orders, tracks arrival, confirms receipt",
    icon: Store,
  },
  {
    role: "dispatcher",
    title: "Dispatcher",
    where: "Plans the day, decides deferrals, watches the runs",
    icon: LayoutDashboard,
  },
  { role: "loader", title: "Loader", where: "Loads in stop order on the shared dock tablet", icon: Package },
  { role: "driver", title: "Driver", where: "Runs the stops and records proof, offline too", icon: Truck },
];

export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const signIn = useSignIn();
  const wanted = params.get("role") as Role | null;
  const [role, setRole] = useState<Role | null>(wanted);
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  // a tap on a role brings its sign-in into view: on a phone it opens below the four cards, out of sight
  const form = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState(0);

  const people = (accounts.data ?? []).filter((a) => a.role === role);
  const chosen = people.find((a) => a.username === username);
  const usesPin = role === "loader";

  useEffect(() => {
    // pick the judge account for the role by default, keeping a password typed before the names came in
    if (role && !people.some((p) => p.username === username) && people[0]) {
      setUsername(people[0].username);
      if (username) setSecret("");
    }
  }, [role, people, username]);

  useEffect(() => {
    if (!picked) return;
    form.current?.scrollIntoView({ block: "nearest" });
    form.current?.querySelector<HTMLInputElement>("input[type=password]")?.focus({ preventScroll: true });
  }, [picked]);

  const submit = (pin?: string) =>
    signIn.mutate(usesPin ? { username, pin: pin ?? secret } : { username, password: secret }, {
      onSuccess: (me) => navigate(params.get("next") || HOME[me.role], { replace: true }),
      onError: () => setSecret(""),
    });

  return (
    <div className="min-h-dvh bg-asphalt-50">
      <DemoBar />
      <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-8 md:py-14">
        <header className="flex flex-col gap-2">
          <Logo size={36} />
          <p className="t-body text-asphalt-700">
            Delivery planning for Waypoint Group. From order to receipt, nothing gets dropped.
          </p>
        </header>

        <section aria-labelledby="who" className="flex flex-col gap-3">
          <h1 id="who" className="t-h2">
            Who is signing in?
          </h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(({ role: r, title, where, icon: Icon }) => {
              const judge = (accounts.data ?? []).find((a) => a.role === r);
              const selected = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setRole(r);
                    setSecret("");
                    signIn.reset();
                    setPicked((n) => n + 1);
                  }}
                  className={cx(
                    "flex min-h-[88px] items-start gap-3 rounded-card border bg-white p-4 text-left transition-colors",
                    selected
                      ? "border-2 border-petrol-700 bg-petrol-50"
                      : "border-asphalt-200 hover:border-asphalt-300",
                  )}
                >
                  <span
                    className={cx(
                      "flex size-10 shrink-0 items-center justify-center rounded-button",
                      selected ? "bg-petrol-700 text-white" : "bg-asphalt-100 text-asphalt-700",
                    )}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={cx("t-h3", selected && "text-petrol-700")}>{title}</span>
                    <span className="t-label text-asphalt-700">{where}</span>
                    {judge ? (
                      <span className="t-label mt-1 text-asphalt-500">
                        <span className="latin">{judge.display_name}</span> · {judge.detail}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {role ? (
          <section
            ref={form}
            className="scroll-mb-4 rounded-card border border-asphalt-200 bg-white p-4 md:p-6"
            aria-live="polite"
          >
            {usesPin ? (
              <LoaderPin
                people={people}
                username={username}
                onPick={(u) => {
                  setUsername(u);
                  setSecret("");
                  signIn.reset();
                }}
                pin={secret}
                onPin={(value) => {
                  setSecret(value);
                  if (value.length === 4) submit(value);
                }}
                error={signIn.isError}
                busy={signIn.isPending}
                failed={accounts.isError}
              />
            ) : (
              <form
                className="flex max-w-[420px] flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <div className="flex flex-col gap-1">
                  <label htmlFor="username" className="t-label-strong">
                    Username
                  </label>
                  <input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="latin h-12 rounded-chip border border-asphalt-300 bg-white px-4 t-body"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="password" className="t-label-strong">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    className={cx(
                      "h-12 rounded-chip border bg-white px-4 t-body",
                      signIn.isError ? "border-problem border-[1.5px]" : "border-asphalt-300",
                    )}
                    aria-invalid={signIn.isError}
                    aria-describedby="password-help"
                  />
                  <p id="password-help" className={cx("t-label", signIn.isError ? "text-problem" : "text-asphalt-500")}>
                    {signIn.isError ? signIn.error.message : chosen ? `Demo account. ${chosen.hint}` : " "}
                  </p>
                </div>
                <Button type="submit" variant="primary" full disabled={signIn.isPending || !username || !secret}>
                  Sign in
                </Button>
              </form>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function LoaderPin({
  people,
  username,
  onPick,
  pin,
  onPin,
  error,
  busy,
  failed,
}: {
  people: Account[];
  username: string;
  onPick: (username: string) => void;
  pin: string;
  onPin: (value: string) => void;
  error: boolean;
  busy: boolean;
  /** The loaders' names could not be loaded. */
  failed: boolean;
}) {
  const person = people.find((p) => p.username === username);
  // The keys wait for a name: a PIN tapped before the names come in would be sent for nobody.
  return (
    <div className="mx-auto flex max-w-[358px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="t-label-strong text-asphalt-700">Kandy hub dock tablet. Tap your name.</p>
        <div className="grid grid-cols-3 gap-2">
          {people.map((p) => {
            const selected = p.username === username;
            const initials = p.display_name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2);
            return (
              <button
                key={p.username}
                type="button"
                aria-pressed={selected}
                onClick={() => onPick(p.username)}
                className={cx(
                  "flex h-16 items-center gap-2 rounded-button px-2 text-left",
                  selected ? "border-2 border-petrol-700 bg-petrol-50" : "border border-asphalt-300 bg-white",
                )}
              >
                <span className="latin flex size-7 shrink-0 items-center justify-center rounded-full bg-asphalt-100 t-caption">
                  {initials}
                </span>
                <span className={cx("latin t-label-strong truncate", selected && "text-petrol-700")}>
                  {p.display_name.split(" ")[p.display_name.startsWith("Mohamed") ? 1 : 0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="t-h3">
          {person ? (
            <>
              Enter{" "}
              <span className="latin">
                {person.display_name.split(" ")[person.display_name.startsWith("Mohamed") ? 1 : 0]}
              </span>
              's PIN
            </>
          ) : (
            "Enter your PIN"
          )}
        </p>
        <p className={cx("t-caption", error || failed ? "text-problem" : "text-asphalt-500")}>
          {error
            ? "That PIN did not match. Try again."
            : person
              ? `Demo account. ${person.hint}`
              : failed
                ? "Relay could not load the names. Reload the page to try again."
                : "Loading the names. The keys work once a name is picked."}
        </p>
      </div>
      <PinPad value={pin} onChange={onPin} error={error && pin.length === 0} disabled={busy || !person} />
      <p className="t-caption text-center text-asphalt-500">Each loader's language comes back when they sign in.</p>
    </div>
  );
}
