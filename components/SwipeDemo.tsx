import Image from "next/image"

const tips = [
  { icon: "💜", label: "Swipe right to like" },
  { icon: "✖️", label: "Swipe left to skip" },
  { icon: "🔖", label: "Save favourites" },
]

interface SwipeDemoProps {
  onCta?: () => void
}

export function SwipeDemo({ onCta }: SwipeDemoProps) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:items-center" aria-labelledby="swipe-demo-heading">
      <div className="flex-1">
        <div className="relative mx-auto aspect-[3/4] max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <Image
            src="/images/placeholder.png"
            alt="Example gift card showing swipe actions"
            fill
            className="object-cover"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" aria-hidden />
        </div>
      </div>
      <div className="flex-1 space-y-6" id="swipe-demo-heading">
        <h2 className="text-display-sm text-foreground">Swipe to refine your picks</h2>
        <p className="text-body-base text-muted-foreground">
          Keep the matches flowing. Swipe to teach the quiz what feels right, then save the ones you want to share.
        </p>
        <div className="flex flex-wrap gap-3">
          {tips.map((tip) => (
            <span key={tip.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-body-sm text-foreground">
              <span aria-hidden>{tip.icon}</span>
              {tip.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onCta}
          data-analytics="swipe_demo_interact"
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring focus-visible:ring-primary/30"
        >
          Try the quiz—see your picks in 2 minutes
        </button>
      </div>
    </section>
  )
}

