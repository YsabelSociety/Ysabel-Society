-- Ysabel Society / apply to a new Supabase project.
-- Schema foundation only. Not provisioned or used by the hosted D1 preview.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.users(id uuid primary key references auth.users(id) on delete cascade,display_name text);
create table public.organization_members(organization_id uuid not null references public.organizations(id),user_id uuid not null references public.users(id),role text not null check(role in ('owner','admin','editor','viewer')),primary key(organization_id,user_id));
create function private.member_of(org uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid()) $$;
create function private.can_edit(org uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid() and m.role in ('owner','admin','editor')) $$;
grant usage on schema private to authenticated;
revoke all on function private.member_of(uuid),private.can_edit(uuid) from public;
grant execute on function private.member_of(uuid),private.can_edit(uuid) to authenticated;

create table public.business_units(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), name text not null, timezone text not null default 'Europe/Tirane',created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.platform_accounts(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), business_unit_id uuid not null, platform text not null, external_id text not null, permissions jsonb not null default '[]', enabled boolean not null default true, last_successful_sync timestamptz,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.content_items(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), business_unit_id uuid, media_asset_id uuid, campaign_id uuid, title text not null, caption text not null default '', format text not null, status text not null check(status in ('draft','approved','scheduled','published','archived')), position integer not null default 0, scheduled_at timestamptz,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.content_publications(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), content_item_id uuid not null, account_id uuid not null, external_post_id text not null, permalink text, published_at timestamptz not null, attribution_type text not null default 'unknown' check(attribution_type in ('direct','assisted','correlation','unknown')), utm_source text, utm_campaign text, utm_content text,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.audience_snapshots(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), account_id uuid not null, captured_on date not null, dimension text not null, values jsonb not null, suppressed boolean not null default false,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.sync_runs(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), account_id uuid not null, status text not null check(status in ('queued','running','succeeded','failed')), started_at timestamptz, finished_at timestamptz, range_start date, range_end date, cursor text, attempt integer not null default 0, rows_upserted integer, public_error_code text,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.reports(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), title text not null, start_date date not null, end_date date not null, filters jsonb not null, snapshot jsonb not null, source_freshness jsonb not null, check(end_date>=start_date),created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.annotations(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), business_unit_id uuid, date date not null, text text not null, created_by uuid references public.users(id),created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.tags(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), name text not null,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.campaigns(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), business_unit_id uuid, name text not null, start_date date, end_date date,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.media_assets(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), object_key text not null, mime_type text not null, size_bytes bigint not null check(size_bytes>0), width integer, height integer, duration_seconds numeric, alt_text text,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.reservation_events(organization_id uuid not null references public.organizations(id),id uuid not null default gen_random_uuid(), provider text not null, external_event_id text not null, status text not null, event_at timestamptz not null, attributable_publication_id uuid, attribution_type text not null default 'unknown', source_event jsonb not null,created_at timestamptz not null default now(),primary key(organization_id,id));

create table public.account_metrics_daily(organization_id uuid not null,account_id uuid not null,date date not null,dimension_key text not null default 'all',metrics jsonb not null,source_metrics jsonb not null,definition_version text not null,fetched_at timestamptz not null default now(),primary key(organization_id,account_id,date,dimension_key),foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id));

create table public.content_metrics_daily(organization_id uuid not null,publication_id uuid not null,date date not null,dimension_key text not null default 'all',metrics jsonb not null,source_metrics jsonb not null,definition_version text not null,fetched_at timestamptz not null default now(),primary key(organization_id,publication_id,date,dimension_key),foreign key(organization_id,publication_id) references public.content_publications(organization_id,id));

create table public.ga4_metrics_daily(organization_id uuid not null,account_id uuid not null,date date not null,dimension_key text not null default 'all',metrics jsonb not null,source_metrics jsonb not null,definition_version text not null,fetched_at timestamptz not null default now(),primary key(organization_id,account_id,date,dimension_key),foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id));

create table public.gbp_metrics_daily(organization_id uuid not null,account_id uuid not null,date date not null,dimension_key text not null default 'all',metrics jsonb not null,source_metrics jsonb not null,definition_version text not null,fetched_at timestamptz not null default now(),primary key(organization_id,account_id,date,dimension_key),foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id));

create table public.ad_metrics_daily(organization_id uuid not null,account_id uuid not null,date date not null,dimension_key text not null default 'all',metrics jsonb not null,source_metrics jsonb not null,definition_version text not null,fetched_at timestamptz not null default now(),primary key(organization_id,account_id,date,dimension_key),foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id));

