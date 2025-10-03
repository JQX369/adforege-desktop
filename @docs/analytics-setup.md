# FairyWize Analytics Setup & SEO Monitoring

## Google Analytics 4 Setup

### Environment Variables Required
Add these to your `.env.local`:
```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
GOOGLE_VERIFICATION_TOKEN=your-google-verification-token
BING_VERIFICATION_TOKEN=your-bing-verification-token
```

### Google Search Console Setup
1. **Verify Ownership**: Add Google verification token to layout.tsx
2. **Submit Sitemap**: Submit `https://fairywize.com/api/sitemap` to Google Search Console
3. **Monitor Core Web Vitals**: Set up monitoring for LCP, FID, and CLS metrics
4. **Track Keywords**: Monitor which keywords drive organic traffic

## Key SEO Metrics to Track

### Traffic Metrics
- **Organic Sessions**: Total organic search traffic
- **Organic Pageviews**: Pages visited from search engines
- **Bounce Rate**: Percentage of single-page sessions
- **Session Duration**: Average time spent on site

### Keyword Performance
- **Top Performing Keywords**: Track rankings for target keywords
- **New Keywords**: Monitor new keywords bringing traffic
- **Seasonal Trends**: Track holiday and seasonal keyword performance
- **Long-tail Keywords**: Monitor conversion rates for specific queries

### Content Performance
- **Gift Guide Engagement**: Track views and conversions for gift guides
- **Form Completion Rate**: Track how many users complete the gift finder form
- **Swipe Activity**: Monitor product swipes and saves
- **Vendor Signups**: Track conversions from vendor page

### Technical SEO Metrics
- **Core Web Vitals**: LCP, FID, CLS scores
- **Page Load Speed**: Monitor loading times
- **Crawl Errors**: Track 404s and server errors
- **Index Coverage**: Monitor pages indexed vs submitted

## Custom Events to Track

### User Journey Events
```javascript
// Gift form interactions
gtag('event', 'gift_form_started', {
  form_step: 'recipient_relationship'
});

gtag('event', 'gift_form_completed', {
  form_data: {
    relationship: 'friend',
    occasion: 'birthday',
    budget: 'under_50'
  }
});

// Product interactions
gtag('event', 'product_swiped', {
  product_id: 'abc123',
  action: 'liked',
  category: 'tech_gifts'
});

gtag('event', 'product_saved', {
  product_id: 'abc123',
  category: 'personalized_gifts'
});

// Gift guide interactions
gtag('event', 'gift_guide_viewed', {
  guide_type: 'holiday_gifts',
  category: 'seasonal'
});

// Vendor interactions
gtag('event', 'vendor_signup_started', {
  plan_selected: 'basic'
});
```

## SEO Monitoring Dashboard

### Weekly Checks
1. **Keyword Rankings**: Monitor target keyword positions
2. **Organic Traffic**: Compare week-over-week organic sessions
3. **Core Web Vitals**: Check if scores are in "Good" range
4. **Crawl Errors**: Address any new 404s or server errors
5. **Backlink Profile**: Monitor new backlinks acquired

### Monthly Reports
1. **Content Performance**: Analyze which gift guides perform best
2. **Seasonal Trends**: Track holiday shopping patterns
3. **Conversion Funnel**: Monitor form completion to purchase flow
4. **Competitor Analysis**: Compare rankings with competitors
5. **Local SEO**: Track local search visibility

## SEO Tools Integration

### Recommended Tools
1. **Google Analytics 4**: Primary analytics platform
2. **Google Search Console**: Search performance and technical issues
3. **SEMrush/Ahrefs**: Keyword research and competitor analysis
4. **PageSpeed Insights**: Core Web Vitals monitoring
5. **Screaming Frog**: Technical SEO audits

### Automated Monitoring
Set up alerts for:
- Significant ranking drops for target keywords
- Core Web Vitals score degradation
- Unusual traffic spikes or drops
- New crawl errors or indexing issues

## Content Performance Tracking

### Gift Guide Analytics
- Track which gift guides get the most traffic
- Monitor bounce rates for different guide types
- Track conversion rates (form completions) by guide
- Monitor seasonal performance patterns

### Local SEO Tracking
- Track "gifts near me" search performance
- Monitor local business page engagement
- Track local keyword rankings by region
- Monitor local competitor visibility

## Conversion Tracking

### Primary Conversions
1. **Gift Form Completions**: Users who complete the 12-question form
2. **Product Saves**: Users who save products for later
3. **Vendor Signups**: New vendors joining the platform
4. **Affiliate Clicks**: Clicks on affiliate product links

### Secondary Conversions
1. **Gift Guide Views**: Engagement with content pages
2. **Email Signups**: Newsletter or update subscriptions
3. **Social Shares**: Content shared on social media
4. **Return Visits**: Users coming back to the site

## A/B Testing for SEO

### Tests to Run
1. **Meta Title Variations**: Test different title formats
2. **Gift Guide Structures**: Different layouts and content organization
3. **Call-to-Action Buttons**: Different wording and placement
4. **Local SEO Elements**: Different approaches to local content

### Testing Framework
- Use Google Optimize for A/B testing
- Test one element at a time
- Run tests for at least 2 weeks
- Ensure statistical significance before implementing

## SEO Success Metrics

### Short-term (1-3 months)
- Achieve Google Analytics 4 setup and verification
- Index all important pages in Google
- Start ranking for long-tail keywords
- Achieve "Good" Core Web Vitals scores

### Medium-term (3-6 months)
- Rank on page 1 for 5+ target keywords
- Achieve 1,000+ monthly organic sessions
- 20%+ conversion rate from organic traffic
- Establish local SEO presence in target markets

### Long-term (6-12 months)
- Rank in top 3 for primary keywords
- 10,000+ monthly organic sessions
- Establish authority in gift recommendation space
- Achieve consistent seasonal traffic growth

## Maintenance Schedule

### Daily
- Check for crawl errors in Google Search Console
- Monitor Core Web Vitals scores
- Review organic traffic patterns

### Weekly
- Analyze keyword ranking changes
- Review content engagement metrics
- Monitor backlink acquisition

### Monthly
- Comprehensive SEO audit
- Competitor analysis update
- Content strategy review and planning

### Quarterly
- Technical SEO audit
- Content performance review
- Strategy adjustment based on data
