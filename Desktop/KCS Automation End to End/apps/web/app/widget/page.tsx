"use client";

import { useState } from "react";

const initialForm = {
  childFirstName: "",
  age: "",
  readingLevel: "",
  interests: "",
  theme: "",
  tone: "",
  objective: "",
  language: "en-GB",
  dedication: "",
  childPhoto: null as File | null,
  locationPhoto: null as File | null
};

const WidgetPage = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Submitting...");

    const submission = { ...form, childPhoto: undefined, locationPhoto: undefined };
    const response = await fetch("/api/widget/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission)
    });

    const data = await response.json();
    setStatus(data.status ?? "queued");
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Partner Widget (Stub)</h1>
      <p className="mt-2 text-sm text-slate-600">This mock widget demonstrates collecting order briefs.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" htmlFor="childFirstName">
            Child First Name
          </label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            id="childFirstName"
            name="childFirstName"
            value={form.childFirstName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="age">
              Age
            </label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="number"
              min={0}
              max={12}
              id="age"
              name="age"
              value={form.age}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="readingLevel">
              Reading Level
            </label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              id="readingLevel"
              name="readingLevel"
              value={form.readingLevel}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="NURSERY_RECEPTION">Nursery & Reception (3-5)</option>
              <option value="EARLY_KS1">Early KS1 Reader (5-6)</option>
              <option value="KS1_CONFIDENT">KS1 Confident (6-7)</option>
              <option value="LOWER_KS2_STARTER">Lower KS2 Starter (7-8)</option>
              <option value="LOWER_KS2_CONFIDENT">Lower KS2 Confident (8-9)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="interests">
            Child Interests or Story Concept
          </label>
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            id="interests"
            name="interests"
            value={form.interests}
            onChange={handleChange}
            rows={3}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="theme">
              Core Theme
            </label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              id="theme"
              name="theme"
              value={form.theme}
              onChange={handleChange}
              placeholder="CURIOSITY"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="tone">
              Tone
            </label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              id="tone"
              name="tone"
              value={form.tone}
              onChange={handleChange}
              placeholder="HEARTWARMING"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="objective">
            Story Objective
          </label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            id="objective"
            name="objective"
            value={form.objective}
            onChange={handleChange}
            placeholder="THE_JOURNEY_OF_DISCOVERY"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="language">
            Language
          </label>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            id="language"
            name="language"
            value={form.language}
            onChange={handleChange}
          >
            <option value="en-GB">English (UK)</option>
            <option value="en-US">English (US)</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="dedication">
            Dedication
          </label>
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            id="dedication"
            name="dedication"
            value={form.dedication}
            onChange={handleChange}
            rows={2}
          />
        </div>

        <label className="block text-sm font-medium" htmlFor="childPhoto">
          Child Photo (optional)
        </label>
        <input
          id="childPhoto"
          type="file"
          accept="image/*"
          className="mt-1"
          onChange={(event) => setForm((prev) => ({ ...prev, childPhoto: event.target.files?.[0] ?? null }))}
        />

        <label className="block text-sm font-medium" htmlFor="locationPhoto">
          Location Photo (optional)
        </label>
        <input
          id="locationPhoto"
          type="file"
          accept="image/*"
          className="mt-1"
          onChange={(event) => setForm((prev) => ({ ...prev, locationPhoto: event.target.files?.[0] ?? null }))}
        />

        <button
          className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
          type="submit"
        >
          Submit Order Brief
        </button>
      </form>

      {status && <p className="mt-6 text-sm text-slate-700">Status: {status}</p>}
    </main>
  );
};

export default WidgetPage;

