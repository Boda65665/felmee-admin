import { Card } from "@/components/card";
import { DeltaBadge } from "@/components/delta-badge";

type Metric = { title: string; value: string; delta: string; up: boolean };

/** Метрики блока «Пользователи и конверсии» (демо-данные). */
const METRICS: Metric[] = [
  { title: "Пользователи", value: "1 284", delta: "+14,2%", up: true },
  { title: "Отказы", value: "9,81%", delta: "-0,2%", up: true },
  { title: "Записи", value: "1 284", delta: "+14,2%", up: true },
];

/** Секция «Пользователи и конверсии»: заголовок + сетка карточек-метрик. */
export const MetricsGrid = () => {
  return (
    <Card>
      <h2 className="mb-5 text-lg font-medium leading-[1.3] tracking-tight text-ink">
        Пользователи и конверсии
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {METRICS.map(({ title, value, delta, up }) => (
          <Card key={title} className="flex flex-col gap-5">
            <p className="text-sm font-medium leading-[1.3] tracking-tight text-ink-muted">
              {title}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[28px] font-medium leading-[1.1] tracking-tight text-ink">
                {value}
              </span>
              <DeltaBadge up={up}>{delta}</DeltaBadge>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};
