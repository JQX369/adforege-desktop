import { Suspense } from "react";
import { fetchQueueStats } from "../../../lib/dashboard/datasource";

const shimmer = "relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

const AnimatedBadge = ({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "rose" }) => {
  const tones = {
    green: "from-emerald-200 to-emerald-400 text-emerald-900",
    amber: "from-amber-200 to-amber-400 text-amber-900",
    rose: "from-rose-200 to-rose-400 text-rose-900"
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium uppercase text-slate-500">{label}</span>
      <span className={`inline-flex items-center justify-center rounded-full bg-gradient-to-r px-3 py-1 text-sm font-semibold ${tones[tone]}`}>
        {value}
      </span>
    </div>
  );
};

const LoadingTile = () => (
  <div className={shimmer}>
    <div className="mb-2 h-4 w-20 animate-pulse rounded bg-slate-200" />
    <div className="mb-6 h-6 w-1/2 animate-pulse rounded bg-slate-200" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-10 animate-pulse rounded bg-slate-100" />
      <div className="h-10 animate-pulse rounded bg-slate-100" />
    </div>
  </div>
);

const QueueTiles = async () => {
  const stats = await fetchQueueStats();

  if (!stats.length) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        No queue metrics available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {stats.map((queue) => (
        <article
          key={queue.name}
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">{queue.name}</h3>
            <span className="text-xs uppercase tracking-wide text-indigo-500">BullMQ</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AnimatedBadge label="Waiting" value={queue.waiting} tone="amber" />
            <AnimatedBadge label="Active" value={queue.active} tone="green" />
            <AnimatedBadge label="Completed" value={queue.completed} tone="green" />
            <AnimatedBadge label="Failed" value={queue.failed} tone="rose" />
          </div>
        </article>
      ))}
    </div>
  );
};

const QueuesPage = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Queues & Metrics</h2>
        <p className="text-sm text-slate-600">Monitor Gemini asset generation, packaging throughput, and backlog health.</p>
      </header>
      <Suspense fallback={<LoadingTile />}>
        <QueueTiles />
      </Suspense>
    </div>
  );
};

export default QueuesPage;

