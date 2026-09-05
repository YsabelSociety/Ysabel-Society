import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const contentItems = sqliteTable(
  'content_items',
  {
    owner: text('owner').notNull(),
    id: text('id').notNull(),
    payload: text('payload').notNull(),
    position: integer('position').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const annotations = sqliteTable(
  'annotations',
  {
    owner: text('owner').notNull(),
    id: text('id').notNull(),
    date: text('date').notNull(),
    text: text('text').notNull(),
    unit: text('unit').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const reports = sqliteTable(
  'reports',
  {
    owner: text('owner').notNull(),
    id: text('id').notNull(),
    payload: text('payload').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const settings = sqliteTable('workspace_settings', {
  owner: text('owner').primaryKey(),
  payload: text('payload').notNull(),
});
export const media = sqliteTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    key: text('object_key').notNull(),
    name: text('name').notNull(),
    type: text('mime_type').notNull(),
    size: integer('size').notNull(),
  },
  (t) => [index('idx_media_owner').on(t.owner)],
);
export const accounts = sqliteTable(
  'platform_accounts',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    channel: text('channel').notNull(),
    unit: text('unit').notNull(),
    externalId: text('external_id').notNull(),
    enabled: integer('enabled').default(1),
    lastSync: text('last_sync'),
    status: text('status').notNull().default('Disconnected'),
  },
  (t) => [index('idx_accounts_owner').on(t.owner)],
);
export const metrics = sqliteTable(
  'account_metrics_daily',
  {
    account: text('account_id').notNull(),
    date: text('date').notNull(),
    normalized: text('normalized').notNull(),
    raw: text('source_metrics').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.account, t.date] })],
);
export const syncRuns = sqliteTable(
  'sync_runs',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    channel: text('channel').notNull(),
    status: text('status').notNull(),
    started: text('started_at').notNull(),
    finished: text('finished_at'),
    message: text('message'),
  },
  (t) => [index('idx_sync_owner').on(t.owner)],
);

export const connectorVault = sqliteTable(
  'connector_vault',
  {
    owner: text('owner').notNull(),
    kind: text('kind').notNull(),
    provider: text('provider').notNull(),
    encrypted: text('encrypted').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.kind, t.provider] })],
);
export const oauthStates = sqliteTable('oauth_states', {
  state: text('state_hash').primaryKey(),
  owner: text('owner').notNull(),
  provider: text('provider').notNull(),
  nonce: text('nonce_hash').notNull(),
  verifier: text('verifier').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expires: integer('expires_at').notNull(),
});
export const connectorLinks = sqliteTable(
  'connector_links',
  {
    owner: text('owner').notNull(),
    source: text('source').notNull(),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    label: text('label').notNull(),
    snapshot: text('snapshot'),
    autoSync: integer('auto_sync').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.owner, t.source] })],
);

export const sourceReports = sqliteTable(
  'source_reports',
  {
    account: text('account_id').notNull(),
    key: text('report_key').notNull(),
    start: text('period_start').notNull(),
    end: text('period_end').notNull(),
    payload: text('payload').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.account, t.key, t.start, t.end] })],
);
export const sourcePosts = sqliteTable(
  'source_posts',
  {
    account: text('account_id').notNull(),
    id: text('post_id').notNull(),
    published: text('published_date').notNull(),
    payload: text('payload').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.account, t.id] }),
    index('idx_source_posts_date').on(t.account, t.published),
  ],
);

export const communityRecords = sqliteTable('community_records', {
  owner: text('owner').notNull(), source: text('source').notNull(), kind: text('kind').notNull(),
  id: text('id').notNull(), occurredAt: text('occurred_at').notNull(), encrypted: text('encrypted').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.source, t.kind, t.id] }), index('idx_community_owner_kind_time').on(t.owner, t.kind, t.occurredAt)]);
export const communitySync = sqliteTable('community_sync', {
  owner: text('owner').notNull(), source: text('source').notNull(), kind: text('kind').notNull(),
  state: text('state').notNull(), detail: text('detail').notNull(), updatedAt: text('updated_at').notNull(),
  cursor: text('cursor'), accountId: text('account_id'), total: integer('total'),
}, t => [primaryKey({ columns: [t.owner, t.source, t.kind] })]);
