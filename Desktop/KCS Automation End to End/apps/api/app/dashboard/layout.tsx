import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">KCS Admin Dashboard</h1>
        <p className="text-sm text-slate-600">Monitor ingestion, story pipeline, and asset packaging</p>
      </header>
      <main className="px-8 py-6">{children}</main>
    </div>
  );
}

