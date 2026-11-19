import { Card } from "@/components/card";
import { DeltaBadge } from "@/components/delta-badge";

type Metric = { title: string; value: string; delta: string | null; up: boolean };

/** Секция «Пользователи и конверсии»: заголовок + сетка карточек-метрик. */
export const MetricsGrid = ({ metrics }: { metrics: Metric[] }) => {
  return (
    <Card>
      <h2 className="mb-5 text-lg font-medium leading-[1.3] tracking-tight text-ink">
        Пользователи и конверсии
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {metrics.map(({ title, value, delta, up }) => (
          <Card key={title} className="flex flex-col gap-5">
            <p className="text-sm font-medium leading-[1.3] tracking-tight text-ink-muted">
              {title}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[28px] font-medium leading-[1.1] tracking-tight text-ink">
                {value}
              </span>
              {delta !== null && <DeltaBadge up={up}>{delta}</DeltaBadge>}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};
