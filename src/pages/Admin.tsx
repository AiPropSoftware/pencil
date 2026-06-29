import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/integrations/supabase/types";
import { Search, Shield, RefreshCw } from "lucide-react";

interface ProfileWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: Role;
}

const ROLES: Role[] = ["admin", "pro", "free"];

// Shown when Supabase isn't configured so the admin view is explorable in demo mode.
const DEMO_USERS: ProfileWithRole[] = [
  { id: "demo-1", email: "you@pencil.app", full_name: "You (demo admin)", created_at: "2026-06-01", role: "admin" },
  { id: "demo-2", email: "dana.builds@example.com", full_name: "Dana Okafor", created_at: "2026-06-08", role: "pro" },
  { id: "demo-3", email: "marcus.invests@example.com", full_name: "Marcus Lee", created_at: "2026-06-14", role: "pro" },
  { id: "demo-4", email: "trial.user@example.com", full_name: "Priya Nair", created_at: "2026-06-22", role: "free" },
  { id: "demo-5", email: "newlead@example.com", full_name: "Sam Carter", created_at: "2026-06-27", role: "free" },
];

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = React.useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      // Demo mode — no backend. Show sample users so the view is explorable.
      setUsers(DEMO_USERS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await sb
      .from("profile_with_role")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setUsers((data ?? []) as ProfileWithRole[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const changeRole = async (target: ProfileWithRole, role: Role) => {
    const sb = getSupabase();
    if (!sb) {
      // Demo mode — update locally only.
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role } : u)));
      toast.success(`${target.email} is now ${role}. (demo — not persisted)`);
      return;
    }
    setSavingId(target.id);
    const { error } = await sb.rpc("set_user_role", { _target: target.id, _role: role });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role } : u)));
    toast.success(`${target.email} is now ${role}.`);
  };

  const filtered = users.filter(
    (u) =>
      q === "" ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const stats = {
    admins: users.filter((u) => u.role === "admin").length,
    pros:   users.filter((u) => u.role === "pro").length,
    frees:  users.filter((u) => u.role === "free").length,
  };

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="gold-rule" />
          <h1 className="mt-3 font-display text-4xl">Admin · Roles</h1>
          <p className="mt-1 text-muted-foreground">Promote and demote users between admin, pro, and free.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Admins" value={stats.admins} />
        <Stat label="Pro" value={stats.pros} accent />
        <Stat label="Free" value={stats.frees} />
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="space-y-1.5 max-w-md">
            <Label htmlFor="q">Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="q"
                className="pl-9"
                placeholder="email or name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{filtered.length} of {users.length} shown</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-muted-foreground py-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-6">No users match that search.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Joined</th>
                  <th className="py-2 px-3 font-medium">Role</th>
                  <th className="py-2 pl-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="border-b border-border/60 hover:bg-secondary/40">
                      <td className="py-3 pr-3 font-medium">
                        {u.email}{" "}
                        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{u.full_name ?? "—"}</td>
                      <td className="py-3 px-3 text-muted-foreground tabular-nums">
                        {u.created_at.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3 pl-3 w-48">
                        <Select
                          value={u.role}
                          onValueChange={(v) => changeRole(u, v as Role)}
                          disabled={savingId === u.id || (isSelf && u.role === "admin")}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
        <Shield className="h-3 w-3 text-gold" />
        Bootstrapping the first admin? Run{" "}
        <code className="px-1 py-0.5 rounded bg-secondary text-foreground">
          insert into user_roles (user_id, role) values ('{'<your-uuid>'}', 'admin');
        </code>{" "}
        in the Supabase SQL editor.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="stat-label">{label}</div>
        <div className={`mt-1 font-display text-3xl ${accent ? "text-gold" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "admin") return <Badge>admin</Badge>;
  if (role === "pro") return <Badge variant="gold">pro</Badge>;
  return <Badge variant="secondary">free</Badge>;
}
