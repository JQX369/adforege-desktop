import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Contact FairyWize | Get in Touch | Support & Inquiries',
  description: 'Contact FairyWize for support, vendor partnerships, or general inquiries. Reach out to our team for help with gift recommendations or business opportunities.',
  keywords: [
    'contact FairyWize', 'customer support', 'vendor inquiries',
    'gift finder support', 'contact us', 'help center',
    'business partnerships', 'customer service'
  ],
  openGraph: {
    title: 'Contact FairyWize | Get in Touch | Support & Inquiries',
    description: 'Contact FairyWize for support, vendor partnerships, or general inquiries. Reach out to our team for help with gift recommendations or business opportunities.',
    url: 'https://fairywize.com/contact',
  },
  twitter: {
    title: 'Contact FairyWize | Get in Touch | Support & Inquiries',
    description: 'Contact FairyWize for support, vendor partnerships, or general inquiries. Reach out to our team for help with gift recommendations or business opportunities.',
  },
}

export default function ContactPage() {
  const contactMethods = [
    {
      title: 'General Support',
      description: 'Questions about using FairyWize or gift recommendations',
      email: 'support@fairywize.com',
      response: 'Within 24 hours',
      icon: '💬'
    },
    {
      title: 'Vendor Partnerships',
      description: 'Interested in becoming a FairyWize vendor or partner',
      email: 'vendors@fairywize.com',
      response: 'Within 48 hours',
      icon: '🤝'
    },
    {
      title: 'Business Inquiries',
      description: 'Partnerships, press, or business development',
      email: 'business@fairywize.com',
      response: 'Within 72 hours',
      icon: '💼'
    },
    {
      title: 'Technical Issues',
      description: 'Report bugs or technical problems',
      email: 'tech@fairywize.com',
      response: 'Within 12 hours',
      icon: '🔧'
    }
  ]

  const faqs = [
    {
      question: 'How does FairyWize work?',
      answer: 'FairyWize uses advanced AI to analyze your gift preferences and recommend personalized presents. Simply answer a few questions about the recipient and occasion.'
    },
    {
      question: 'Is FairyWize free to use?',
      answer: 'Yes! FairyWize is completely free for users to find gift recommendations. We earn through affiliate partnerships with vendors.'
    },
    {
      question: 'How do I become a vendor?',
      answer: 'Contact our vendor team at vendors@fairywize.com with information about your products and business. We review applications based on quality and uniqueness.'
    },
    {
      question: 'Can I return or exchange gifts?',
      answer: 'Return policies vary by vendor. We link to each vendor\'s return policy, and most offer standard return windows for unused items.'
    },
    {
      question: 'Is my data safe with FairyWize?',
      answer: 'Absolutely. We use enterprise-grade security and never sell your personal information. See our Privacy Policy for complete details.'
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">Get in Touch</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Contact FairyWize
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Have questions, feedback, or interested in partnering with us?
            We're here to help make your gift-finding experience magical.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactMethods.map((method, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center">
                  <div className="text-4xl mb-4">{method.icon}</div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {method.title}
                  </CardTitle>
                  <CardDescription>{method.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="space-y-2">
                    <p className="font-medium">{method.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Response: {method.response}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    asChild
                  >
                    <a href={`mailto:${method.email}`}>
                      Send Email
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Business Hours */}
        <div className="max-w-4xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Support Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8 text-center">
                <div>
                  <h3 className="font-semibold mb-3">Customer Support</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                    <p>Saturday: 10:00 AM - 4:00 PM EST</p>
                    <p>Sunday: Closed</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Emergency Support</h3>
                  <div className="space-y-1 text-muted-foreground">
                    <p>24/7 for critical technical issues</p>
                    <p>Response within 4 hours</p>
                    <p>Email: emergency@fairywize.com</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Social Proof */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl p-8 border border-green-200/20">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
              Join Thousands of Happy Customers
            </h2>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">98%</div>
                <p className="text-muted-foreground">Customer Satisfaction</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">50K+</div>
                <p className="text-muted-foreground">Gifts Recommended</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                <p className="text-muted-foreground">Support Available</p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Find the Perfect Gift?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the magic of AI-powered gift recommendations today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <a href="/">
                Start Finding Gifts →
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/gift-guides">
                Browse Gift Guides →
              </a>
            </Button>
          </div>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground mt-16">
          <h2>Contact FairyWize - We're Here to Help</h2>
          <p>
            Getting in touch with FairyWize is easy. Whether you need help finding the perfect gift,
            want to become a vendor, or have questions about our AI-powered platform, our dedicated
            team is ready to assist you.
          </p>

          <h3>Customer Support</h3>
          <p>
            Our customer support team is available during business hours to help with any questions
            about using FairyWize, understanding recommendations, or navigating the platform.
            We pride ourselves on quick response times and helpful, friendly service.
          </p>

          <h3>Vendor Partnerships</h3>
          <p>
            Interested in joining our curated network of gift vendors? Our vendor relations team
            reviews applications from quality brands and unique artisans. We look for products
            that align with our commitment to thoughtful, personalized gifting.
          </p>

          <h3>Business Development</h3>
          <p>
            For partnership opportunities, press inquiries, or business development discussions,
            our business team handles all commercial relationships and strategic initiatives.
          </p>

          <h3>Technical Support</h3>
          <p>
            Experiencing technical difficulties? Our technical support team provides rapid
            assistance for platform issues, bugs, and performance concerns. Critical issues
            receive priority attention with 24/7 monitoring.
          </p>

          <h3>Response Times and Availability</h3>
          <p>
            We strive to respond to all inquiries promptly. Customer support emails are typically
            answered within 24 hours during business days. Technical issues receive even faster
            attention, often within 12 hours. Emergency situations are handled around the clock.
          </p>

          <h3>Getting the Most Out of FairyWize</h3>
          <p>
            For the best experience with FairyWize, we recommend providing detailed information
            about the gift recipient and occasion. The more context you provide, the better our
            AI can tailor recommendations to create truly meaningful gifts.
          </p>
        </div>
      </div>
    </main>
  )
}
