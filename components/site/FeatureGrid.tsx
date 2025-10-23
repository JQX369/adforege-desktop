import { Card, CardContent } from '@/src/ui/card'
import { useEffect, useRef } from 'react'
import Image from 'next/image'

const features = [
  {
    image: '/images/placeholder.png',
    title: 'Fast personal quiz',
    text: 'Twelve questions tuned to occasion, budget, and personality so every match feels intentional.',
  },
  {
    image: '/images/placeholder.png',
    title: 'Curated matches',
    text: 'AI-assisted picks blended with human-reviewed products and affiliate offers from trusted retailers.',
  },
  {
    image: '/images/placeholder.png',
    title: 'Refine with swipes',
    text: 'Like or pass to instantly reshuffle ideas, then save favourites to share when you are ready.',
  },
]

export function FeatureGrid() {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!sectionRef.current || typeof window === 'undefined') return
    const cards = Array.from(
      sectionRef.current.querySelectorAll<HTMLElement>('.reveal-card')
    )
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
          }
        })
      },
      { threshold: 0.2 }
    )
    cards.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="py-8 md:py-12 fade-in-up"
      data-spotlight="true"
    >
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 opacity-95">
        {features.map(({ image, title, text }, idx) => (
          <Card
            key={title}
            className="border-muted/40 glass-panel hover-float reveal-card"
            style={{ transitionDelay: `${idx * 150}ms` }}
          >
            <CardContent className="p-6 flex gap-4">
              <div className="rounded-full bg-primary/10 text-primary p-4 md:p-5 shrink-0">
                <Image
                  src={image}
                  alt={title}
                  width={40}
                  height={40}
                  className="w-8 h-8 md:w-10 md:h-10"
                />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
