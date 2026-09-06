'use client';
import { useMemo, useState } from 'react';
import { ImageIcon, ArrowUpRight } from 'lucide-react';
import { number, type Post } from '@/lib/analytics';
import { postValue, type SocialMetric } from '@/lib/social-performance';
import { ImportedPostDetail } from './imported-post-detail';
import { Picker } from './controls';

const metrics: [SocialMetric, string][] = [
  ['views', 'Views'],
  ['reach', 'Reach'],
  ['engagements', 'Interactions'],
  ['likes', 'Likes / reactions'],
  ['comments', 'Comments'],
  ['shares', 'Shares'],
  ['reshares', 'Reshares'],
  ['reposts', 'Reposts'],
];
export function PostPerformance({
  posts,
  channels,
  loading,
}: {
  posts: Post[];
  channels: string[];
  loading: boolean;
}) {
  const [search, setSearch] = useState(''),
    [platform, setPlatform] = useState('All selected platforms'),
    [sort, setSort] = useState('Newest first'),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Post | null>(null);
  const rows = useMemo(
    () =>
      posts
        .filter(
          (p) =>
            (platform === 'All selected platforms' ||
              p.platform === platform) &&
            [p.title, p.caption, p.id].some((v) =>
              String(v || '')
                .toLowerCase()
                .includes(search.toLowerCase()),
            ),
        )
        .sort((a, b) =>
          sort === 'Newest first'
            ? b.date.localeCompare(a.date)
            : (postValue(
                b,
                sort === 'Most views'
                  ? 'views'
                  : sort === 'Most shares'
                    ? 'shares'
                    : 'engagements',
              ) ?? -1) -
              (postValue(
                a,
                sort === 'Most views'
                  ? 'views'
                  : sort === 'Most shares'
                    ? 'shares'
                    : 'engagements',
              ) ?? -1),
        ),
    [posts, platform, search, sort],
  );
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1));
  return (
    <section
      className="surface padded post-performance"
      id="post-performance"
      aria-busy={loading}
    >
      <div className="section-head">
        <div>
          <span className="metric-eyebrow">{channels.join(' · ')}</span>
          <h2>Individual post performance</h2>
          <p>
            Images, carousels, videos and reels · {rows.length.toLocaleString()}{' '}
            imported posts in the selected dates and content type
          </p>
        </div>
      </div>
      <div className="inline-controls post-performance-filters">
        <input
          type="search"
          aria-label="Search published posts"
          placeholder="Find a caption or post"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        {channels.length > 1 && (
          <Picker
            label="Post platform"
            value={platform}
            options={['All selected platforms', ...channels]}
            onChange={(v) => {
              setPlatform(v);
              setPage(0);
            }}
          />
        )}
        <Picker
          label="Sort posts"
          value={sort}
          options={[
            'Newest first',
            'Most views',
            'Most interactions',
            'Most shares',
          ]}
          onChange={(v) => {
            setSort(v);
            setPage(0);
          }}
        />
      </div>
      <p className="metric-definition">
        Lifetime totals observed at the last import. Select a post for every
        supplied metric. A dash means unavailable; interactions sum the
        available likes, comments, shares and saves unless the provider supplies
        a total.
      </p>
      {loading ? (
        <p role="status">Loading published posts…</p>
      ) : (
        <div className="report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Published content</th>
                {metrics.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(current * 12, (current + 1) * 12).map((p) => (
                <tr key={p.platform + ':' + p.id}>
                  <td>
                    <button
                      className="post-performance-identity"
                      onClick={() => setSelected(p)}
                    >
                      <span className="post-performance-thumb">
                        <ImageIcon size={20} />
                        {p.image && (
                          <img
                            loading="lazy"
                            src={p.image}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </span>
                      <span>
                        <small className="pill" data-platform={p.platform}>
                          {p.platform} · {p.format}
                        </small>
                        <strong>{p.title}</strong>
                        <small>{p.date}</small>
                      </span>
                    </button>
                  </td>
                  {metrics.map(([key]) => {
                    const value = postValue(p, key);
                    return (
                      <td key={key}>{value === null ? '—' : number(value)}</td>
                    );
                  })}
                  <td>
                    <button
                      className="text-link"
                      aria-label={'View metrics for ' + p.title}
                      onClick={() => setSelected(p)}
                    >
                      View <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !rows.length && (
        <p>
          No imported posts match this selection. Use “Import available history”
          to retrieve older posts, then choose their publication dates.
        </p>
      )}
      <div className="pagination">
        <span>
          Page {current + 1} of {Math.max(1, Math.ceil(rows.length / 12))}
        </span>
        <button disabled={!current} onClick={() => setPage(current - 1)}>
          Previous posts
        </button>
        <button
          disabled={(current + 1) * 12 >= rows.length}
          onClick={() => setPage(current + 1)}
        >
          Next posts
        </button>
      </div>
      {selected && (
        <ImportedPostDetail post={selected} close={() => setSelected(null)} />
      )}
    </section>
  );
}
