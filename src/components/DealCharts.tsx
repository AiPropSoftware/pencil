/**
 * Recharts-backed charts — split out of the main bundle so first paint never
 * pays for the charting library; this chunk lazy-loads when a panel opens.
 */
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { metroTrend } from "@/data/developments";
import { fmtMoney } from "@/lib/format";

export function PpsfChart({ city }: { city: string }) {
  const data = metroTrend(city);
  return (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="ppsf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(38 48% 52%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(38 48% 52%)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 88%)" vertical={false} />
        <XAxis dataKey="quarter" tick={{ fontSize: 10 }} interval={1} />
        <YAxis tick={{ fontSize: 10 }} width={46} tickFormatter={(v) => `$${v}`} />
        <RTooltip formatter={(v: number) => [`$${v}/sf`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(30 15% 86%)" }} />
        <Area type="monotone" dataKey="high" stroke="none" fill="url(#ppsf)" />
        <Line type="monotone" dataKey="high" stroke="hsl(25 10% 65%)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
        <Line type="monotone" dataKey="low" stroke="hsl(25 10% 65%)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
        <Line type="monotone" dataKey="ppsf" stroke="hsl(38 48% 42%)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function PriceHistoryChart({ data }: { data: { label: string; price: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 88%)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={54} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <RTooltip formatter={(v: number) => [fmtMoney(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(30 15% 86%)" }} />
        <Line type="monotone" dataKey="price" stroke="hsl(38 48% 42%)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
