import Link from 'next/link'

interface GuidesCtaProps {
  href?: string
}

export function GuidesCta({ href = '/gift-guides' }: GuidesCtaProps) {
  return (
    <section id="guides" className="mx-auto max-w-6xl px-6 pb-20">
      <div className="rounded-3xl bg-gradient-to-r from-[#6b5cff] via-[#7f6dff] to-[#a799ff] px-10 py-12 text-white shadow-inner">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-display-sm text-white">
              Explore gift guides curated by our team
            </h2>
            <p className="text-body-base text-white/80">
              Browse by occasion or price point. Updated weekly with new
              AI-vetted finds.
            </p>
          </div>
          <Link
            href={href}
            data-analytics="guides_click"
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-white/40"
          >
            View gift guides
          </Link>
        </div>
      </div>
    </section>
  )
}
