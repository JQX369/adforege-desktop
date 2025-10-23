import { Metadata } from 'next'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Badge } from '@/src/ui/badge'
import { Button } from '@/src/ui/button'
import { ABOUT_METADATA } from '@/lib/metadata'

export const metadata: Metadata = ABOUT_METADATA

export default function AboutPage() {
  const features = [
    {
      title: 'AI-Powered Recommendations',
      description:
        'Our advanced artificial intelligence analyzes recipient preferences, relationships, and occasions to suggest truly personalized gifts.',
      icon: '🤖',
    },
    {
      title: 'Curated Product Database',
      description:
        'We partner with trusted vendors to offer high-quality, unique products from boutique shops and artisanal makers.',
      icon: '🎁',
    },
    {
      title: 'User-Friendly Experience',
      description:
        'Simple questions lead to magical results. No more endless scrolling or decision paralysis.',
      icon: '✨',
    },
    {
      title: 'Thoughtful & Meaningful',
      description:
        'Every recommendation is designed to create genuine connections and memorable moments.',
      icon: '💝',
    },
  ]

  const team = [
    {
      name: 'AI Gift Matching Algorithm',
      role: 'Core Technology',
      description:
        'Our proprietary AI learns from millions of gift-giving patterns to make increasingly accurate recommendations.',
    },
    {
      name: 'Curated Vendor Network',
      role: 'Product Partners',
      description:
        'We work with handpicked vendors who share our commitment to quality, uniqueness, and customer satisfaction.',
    },
    {
      name: 'User Experience Design',
      role: 'Product Design',
      description:
        'Intuitive interfaces that make the gift-finding process feel like magic, not work.',
    },
  ]

  const stats = [
    { number: '10,000+', label: 'Happy Customers' },
    { number: '50,000+', label: 'Gifts Recommended' },
    { number: '500+', label: 'Partner Vendors' },
    { number: '95%', label: 'Satisfaction Rate' },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">
            About FairyWize
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Making Gift-Giving Magical
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            We're on a mission to eliminate the stress and uncertainty of
            finding the perfect gift. Using cutting-edge AI technology, we
            transform simple answers into extraordinary recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/">Try FairyWize →</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/vendor">Join as Vendor →</Link>
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                {stat.number}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-8">
              In a world of endless choices, finding the perfect gift shouldn't
              be overwhelming. We believe that thoughtful gifting should be
              accessible to everyone, regardless of time constraints or shopping
              expertise.
            </p>
            <p className="text-lg text-muted-foreground">
              FairyWize was born from the frustration of last-minute gift
              shopping and the joy of discovering that perfect present. We
              combine artificial intelligence with human curation to create an
              experience that's both magical and reliable.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How FairyWize Works
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Technology Section */}
        <div className="mb-16">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-8 border border-purple-200/20">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
              Powered by Advanced AI
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {team.map((member, index) => (
                <div key={index} className="text-center">
                  <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                  <p className="text-primary font-medium mb-3">{member.role}</p>
                  <p className="text-muted-foreground">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Our Values
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-3">
                Personalization First
              </h3>
              <p className="text-muted-foreground">
                Every recommendation is tailored to create genuine connections
                and memorable experiences.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold mb-3">
                Ethical Partnerships
              </h3>
              <p className="text-muted-foreground">
                We partner with vendors who share our commitment to quality,
                sustainability, and fair practices.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-3">Innovation Driven</h3>
              <p className="text-muted-foreground">
                We continuously improve our AI and platform to deliver the best
                possible gift-finding experience.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Experience the Magic?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have discovered the joy of
            effortless, thoughtful gifting.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/">Find Your Perfect Gift →</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/gift-guides">Explore Gift Guides →</Link>
            </Button>
          </div>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground mt-16">
          <h2>About FairyWize: Revolutionizing Gift Recommendations</h2>
          <p>
            FairyWize represents the future of gift-giving in the digital age.
            Founded with the belief that finding the perfect gift should be as
            magical as receiving one, we've developed an AI-powered platform
            that understands the art and science of thoughtful gifting.
          </p>

          <h3>The Problem We Solve</h3>
          <p>
            Traditional gift shopping is often stressful and time-consuming.
            Hours spent browsing countless options, second-guessing decisions,
            and worrying about whether the recipient will appreciate the gift.
            FairyWize eliminates this uncertainty by combining artificial
            intelligence with human curation to deliver personalized
            recommendations that truly resonate.
          </p>

          <h3>Our Technology</h3>
          <p>
            At the heart of FairyWize is our proprietary AI algorithm that
            learns from gift-giving patterns, cultural contexts, and individual
            preferences. The system considers factors like relationship
            dynamics, personality traits, interests, and occasion significance
            to generate recommendations that feel intuitively right.
          </p>

          <h3>Quality Assurance</h3>
          <p>
            Every product in our database undergoes careful review to ensure it
            meets our standards for quality, uniqueness, and value. We work
            exclusively with vendors who demonstrate commitment to customer
            satisfaction and ethical business practices.
          </p>

          <h3>Privacy & Trust</h3>
          <p>
            We take privacy seriously. Your gift-finding preferences and
            personal information are protected with enterprise-grade security.
            We never share your data with third parties, and all recommendations
            are generated securely on our servers.
          </p>

          <h3>Join the FairyWize Community</h3>
          <p>
            Whether you're a gift-giver looking for the perfect present or a
            vendor wanting to reach more customers, FairyWize offers a platform
            that makes thoughtful gifting accessible and enjoyable for everyone
            involved.
          </p>
        </div>
      </div>
    </main>
  )
}
