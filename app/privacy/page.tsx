import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Privacy Policy | FairyWize AI Gift Finder | Data Protection',
  description: 'Learn how FairyWize protects your privacy and personal data. Our comprehensive privacy policy explains how we collect, use, and safeguard your information.',
  keywords: [
    'privacy policy', 'data protection', 'FairyWize privacy',
    'gift finder privacy', 'personal data', 'privacy rights',
    'GDPR compliance', 'data security'
  ],
  openGraph: {
    title: 'Privacy Policy | FairyWize AI Gift Finder | Data Protection',
    description: 'Learn how FairyWize protects your privacy and personal data. Our comprehensive privacy policy explains how we collect, use, and safeguard your information.',
    url: 'https://fairywize.com/privacy',
  },
  twitter: {
    title: 'Privacy Policy | FairyWize AI Gift Finder | Data Protection',
    description: 'Learn how FairyWize protects your privacy and personal data. Our comprehensive privacy policy explains how we collect, use, and safeguard your information.',
  },
}

export default function PrivacyPage() {
  const sections = [
    {
      title: 'Information We Collect',
      content: [
        'Personal information you provide directly (name, email, preferences)',
        'Gift preferences and recommendation data',
        'Usage analytics and interaction patterns',
        'Device and browser information for optimization',
        'Payment information processed securely through third-party providers'
      ]
    },
    {
      title: 'How We Use Your Information',
      content: [
        'Providing personalized gift recommendations',
        'Improving our AI algorithms and user experience',
        'Customer support and communication',
        'Legal compliance and fraud prevention',
        'Analytics to understand usage patterns and improve our service'
      ]
    },
    {
      title: 'Information Sharing',
      content: [
        'We do not sell your personal information to third parties',
        'Limited sharing with service providers for essential functions',
        'Legal requirements may necessitate disclosure',
        'Aggregated, anonymized data for research and improvement'
      ]
    },
    {
      title: 'Data Security',
      content: [
        'Industry-standard encryption for data transmission',
        'Secure servers with regular security audits',
        'Access controls and employee training',
        'Regular security updates and monitoring',
        'Data minimization and retention policies'
      ]
    },
    {
      title: 'Your Rights',
      content: [
        'Access to your personal information',
        'Correction of inaccurate data',
        'Deletion of your account and data',
        'Data portability options',
        'Opt-out of marketing communications'
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
            Privacy Policy
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your privacy is important to us. This policy explains how FairyWize collects,
            uses, and protects your personal information.
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
                FairyWize is committed to protecting your privacy and ensuring transparency
                in how we handle your personal information. This Privacy Policy describes
                our practices regarding the collection, use, and disclosure of information
                when you use our AI-powered gift recommendation platform.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Policy Sections */}
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

        {/* Contact Information */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Contact Us</CardTitle>
              <CardDescription>
                If you have any questions about this Privacy Policy or our data practices,
                please contact us:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> privacy@fairywize.com</p>
                <p><strong>Address:</strong> FairyWize Privacy Team, Digital Privacy Office</p>
                <p><strong>Response Time:</strong> We aim to respond to all privacy inquiries within 30 days.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <div className="max-w-4xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our
                practices or legal requirements. We will notify users of any material changes
                via email or through a prominent notice on our platform.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* SEO Content */}
        <div className="prose prose-lg max-w-4xl mx-auto text-muted-foreground mt-16">
          <h2>FairyWize Privacy Commitment</h2>
          <p>
            At FairyWize, we understand that trust is fundamental to the gift-finding experience.
            Our privacy practices are designed to protect your personal information while providing
            the personalized service you expect from our AI-powered platform.
          </p>

          <h3>Data Collection and Purpose</h3>
          <p>
            We collect only the information necessary to provide our gift recommendation services
            and improve your experience. This includes details about gift preferences, usage patterns,
            and basic account information. All data collection serves the purpose of making better
            recommendations and ensuring a smooth user experience.
          </p>

          <h3>AI and Personalization</h3>
          <p>
            Our AI algorithms use anonymized patterns from many users to improve recommendations.
            Individual user data is never used to train models in a way that could identify specific
            individuals. Your privacy is maintained even as we learn from collective gift-giving patterns.
          </p>

          <h3>Third-Party Services</h3>
          <p>
            We partner with trusted third-party services for payment processing, analytics, and
            customer support. These partners are selected for their strong privacy practices and
            are contractually obligated to protect your data.
          </p>

          <h3>International Data Transfers</h3>
          <p>
            FairyWize operates globally, which may involve transferring data across borders.
            When this occurs, we ensure appropriate safeguards are in place to protect your
            information in accordance with applicable privacy laws.
          </p>

          <h3>Cookies and Tracking</h3>
          <p>
            We use cookies and similar technologies to enhance your experience and analyze
            platform usage. You can control cookie preferences through your browser settings,
            though some features may be limited without certain cookies.
          </p>

          <h3>Children's Privacy</h3>
          <p>
            FairyWize is not intended for children under 13. We do not knowingly collect
            personal information from children under this age. If we become aware of such
            collection, we will take immediate steps to delete the information.
          </p>
        </div>
      </div>
    </main>
  )
}
