/**
 * Realistic demo data for store screenshots and local preview.
 * No API credentials or network calls required.
 */

export const DEMO_USER = {
  email: 'owner@mainstreetbakery.com',
  name: 'Main Street Bakery',
};

export const DEMO_SETTINGS = {
  businessName: 'Main Street Bakery',
  industry: 'restaurant',
  location: 'Austin, TX',
  avgOrderValue: '45',
  ga4PropertyId: '123456789',
  searchConsoleSite: 'https://mainstreetbakery.com/',
  adsCustomerId: '123-456-7890',
  gmbLocationName: 'accounts/123/locations/456',
  openAiApiKey: 'demo-mode',
  demoMode: true,
};

export const DEMO_DATA = {
  analytics: {
    overview: {
      current: {
        sessions: 8420,
        users: 6310,
        bounceRate: 0.58,
        conversions: 186,
      },
      previous: {
        sessions: 11240,
        users: 8890,
        bounceRate: 0.49,
        conversions: 248,
      },
      changes: {
        sessions: -25.1,
        users: -29.0,
        bounceRate: 18.4,
        conversions: -25.0,
      },
    },
    channels: [
      { channel: 'Organic Search', sessions: 3120 },
      { channel: 'Direct', sessions: 2180 },
      { channel: 'Paid Search', sessions: 1540 },
      { channel: 'Social', sessions: 890 },
      { channel: 'Referral', sessions: 420 },
      { channel: 'Email', sessions: 270 },
    ],
  },
  searchConsole: {
    summary: {
      current: {
        clicks: 2840,
        impressions: 48200,
        ctr: 0.0589,
        position: 12.4,
      },
      previous: {
        clicks: 3620,
        impressions: 52100,
        ctr: 0.0695,
        position: 9.8,
      },
      changes: {
        clicks: -21.5,
        impressions: -7.5,
        ctr: -15.3,
        position: 26.5,
      },
    },
    queries: [
      { keys: ['bakery near me'], clicks: 420, position: 4.2 },
      { keys: ['custom wedding cakes austin'], clicks: 310, position: 6.1 },
      { keys: ['best sourdough austin'], clicks: 285, position: 8.3 },
      { keys: ['birthday cake delivery'], clicks: 198, position: 11.5 },
      { keys: ['gluten free bakery'], clicks: 176, position: 14.2 },
      { keys: ['coffee shop downtown austin'], clicks: 142, position: 18.7 },
      { keys: ['artisan bread austin'], clicks: 118, position: 9.4 },
      { keys: ['pastry catering'], clicks: 95, position: 22.1 },
    ],
  },
  ads: {
    summary: {
      totalSpend: 1842.5,
      clicks: 1240,
      ctr: 0.0342,
      conversions: 42,
      costPerConversion: 43.87,
    },
  },
  gmb: {
    reviewStats: {
      averageRating: 3.7,
      total: 128,
      unanswered: 5,
    },
    performance: {
      totals: {
        WEBSITE_CLICKS: 340,
        BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 420,
        BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 890,
      },
    },
  },
};

export const DEMO_ISSUES = [
  {
    id: 'traffic_drop',
    source: 'analytics',
    severity: 'critical',
    title: 'Significant Traffic Drop',
    description:
      'Sessions dropped 25.1% compared to the previous period (8,420 vs 11,240).',
    actions: [
      'Check if there are any technical issues (404 errors, server downtime)',
      'Review recent changes to the website',
      'Check Google Search Console for manual actions or indexing issues',
    ],
  },
  {
    id: 'conversion_drop',
    source: 'analytics',
    severity: 'critical',
    title: 'Conversion Rate Declined',
    description: 'Conversions dropped 25.0% compared to the previous period.',
    actions: [
      'Test your contact forms, phone click tracking, and checkout flows',
      'Review landing page changes made recently',
      'Check for broken CTAs or form errors in browser console',
    ],
  },
  {
    id: 'organic_click_drop',
    source: 'searchConsole',
    severity: 'warning',
    title: 'Organic Search Clicks Declining',
    description:
      'Search clicks dropped 21.5% to 2,840. Your organic visibility may be slipping.',
    actions: [
      'Review pages that lost the most traffic in Search Console',
      'Update thin or outdated content on top landing pages',
      'Check for new competitors ranking above you for key terms',
    ],
  },
  {
    id: 'low_review_rating',
    source: 'gmb',
    severity: 'critical',
    title: 'Below-Average Review Rating',
    description:
      'Your Google rating is 3.7 stars. Most customers expect 4.0+ before choosing a local business.',
    actions: [
      'Respond professionally to all recent negative reviews',
      'Ask satisfied customers to leave reviews after positive experiences',
      'Address recurring complaints mentioned in reviews',
    ],
  },
  {
    id: 'high_cpa',
    source: 'ads',
    severity: 'warning',
    title: 'High Cost Per Conversion',
    description:
      'Your cost per conversion ($43.87) is close to your estimated order value ($45). Ads may not be profitable.',
    actions: [
      'Pause underperforming keywords and ad groups',
      'Add negative keywords to filter low-intent traffic',
      'Test new ad copy focused on your best-selling items',
    ],
  },
];

export const DEMO_AI_ADVICE = `## Marketing Health Diagnosis

Main Street Bakery is facing a meaningful traffic and conversion decline across both organic search and paid channels. Your local reputation (3.7★) is also below the threshold most diners use when choosing where to eat. The good news: these are fixable with focused effort this week.

## Top 3 Actions This Week

1. **Fix your top landing pages** — Sessions are down 25%. Audit your 5 highest-traffic pages for broken links, slow load times, and outdated menus or hours.
2. **Respond to every unanswered review** — You have 5 pending replies. A thoughtful response to a 3-star review often converts skeptics into regulars.
3. **Pause low-performing ad keywords** — At $43.87/conversion vs a $45 order value, you're barely breaking even. Cut keywords with CPA above $35.

## Quick Win Today (Under 30 Minutes)

Post a Google Business Profile update with a photo of today's fresh pastries and your weekend hours. Businesses that post weekly see measurably more map impressions.

## You've Got This

Small dips happen — what matters is catching them early. You're already ahead of most local businesses just by monitoring these numbers. Focus on reviews and your top 3 landing pages first.`;

export const DEMO_ASK_RESPONSE =
  'Your traffic drop is primarily driven by organic search — clicks fell 21.5% while paid traffic held steadier. The biggest culprit is likely ranking slips on high-intent terms like "bakery near me" and "custom wedding cakes austin." Start by checking Search Console → Performance → Pages to see which URLs lost the most clicks, then refresh those pages with updated photos, current menu items, and local keywords in titles and headings.';
