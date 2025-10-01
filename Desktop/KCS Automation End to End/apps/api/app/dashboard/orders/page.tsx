import { Suspense } from "react";
import { fetchPackagingSummaries } from "../../../lib/dashboard/datasource";

const shimmer = "relative overflow-hidden rounded-lg bg-white p-6 shadow-sm";

const LoadingCard = () => (
  <div className={shimmer}>
    <div className="mb-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
    <div className="mb-2 h-6 w-2/3 animate-pulse rounded bg-slate-200" />
    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
  </div>
);

const PackagingList = async () => {
  const summaries = await fetchPackagingSummaries();

  if (summaries.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        No packaged stories yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {summaries.map((summary) => (
        <article
          key={summary.orderId}
          className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              {summary.partnerName}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(summary.updatedAt).toLocaleString()}
            </span>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">Order {summary.orderId}</h3>
          <p className="text-sm text-slate-600">{summary.customerEmail ?? "No customer email"}</p>
          {summary.packagedLinks?.titleOptions?.length ? (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title Ideas</h4>
              <ul className="space-y-1 text-sm text-slate-700">
                {summary.packagedLinks.titleOptions.map((title) => (
                  <li key={title} className="rounded bg-slate-100 px-2 py-1">
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.packagedLinks?.blurb ? (
            <p className="mt-4 text-sm text-slate-600">{summary.packagedLinks.blurb}</p>
          ) : null}
          {summary.packagedLinks?.ordered?.length ? (
            <div className="mt-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Assets:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.packagedLinks.ordered.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
                  >
                    View asset
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
};

const OrdersPage = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Packaged Stories</h2>
        <p className="text-sm text-slate-600">
          Gemini-generated assets, overlay choices, and blurbs ready for partner delivery.
        </p>
      </header>
      <Suspense fallback={<LoadingCard />}>
        <PackagingList />
      </Suspense>
    </div>
  );
};

export default OrdersPage;

