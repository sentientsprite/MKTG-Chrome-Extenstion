/**
 * AI Growth Coach Engine
 * Analyzes marketing data and generates actionable insights using OpenAI
 */

const OPENAI_BASE = 'https://api.openai.com/v1';

// ── Issue Detection Rules ────────────────────────────────────────────────────

/**
 * Detect issues across all data sources
 * @param {Object} data - Aggregated data from all APIs
 * @param {Object} [options] - Detection options
 * @param {number} [options.avgOrderValue=100] - Estimated average order/lead value in USD, used to evaluate ad CPA
 * @returns {Array<Issue>} List of detected issues sorted by severity
 */
export function detectIssues(data, options = {}) {
  const issues = [];

  if (data.analytics) {
    issues.push(...detectAnalyticsIssues(data.analytics));
  }
  if (data.searchConsole) {
    issues.push(...detectSearchConsoleIssues(data.searchConsole));
  }
  if (data.ads) {
    issues.push(...detectAdsIssues(data.ads, options));
  }
  if (data.gmb) {
    issues.push(...detectGmbIssues(data.gmb));
  }

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function detectAnalyticsIssues(analytics) {
  const issues = [];
  const { changes, current, previous } = analytics.overview || {};
  if (!changes) return issues;

  // Traffic drop detection
  if (changes.sessions <= -20) {
    issues.push({
      id: 'traffic_drop',
      source: 'analytics',
      severity: changes.sessions <= -40 ? 'critical' : 'warning',
      title: 'Significant Traffic Drop',
      description: `Sessions dropped ${Math.abs(changes.sessions).toFixed(1)}% compared to the previous period (${formatNumber(current?.sessions)} vs ${formatNumber(previous?.sessions)}).`,
      metric: 'sessions',
      change: changes.sessions,
      actions: [
        'Check if there are any technical issues (404 errors, server downtime)',
        'Review recent changes to the website',
        'Check Google Search Console for manual actions or indexing issues',
        'Verify Google Analytics tracking code is still installed correctly',
      ],
    });
  }

  // Bounce rate increase
  if (changes.bounceRate >= 15 && current?.bounceRate > 0.6) {
    issues.push({
      id: 'high_bounce_rate',
      source: 'analytics',
      severity: 'warning',
      title: 'Rising Bounce Rate',
      description: `Bounce rate increased ${changes.bounceRate.toFixed(1)}% to ${(current.bounceRate * 100).toFixed(1)}%. Visitors may not be finding what they need.`,
      metric: 'bounceRate',
      change: changes.bounceRate,
      actions: [
        'Audit your top landing pages for relevance and page speed',
        'Ensure your value proposition is clear above the fold',
        'Check mobile usability — most traffic is now mobile',
        'Review ad targeting to ensure traffic quality is high',
      ],
    });
  }

  // Conversion drop
  if (changes.conversions <= -25 && previous?.conversions > 0) {
    issues.push({
      id: 'conversion_drop',
      source: 'analytics',
      severity: 'critical',
      title: 'Conversion Rate Declined',
      description: `Conversions dropped ${Math.abs(changes.conversions).toFixed(1)}% compared to the previous period.`,
      metric: 'conversions',
      change: changes.conversions,
      actions: [
        'Test your contact forms, phone click tracking, and checkout flows',
        'Review landing page changes made recently',
        'Check for broken CTAs or form errors in browser console',
        'A/B test your call-to-action buttons and messaging',
      ],
    });
  }

  // Session duration drop
  if (changes.avgSessionDuration <= -25 && previous?.avgSessionDuration > 0) {
    issues.push({
      id: 'session_duration_drop',
      source: 'analytics',
      severity: 'info',
      title: 'Reduced Engagement Time',
      description: `Average session duration dropped ${Math.abs(changes.avgSessionDuration).toFixed(1)}%. Users are leaving faster.`,
      metric: 'avgSessionDuration',
      change: changes.avgSessionDuration,
      actions: [
        'Improve content quality and relevance on key pages',
        'Add internal links to keep users exploring your site',
        'Embed videos or interactive content to increase engagement',
      ],
    });
  }

  return issues;
}

function detectSearchConsoleIssues(sc) {
  const issues = [];
  const { changes, current } = sc.summary || {};
  if (!changes) return issues;

  // Click drop
  if (changes.clicks <= -20) {
    issues.push({
      id: 'search_click_drop',
      source: 'searchConsole',
      severity: changes.clicks <= -40 ? 'critical' : 'warning',
      title: 'Organic Search Clicks Dropping',
      description: `Search clicks dropped ${Math.abs(changes.clicks).toFixed(1)}%. Your organic visibility may be declining.`,
      metric: 'clicks',
      change: changes.clicks,
      actions: [
        'Check for lost keyword rankings in Search Console',
        'Review if competitors are outranking you for key terms',
        'Ensure title tags and meta descriptions are compelling',
        'Look for crawl errors or indexing issues',
      ],
    });
  }

  // CTR decline
  if (changes.ctr <= -15 && current?.ctr < 0.03) {
    issues.push({
      id: 'low_ctr',
      source: 'searchConsole',
      severity: 'warning',
      title: 'Low Organic Click-Through Rate',
      description: `CTR is ${(current.ctr * 100).toFixed(2)}% and dropped ${Math.abs(changes.ctr).toFixed(1)}%. Your search snippets may not be compelling enough.`,
      metric: 'ctr',
      change: changes.ctr,
      actions: [
        'Rewrite title tags to be more action-oriented and keyword-rich',
        'Add compelling meta descriptions with a clear call-to-action',
        'Implement structured data (schema) for rich snippets',
        'Test emoji or power words in titles where appropriate',
      ],
    });
  }

  // Position drop
  if (changes.position >= 3 && current?.position > 10) {
    issues.push({
      id: 'rank_drop',
      source: 'searchConsole',
      severity: 'warning',
      title: 'Average Search Position Declining',
      description: `Average ranking position dropped by ${changes.position.toFixed(1)} positions to position ${current.position.toFixed(1)}.`,
      metric: 'position',
      change: changes.position,
      actions: [
        'Update and expand content on pages that lost rankings',
        'Build more quality backlinks to underperforming pages',
        'Improve page speed and Core Web Vitals',
        'Check for duplicate content or cannibalization issues',
      ],
    });
  }

  return issues;
}

function detectAdsIssues(ads, options = {}) {
  const issues = [];
  if (!ads.summary) return issues;

  const { totalSpend, conversions, ctr, costPerConversion, searchImpressionShare } = ads.summary;

  // High cost per conversion — threshold is 3× the configured (or default) average order value
  const avgOrderValue = (options.avgOrderValue && options.avgOrderValue > 0) ? options.avgOrderValue : 100;
  if (costPerConversion > avgOrderValue * 3 && conversions > 0) {
    issues.push({
      id: 'high_cpa',
      source: 'ads',
      severity: 'critical',
      title: 'High Cost Per Conversion',
      description: `Your average cost per conversion is $${costPerConversion.toFixed(2)}, which may be unprofitable.`,
      metric: 'costPerConversion',
      change: null,
      actions: [
        'Pause underperforming keywords and ad groups',
        'Improve landing page conversion rate (add testimonials, clear CTAs)',
        'Use negative keywords to filter out irrelevant searches',
        'Switch to Target CPA or Target ROAS bidding strategy',
      ],
    });
  }

  // Low CTR
  if (ctr < 0.02 && totalSpend > 0) {
    issues.push({
      id: 'low_ad_ctr',
      source: 'ads',
      severity: 'warning',
      title: 'Low Ad Click-Through Rate',
      description: `Your ad CTR is ${(ctr * 100).toFixed(2)}%, which suggests your ads may not be resonating with searchers.`,
      metric: 'ctr',
      change: null,
      actions: [
        'Write more compelling ad copy with a strong unique value proposition',
        'Add ad extensions (callouts, site links, call extensions)',
        'Test different headlines using responsive search ads',
        'Review keyword match types — broad match may be showing irrelevant ads',
      ],
    });
  }

  // Low impression share
  if (searchImpressionShare < 0.4 && totalSpend > 0) {
    issues.push({
      id: 'low_impression_share',
      source: 'ads',
      severity: 'info',
      title: 'Missing Search Impression Share',
      description: `You're only showing for ${(searchImpressionShare * 100).toFixed(0)}% of eligible searches, leaving leads on the table.`,
      metric: 'searchImpressionShare',
      change: null,
      actions: [
        'Increase your daily budget if impression share is lost to budget',
        'Improve Quality Score by improving ad relevance and landing pages',
        'Expand keyword list to capture more relevant searches',
      ],
    });
  }

  return issues;
}

function detectGmbIssues(gmb) {
  const issues = [];

  if (gmb.reviewStats) {
    const { averageRating, unanswered, recentNegative, total } = gmb.reviewStats;

    if (averageRating < 4.0 && total >= 5) {
      issues.push({
        id: 'low_rating',
        source: 'gmb',
        severity: 'critical',
        title: 'Low Google Review Rating',
        description: `Your average rating is ${averageRating.toFixed(1)} stars. This can significantly reduce customer trust and local rankings.`,
        metric: 'averageRating',
        change: null,
        actions: [
          'Respond professionally to every negative review',
          'Create a follow-up process to ask satisfied customers for reviews',
          'Address the specific issues mentioned in negative reviews',
          'Use a QR code or email template to make leaving reviews easy',
        ],
      });
    }

    if (unanswered > 3) {
      issues.push({
        id: 'unanswered_reviews',
        source: 'gmb',
        severity: 'warning',
        title: `${unanswered} Unanswered Reviews`,
        description: `You have ${unanswered} reviews without a response. Responding shows you value customer feedback.`,
        metric: 'unanswered',
        change: null,
        actions: [
          'Respond to all reviews within 48 hours',
          'Thank positive reviewers personally',
          'Address negative reviews with empathy and a resolution offer',
        ],
      });
    }

    if (recentNegative >= 3) {
      issues.push({
        id: 'recent_negative_reviews',
        source: 'gmb',
        severity: 'warning',
        title: 'Recent Negative Reviews Spike',
        description: `${recentNegative} negative reviews (1-2 stars) in the last 30 days — investigate if there's a service issue.`,
        metric: 'recentNegative',
        change: null,
        actions: [
          'Identify common themes in recent negative reviews',
          'Hold a team meeting to address service quality issues',
          'Contact unhappy customers to resolve their experience',
        ],
      });
    }
  }

  // Low impressions
  if (gmb.performance?.totals) {
    const totals = gmb.performance.totals;
    const totalImpressions = (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
      (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
      (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
      (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);

    if (totalImpressions < 100 && totalImpressions > 0) {
      issues.push({
        id: 'low_gmb_visibility',
        source: 'gmb',
        severity: 'info',
        title: 'Low Google Business Profile Visibility',
        description: `Only ${totalImpressions} impressions in the last 28 days. Your local listing may need optimization.`,
        metric: 'impressions',
        change: null,
        actions: [
          'Ensure your business category is accurate and specific',
          'Add high-quality photos regularly (aim for 10+ photos)',
          'Keep business hours updated, especially for holidays',
          'Post Google Business updates weekly to stay active',
          'Add products/services to your listing',
        ],
      });
    }
  }

  return issues;
}

// ── AI Coach ─────────────────────────────────────────────────────────────────

/**
 * Generate AI-powered growth advice using OpenAI
 * @param {Object} context - Business context and data summary
 * @param {string} openAiApiKey - OpenAI API key
 * @param {Array} issues - Detected issues
 */
export async function generateAIAdvice(context, openAiApiKey, issues = []) {
  const systemPrompt = `You are an expert AI Growth Coach for small and local businesses. 
You analyze marketing data and provide specific, actionable advice in plain language.
Be direct, practical, and encouraging. Focus on highest-impact actions first.
Always tailor advice to small/local business constraints (limited budget, limited time).
Keep your response concise and structured with clear action items.`;

  const issuesSummary = issues.slice(0, 5).map(i =>
    `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`
  ).join('\n');

  const dataSummary = buildDataSummary(context);

  const userPrompt = `Business: ${context.businessName || 'Small local business'}
Industry: ${context.industry || 'General'}
Location: ${context.location || 'Local'}

Current Performance Data:
${dataSummary}

Detected Issues:
${issuesSummary || 'No major issues detected'}

Based on this data, provide:
1. A brief diagnosis (2-3 sentences) of the business's current marketing health
2. Top 3 highest-impact actions they should take THIS WEEK
3. One quick win they can implement today (under 30 minutes)
4. A motivating close

Format with clear headers and bullet points.`;

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Unable to generate advice at this time.';
}

/**
 * Answer a specific question from the user about their marketing data
 */
export async function askCoach(question, context, openAiApiKey) {
  const dataSummary = buildDataSummary(context);

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert AI Growth Coach for small and local businesses. 
Answer questions about marketing data concisely and practically.
Current business data:
${dataSummary}`,
        },
        { role: 'user', content: question },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'I could not process your question.';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDataSummary(context) {
  const parts = [];

  if (context.analytics?.overview?.current) {
    const c = context.analytics.overview.current;
    const ch = context.analytics.overview.changes;
    parts.push(`Analytics (last 30 days):
  - Sessions: ${formatNumber(c.sessions)} (${formatChange(ch?.sessions)}%)
  - Users: ${formatNumber(c.users)} (${formatChange(ch?.users)}%)
  - Bounce Rate: ${(c.bounceRate * 100).toFixed(1)}% (${formatChange(ch?.bounceRate)}%)
  - Conversions: ${formatNumber(c.conversions)} (${formatChange(ch?.conversions)}%)`);
  }

  if (context.searchConsole?.summary?.current) {
    const c = context.searchConsole.summary.current;
    const ch = context.searchConsole.summary.changes;
    parts.push(`Search Console (last 28 days):
  - Clicks: ${formatNumber(c.clicks)} (${formatChange(ch?.clicks)}%)
  - Impressions: ${formatNumber(c.impressions)} (${formatChange(ch?.impressions)}%)
  - CTR: ${(c.ctr * 100).toFixed(2)}% (${formatChange(ch?.ctr)}%)
  - Avg Position: ${c.position?.toFixed(1)} (${formatChange(ch?.position)}%)`);
  }

  if (context.ads?.summary) {
    const s = context.ads.summary;
    parts.push(`Google Ads (last 30 days):
  - Total Spend: $${s.totalSpend?.toFixed(2)}
  - Clicks: ${formatNumber(s.clicks)}
  - CTR: ${(s.ctr * 100).toFixed(2)}%
  - Conversions: ${s.conversions}
  - Cost/Conversion: $${s.costPerConversion?.toFixed(2)}`);
  }

  if (context.gmb?.reviewStats) {
    const r = context.gmb.reviewStats;
    parts.push(`Google Business Profile:
  - Average Rating: ${r.averageRating?.toFixed(1)} stars
  - Total Reviews: ${r.total}
  - Unanswered Reviews: ${r.unanswered}`);
  }

  return parts.join('\n\n') || 'No data available yet.';
}

function formatNumber(n) {
  if (!n && n !== 0) return 'N/A';
  return Math.round(n).toLocaleString();
}

function formatChange(n) {
  if (!n && n !== 0) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}
