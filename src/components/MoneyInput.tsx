import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { displayWithCommas, parseNumericInput } from "@/lib/format";

interface NumericFieldProps {
  id?: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  /** For % inputs: value is decimal (0.075), input displays 7.50 */
  percent?: boolean;
  /** Number of decimals when displaying. Default 0 for money, 2 for percent. */
  decimals?: number;
  className?: string;
  hint?: string;
}

/**
 * Numeric input with prefix/suffix slots, comma-formatted display, and a raw numeric
 * value upstream. Internally tracks the user's in-progress text so they can keep
 * typing decimals without losing focus or having "7." round to "7".
 */
export function NumericField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  percent,
  decimals,
  className,
  hint,
}: NumericFieldProps) {
  const displayDecimals = decimals ?? (percent ? 2 : 0);
  const toDisplay = (n: number) => {
    if (!Number.isFinite(n)) return "";
    const v = percent ? n * 100 : n;
    return displayWithCommas(v.toFixed(displayDecimals).replace(/\.?0+$/, ""));
  };
  const [text, setText] = React.useState<string>(toDisplay(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setText(toDisplay(value));
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const raw = parseNumericInput(e.target.value);
            setText(displayWithCommas(raw));
            const n = raw === "" || raw === "-" || raw === "." ? 0 : Number(raw);
            if (Number.isFinite(n)) onChange(percent ? n / 100 : n);
          }}
          onBlur={() => {
            setFocused(false);
            setText(toDisplay(value));
          }}
          className={cn(prefix && "pl-7", suffix && "pr-10")}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
