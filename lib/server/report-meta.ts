import { type Daily, type Range } from '@/lib/analytics';
import {
  collect,
  dateList,
  emptyDaily,
  finite,
  importedPost,
  putMetric,
  putPost,
  resultSet,
  safeMedia,
  type ImportResult,
} from '@/lib/reporting';
import { requestJSON } from './providers';
import { type ReportingContext } from './report-google';

function apiIssue(body: any) {
  const e = body?.error;
  return e?.code === 190
    ? 'Authorization expired. Sign in with Meta again.'
    : [10, 200, 294].includes(e?.code)
      ? 'Meta has not granted permission for this report. Update the login configuration, approve access and reconnect.'
      : e?.code === 100
        ? 'This metric or field is not supported for this account, content type or Graph API version.'
        : e?.is_transient || [4, 17, 32, 613].includes(e?.code)
          ? 'Meta temporarily limited this request. Refresh again later.'
          : 'Meta did not return this report. Check the account permissions and Graph API version.';
}
export async function graphGet(context: ReportingContext, path: string) {
  if (!/^v\d{1,2}\.\d{1,2}$/.test(context.apiVersion || ''))
    throw new Error(
      'INPUT:Enter the Graph API version shown in your Meta app.',
    );
  return requestJSON(
    'https://graph.facebook.com/' + context.apiVersion + '/' + path,
    { headers: { Authorization: 'Bearer ' + context.accessToken } },
  );
}
export async function graphBatch(context: ReportingContext, paths: string[]) {
  const results: { body?: any; error?: string }[] = [];
  for (let i = 0; i < paths.length; i += 40) {
    const chunk = paths.slice(i, i + 40);
    try {
      const r = await requestJSON(
        'https://graph.facebook.com/' + context.apiVersion + '/',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + context.accessToken,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            batch: JSON.stringify(
              chunk.map((relative_url) => ({ method: 'GET', relative_url })),
            ),
          }),
        },
      );
      for (let n = 0; n < chunk.length; n++) {
        const item = Array.isArray(r) ? r[n] : null;
        let body: any;
        try {
          body = item ? JSON.parse(item.body) : {};
        } catch {
          body = {};
        }
        results.push(
          item?.code >= 200 && item.code < 300 && !body.error
            ? { body }
            : { error: apiIssue(body) },
        );
      }
    } catch (e) {
      results.push(
        ...chunk.map(() => ({
          error:
            e instanceof Error && e.message.startsWith('INPUT:')
              ? e.message.slice(6)
              : 'Meta request failed. Refresh again later.',
        })),
      );
    }
  }
  return results;
}
const query = (params: Record<string, string>) =>
  new URLSearchParams(params).toString();
