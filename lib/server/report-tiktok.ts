import { type Range } from '@/lib/analytics';
import {
  collect,
  emptyDaily,
  finite,
  importedPost,
  putMetric,
  putPost,
  resultSet,
  safeMedia,
} from '@/lib/reporting';
import { type ReportingContext } from './report-google';
import { requestJSON } from './providers';

export async function importTikTok(context: ReportingContext, range: Range) {
  const result = resultSet(),
    headers = {
      Authorization: 'Bearer ' + context.accessToken,
      'Content-Type': 'application/json',
    };
  const r = await requestJSON(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count',
    { headers },
  );
  if (r.error?.code && r.error.code !== 'ok')
    throw new Error(
      'INPUT:TikTok rejected this token or its user.info.stats permission. Reauthorize after scope approval.',
    );
  const u = r.data?.user;
  if (!u || u.open_id !== context.externalId)
    throw new Error(
      'INPUT:The TikTok account does not match the selected account.',
    );
  result.profile = {
    followers: finite(u.follower_count),
    likes: finite(u.likes_count),
    videos: finite(u.video_count),
  };
  const d = emptyDaily(new Date().toISOString().slice(0, 10), 'TikTok');
  putMetric(d, 'followers', u.follower_count);
  d.sourceMetrics = { followersObservedAt: new Date().toISOString() };
  result.daily.push(d);
  result.checks.push({
    key: 'profile',
    label: 'TikTok profile statistics',
    status: 'imported',
    records: 1,
    detail: 'Current follower, like and video counts.',
  });
  const videos = await collect(
    result,
    'content',
    'TikTok published videos',
    async () => {
      const items: any[] = [];
      let cursor: number | undefined;
      for (let page = 0; page < 50; page++) {
        const r = await requestJSON(
          'https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,cover_image_url,share_url,title,video_description,duration,like_count,comment_count,share_count,view_count',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              max_count: 20,
              ...(cursor ? { cursor } : {}),
            }),
          },
        );
        if (r.error?.code && r.error.code !== 'ok')
          throw new Error(
            'INPUT:TikTok video access is missing. Add video.list to the developer app and authorize again.',
          );
        for (const v of r.data?.videos || []) {
          const date = new Date(v.create_time * 1000)
            .toISOString()
            .slice(0, 10);
          if (date >= range.start && date <= range.end) items.push(v);
        }
        cursor = r.data?.cursor;
        if (
          !r.data?.has_more ||
          !cursor ||
          (r.data?.videos?.length &&
            new Date(r.data.videos.at(-1).create_time * 1000)
              .toISOString()
              .slice(0, 10) < range.start)
        )
          break;
        if (page === 49)
          result.checks.push({
            key: 'content-limit',
            label: 'Older TikTok videos',
            status: 'unavailable',
            records: 0,
            detail:
              'The first 1,000 accessible videos were scanned. Use an export for more history.',
          });
      }
      return items;
    },
    (r) => r.length,
  );
  result.posts = (videos || []).map((v: any) => {
    const p = importedPost(
      'TikTok',
      v.id,
      new Date(v.create_time * 1000).toISOString(),
      v.title || v.video_description || 'TikTok video',
    );
    p.caption = v.video_description || p.title;
    p.image = safeMedia(v.cover_image_url);
    p.permalink = safeMedia(v.share_url);
    p.format = 'Video';
    for (const [key, name] of Object.entries({
      views: 'view_count',
      likes: 'like_count',
      comments: 'comment_count',
      shares: 'share_count',
    }))
      putPost(p, key, v[name]);
    p.sourceMetrics = {
      duration: v.duration,
      metricScope: 'lifetime',
      thumbnailExpires:
        'TikTok cover links expire after approximately six hours; refresh to renew.',
    };
    return p;
  });
  for (const label of [
    'Daily video views and profile views',
    'Historical followers before connection',
    'Audience demographics and watch-time retention',
  ])
    result.checks.push({
      key: label,
      label,
      status: 'unavailable',
      records: 0,
      detail:
        'TikTok Display API does not supply this report. Import a TikTok Studio export containing the required fields. Lifetime video counters are not converted into daily traffic.',
    });
  result.scope =
    'TikTok current profile statistics and published-video lifetime views, likes, comments and shares. Daily analytics require a Studio export or separately approved Business API access.';
  return result;
}