create table private.platform_connections(organization_id uuid not null,account_id uuid not null,access_token_ciphertext bytea not null,refresh_token_ciphertext bytea,encryption_key_version integer not null,expires_at timestamptz,metadata jsonb not null default '{}',primary key(organization_id,account_id),foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id) on delete cascade);
-- Credentials must be encrypted by the application with a versioned externally held key.
-- This private table is service-role-only. Never grant browser access.
create table public.content_tags(organization_id uuid not null,content_item_id uuid not null,tag_id uuid not null,primary key(organization_id,content_item_id,tag_id),foreign key(organization_id,content_item_id) references public.content_items(organization_id,id) on delete cascade,foreign key(organization_id,tag_id) references public.tags(organization_id,id) on delete cascade);
alter table public.platform_accounts add foreign key(organization_id,business_unit_id) references public.business_units(organization_id,id);
alter table public.content_items add foreign key(organization_id,business_unit_id) references public.business_units(organization_id,id),add foreign key(organization_id,media_asset_id) references public.media_assets(organization_id,id),add foreign key(organization_id,campaign_id) references public.campaigns(organization_id,id);
alter table public.content_publications add foreign key(organization_id,content_item_id) references public.content_items(organization_id,id),add foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id);
alter table public.audience_snapshots add foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id);
alter table public.sync_runs add foreign key(organization_id,account_id) references public.platform_accounts(organization_id,id);
alter table public.annotations add foreign key(organization_id,business_unit_id) references public.business_units(organization_id,id);
alter table public.campaigns add foreign key(organization_id,business_unit_id) references public.business_units(organization_id,id);
alter table public.reservation_events add foreign key(organization_id,attributable_publication_id) references public.content_publications(organization_id,id);
create unique index idx_account_platform_id on public.platform_accounts(organization_id,platform,external_id);
create unique index idx_publication_external on public.content_publications(organization_id,account_id,external_post_id);
create unique index idx_sync_running on public.sync_runs(organization_id,account_id) where status='running';
create unique index idx_reservation_external on public.reservation_events(organization_id,provider,external_event_id);
create index idx_content_unit_schedule on public.content_items(organization_id,business_unit_id,status,scheduled_at);
create index idx_metrics_org_date on public.account_metrics_daily(organization_id,date);
create index idx_annotations_org_date on public.annotations(organization_id,date);
alter table public.users enable row level security;
create policy own_profile on public.users for select to authenticated using(id=auth.uid());
alter table public.organizations enable row level security;
create policy org_read on public.organizations for select to authenticated using(private.member_of(id));
alter table public.organization_members enable row level security;
create policy membership_read on public.organization_members for select to authenticated using(private.member_of(organization_id));

alter table public.business_units enable row level security;
create policy member_read on public.business_units for select to authenticated using(private.member_of(organization_id));

alter table public.platform_accounts enable row level security;
create policy member_read on public.platform_accounts for select to authenticated using(private.member_of(organization_id));

alter table public.content_items enable row level security;
create policy member_read on public.content_items for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.content_items for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

alter table public.content_publications enable row level security;
create policy member_read on public.content_publications for select to authenticated using(private.member_of(organization_id));

alter table public.audience_snapshots enable row level security;
create policy member_read on public.audience_snapshots for select to authenticated using(private.member_of(organization_id));

alter table public.sync_runs enable row level security;
create policy member_read on public.sync_runs for select to authenticated using(private.member_of(organization_id));

alter table public.reports enable row level security;
create policy member_read on public.reports for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.reports for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

alter table public.annotations enable row level security;
create policy member_read on public.annotations for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.annotations for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

alter table public.tags enable row level security;
create policy member_read on public.tags for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.tags for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

alter table public.campaigns enable row level security;
create policy member_read on public.campaigns for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.campaigns for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

alter table public.media_assets enable row level security;
create policy member_read on public.media_assets for select to authenticated using(private.member_of(organization_id));

alter table public.reservation_events enable row level security;
create policy member_read on public.reservation_events for select to authenticated using(private.member_of(organization_id));

alter table public.account_metrics_daily enable row level security;
create policy member_read on public.account_metrics_daily for select to authenticated using(private.member_of(organization_id));

alter table public.content_metrics_daily enable row level security;
create policy member_read on public.content_metrics_daily for select to authenticated using(private.member_of(organization_id));

alter table public.ga4_metrics_daily enable row level security;
create policy member_read on public.ga4_metrics_daily for select to authenticated using(private.member_of(organization_id));

alter table public.gbp_metrics_daily enable row level security;
create policy member_read on public.gbp_metrics_daily for select to authenticated using(private.member_of(organization_id));

alter table public.ad_metrics_daily enable row level security;
create policy member_read on public.ad_metrics_daily for select to authenticated using(private.member_of(organization_id));

alter table public.content_tags enable row level security;
create policy member_read on public.content_tags for select to authenticated using(private.member_of(organization_id));
create policy editor_write on public.content_tags for all to authenticated using(private.can_edit(organization_id)) with check(private.can_edit(organization_id));

-- Ingestion, membership, account changes, publication matching and source metrics remain service-role-only.

