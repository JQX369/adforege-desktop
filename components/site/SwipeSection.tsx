import { Card, CardContent } from '@/components/ui/card'
import { Heart, X, Bookmark } from 'lucide-react'
import Image from 'next/image'

export function SwipeSection() {
  return (
    <section className="py-8 md:py-10 border-top border-white/10 fade-in-up" aria-label="How swiping works" data-spotlight="true">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
          <div className="order-1 relative">
            <div className="mx-auto md:mx-0 w-full max-w-xl rounded-2xl overflow-hidden glass-panel p-4">
              <div className="relative w-full aspect-square">
                <Image
                  src="/images/placeholder.png"
                  alt="Illustration of swiping left or right to rate gift ideas"
                  fill
                  className="object-contain rounded-xl"
                  priority
                  sizes="(min-width: 1024px) 560px, (min-width: 768px) 70vw, 100vw"
                />
              </div>
            </div>
            {/* Grounding glow/shadow */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-1 w-1/2 h-6 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.30),transparent_60%)] blur-xl opacity-70" />
          </div>
          <div className="order-2">
            <div className="text-center md:text-left mb-4 md:mb-6">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Swipe to refine your picks</h2>
              <p className="text-muted-foreground mt-2 md:text-lg">Swipe right to like, left to pass, and save your favorites to revisit later.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 items-stretch">
              <Card className="h-full border-muted/30 hover-float">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 text-primary p-3">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">Swipe right to like</h3>
                    <p className="text-sm text-muted-foreground">Guide the AI toward better matches.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full border-muted/30 hover-float">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-full bg-destructive/10 text-destructive p-3">
                    <X className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">Swipe left to skip</h3>
                    <p className="text-sm text-muted-foreground">Remove misses and keep results focused.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="h-full border-muted/30 hover-float">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-full bg-secondary/20 text-secondary-foreground p-3">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">Save favorites</h3>
                    <p className="text-sm text-muted-foreground">Build a shortlist in the Saved drawer.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


