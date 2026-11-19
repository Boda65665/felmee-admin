import { useState } from "react";
import { differenceInCalendarDays, format, isValid, parseISO, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useSearchParams } from "react-router-dom";

import type { OverviewMetric } from "@/lib/api/business-overview";

export const overviewNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
function defaultPeriod() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Minsk", dateStyle: "short" })
    .format(new Date());
  return { from: format(subDays(parseISO(today), 29), "yyyy-MM-dd"), to: today };
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function useOverviewPeriod() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<DateRange>();
  const fallback = defaultPeriod();
  const from = parseDate(params.get("from")) ?? parseISO(fallback.from);
  const to = parseDate(params.get("to")) ?? parseISO(fallback.to);
  const period = { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
  const days = differenceInCalendarDays(to, from) + 1;
  const valid = days > 0 && days <= 366;

  const onChange = (range: DateRange | undefined) => {
    setDraft(range?.from && !range.to ? range : undefined);
    if (range?.from && range.to) {
      setParams({
        from: format(range.from, "yyyy-MM-dd"),
        to: format(range.to, "yyyy-MM-dd"),
      }, { replace: true });
    }
  };

  return {
    period,
    range: draft ?? { from, to },
    dirty: Boolean(draft || period.from !== fallback.from || period.to !== fallback.to),
    valid,
    onChange,
    reset: () => { setDraft(undefined); setParams({}, { replace: true }); },
  };
}

export function overviewStat(title: string, metric: OverviewMetric, unit = "", decreaseIsPositive = false) {
  const change = metric.change_percent;
  return {
    title,
    value: `${overviewNumber.format(metric.value)}${unit}`,
    delta: change == null ? null : `${change > 0 ? "+" : ""}${overviewNumber.format(change)}${unit === "%" ? " п. п." : "%"}`,
    up: change == null || (decreaseIsPositive ? change <= 0 : change >= 0),
  };
}

