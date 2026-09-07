'use client';
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from 'react';
import facebookMark from 'simple-icons/icons/facebook.svg';
import googleMapsMark from 'simple-icons/icons/googlemaps.svg';
import instagramMark from 'simple-icons/icons/instagram.svg';
import tiktokMark from 'simple-icons/icons/tiktok.svg';
import {
  Activity,
  AtSign,
  BadgeCheck,
  BookOpen,
  Bookmark,
  CalendarDays,
  CalendarCheck,
  CalendarRange,
  Camera,
  ChartColumnIncreasing,
  CircleUserRound,
  Clock3,
  FileChartColumn,
  FileDown,
  Eye,
  FileText,
  Flag,
  Globe,
  Heart,
  HeartHandshake,
  Image,
  KeyRound,
  Layers3,
  LayoutGrid,
  List,
  MapPinned,
  Mars,
  MessageCircle,
  MessageCircleMore,
  MessageSquareReply,
  Monitor,
  MousePointerClick,
  Music2,
  Navigation,
  Phone,
  Play,
  Plug,
  Radar,
  Repeat2,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  UserRound,
  UserRoundCheck,
  UserRoundPlus,
  UsersRound,
  Utensils,
  Venus,
  Video,
  Wallet,
  Wine,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { TabsTrigger } from '@/components/ui/tabs';
import styles from './data-icons.module.css';

const normalize = (name: string) =>
  name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const definitions: [LucideIcon, string[]][] = [
  [Camera, ['instagram', 'direct instagram']],
  [Flag, ['facebook']],
  [Music2, ['tiktok']],
  [Globe, ['website', 'ga4', 'countries', 'country', 'geography', 'abroad']],
  [MapPinned, ['google business', 'gbp', 'maps', 'cities', 'city', 'local']],
  [Layers3, ['all', 'all platforms', 'all social platforms', 'all topics']],
  [CircleUserRound, ['profile views', 'profileviews', 'profile visits']],
  [
    Eye,
    [
      'views',
      'content views',
      'total content views',
      'page views',
      'pageviews',
      'screen page views',
      'unique media viewers',
    ],
  ],
  [Radar, ['reach', 'aggregated reach']],
  [
    HeartHandshake,
    ['engagements', 'engaged', 'engaged sessions', 'engagement rate'],
  ],
  [UsersRound, ['followers', 'community', 'accounts']],
  [
    UserRound,
    [
      'users',
      'active users',
      'daily active users',
      'users viewers',
      'visitor type',
    ],
  ],
  [
    MousePointerClick,
    ['sessions', 'website visits', 'clicks', 'website clicks', 'link clicks'],
  ],
  [Search, ['search', 'google search views', 'search queries']],
  [Navigation, ['directions', 'direction requests']],
  [Phone, ['calls', 'phone call clicks']],
  [Heart, ['likes']],
  [MessageCircle, ['comments']],
  [Heart, ['reactions']],
  [Bookmark, ['saves']],
  [Clock3, ['average watch time ms', 'total watch time ms']],
  [Share2, ['shares']],
  [Repeat2, ['reshares', 'reposts', 'story reposts']],
  [Tag, ['tagged posts', 'post tag']],
  [AtSign, ['story mentions', 'post mentions', 'mentions']],
  [Image, ['posts', 'published posts', 'content', 'images']],
  [Play, ['stories']],
  [Video, ['reels', 'videos']],
  [Star, ['influencers', 'influencers awaiting reply']],
  [Venus, ['female', 'females', 'women']],
  [Mars, ['male', 'males', 'men']],
  [UserRoundPlus, ['new users', 'newusers', 'follows', 'net new followers']],
  [TrendingUp, ['growth', 'average daily growth']],
  [UserRoundCheck, ['leads', 'potential clients']],
  [MessageCircleMore, ['messages received', 'all conversations', 'history']],
  [
    MessageSquareReply,
    [
      'unanswered',
      'unanswered messages',
      'conversations awaiting reply',
      'reviews without a reply',
      'waiting',
    ],
  ],
  [Star, ['imported reviews', 'reviews', 'average rating']],
  [
    Utensils,
    [
      'food',
      'food related reviews',
      'menu',
      'menu interactions',
      'menu page views',
    ],
  ],
  [Wine, ['drinks', 'food drinks', 'with drink criticism']],
  [UserRoundCheck, ['service', 'service staff', 'staff']],
  [Wind, ['atmosphere']],
  [
    Clock3,
    [
      'waiting time',
      'engagement seconds',
      'engagement time',
      'engagementseconds',
    ],
  ],
  [Wallet, ['price value']],
  [Sparkles, ['cleanliness', 'creative patterns']],
  [
    CalendarCheck,
    [
      'bookings',
      'reservation',
      'reservation clicks',
      'confirmed reservation events',
    ],
  ],
  [ShoppingBag, ['food orders', 'foodorders']],
  [CalendarDays, ['monthly', 'yearly']],
  [
    CalendarRange,
    ['weekly', 'daily', 'selected dates', 'timeline', 'formats timing'],
  ],
  [LayoutGrid, ['grid', 'large grid']],
  [List, ['list']],
  [Smartphone, ['phone', 'mobile', 'device']],
  [Monitor, ['desktop']],
  [Settings2, ['setup', 'app setup']],
  [BookOpen, ['guide', 'setup guide']],
  [KeyRound, ['credentials', 'existing access service account']],
  [FileDown, ['file', 'import csv', 'import an export']],
  [ShieldCheck, ['authorize', 'access', 'platform access']],
  [Activity, ['automation', 'automatic refresh history']],
  [
    FileChartColumn,
    [
      'saved reports',
      'reports',
      'source medium',
      'acquisition',
      'events',
      'event count',
    ],
  ],
  [FileChartColumn, ['website total']],
  [Navigation, ['website traffic']],
  [Layers3, ['website channels']],
  [FileText, ['website pages']],
  [Activity, ['website events']],
  [Smartphone, ['website devices']],
  [Globe, ['website countries']],
  [MapPinned, ['website cities']],
  [UsersRound, ['website visitors']],
  [Plug, ['platform connections', 'connections']],
  [BadgeCheck, ['preferences', 'settings']],
];
const icons = new Map(
  definitions.flatMap(([icon, names]) =>
    names.map((name) => [normalize(name), icon] as const),
  ),
);
const brandIcons = new Map<string, string>([
  ['instagram', instagramMark],
  ['direct instagram', instagramMark],
  ['facebook', facebookMark],
  ['tiktok', tiktokMark],
  ['google business', googleMapsMark],
  ['gbp', googleMapsMark],
]);
const contextualIcons = [...icons.entries()].sort(
  (a, b) => b[0].length - a[0].length,
);
export function iconFor(name: string): LucideIcon {
  const text = normalize(name);
  const exact = icons.get(text);
  if (exact) return exact;
  // Labels add timeframe/context (e.g. Page views · 30 min); keep their metric icon.
  for (const [key, icon] of contextualIcons)
    if (text === key || text.startsWith(key + ' ') || text.endsWith(' ' + key))
      return icon;
  return ChartColumnIncreasing;
}
export function DataIcon({
  name,
  badge = false,
}: {
  name: string;
  badge?: boolean;
}) {
  const brand = brandIcons.get(normalize(name));
  if (brand)
    return (
      <span
        className={`${badge ? styles.badge : styles.icon} ${styles.brand}`}
        aria-hidden="true"
      >
        <img src={brand} alt="" />
      </span>
    );
  const Icon = iconFor(name);
  return (
    <span className={badge ? styles.badge : styles.icon} aria-hidden="true">
      <Icon size={badge ? 18 : 16} strokeWidth={1.6} />
    </span>
  );
}
function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textOf(child.props.children)
          : '',
    )
    .join(' ');
}
export function DataTab({
  children,
  ...props
}: ComponentProps<typeof TabsTrigger>) {
  const text = textOf(children).replace(/^\s*\d+\s*·\s*/, '');
  return (
    <TabsTrigger {...props}>
      <DataIcon name={text || String(props.value)} />
      {children}
    </TabsTrigger>
  );
}
