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
