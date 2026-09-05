import { type Range } from '@/lib/analytics';
import { finite, resultSet } from '@/lib/reporting';
import { type ReportingContext } from './report-google';
import { graphGet } from './report-meta';
import { requestJSON } from './providers';

export async function importAdvertising(
  context: ReportingContext,
  source: string,
  range: Range,
) {
  const result = resultSet(),
    rows: Record<string, string | number | null>[] = [];
  let currency = '';
  let truncated = false;
  if (source === 'meta-ads') {
    const id = context.externalId.startsWith('act_')
      ? context.externalId
      : 'act_' + context.externalId;
    const account = await graphGet(
      context,
      encodeURIComponent(id) + '?fields=id,name,currency',
    );
    currency = account.currency || '';
    result.profile = { label: account.name, currency };
    let after = '';
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams({
        fields:
          'date_start,date_stop,campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values',
        level: 'campaign',
        time_increment: '1',
        time_range: JSON.stringify({ since: range.start, until: range.end }),
        limit: '500',
        ...(after ? { after } : {}),
      });
      const r = await graphGet(
        context,
        encodeURIComponent(id) + '/insights?' + q,
      );
      for (const v of r.data || []) {
        const row: Record<string, string | number | null> = {
          date: v.date_start,
          campaignId: v.campaign_id,
          campaign: v.campaign_name,
          spend: finite(v.spend),
          currency,
          impressions: finite(v.impressions),
          reach: finite(v.reach),
          clicks: finite(v.clicks),
          linkClicks: finite(v.inline_link_clicks),
        };
        for (const action of v.actions || [])
          row['action:' + action.action_type] = finite(action.value);
        for (const value of v.action_values || [])
          row['value:' + value.action_type] = finite(value.value);
        rows.push(row);
      }
      after = r.paging?.cursors?.after || '';
      if (!r.paging?.next || !after) break;
      if (page === 19) truncated = true;
    }
  } else if (source === 'google-ads') {
    if (!context.developerToken || !/^v\d+$/.test(context.apiVersion || ''))
      throw new Error(
        'INPUT:Google Ads requires an approved developer token and supported API version, such as v25.',
      );
    const id = context.externalId.replaceAll('-', '');
    if (!/^\d+$/.test(id))
      throw new Error('INPUT:Enter the numeric Google Ads customer ID.');
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + context.accessToken,
      'Content-Type': 'application/json',
      'developer-token': context.developerToken,
    };
    if (context.loginCustomerId)
      headers['login-customer-id'] = context.loginCustomerId.replaceAll(
        '-',
        '',
      );
    let pageToken = '';
    for (let page = 0; page < 20; page++) {
      const r = await requestJSON(
        'https://googleads.googleapis.com/' +
          context.apiVersion +
          '/customers/' +
          id +
          '/googleAds:search',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query:
              "SELECT segments.date, customer.currency_code, campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '" +
              range.start +
              "' AND '" +
              range.end +
              "'",
            ...(pageToken ? { pageToken } : {}),
          }),
        },
      );
      for (const v of r.results || [])
        rows.push({
          date: v.segments?.date,
          campaignId: v.campaign?.id,
          campaign: v.campaign?.name,
          currency: v.customer?.currencyCode || '',
          impressions: finite(v.metrics?.impressions),
          clicks: finite(v.metrics?.clicks),
          spend:
            finite(v.metrics?.costMicros) === null
              ? null
              : Number(v.metrics.costMicros) / 1000000,
          conversions: finite(v.metrics?.conversions),
          conversionValue: finite(v.metrics?.conversionsValue),
        });
      pageToken = r.nextPageToken || '';
      if (!pageToken) break;
      if (page === 19) truncated = true;
    }
  } else {
    for (let page = 1; page <= 20; page++) {
      const q = new URLSearchParams({
        advertiser_id: context.externalId,
        report_type: 'BASIC',
        data_level: 'AUCTION_CAMPAIGN',
        dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
        metrics: JSON.stringify([
          'campaign_name',
          'spend',
          'impressions',
          'clicks',
          'conversion',
        ]),
        start_date: range.start,
        end_date: range.end,
        page: String(page),
        page_size: '1000',
      });
      const r = await requestJSON(
        'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?' +
          q,
        { headers: { 'Access-Token': context.accessToken } },
      );
      if (r.code !== 0)
        throw new Error(
          'INPUT:TikTok Ads reporting was rejected. Check Marketing API approval, advertiser access and the access token.',
        );
      for (const v of r.data?.list || [])
        rows.push({
          date: String(v.dimensions?.stat_time_day || '').slice(0, 10),
          campaignId: v.dimensions?.campaign_id,
          campaign: v.metrics?.campaign_name || v.dimensions?.campaign_id,
          spend: finite(v.metrics?.spend),
          currency: 'Advertiser currency',
          impressions: finite(v.metrics?.impressions),
          clicks: finite(v.metrics?.clicks),
          conversions: finite(v.metrics?.conversion),
        });
      if (page >= Number(r.data?.page_info?.total_page || 1)) break;
      if (page === 20) truncated = true;
    }
  }
  result.tables.push({
    key: 'advertising-campaigns',
    title:
      source === 'meta-ads'
        ? 'Meta Ads campaigns'
        : source === 'google-ads'
          ? 'Google Ads campaigns'
          : 'TikTok Ads campaigns',
    source,
    columns: [...new Set(rows.flatMap((r) => Object.keys(r)))],
    rows,
    period: range,
    truncated,
    scope:
      'Daily campaign results in the advertiser reporting timezone and account currency. Platform attribution applies. Reach is not deduplicated across dates or campaigns; currencies are never added together.',
  });
  result.checks.push({
    key: 'advertising',
    label: 'Advertising campaign report',
    status: rows.length ? 'imported' : 'empty',
    records: rows.length,
    detail: truncated
      ? 'Row limit reached; import a narrower date window.'
      : 'Real campaign metrics returned by the advertising API. No rows can mean no delivery in this period.',
  });
  result.scope =
    'Advertising data stays separate from organic social metrics to avoid double counting.';
  return result;
}
