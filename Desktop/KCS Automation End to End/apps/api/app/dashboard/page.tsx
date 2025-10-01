import Link from "next/link";

const DashboardHome = () => {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Pipeline Overview</h2>
        <p className="text-sm text-slate-600">
          Keep track of partner orders, Gemini-driven asset batches, and packaging outputs.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/orders"
          className="rounded border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-300"
        >
          <h3 className="text-lg font-medium text-slate-900">Orders</h3>
          <p className="text-sm text-slate-600">Recent orders and pipeline status.</p>
        </Link>
        <Link
          href="/dashboard/queues"
          className="rounded border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-300"
        >
          <h3 className="text-lg font-medium text-slate-900">Queues</h3>
          <p className="text-sm text-slate-600">BullMQ metrics, DLQs, and asset packaging throughput.</p>
        </Link>
      </div>
    </div>
  );
};

export default DashboardHome;

