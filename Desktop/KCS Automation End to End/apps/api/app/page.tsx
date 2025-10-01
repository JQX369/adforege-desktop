const Page = () => {
  return (
    <main className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">KCS Automation API</h1>
      <section className="space-y-2">
        <h2 className="text-xl font-medium">Intake Status</h2>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>/api/partner/orders &mdash; HMAC-signed order intake</li>
          <li>images.analyze_uploads queue &mdash; image-first descriptors</li>
          <li>brief.extract queue &mdash; pending Phase 2</li>
        </ul>
        <p className="text-sm text-indigo-600">
          <a href="/dashboard">Open Admin Dashboard &rarr;</a>
        </p>
      </section>
    </main>
  );
};

export default Page;

