const items = [
  { title: "Fast personal quiz", body: "Twelve tuned questions: occasion, budget, interests." },
  { title: "Curated matches", body: "AI picks blended with human-reviewed products." },
  { title: "Refine with swipes", body: "Like or pass to reshuffle; save favourites." },
]

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="features-heading">
      <div className="grid gap-4 md:grid-cols-3" id="features-heading">
        {items.map((item) => (
          <div key={item.title} className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="text-body-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <a
          href="#quiz"
          data-analytics="cta_features_start"
          className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-base font-semibold text-background transition hover:shadow-md focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
        >
          Start gift quiz
        </a>
      </div>
    </section>
  )
}

