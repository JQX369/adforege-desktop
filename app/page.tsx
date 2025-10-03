"use client"
import { useState } from 'react'
import { Hero } from '@/components/site/Hero'
import { FeatureGrid } from '@/components/site/FeatureGrid'
import { SwipeSection } from '@/components/site/SwipeSection'
import BubbleGraph from '@/components/visuals/BubbleGraph'
import Image from 'next/image'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [showSwipeDeck, setShowSwipeDeck] = useState(false)
  const [userId, setUserId] = useState('')

  const bubbleProgress = showSwipeDeck ? 0.95 : 0.45

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <Hero />
      <FeatureGrid />
      <SwipeSection />

      {/* Simple placeholder for the image */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <Image
            src="/images/placeholder.png"
            alt="Family and friends spending time together"
            className="w-full h-36 md:h-40 object-cover rounded-xl mx-auto"
            width={400}
            height={160}
            priority
          />
        </div>
      </div>

      <BubbleGraph progress={bubbleProgress} />
    </main>
  )
}