function scalar(item: any) {
  return finite(item?.total_value?.value ?? item?.values?.[0]?.value);
}
async function mediaList(
  context: ReportingContext,
  source: string,
  range: Range,
  result: ImportResult,
) {
  const instagram = source === 'instagram',
    items: any[] = [];
  const fields = instagram
    ? 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'
    : 'id,message,created_time,full_picture,permalink_url,shares';
  let after = '';
  for (let page = 0; page < 20; page++) {
    const r = await graphGet(
      context,
      encodeURIComponent(context.externalId) +
        (instagram ? '/media?' : '/published_posts?') +
        query({
          fields,
          limit: '50',
          ...(after ? { after } : {}),
          ...(!instagram
            ? {
                since: range.start,
                until: new Date(Date.parse(range.end) + 86400000)
                  .toISOString()
                  .slice(0, 10),
              }
            : {}),
        }),
    );
    for (const item of r.data || []) {
      const date = String(item.timestamp || item.created_time || '').slice(
        0,
        10,
      );
      if (date >= range.start && date <= range.end) items.push(item);
    }
    after = r.paging?.cursors?.after || '';
    if (
      !r.paging?.next ||
      !after ||
      (instagram &&
        r.data?.length &&
        String(r.data.at(-1).timestamp).slice(0, 10) < range.start)
    )
      break;
    if (page === 19)
      result.checks.push({
        key: 'content-limit',
        label: 'Older content',
        status: 'unavailable',
        records: 0,
        detail:
          'The first 1,000 accessible posts were scanned. Import an older date window or a platform export for additional history.',
      });
  }
  return items;
}
export async function importMeta(
  context: ReportingContext,
  source: 'instagram' | 'facebook',
  range: Range,
) {
  const result = resultSet(),
    instagram = source === 'instagram',
    channel = instagram ? 'Instagram' : 'Facebook';
  const profile = await graphGet(
    context,
    encodeURIComponent(context.externalId) +
      '?fields=' +
      (instagram
        ? 'id,username,followers_count,media_count'
        : 'id,name,followers_count'),
  );
  if (String(profile.id) !== context.externalId)
    throw new Error('INPUT:This token does not match the selected account.');
  result.profile = {
    followers: finite(profile.followers_count),
    ...(instagram ? { posts: finite(profile.media_count) } : {}),
  };
  result.checks.push({
    key: 'profile',
    label: 'Current account statistics',
    status: 'imported',
    records: 1,
    detail:
      'Follower count is observed now; it is not backdated into historical charts.',
  });
  const map = new Map<string, Daily>();
  const current = emptyDaily(new Date().toISOString().slice(0, 10), channel);
  putMetric(current, 'followers', profile.followers_count);
  current.sourceMetrics = { followersObservedAt: new Date().toISOString() };
  map.set(current.date, current);
  if (instagram) {
    const specs = [
      ['views', 'views'],
      ['reach', 'reach'],
      ['total_interactions', 'engagements'],
      ['profile_views', 'profileViews'],
      ['profile_links_taps', 'clicks'],
    ] as const;
    const jobs = dateList(range).flatMap((date) =>
      specs.map(([metric, field]) => ({ date, metric, field })),
    );
    const replies = await graphBatch(
      context,
      jobs.map(
        (j) =>
          encodeURIComponent(context.externalId) +
          '/insights?' +
          query({
            metric: j.metric,
            period: 'day',
            metric_type: 'total_value',
            since: String(Math.floor(Date.parse(j.date + 'T00:00:00Z') / 1000)),
            until: String(
              Math.floor(Date.parse(j.date + 'T00:00:00Z') / 1000) + 86400,
            ),
          }),
      ),
    );
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i],
        item = replies[i],
        insight = item.body?.data?.find((v: any) => v.name === j.metric),
        value = scalar(insight);
      if (value !== null) {
        const d = map.get(j.date) || emptyDaily(j.date, channel);
        putMetric(d, j.field, value);
        d.sourceMetrics = {
          ...d.sourceMetrics,
          [j.metric]: value,
          timezone: 'UTC request boundaries',
          engagementDefinition:
            'Instagram total_interactions, as returned by Meta',
        };
        map.set(d.date, d);
      }
    }
    for (const [metric, field] of specs) {
      const positions = jobs
          .map((j, i) => ({ j, i }))
          .filter((v) => v.j.metric === metric),
        available = positions.filter(
          (v) =>
            scalar(
              replies[v.i].body?.data?.find((d: any) => d.name === metric),
            ) !== null,
        ),
        failure = positions.find((v) => replies[v.i].error);
      result.checks.push({
        key: metric,
        label: 'Daily Instagram ' + field,
        status: available.length
          ? 'imported'
          : failure
            ? 'unavailable'
            : 'empty',
        records: available.length,
        detail:
          available.length +
          ' of ' +
          dateList(range).length +
          ' dates returned.' +
          (failure
            ? ' ' + replies[failure.i].error
            : ' Empty dates stay unavailable.'),
      });
    }
    for (const breakdown of ['country', 'city', 'age', 'gender']) {
      const raw: any = await collect(
        result,
        'audience-' + breakdown,
        'Instagram audience by ' + breakdown,
        () =>
          graphGet(
            context,
            encodeURIComponent(context.externalId) +
              '/insights?' +
              query({
                metric: 'follower_demographics',
                period: 'lifetime',
                metric_type: 'total_value',
                timeframe: 'last_30_days',
                breakdown,
              }),
          ),
        (r) => r.data?.[0]?.total_value?.breakdowns?.[0]?.results?.length || 0,
      );
      const values =
        raw?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
      if (values.length)
        result.tables.push({
          key: 'audience-' + breakdown,
          title: 'Instagram followers by ' + breakdown,
          source,
          columns: [breakdown, 'followers'],
          rows: values.map((r: any) => ({
            [breakdown]: (r.dimension_values || []).join(' · '),
            followers: finite(r.value),
          })),
          period: range,
          scope:
            'Current provider demographic snapshot for the last 30 days. Privacy thresholds apply; not a historical daily series.',
        });
    }
  } else {
    // Views and unique media viewers retain their distinct definitions. Never relabel viewers as legacy reach.
    const specs = [
      ['page_media_view', 'views'],
      ['page_total_media_view_unique', 'mediaViewers'],
      ['page_post_engagements', 'engagements'],
      ['page_views_total', 'profileViews'],
      ['page_daily_follows', 'follows'],
      ['page_daily_unfollows', 'unfollows'],
    ] as const;
    const paths = specs.map(
      ([metric]) =>
        encodeURIComponent(context.externalId) +
        '/insights?' +
        query({
          metric,
          period: 'day',
          since: range.start,
          until: new Date(Date.parse(range.end) + 86400000)
            .toISOString()
            .slice(0, 10),
        }),
    );
    const replies = await graphBatch(context, paths);
    for (let i = 0; i < specs.length; i++) {
      const [metric, field] = specs[i],
        r = replies[i];
      let count = 0;
      for (const v of r.body?.data?.[0]?.values || []) {
        // Insights end_time is the exclusive provider-day boundary, often Pacific time.
        const endDate = String(v.end_time || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;
        const date = new Date(Date.parse(endDate + 'T00:00:00Z') - 86400000)
          .toISOString()
          .slice(0, 10);
        if (date < range.start || date > range.end || finite(v.value) === null)
          continue;
        const d = map.get(date) || emptyDaily(date, channel);
        putMetric(d, field, v.value);
        d.sourceMetrics = {
          ...d.sourceMetrics,
          [metric]: v.value,
          periodEnd: v.end_time,
        };
        map.set(date, d);
        count++;
      }
      result.checks.push({
        key: metric,
        label: 'Facebook ' + field,
        status: count ? 'imported' : r.error ? 'unavailable' : 'empty',
        records: count,
        detail:
          r.error ||
          'Provider-day observations. Missing dates remain unavailable.',
      });
    }
    result.checks.push({
      key: 'reach',
      label: 'Facebook legacy reach',
      status: 'unavailable',
      records: 0,
      detail:
        'Legacy reach is not substituted with views. Current unique media viewers appear separately where Meta returns them; a reach export can be imported with its original definition.',
    });
    for (const metric of ['page_follows_country', 'page_follows_city']) {
      const r: any = await collect(
        result,
        metric,
        'Facebook audience geography',
        () =>
          graphGet(
            context,
            encodeURIComponent(context.externalId) +
              '/insights?' +
              query({
                metric,
                period: 'day',
                since: range.end,
                until: new Date(Date.parse(range.end) + 86400000)
                  .toISOString()
                  .slice(0, 10),
              }),
          ),
        (r) => Object.keys(r.data?.[0]?.values?.[0]?.value || {}).length,
      );
      const value = r?.data?.[0]?.values?.at(-1)?.value;
      if (value && typeof value === 'object')
        result.tables.push({
          key: 'audience-' + metric,
          title: metric.endsWith('city')
            ? 'Facebook followers by city'
            : 'Facebook followers by country',
          source,
          columns: ['location', 'followers'],
          rows: Object.entries(value).map(([location, followers]) => ({
            location,
            followers: finite(followers),
          })),
          period: range,
          scope:
            'Provider audience snapshot. Privacy and version availability apply.',
        });
    }
  }
  const media = await collect(
    result,
    'content',
    'Published content',
    () => mediaList(context, source, range, result),
    (r) => r.length,
  );
  // Optional user-content permissions must not prevent importing the Page's posts.
  if (!instagram && media?.length) {
    const counts = await graphBatch(
      context,
      media.map((m: any) => encodeURIComponent(m.id) + '?' + query({
        fields: 'reactions.limit(0).summary(true),comments.limit(0).summary(true)',
      })),
    );
    let returned = 0;
    for (let i = 0; i < media.length; i++) {
      const body = counts[i].body;
      if (body) {
        media[i].reactions = body.reactions;
        media[i].comments = body.comments;
        if (finite(body.reactions?.summary?.total_count) !== null) returned++;
        if (finite(body.comments?.summary?.total_count) !== null) returned++;
      }
    }
    const failure = counts.find((c) => c.error);
    result.checks.push({
      key: 'post-interactions',
      label: 'Facebook reactions and comments',
      status: returned ? 'imported' : failure ? 'unavailable' : 'empty',
      records: returned,
      detail: returned + ' lifetime interaction totals returned.' + (failure
        ? ' Check pages_read_user_content in the login configuration and reconnect. ' + failure.error
        : ''),
    });
  }
  const posts = (media || []).map((m: any) => {
    const p = importedPost(
      channel,
      m.id,
      m.timestamp || m.created_time,
      m.caption || m.message || 'Published content',
    );
    p.image = safeMedia(m.thumbnail_url || m.media_url || m.full_picture);
    p.permalink = safeMedia(m.permalink || m.permalink_url);
    p.format = instagram
      ? m.media_product_type === 'REELS'
        ? 'Reel'
        : m.media_type === 'CAROUSEL_ALBUM'
          ? 'Carousel'
          : m.media_type === 'VIDEO'
            ? 'Video'
            : 'Static'
      : 'Post';
    putPost(
      p,
      'likes',
      instagram ? m.like_count : m.reactions?.summary?.total_count,
    );
    putPost(
      p,
      'comments',
      instagram ? m.comments_count : m.comments?.summary?.total_count,
    );
    if (!instagram) putPost(p, 'shares', m.shares?.count);
    p.sourceMetrics = {
      likesDefinition: instagram ? 'Instagram likes' : 'Facebook reactions',
      metricScope: 'lifetime',
      publishedAt: p.publishedAt,
    };
    return p;
  });
  const metricSpecs = instagram
    ? [
        ['views', 'views'],
        ['reach', 'reach'],
        ['saved', 'saves'],
        ['shares', 'shares'],
        ['follows', 'followers'],
        ['profile_visits', 'profileVisits'],
        ['ig_reels_avg_watch_time', 'averageWatchTimeMs'],
        ['ig_reels_video_view_total_time', 'watchTimeMs'],
      ]
    : [
        ['post_media_view', 'views'],
        ['post_total_media_view_unique', 'mediaViewers'],
        ['post_clicks', 'clicks'],
      ];
  const jobs = posts.flatMap((p, i) =>
    metricSpecs.map(([metric, field]) => ({
      i,
      id: (media || [])[i].id,
      metric,
      field,
    })),
  );
  const replies = await graphBatch(
    context,
    jobs.map(
      (j) =>
        encodeURIComponent(j.id) + '/insights?' + query({ metric: j.metric }),
    ),
  );
  let imported = 0,
    failed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i],
      r = replies[i],
      value = scalar(r.body?.data?.find((d: any) => d.name === j.metric));
    if (value !== null) {
      putPost(posts[j.i], j.field, value);
      posts[j.i].sourceMetrics = {
        ...posts[j.i].sourceMetrics,
        [j.metric]: value,
      };
      imported++;
    } else if (r.error) failed++;
  }
  result.checks.push({
    key: 'post-insights',
    label: 'Individual content metrics',
    status: imported ? 'imported' : failed ? 'unavailable' : 'empty',
    records: imported,
    detail:
      imported +
      ' content metric values returned; ' +
      failed +
      ' unavailable requests. Metrics differ by content type. Counts are lifetime totals observed at refresh.',
  });
  result.posts = posts;
  result.daily = [...map.values()];
  result.scope =
    'Meta account insights and published-content lifetime metrics. API version, date limits, permissions and account eligibility determine availability.';
  return result;
}
