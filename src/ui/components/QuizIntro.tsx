interface QuizIntroProps {
  onStart?: () => void
}

export function QuizIntro({ onStart }: QuizIntroProps) {
  return (
    <section id="quiz" className="mx-auto max-w-5xl px-6">
      <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-4">
            <p className="text-body-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Just 2 minutes
            </p>
            <h2 className="text-display-sm text-foreground">
              Tell us about them
            </h2>
            <div className="flex flex-wrap gap-3 text-body-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
                ⏱️ ~2 minutes
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
                🔒 No login
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
                🔖 Save & share
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onStart}
            data-analytics="quiz_start"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
          >
            Start now
          </button>
        </div>
      </div>
    </section>
  )
}
