import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Terms of Service | FairyWize AI Gift Finder | Terms & Conditions',
  description: 'Read FairyWize\'s terms of service and usage agreement. Understand our platform rules, user responsibilities, and service commitments.',
  keywords: [
    'terms of service', 'terms and conditions', 'FairyWize terms',
    'user agreement', 'service terms', 'platform rules',
    'legal terms', 'usage agreement'
  ],
  openGraph: {
    title: 'Terms of Service | FairyWize AI Gift Finder | Terms & Conditions',
    description: 'Read FairyWize\'s terms of service and usage agreement. Understand our platform rules, user responsibilities, and service commitments.',
    url: 'https://fairywize.com/terms',
  },
  twitter: {
    title: 'Terms of Service | FairyWize AI Gift Finder | Terms & Conditions',
    description: 'Read FairyWize\'s terms of service and usage agreement. Understand our platform rules, user responsibilities, and service commitments.',
  },
}

export default function TermsPage() {
  const sections = [
    {
      title: 'Acceptance of Terms',
      content: [
        'By accessing and using FairyWize, you accept and agree to be bound by these Terms of Service',
        'These terms apply to all users, including browsers, vendors, and contributors',
        'If you do not agree to these terms, please do not use our service',
        'We reserve the right to modify these terms at any time with notice'
      ]
    },
    {
      title: 'Description of Service',
      content: [
        'FairyWize is an AI-powered gift recommendation platform',
        'We provide personalized gift suggestions based on user input',
        'Service availability may vary and is provided "as is"',
        'We reserve the right to modify or discontinue services at any time'
      ]
    },
    {
      title: 'User Responsibilities',
      content: [
        'Provide accurate and truthful information when using our service',
        'Use the platform for lawful purposes only',
        'Respect intellectual property rights of content on our platform',
        'Maintain the security of your account credentials',
        'Report any misuse or security concerns promptly'
      ]
    },
    {
      title: 'Vendor Terms',
      content: [
        'Vendors must provide accurate product information and descriptions',
        'All products must comply with applicable laws and regulations',
        'Vendors are responsible for order fulfillment and customer service',
        'Commission structures and payment terms are subject to separate agreements',
        'Product quality and customer satisfaction are paramount'
      ]
    },
    {
      title: 'Intellectual Property',
      content: [
        'FairyWize content and technology are protected by copyright and trademark laws',
        'Users retain rights to their original content and personal information',
        'Limited license granted for platform use and personal, non-commercial purposes',
        'Unauthorized use or reproduction is strictly prohibited'
      ]
    },
    {
      title: 'Privacy and Data',
      content: [
        'Your privacy is protected under our Privacy Policy',
        'We collect and use data as described in our privacy documentation',
        'Data is used to improve services and provide personalized recommendations',
        'You have rights regarding your personal information and data usage'
      ]
    },
    {
      title: 'Disclaimers and Limitations',
      content: [
        'Service provided "as is" without warranties of any kind',
        'We do not guarantee recommendation accuracy or suitability',
        'Limitation of liability for indirect or consequential damages',
        'Some jurisdictions may not allow certain limitations'
      ]
    }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">Legal & Compliance</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Terms of Service
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            These terms govern your use of FairyWize and outline our mutual rights and responsibilities.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: October 3, 2025
          </p>
        </div>

        {/* Introduction */}
        <div className="max-w-4xl mx-auto mb-12">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground leading-relaxed">
                Welcome to FairyWize! These Terms of Service ("Terms") govern your access to and use
                of the FairyWize website, mobile application, and related services (collectively, the "Service").
                By using FairyWize, you agree to be bound by these Terms.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Terms Sections */}
        <div className="max-w-4xl mx-auto space-y-8">
          {sections.map((section, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-2xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <span className="text-primary font-bold mt-1">•</span>
                      <span className="text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Termination */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We reserve the right to terminate or suspend your account and access to the Service
                  immediately, without prior notice or liability, for any reason, including but not
                  limited to breach of these Terms.
                </p>
                <p>
                  Upon termination, your right to use the Service will cease immediately. All provisions
                  of these Terms which by their nature should survive termination shall survive,
                  including ownership provisions, warranty disclaimers, and limitations of liability.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Governing Law */}
        <div className="max-w-4xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Governing Law</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  These Terms shall be interpreted and governed by the laws of the jurisdiction in which
                  FairyWize operates, without regard to conflict of law provisions.
                </p>
                <p>
                  Any disputes arising from these Terms or your use of the Service shall be resolved
                  through binding arbitration in accordance with the rules of the applicable arbitration
                  association.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <div className="max-w-4xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Contact Information</CardTitle>
              <CardDescription>
                Questions about these Terms should be directed to:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> legal@fairywize.com</p>
                <p><strong>Subject:</strong> Terms of Service Inquiry</p>
                <p><strong>Response Time:</strong> We aim to respond within 5-7 business days.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Changes to Terms */}
        <div className="max-w-4xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of
                material changes via email or through a prominent notice on our platform.
                Your continued use of FairyWize after such modifications constitutes acceptance
                of the updated Terms.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground mt-16">
          <h2>FairyWize Terms of Service</h2>
          <p>
            These comprehensive terms of service outline the agreement between FairyWize and its users,
            ensuring a clear understanding of rights, responsibilities, and expectations for all parties
            using our AI-powered gift recommendation platform.
          </p>

          <h3>User Agreement</h3>
          <p>
            By accessing FairyWize, you enter into a binding agreement that defines how you may use
            our services. This includes guidelines for appropriate use, content creation, and interaction
            with other users and vendors on our platform.
          </p>

          <h3>Service Availability</h3>
          <p>
            While we strive for consistent service availability, FairyWize operates on a best-effort basis.
            We provide our services "as is" and cannot guarantee uninterrupted access or specific
            performance levels. Planned maintenance and unexpected outages may occur.
          </p>

          <h3>Content and Intellectual Property</h3>
          <p>
            All content on FairyWize, including but not limited to text, graphics, logos, and software,
            is protected by intellectual property laws. Users are granted a limited license to access
            and use the platform for personal, non-commercial purposes.
          </p>

          <h3>Payment and Commercial Terms</h3>
          <p>
            For vendors and commercial users, separate payment terms and commission structures apply.
            All financial transactions are processed securely, and payment obligations must be met
            according to the agreed terms and schedules.
          </p>

          <h3>Dispute Resolution</h3>
          <p>
            In the event of disputes, we encourage amicable resolution through our customer support channels.
            Formal disputes may be resolved through arbitration or the appropriate legal jurisdiction
            as specified in these terms.
          </p>
        </div>
      </div>
    </main>
  )
}
