const Page = () => {
  return (
    <main className="mx-auto max-w-5xl p-12 space-y-6">
      <h1 className="text-3xl font-semibold">KCS Partner Widget</h1>
      <p className="text-slate-700">
        Embed the widget bundle at <code>/widget.js</code> to capture story briefs and submit orders to the intake
        API.
      </p>
      <section className="rounded border border-slate-200 p-4">
        <h2 className="text-xl font-medium">Phase 0 Widget Checklist</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          <li>Handles child + supporting character uploads</li>
          <li>Flags location photo (optional)</li>
          <li>Collects metadata for prompt overrides</li>
        </ul>
      </section>
    </main>
  );
};

export default Page;

