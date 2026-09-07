'use client';

import {
  Archive, ArrowLeftRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3,
  Compass, Copy, Download, Expand, Grid3X3, Heart, Home, Images, Maximize2, Menu,
  MessageCircle,
  LockKeyhole, LogOut, Monitor, MoreHorizontal, Move, NotebookPen, Pause, Play, Plus, Redo2,
  RotateCcw, Search, Send, Settings, SlidersHorizontal, Smartphone, Sparkles, Trash2, Undo2,
  Upload, UserRound, Video, Volume2, X,
} from 'lucide-react';
import { memo, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import YsabelLoginLogo from '@/components/ysabel-login-logo';
import YsabelLoginBackground from '@/components/ysabel-login-background';
import { LOGIN_SCENE } from '@/lib/login-scene-config';
import { loadPreview, ProgressiveImage, useMediaVisibility } from '@/components/media-preview';

type ViewMode = 'mobile' | 'desktop' | 'grid';
type Section = 'feed' | 'media' | 'calendar' | 'notes' | 'captions' | 'versions' | 'archive' | 'settings';
type RearrangeMode = 'swap' | 'insert';
type DragSource = { type: 'grid' | 'library'; index?: number; id?: string };

type Asset = {
  id: string; name: string; fileName: string; mimeType: string; fileSize: number; url: string;
  format: string; category: string; status: string; plannedDate: string | null; caption: string;
  notes: string; slides: string[]; cropZoom: number; cropX: number; cropY: number; palette: string; archived: boolean;
  publicPath?: string; createdAt?: number; updatedAt?: number;
};

type Board = { id: string; name: string; archived: boolean; createdAt?: number; updatedAt?: number };
type Version = { id: string; boardId: string; name: string; snapshot: string; createdAt: number };
type CalendarNote = { boardId: string; noteDate: string; body: string; updatedAt: number };
type Publication = { boardId: string; snapshot: string; publishedAt: number | string };
type CommunityCaption = { id: string; text: string };
type CaptionPool = { available: string[]; used: string[] };
type CommunityCaptionStore = Record<string, CaptionPool>;
type WorkspaceData = {
  boards: Board[];
  media: (Asset & { publicPath?: string })[];
  positions: { boardId: string; position: number; mediaId: string | null }[];
  versions: Version[];
  notes: CalendarNote[];
  publications: Publication[];
};

const FEED_SIZE = 15;
const emptyFeed = () => Array<string | null>(FEED_SIZE).fill(null);
const COMMUNITY_CAPTION_STORAGE_KEY = 'ysabel_community_captions_v1';
const COMMUNITY_CAPTIONS_TEXTS = [
  'Monday night. Who did you think of when you saw Kipey’s name? Bring them. — Ysabel Garden · 21:00',
  'Tuesday night. Don’t just forward this. Add “come with me.” — Lab Sadiku · Ysabel Garden · 21:00',
  'We’d love to see you walk in this Wednesday. — Jeton Berisha · Ysabel Asian · 20:00',
  'Thursday night with Kreshatech. Come early enough to hear how it begins. — Ysabel Garden · 21:00',
  'Friday night. “I miss going out with you.” Send that part too. — Artan Ymeri · Ysabel Garden · 21:00',
  'Saturday night. The song you know by heart. The person who knows why. — Yll Megi · Ysabel Garden · 21:00',
  'Monday night. First time at Ysabel? Come say hello when you arrive. — Adrian Berisha · Ysabel Garden · 21:00',
  'Tuesday night with Yll Megi. Bring the person who got you into this music. — Ysabel Garden · 21:00',
  'If you’ve been meaning to come back, make it this Wednesday. — Kipey · Ysabel Garden · 21:00',
  'Thursday night. “I’ll come if you come.” We’re counting on both. — Dandara Sound · Ysabel Garden · 21:00',
  'Friday night with Firstmusix. Sometimes you know in the first ten seconds. — Ysabel Garden · 21:00',
  'Saturday night. Back in Prishtina? Come tell us where you’ve been. — Lab Sadiku · Ysabel Garden · 21:00',
  'Monday night. We’re here if you feel like going out. — Kipey · Ysabel Garden · 21:00',
  'Tuesday night. Ever heard a song and immediately wanted someone else to hear it? — Kreshatech · Ysabel Garden · 21:00',
  'Wednesday night with Dandara Sound. Who should be hearing this beside you? — Ysabel Garden · 21:00',
  'If someone’s back in town, bring them by this Thursday. — Artan Ymeri · Ysabel Garden · 21:00',
  'Friday night. Have you eaten? Jeton Berisha’s playing at eight. — Ysabel Asian · 20:00',
  'Saturday night. You can bring someone we haven’t met. We’d like that. — Adrian Berisha · Ysabel Garden · 21:00',
  'Monday night. Lab Sadiku at nine. This is us asking you properly. — Ysabel Garden · 21:00',
  'Tuesday night. Who knows your favourite song without having to ask? — Yll Megi · Ysabel Garden · 21:00',
  'Wednesday night with Kipey. Hear the whole set before choosing your favourite. — Ysabel Garden · 21:00',
  'Thursday night. Dinner can be the plan. The music’s already sorted. — Jeton Berisha · Ysabel Asian · 20:00',
  'Friday night. Come for an hour. We’d still be happy to see you. — Firstmusix · Ysabel Garden · 21:00',
  'Saturday night with Kipey. Tell us which track stays with you tomorrow. — Ysabel Garden · 21:00',
  'Monday night. “Do you remember this?” Better when they’re sitting beside you. — Lab Sadiku · Ysabel Garden · 21:00',
  'Tuesday night. Someone in Prishtina knows exactly why you’d love this. — Dandara Sound · Ysabel Garden · 21:00',
  'Wednesday night. Order something to share. Tell them what happened. — Jeton Berisha · Ysabel Asian · 20:00',
  'Thursday night. Which song would make you get up halfway through dinner? — Artan Ymeri · Ysabel Garden · 21:00',
  'Friday night with Adrian Berisha. We’d love your take on the set. — Ysabel Garden · 21:00',
  'Saturday night. Bring the person you’ve been sending songs to. — Firstmusix · Ysabel Garden · 21:00',
  'Monday night. The friend you keep sending songs to. Ask them along. — Kipey · Ysabel Garden · 21:00',
  'Tuesday night. Which friend are you calling first? — Yll Megi · Ysabel Garden · 21:00',
  'Wednesday night. Tell us you’re coming. We like having names to look out for. — Lab Sadiku · Ysabel Garden · 21:00',
  'Thursday night. First time hearing Kreshatech? Come close enough to watch. — Ysabel Garden · 21:00',
  'Friday night. “Tell me everything.” There’s time before the music starts. — Jeton Berisha · Ysabel Asian · 20:00',
  'Saturday night. Bring someone visiting Prishtina. Let them hear it for themselves. — Dandara Sound · Ysabel Garden · 21:00',
  'Monday night. Get ready together. We’ll see you both here. — Adrian Berisha · Ysabel Garden · 21:00',
  'Tuesday night. What did you listen to before you met them? — Artan Ymeri · Ysabel Garden · 21:00',
  'Wednesday night. Jeton Berisha at eight. Will you be here when we start? — Ysabel Asian · 20:00',
  'Thursday night. “We should do this again.” Tonight would work. — Kipey · Ysabel Garden · 21:00',
  'Friday night. An evening without rushing each other. Come sit down. — Dandara Sound · Ysabel Garden · 21:00',
  'Saturday night. We don’t need the short version. Come tell us everything. — Jeton Berisha · Ysabel Garden · 21:00',
  'Monday night. Bring someone who’s never heard Kipey. Watch what they notice. — Ysabel Garden · 21:00',
  'Tuesday night. “Thought you’d like this.” Sometimes that’s all it takes. — Yll Megi · Ysabel Garden · 21:00',
  'If your friend’s playing this Wednesday, let them see you there. — Kreshatech · Ysabel Garden · 21:00',
  'Thursday night with Firstmusix. Who’s joining us? — Ysabel Garden · 21:00',
  'Friday night. Dinner outside? Jeton Berisha’s playing. — Ysabel Garden · 21:00',
  'Saturday night. Who remembers where you first heard that song? — Lab Sadiku · Ysabel Garden · 21:00',
  'Monday night. “Can we catch up?” We’ve got somewhere in mind. — Artan Ymeri · Ysabel Garden · 21:00',
  'If we haven’t met yet, come say hello this Tuesday. — Adrian Berisha · Ysabel Garden · 21:00',
  'Wednesday night with Kipey. What would you love to hear? — Ysabel Garden · 21:00',
  'Thursday night. Bring whoever you’ve barely spoken to all week. — Dandara Sound · Ysabel Garden · 21:00',
  'Friday night. Your friend knows every track. We’d like to meet them. — Kreshatech · Ysabel Garden · 21:00',
  'Saturday night. “You’d love this.” Give them the chance to find out. — Lab Sadiku · Ysabel Garden · 21:00',
  'Monday night with Yll Megi. You don’t have to know the music yet. — Ysabel Garden · 21:00',
  'Tuesday night. A song comes on. Who’s the first person you look for? — Kipey · Ysabel Garden · 21:00',
  'Wednesday night. Keep us in mind when dinner ends. Lab Sadiku’s playing. — Ysabel Garden · 21:00',
  'Thursday night. Somebody’s first Ysabel night could be with you. — Firstmusix · Ysabel Garden · 21:00',
  'Friday night with Adrian Berisha. First visit? We’d love to meet you. — Ysabel Garden · 21:00',
  'Saturday night. When was the last time you heard them laugh in person? — Jeton Berisha · Ysabel Asian · 20:00',
  'Monday night with Artan Ymeri. Tell us what you’d play next. — Ysabel Garden · 21:00',
  'Tuesday night. “Come over. There’s someone I want you to hear.” — Kreshatech · Ysabel Garden · 21:00',
  'Wednesday night. Your favourite song was new to you once. — Dandara Sound · Ysabel Garden · 21:00',
  'Thursday night. You don’t have to wait until you have news. — Jeton Berisha · Ysabel Asian · 20:00',
  'Friday night. Got an hour before heading home? Kipey’s starting at nine. — Ysabel Garden · 21:00',
  'Saturday night. “Are you coming?” We’d love a yes. — Firstmusix · Ysabel Garden · 21:00',
  'Monday night. Tell us which song reminds you of your first night here. — Lab Sadiku · Ysabel Garden · 21:00',
  'Tuesday night with Dandara Sound. Start at the back. Come closer when you feel it. — Ysabel Garden · 21:00',
  'Wednesday night with Lab Sadiku. Come hear something you’ll want to share. — Ysabel Garden · 21:00',
  'Thursday night. That friend who lives nearby but you never see. Invite them. — Adrian Berisha · Ysabel Garden · 21:00',
  'Friday night. Will you remember the song or who you were with? — Kipey · Ysabel Garden · 21:00',
  'Saturday night. Invite someone you usually only see on a screen. — Jeton Berisha · Ysabel Asian · 20:00',
  'Monday night. “This one’s for you.” You know who to bring. — Yll Megi · Ysabel Garden · 21:00',
  'Tuesday night with Firstmusix. Come listen, then tell us what you think. — Ysabel Garden · 21:00',
  'Wednesday night. First night in Prishtina? We’d like to be part of it. — Artan Ymeri · Ysabel Garden · 21:00',
  'Thursday night. “How have you been?” Let’s ask that in person. — Adrian Berisha · Ysabel Garden · 21:00',
  'Friday night with Yll Megi. Let’s see how many opening notes you need. — Ysabel Garden · 21:00',
  'Saturday night. Dandara Sound at nine. Let’s introduce someone new to this music. — Ysabel Garden · 21:00',
  'Monday night. The person you keep sending songs to. Ask them along. — Kipey · Ysabel Garden · 21:00',
  'Tuesday night. Find us before you start asking where everyone went. — Kreshatech · Ysabel Garden · 21:00',
  'Wednesday night. Come on your own if you like. We’ll be happy to see you. — Artan Ymeri · Ysabel Garden · 21:00',
  'Thursday night. Been listening to anything good? Come tell Kipey. — Ysabel Garden · 21:00',
  'Friday night. “I was hoping you’d be here.” So were we. — Lab Sadiku · Ysabel Garden · 21:00',
  'Saturday night. Who are you saving the seat beside you for? — Jeton Berisha · Ysabel Asian · 20:00',
  'Monday night with Jeton Berisha. Come sit with us for the first track. — Ysabel Asian · 20:00',
  'Did a friend bring you here the first time? Thank them this Tuesday. — Dandara Sound · Ysabel Garden · 21:00',
  'Wednesday night. Is there someone you’d like to get to know better? — Yll Megi · Ysabel Garden · 21:00',
  'Thursday night with Adrian Berisha. Bring someone whose music taste you’re curious about. — Ysabel Garden · 21:00',
  'Friday night. Dinner in the Garden? Firstmusix is playing. — Ysabel Garden · 21:00',
  'Saturday night. “We haven’t done this in ages.” Come say it here. — Kipey · Ysabel Garden · 21:00',
  'Monday night. Watch who smiles when Kreshatech changes the track. — Ysabel Garden · 21:00',
  'There’s someone you’ve only met briefly. Invite them properly this Tuesday. — Lab Sadiku · Ysabel Garden · 21:00',
  'Wednesday night with Artan Ymeri. Tell us who introduced you to his music. — Ysabel Garden · 21:00',
  'Thursday night. Have you been to the Garden at this hour? — Dandara Sound · Ysabel Garden · 21:00',
  'Never heard Lab Sadiku play? Come this Friday. — Ysabel Garden · 21:00',
  'Saturday night. Bring your oldest friend. See which song you both remember. — Yll Megi · Ysabel Garden · 21:00',
  'Monday night. Pull up a chair. Tell us how your summer went. — Jeton Berisha · Ysabel Garden · 21:00',
  'Tuesday night. First time hearing Yll Megi, or back for another set? — Ysabel Garden · 21:00',
  'Wednesday night. Come tell us which part you’d bring someone back for. — Adrian Berisha · Ysabel Garden · 21:00',
  'Society, who are we finally seeing this Thursday? — Kipey · Ysabel Garden · 21:00',
];
const COMMUNITY_CAPTIONS = COMMUNITY_CAPTIONS_TEXTS.map((text, index) => ({ id: `caption-${index + 1}`, text }));
const COMMUNITY_CAPTION_IDS = new Set(COMMUNITY_CAPTIONS.map((caption) => caption.id));

const COMMUNITY_CAPTION_BY_ID = new Map(COMMUNITY_CAPTIONS.map((caption) => [caption.id, caption]));
const DEFAULT_CAPTION_POOL: CaptionPool = {
  available: COMMUNITY_CAPTIONS.map((caption) => caption.id),
  used: [],
};

function dedupeOrdered(items: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

function normalizeCaptionPool(value: unknown): CaptionPool {
  const baseline: CaptionPool = { available: [...DEFAULT_CAPTION_POOL.available], used: [] };
  if (!value || typeof value !== 'object') return baseline;
  const input = value as { available?: unknown; used?: unknown };
  if (!Array.isArray(input.available) || !Array.isArray(input.used)) return baseline;
  const valid = input.available.filter((value): value is string => typeof value === 'string' && COMMUNITY_CAPTION_IDS.has(value));
  const validUsed = input.used.filter((value): value is string => typeof value === 'string' && COMMUNITY_CAPTION_IDS.has(value));
  const used = dedupeOrdered(validUsed);
  const usedSet = new Set(used);
  const available = dedupeOrdered(valid.filter((id) => !usedSet.has(id)));
  return { available, used };
}

function mergeCaptionStore(raw: unknown, boardIds: string[]) {
  const output: CommunityCaptionStore = {};
  const parsed = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  for (const boardId of boardIds) output[boardId] = normalizeCaptionPool(parsed[boardId]);
  return output;
}

function cloneCaptionPool(pool: CaptionPool): CaptionPool {
  return { available: [...pool.available], used: [...pool.used] };
}

function moveCaptionBetweenPools(pool: CaptionPool, captionId: string, target: 'used' | 'available') {
  const available = dedupeOrdered(pool.available);
  const used = dedupeOrdered(pool.used);
  if (target === 'used') {
    if (!available.includes(captionId)) return pool;
    return {
      available: available.filter((id) => id !== captionId),
      used: [...used, captionId],
    };
  }
  if (!used.includes(captionId)) return pool;
  return {
    available: [...available, captionId],
    used: used.filter((id) => id !== captionId),
  };
}

function mediaUrl(asset: Pick<Asset, 'id' | 'url' | 'publicPath'>, token = '') {
  const incoming = asset.publicPath || asset.url || '/contentpreview/api/media/' + asset.id;
  const source = incoming.startsWith('/api/') ? '/contentpreview' + incoming
    : incoming.startsWith('/') && !incoming.startsWith('/contentpreview/') && !incoming.startsWith('/contentpreview-app/')
      ? '/contentpreview-app' + incoming : incoming;
  if (!token || !source.startsWith('/contentpreview/api/media/')) return source;
  const cleanSource = source.split('?')[0];
  return `${cleanSource}?access_token=${encodeURIComponent(token)}`;
}

type MediaVariant = 'thumbnail' | 'display';
type OptimizedMedia = { thumbnail: Blob | null; display: Blob | null };
type VideoConverter = import('@ffmpeg/ffmpeg').FFmpeg;

const videoExtensions = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'mpeg', 'mpg', 'mts', 'm2ts', '3gp', '3g2', 'ogv']);
const directlyPlayableVideoExtensions = new Set(['mp4', 'm4v', 'webm']);
let videoConverterPromise: Promise<VideoConverter> | null = null;
let videoConversionQueue: Promise<unknown> = Promise.resolve();

function fileExtension(name: string) {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

function isVideoFile(file: Pick<File, 'name' | 'type'>) {
  return file.type.startsWith('video/') || videoExtensions.has(fileExtension(file.name));
}

function isVideoAsset(asset: Pick<Asset, 'fileName' | 'mimeType' | 'format'>) {
  // A still cover tagged "Reel" is an image, not an undecodable video.
  if (asset.mimeType.startsWith('image/')) return false;
  return asset.mimeType.startsWith('video/') || videoExtensions.has(fileExtension(asset.fileName)) || asset.format === 'Video' || asset.format === 'Reel';
}

function converterAssetUrl(name: string) {
  return `/contentpreview-app/ffmpeg/${name}`;
}

async function getVideoConverter() {
  if (!videoConverterPromise) {
    videoConverterPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const converter = new FFmpeg();
      let wasmURL = '';
      try {
        const compressed = await fetch(converterAssetUrl('ffmpeg-core.wasm.gz'));
        if (!compressed.ok || !compressed.body || typeof DecompressionStream === 'undefined') throw new Error('Compressed video engine unavailable');
        const stream = compressed.body.pipeThrough(new DecompressionStream('gzip'));
        wasmURL = URL.createObjectURL(new Blob([await new Response(stream).arrayBuffer()], { type: 'application/wasm' }));
      } catch {
        const fallback = await fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm');
        if (!fallback.ok) throw new Error('Video engine unavailable');
        wasmURL = URL.createObjectURL(new Blob([await fallback.arrayBuffer()], { type: 'application/wasm' }));
      }
      await converter.load({
        coreURL: converterAssetUrl('ffmpeg-core.js'),
        wasmURL,
      });
      return converter;
    })().catch((error) => {
      videoConverterPromise = null;
      throw error;
    });
  }
  return videoConverterPromise;
}

async function transcodeVideo(file: File) {
  const converter = await getVideoConverter();
  const token = crypto.randomUUID().replaceAll('-', '');
  const inputName = `input-${token}.${fileExtension(file.name) || 'video'}`;
  const outputName = `output-${token}.mp4`;
  try {
    await converter.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    const result = await converter.exec([
      '-i', inputName,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
      outputName,
    ], 15 * 60 * 1000);
    if (result !== 0) throw new Error('Video conversion failed');
    const output = await converter.readFile(outputName);
    if (typeof output === 'string') throw new Error('Video conversion produced invalid data');
    const bytes = new Uint8Array(output.byteLength); bytes.set(output);
    return new File([bytes], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4', lastModified: file.lastModified });
  } finally {
    await Promise.allSettled([converter.deleteFile(inputName), converter.deleteFile(outputName)]);
  }
}

function normalizeVideo(file: File, force = false) {
  if (!isVideoFile(file) || (!force && directlyPlayableVideoExtensions.has(fileExtension(file.name)))) return Promise.resolve(file);
  const task = videoConversionQueue.then(() => transcodeVideo(file));
  videoConversionQueue = task.then(() => undefined, () => undefined);
  return task;
}

function videoNeedsNormalization(file: File) {
  return isVideoFile(file) && !directlyPlayableVideoExtensions.has(fileExtension(file.name));
}

function mediaVariantUrl(source: string, variant: MediaVariant) {
  if (!source.startsWith('/contentpreview/api/media/')) return '';
  return `${source}${source.includes('?') ? '&' : '?'}variant=${variant}`;
}

function scaledPreviewSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function encodePreview(source: CanvasImageSource, width: number, height: number, maxEdge: number, quality: number) {
  const size = scaledPreviewSize(width, height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width; canvas.height = size.height;
  canvas.getContext('2d', { alpha: true })?.drawImage(source, 0, 0, size.width, size.height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

async function createOptimizedMedia(file: Blob): Promise<OptimizedMedia> {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.decoding = 'async'; image.src = objectUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Image preview failed')); });
      const [thumbnail, display] = await Promise.all([
        encodePreview(image, image.naturalWidth, image.naturalHeight, 900, 0.84),
        encodePreview(image, image.naturalWidth, image.naturalHeight, 1800, 0.9),
      ]);
      return { thumbnail, display };
    }
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Video preview timed out')), 6000);
        video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
        video.onerror = () => { window.clearTimeout(timer); reject(new Error('Video preview failed')); };
        video.load();
      });
      const thumbnail = await encodePreview(video, video.videoWidth, video.videoHeight, 900, 0.84);
      return { thumbnail, display: null };
    }
  } catch { /* The original still uploads if a browser cannot create a preview. */ }
  finally { URL.revokeObjectURL(objectUrl); }
  return { thumbnail: null, display: null };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

type LocalVariantUrls = { thumbnail: string; display: string };
const variantBackfills = new Map<string, Promise<LocalVariantUrls | null>>();
let variantBackfillQueue: Promise<unknown> = Promise.resolve();

function ensureMediaVariants(asset: Asset) {
  const existing = variantBackfills.get(asset.url);
  if (existing) return existing;
  const task = variantBackfillQueue.then(async () => {
    try {
      const original = await fetch(asset.url, { cache: 'force-cache' });
      if (!original.ok) throw new Error('Original media unavailable');
      const optimized = await createOptimizedMedia(await original.blob());
      if (!optimized.thumbnail) throw new Error('Image optimization failed');
      const source = new URL(asset.url, window.location.origin);
      const token = source.searchParams.get('access_token');
      const endpoint = `/contentpreview/api/media/${encodeURIComponent(asset.id)}/preview${token ? `?access_token=${encodeURIComponent(token)}` : ''}`;
      const form = new FormData();
      form.append('thumbnail', optimized.thumbnail, 'thumbnail.webp');
      if (optimized.display) form.append('display', optimized.display, 'display.webp');
      // The optimized local files can render immediately; persistence completes quietly in the background.
      void fetch(endpoint, { method: 'POST', body: form }).catch(() => undefined);
      const thumbnail = URL.createObjectURL(optimized.thumbnail);
      const display = URL.createObjectURL(optimized.display || optimized.thumbnail);
      return { thumbnail, display };
    } catch {
      return null;
    }
  });
  variantBackfillQueue = task.catch(() => undefined);
  variantBackfills.set(asset.url, task);
  // Do not retain every original's decoded derivatives for an entire session.
  if (variantBackfills.size > 40) {
    const oldest = variantBackfills.keys().next().value!;
    const result = variantBackfills.get(oldest);
    variantBackfills.delete(oldest);
    void result?.then((urls) => { if (urls) window.setTimeout(() => { URL.revokeObjectURL(urls.thumbnail); URL.revokeObjectURL(urls.display); }, 60000); });
  }
  return task;
}

type RecoveredVideo = { source: string; poster?: string };
const videoRecoveries = new Map<string, Promise<RecoveredVideo | null>>();

function recoverLegacyVideo(asset: Asset) {
  const existing = videoRecoveries.get(asset.id);
  if (existing) return existing;
  const task = (async () => {
    try {
      const response = await fetch(asset.url, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Video unavailable');
      const original = new File([await response.blob()], asset.fileName || `${asset.name}.mov`, {
        type: asset.mimeType || 'application/octet-stream',
      });
      const converted = await normalizeVideo(original, true);
      const optimized = await createOptimizedMedia(converted);
      const source = new URL(asset.url, window.location.origin);
      const accessToken = source.searchParams.get('access_token');
      const endpoint = `/contentpreview/api/media/${encodeURIComponent(asset.id)}/video${accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : ''}`;
      const form = new FormData(); form.append('file', converted);
      if (optimized.thumbnail) form.append('thumbnail', optimized.thumbnail, 'thumbnail.webp');
      const saved = await fetch(endpoint, { method: 'POST', body: form });
      if (!saved.ok) throw new Error('Converted video could not be saved');
      return {
        source: URL.createObjectURL(converted),
        poster: optimized.thumbnail ? URL.createObjectURL(optimized.thumbnail) : undefined,
      };
    } catch {
      videoRecoveries.delete(asset.id);
      return null;
    }
  })();
  videoRecoveries.set(asset.id, task);
  return task;
}

function readPublishedSnapshot(publication?: Publication, token = '') {
  if (!publication) return null;
  try {
    const parsed = JSON.parse(publication.snapshot) as { positions?: (string | null)[]; assets?: (Asset & { publicPath?: string })[] };
    const positions = emptyFeed();
    (parsed.positions || []).slice(0, FEED_SIZE).forEach((id, index) => { positions[index] = id || null; });
    const assets = (parsed.assets || []).map((asset) => ({
      ...asset,
      slides: Array.isArray(asset.slides) ? asset.slides : [],
      url: mediaUrl(asset, token),
    }));
    return { positions, assets };
  } catch { return null; }
}

const formats = ['Photo', 'Video', 'Reel', 'Carousel', 'Campaign'];
const categories = ['Ysabel Society', 'Asian', 'Italian', 'Bar', 'Events', 'Society', 'Other'];
const statuses = ['Concept', 'Selected', 'Editing', 'Approved', 'Scheduled', 'Published'];
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getBoardCalendar(name?: string) {
  const now = new Date();
  const monthFromName = monthNames.findIndex((month) => (name || '').toLowerCase().includes(month.toLowerCase()));
  const yearFromName = Number((name || '').match(/\b20\d{2}\b/)?.[0]);
  const month = monthFromName >= 0 ? monthFromName : now.getMonth();
  const year = Number.isFinite(yearFromName) && yearFromName > 0 ? yearFromName : now.getFullYear();
  const days = new Date(year, month + 1, 0).getDate();
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Math.ceil((first + days) / 7) * 7;
  const dateForDay = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, days, first, cells, label: `${monthNames[month]} ${year}`, dateForDay };
}
const instagramProfile = {
  username: 'ysabelsociety',
  name: 'Ysabel Society',
  posts: '86',
  followers: '56K',
  following: '144',
  category: '📞 Italian & Asian Restaurant',
  reservations: '038705000 - 048705000',
  location: 'Marriott Hotel - Prishtina',
  website: 'ysabelsociety.com',
};

declare global {
  interface Document {
    modelContext?: {
      registerTool(tool: {
        name: string; title?: string; description: string; inputSchema: object;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        execute(input: unknown): unknown | Promise<unknown>;
      }, options?: { signal?: AbortSignal }): void | Promise<void>;
    };
  }
}

function BrandAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return <span className={'brand-avatar brand-avatar--' + size}><img src="/contentpreview-app/ysabel-instagram-profile.jpg" alt="Ysabel Society official Instagram profile" /></span>;
}

const AssetVisual = memo(function AssetVisual({ asset, contain = false, original = false, defer = false }: { asset: Asset; contain?: boolean; original?: boolean; defer?: boolean }) {
  const { ref, visible } = useMediaVisibility(defer);
  const isVideo = isVideoAsset(asset);
  const isBrand = asset.id.includes('mark') || asset.id.includes('wordmark');
  const [videoSource, setVideoSource] = useState(asset.url);
  const [videoPoster, setVideoPoster] = useState(mediaVariantUrl(asset.url, 'thumbnail') || undefined);
  const [videoRecovering, setVideoRecovering] = useState(false);
  useEffect(() => {
    setVideoSource(asset.url);
    setVideoPoster(mediaVariantUrl(asset.url, 'thumbnail') || undefined);
    setVideoRecovering(false);
  }, [asset.url]);
  const style = original ? {
    objectPosition: 'center',
    transform: 'none',
  } : {
    objectPosition: asset.cropX + '% ' + asset.cropY + '%',
    transform: 'scale(' + asset.cropZoom / 100 + ')',
  };
  if (isVideo) return (
    <span ref={ref} className={'video-visual' + (videoRecovering ? ' is-converting' : '')}>
      {visible && <video
        data-grid-video src={videoSource} poster={videoPoster} muted loop playsInline controls={contain}
        preload={contain ? 'metadata' : 'none'}
        className={'asset-media' + (original ? ' asset-media--original' : '')} style={style}
        onError={() => {
          if (videoRecovering || videoSource !== asset.url || asset.id.startsWith('local-') || !asset.url.startsWith('/contentpreview/api/media/')) return;
          setVideoRecovering(true);
          void recoverLegacyVideo(asset).then((recovered) => {
            if (recovered) { setVideoSource(recovered.source); setVideoPoster(recovered.poster); }
            setVideoRecovering(false);
          });
        }}
      />}
      {videoRecovering && <span className="video-converting"><span />Preparing video</span>}
    </span>
  );
  return (
    <span ref={ref} className={'asset-visual ' + (isBrand ? 'asset-visual--brand ' : '') + (original ? 'asset-visual--original' : '')}>
      {visible && <ProgressiveImage key={asset.url} thumbnail={mediaVariantUrl(asset.url, 'thumbnail') || asset.url}
        display={contain ? mediaVariantUrl(asset.url, 'display') || asset.url : undefined} alt={asset.name} style={style}
        recover={() => asset.url.startsWith('/contentpreview/api/media/') ? ensureMediaVariants(asset) : Promise.resolve(null)} />}
    </span>
  );
});

const CarouselVisual = memo(function CarouselVisual({ asset, assets, contain = false, defer = false }: { asset: Asset; assets: Asset[]; contain?: boolean; defer?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [active, setActive] = useState(0);
  const byId = useMemo(() => new Map(assets.map((item) => [item.id, item])), [assets]);
  const slides = useMemo(() => [asset, ...(asset.slides || []).map((id) => byId.get(id)).filter(Boolean) as Asset[]], [asset, byId]);

  useEffect(() => { if (active >= slides.length) setActive(Math.max(0, slides.length - 1)); }, [active, slides.length]);

  const settle = () => {
    const node = frame.current;
    if (!node?.clientWidth) return;
    const index = Math.max(0, Math.min(slides.length - 1, Math.round(node.scrollLeft / node.clientWidth)));
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  const goTo = (index: number) => {
    const node = frame.current;
    if (!node) return;
    const next = Math.max(0, Math.min(slides.length - 1, index));
    node.scrollTo({ left: next * node.clientWidth, behavior: 'smooth' });
    setActive(next);
  };

  if (asset.format !== 'Carousel' || slides.length < 2) return <AssetVisual asset={asset} contain={contain} defer={defer} />;
  return (
    <span className={'carousel-visual' + (contain ? ' carousel-visual--contain' : '')}>
      <span
        className="carousel-track" ref={frame}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('video')) return;
          // Native touch scrolling preserves inertia and vertical page scrolling.
          if (event.pointerType !== 'mouse') return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.style.scrollSnapType = 'none';
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || current.pointerId !== event.pointerId) return;
          const distance = event.clientX - current.startX;
          if (Math.abs(distance) > 4) { current.moved = true; suppressClick.current = true; }
          if (current.moved) { event.preventDefault(); event.currentTarget.scrollLeft = current.startScroll - distance; }
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null; event.currentTarget.style.scrollSnapType = ''; settle();
          window.setTimeout(() => { suppressClick.current = false; }, 0);
        }}
        onPointerCancel={(event) => { drag.current = null; event.currentTarget.style.scrollSnapType = ''; settle(); }}
        onScroll={(event) => { if (event.currentTarget.clientWidth) setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)); }}
        onClick={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
      >
        {slides.map((slide, index) => <span className="carousel-slide" key={slide.id + '-' + index}>{Math.abs(index - active) <= 1 && <AssetVisual asset={slide} contain={contain && index === active} defer={defer || index !== active} />}</span>)}
      </span>
      {contain && <>
        <button className="carousel-control carousel-control--previous" type="button" aria-label="Previous slide" disabled={active === 0} onClick={(event) => { event.stopPropagation(); goTo(active - 1); }}><ChevronLeft /></button>
        <button className="carousel-control carousel-control--next" type="button" aria-label="Next slide" disabled={active === slides.length - 1} onClick={(event) => { event.stopPropagation(); goTo(active + 1); }}><ChevronRight /></button>
      </>}
      <span className="carousel-position">{active + 1} / {slides.length}</span>
      <span className="carousel-progress" aria-hidden="true"><i style={{ width: `${((active + 1) / slides.length) * 100}%` }} /></span>
    </span>
  );
});

function InlineVideoControl() {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      className="tile-video-control" type="button" aria-label={playing ? 'Pause video in grid' : 'Play video in grid'}
      title={playing ? 'Pause video' : 'Play video'}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault(); event.stopPropagation();
        const video = event.currentTarget.parentElement?.querySelector<HTMLVideoElement>('video[data-grid-video]');
        if (!video) return;
        if (video.paused) void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        else { video.pause(); setPlaying(false); }
      }}
    >{playing ? <Pause /> : <Play fill="currentColor" />}</button>
  );
}

function clearDropHighlight() {
  document.querySelectorAll('.feed-tile-wrap.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
}

function highlightDrop(node: Element | null) {
  const tile = node?.closest('.feed-tile-wrap') || null;
  if (tile?.classList.contains('is-drop-target')) return;
  clearDropHighlight();
  tile?.classList.add('is-drop-target');
}

type FeedGridProps = {
  positions: (string | null)[]; assets: Asset[]; edit: boolean; scale?: 'phone' | 'desktop' | 'large' | 'mini';
  grayscale?: boolean; colorRhythm?: boolean; similarity?: boolean; exchangeFirst: number | null;
  dropTarget?: number | null;
  onTile: (index: number, asset: Asset | null) => void; onDragStart: (source: DragSource) => void;
  onDragEnd: () => void;
  onPointerStart: (source: DragSource, pointer: { pointerId: number; x: number; y: number }) => void;
  onDrop: (index: number) => void; onDelete: (index: number) => void; onCrop: (asset: Asset) => void;
};

function FeedGrid({
  positions, assets, edit, scale = 'phone', grayscale, colorRhythm, similarity, exchangeFirst,
  dropTarget, onTile, onDragStart, onDragEnd, onPointerStart, onDrop, onDelete, onCrop,
}: FeedGridProps) {
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const cropDrag = useRef<{ pointerId: number; index: number; asset: Asset; latest: Asset; startX: number; startY: number; startCropX: number; startCropY: number; width: number; height: number; moved: boolean } | null>(null);
  const suppressTileClick = useRef<number | null>(null);
  const prefetchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(prefetchTimer.current), []);

  const beginCrop = (event: ReactPointerEvent<HTMLButtonElement>, index: number, asset: Asset, isCarousel: boolean) => {
    if (!edit || isCarousel || isVideoAsset(asset)) return;
    // A second finger belongs to native pinch zoom, not a new crop gesture.
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDrag.current = { pointerId: event.pointerId, index, asset, latest: asset, startX: event.clientX, startY: event.clientY, startCropX: asset.cropX, startCropY: asset.cropY, width: rect.width, height: rect.height, moved: false };
  };

  const moveCrop = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = cropDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (!current.moved && Math.hypot(deltaX, deltaY) < 4) return;
    current.moved = true; event.preventDefault();
    current.latest = { ...current.asset, cropX: Math.max(0, Math.min(100, current.startCropX - (deltaX / current.width) * 100)), cropY: Math.max(0, Math.min(100, current.startCropY - (deltaY / current.height) * 100)) };
    // Frame locally during the gesture; commit once on release, not per pixel.
    event.currentTarget.querySelectorAll<HTMLElement>('.asset-media').forEach((image) => {
      image.style.objectPosition = `${current.latest.cropX}% ${current.latest.cropY}%`;
    });
  };

  const endCrop = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = cropDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.moved) {
      if (event.type === 'pointercancel') {
        event.currentTarget.querySelectorAll<HTMLElement>('.asset-media').forEach((image) => { image.style.objectPosition = `${current.asset.cropX}% ${current.asset.cropY}%`; });
      } else onCrop(current.latest);
      suppressTileClick.current = current.index;
      window.setTimeout(() => { if (suppressTileClick.current === current.index) suppressTileClick.current = null; }, 0);
    }
    cropDrag.current = null;
  };

  return (
    <div className={'feed-grid feed-grid--' + scale + (grayscale ? ' is-grayscale' : '')}>
      {positions.slice(0, FEED_SIZE).map((id, index) => {
        const asset = id ? byId.get(id) || null : null;
        const isCarousel = Boolean(asset?.format === 'Carousel' && asset.slides?.length);
        const similar = similarity && index > 0 && id && positions[index - 1] === id;
        return (
          <div className={'feed-tile-wrap' + (dropTarget === index ? ' is-drop-target' : '')} key={index} data-feed-index={index}>
            <button
              className={'feed-tile ' + (asset ? 'feed-tile--filled' : 'feed-tile--empty') + (edit && asset && !isCarousel && !isVideoAsset(asset) ? ' is-crop-editable' : '') + (exchangeFirst === index ? ' is-exchange-selected' : '')}
              type="button"
              onPointerDown={(event) => { if (asset) beginCrop(event, index, asset, isCarousel); }}
              onPointerMove={moveCrop}
              onPointerUp={endCrop}
              onPointerCancel={endCrop}
              onPointerEnter={() => { if (!edit && asset && !isVideoAsset(asset)) { const source = mediaVariantUrl(asset.url, 'display'); if (source) prefetchTimer.current = window.setTimeout(() => { void loadPreview(source, true).catch(() => undefined); }, 180); } }}
              onPointerLeave={() => window.clearTimeout(prefetchTimer.current)}
              onDragOver={(event) => { if (edit) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; highlightDrop(event.currentTarget); } }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDropHighlight(); }}
              onDrop={(event) => { event.preventDefault(); clearDropHighlight(); if (edit) onDrop(index); }}
              onClick={() => { if (suppressTileClick.current === index) { suppressTileClick.current = null; return; } onTile(index, asset); }}
              aria-label={asset ? 'Open position ' + (index + 1) + ': ' + asset.name : 'Add media to position ' + (index + 1)}
            >
              {asset ? <CarouselVisual key={asset.id} asset={asset} assets={assets} defer={index >= 6} /> : <span className="empty-add"><Plus /><small>Add media</small></span>}
              {edit && <span className="position-number">{String(index + 1).padStart(2, '0')}</span>}
              {asset && isVideoAsset(asset) && <Video className="video-mark" />}
              {similar && <span className="similarity-note">Similar composition</span>}
              {edit && asset && !isCarousel && !isVideoAsset(asset) && <span className="crop-drag-hint"><Move />Drag image to frame</span>}
            </button>
            {asset && isVideoAsset(asset) && <InlineVideoControl />}
            {edit && asset && <button className="tile-drag-handle" type="button" draggable aria-label={'Drag post at position ' + (index + 1) + ' to swap it'} title="Drag directly to swap" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); onDragStart({ type: 'grid', index }); }} onDragEnd={onDragEnd} onPointerDown={(event) => { event.stopPropagation(); if (event.pointerType === 'touch') { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onPointerStart({ type: 'grid', index }, { pointerId: event.pointerId, x: event.clientX, y: event.clientY }); } }}><Grid3X3 /></button>}
            {edit && asset && <button className="tile-delete" type="button" aria-label={'Remove position ' + (index + 1)} title="Remove from feed" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(index); }}><Trash2 /></button>}
            {colorRhythm && asset && <div className="tile-palette">{asset.palette.split(',').map((color) => <i key={color} style={{ background: color }} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ProfileContent({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'profile-block profile-block--compact' : 'profile-block'}>
      <div className="profile-line">
        <BrandAvatar size={compact ? 'lg' : 'xl'} />
        <div className="profile-stats">
          <span><strong>{instagramProfile.posts}</strong><small>posts</small></span>
          <span><strong>{instagramProfile.followers}</strong><small>followers</small></span>
          <span><strong>{instagramProfile.following}</strong><small>following</small></span>
        </div>
      </div>
      <div className="profile-copy">
        <strong>{instagramProfile.name}</strong><span>{instagramProfile.category}</span>
        <p>Reservations: {instagramProfile.reservations}<br />📍 {instagramProfile.location}</p>
        <b className="profile-link">{instagramProfile.website}</b>
      </div>
      <div className="profile-actions"><button>Edit profile</button><button>Share profile</button><button>+</button></div>
    </section>
  );
}

function MobilePreview(props: FeedGridProps) {
  return (
    <div className="phone-wrap">
      <div className="device">
        <div className="instagram-screen">
          <div className="status-bar"><span>9:41</span><span className="island" /><span>5G&nbsp; ◒</span></div>
          <header className="ig-mobile-header"><span className="ig-user">{instagramProfile.username}</span><ChevronDown /><span className="header-spacer" /><MoreHorizontal /></header>
          <ProfileContent compact />
          <nav className="ig-tabs" aria-label="Profile content"><Grid3X3 /><Play /><Images /></nav>
          <FeedGrid {...props} scale="phone" colorRhythm={false} />
        </div>
      </div>
      <p className="device-label"><ChevronDown />Scroll inside the phone to see all 15 posts</p>
    </div>
  );
}

function DesktopPreview(props: FeedGridProps) {
  const nav = [Home, Search, Compass, Play, MessageCircle, Heart, Plus, UserRound];
  return (
    <div className="desktop-instagram">
      <aside className="desktop-ig-nav">
        <span className="ig-script">Instagram</span>
        {nav.map((Icon, i) => <button key={i} aria-label={'Instagram navigation ' + (i + 1)}><Icon /><span>{['Home','Search','Explore','Reels','Messages','Notifications','Create','Profile'][i]}</span></button>)}
        <button className="ig-more"><Menu /><span>More</span></button>
      </aside>
      <div className="desktop-ig-main">
        <div className="desktop-profile">
          <BrandAvatar size="xl" />
          <div>
            <div className="desktop-profile-title"><strong>{instagramProfile.username}</strong><button>Edit profile</button><button>View archive</button><MoreHorizontal /></div>
            <div className="desktop-stats"><span><strong>{instagramProfile.posts}</strong> posts</span><span><strong>{instagramProfile.followers}</strong> followers</span><span><strong>{instagramProfile.following}</strong> following</span></div>
            <div className="desktop-bio"><strong>{instagramProfile.name}</strong><span>{instagramProfile.category}</span><p>Reservations: {instagramProfile.reservations}<br />📍 {instagramProfile.location}</p><b>{instagramProfile.website}</b></div>
          </div>
        </div>
        <div className="desktop-tabs"><span><Grid3X3 />Posts</span><span><Play />Reels</span><span><Images />Tagged</span></div>
        <FeedGrid {...props} scale="desktop" colorRhythm={false} />
      </div>
    </div>
  );
}

function GridPreview(props: FeedGridProps) {
  return <div className="grid-only"><div className="grid-only-title"><span>September direction</span><small>3 columns · 15 positions</small></div><FeedGrid {...props} scale="large" /></div>;
}

function CarouselEditor({ asset, assets, onChange, onAddSlides }: {
  asset: Asset; assets: Asset[]; onChange: (asset: Asset) => void; onAddSlides: () => void;
}) {
  const slideIds = asset.slides || [];
  const slideAssets = slideIds.map((id) => assets.find((item) => item.id === id)).filter(Boolean) as Asset[];
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<string[]>([]);
  const pointer = useRef<{ pointerId: number; index: number; startX: number; startY: number; active: boolean } | null>(null);
  const remainingCapacity = Math.max(0, 39 - slideIds.length);
  const availableLibraryAssets = assets.filter((item) => item.id !== asset.id && !slideIds.includes(item.id) && !item.archived);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= slideIds.length || to >= slideIds.length) return;
    const next = [...slideIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...asset, format: 'Carousel', slides: next });
  };

  const toggleLibraryAsset = (id: string) => {
    setLibrarySelection((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < remainingCapacity ? [...current, id] : current);
  };

  const addLibrarySlides = () => {
    if (!librarySelection.length) return;
    onChange({ ...asset, format: 'Carousel', slides: [...slideIds, ...librarySelection].slice(0, 39) });
    setLibrarySelection([]); setLibraryOpen(false);
  };

  useEffect(() => {
    const targetAt = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-carousel-slide-index]');
      return element ? Number(element.dataset.carouselSlideIndex) : null;
    };
    const move = (event: PointerEvent) => {
      const current = pointer.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 7) return;
      current.active = true; event.preventDefault(); setDragIndex(current.index); setDropIndex(targetAt(event.clientX, event.clientY));
    };
    const end = (event: PointerEvent) => {
      const current = pointer.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const target = targetAt(event.clientX, event.clientY);
      if (current.active && target !== null) reorder(current.index, target);
      pointer.current = null; setDragIndex(null); setDropIndex(null);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, [slideIds, asset]);

  return <div className="carousel-editor">
    <div className="carousel-editor-heading"><span>Slides</span><strong>{1 + slideIds.length} / 40</strong></div>
    <div className="carousel-editor-strip">
      <span className="carousel-editor-cover" title="Cover image"><AssetVisual asset={asset} /><i>01 · Cover</i></span>
      {slideAssets.map((slide, index) => <span
        key={slide.id + '-' + index} draggable data-carousel-slide-index={index}
        className={'carousel-editor-slide ' + (dragIndex === index ? 'dragging ' : '') + (dropIndex === index ? 'drop-target' : '')}
        title="Drag to change the slide order"
        onDragStart={() => { setDragIndex(index); setDropIndex(index); }}
        onDragOver={(event) => { event.preventDefault(); setDropIndex(index); }}
        onDrop={(event) => { event.preventDefault(); if (dragIndex !== null) reorder(dragIndex, index); setDragIndex(null); setDropIndex(null); }}
        onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
        onPointerDown={(event) => { if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest('button')) return; pointer.current = { pointerId: event.pointerId, index, startX: event.clientX, startY: event.clientY, active: false }; }}
      ><AssetVisual asset={slide} /><i>{String(index + 2).padStart(2, '0')}</i><button type="button" aria-label={'Remove ' + slide.name + ' from carousel'} onClick={() => onChange({ ...asset, slides: slideIds.filter((_, itemIndex) => itemIndex !== index) })}><X /></button></span>)}
      {slideIds.length < 39 && <button type="button" className="carousel-add-tile" onClick={() => { setLibrarySelection([]); setLibraryOpen(true); }}><Images /><span>Library</span></button>}
    </div>
    <div className="carousel-add-actions">
      <Button type="button" variant="outline" onClick={() => { setLibrarySelection([]); setLibraryOpen(true); }} disabled={slideIds.length >= 39}><Images />Media Library</Button>
      <Button type="button" variant="outline" onClick={onAddSlides} disabled={slideIds.length >= 39}><Upload />Upload files</Button>
    </div>
    <p>Select several library assets or upload several files together. They become slides in this post in one action.</p>
    <Dialog open={libraryOpen} onOpenChange={(open) => { setLibraryOpen(open); if (!open) setLibrarySelection([]); }}>
      <DialogContent className="carousel-library-dialog">
        <DialogHeader><DialogTitle>Add slides from Media Library</DialogTitle><DialogDescription>Select multiple existing assets, then add them together to this post.</DialogDescription></DialogHeader>
        <div className="carousel-library-meta"><span>{librarySelection.length} selected</span><span>{remainingCapacity} spaces available</span></div>
        <div className="carousel-library-grid">{availableLibraryAssets.length ? availableLibraryAssets.map((item) => {
          const selected = librarySelection.includes(item.id);
          return <button key={item.id} type="button" className={selected ? 'selected' : ''} onClick={() => toggleLibraryAsset(item.id)} aria-pressed={selected}>
            <span className="carousel-library-thumb"><AssetVisual asset={item} />{selected && <i><Check /></i>}</span>
            <span><strong>{item.name}</strong><small>{item.format} · {item.category}</small></span>
          </button>;
        }) : <div className="carousel-library-empty"><Images /><p>No additional Media Library assets are available for this post.</p></div>}</div>
        <DialogFooter><Button variant="outline" onClick={() => setLibraryOpen(false)}>Cancel</Button><Button onClick={addLibrarySlides} disabled={!librarySelection.length}>Add {librarySelection.length || ''} slide{librarySelection.length === 1 ? '' : 's'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Inspector({ asset, assets, onChange, onClose, onRemove, onDuplicate, onReplace, onAddSlides }: {
  asset: Asset | null; assets: Asset[]; onChange: (asset: Asset) => void; onClose: () => void; onRemove: () => void;
  onDuplicate: () => void; onReplace: () => void; onAddSlides: () => void;
}) {
  if (!asset) return null;
  const update = (field: keyof Asset, value: Asset[keyof Asset]) => onChange({ ...asset, [field]: value });
  return (
    <Sheet open={Boolean(asset)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="inspector-sheet" showCloseButton>
        <SheetHeader className="inspector-header">
          <p className="panel-kicker">Content details</p><SheetTitle>{asset.name}</SheetTitle>
          <SheetDescription>{asset.fileName} · {asset.fileSize ? Math.max(0.1, asset.fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Seed media'}</SheetDescription>
        </SheetHeader>
        <div className="inspector-scroll">
          <div className="inspector-preview"><CarouselVisual key={asset.id} asset={asset} assets={assets} contain /></div>
          <label>Internal content name<Input value={asset.name} onChange={(e) => update('name', e.target.value)} /></label>
          <div className="inspector-two">
            <label>Format<Select value={asset.format} onValueChange={(value) => update('format', String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{formats.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
            <label>Category<Select value={asset.category} onValueChange={(value) => update('category', String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
          </div>
          <div className="inspector-two">
            <label>Status<Select value={asset.status} onValueChange={(value) => update('status', String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
            <label>Planned date<Input type="date" value={asset.plannedDate || ''} onChange={(e) => update('plannedDate', e.target.value)} /></label>
          </div>
          <CarouselEditor asset={asset} assets={assets} onChange={onChange} onAddSlides={onAddSlides} />
          <label>Caption<Textarea value={asset.caption} onChange={(e) => update('caption', e.target.value)} placeholder="Write the future caption…" /></label>
          <label>Internal notes<Textarea value={asset.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Art direction notes…" /></label>
          <div className="crop-section">
            <div className="crop-heading"><span>Framing</span><button onClick={() => onChange({ ...asset, cropZoom: 100, cropX: 50, cropY: 50 })}><RotateCcw />Reset</button></div>
            <label>Zoom <strong>{asset.cropZoom}%</strong><Slider min={100} max={180} value={[asset.cropZoom]} onValueChange={(value) => update('cropZoom', Number(Array.isArray(value) ? value[0] : value))} /></label>
            <label>Horizontal <strong>{asset.cropX}</strong><Slider min={0} max={100} value={[asset.cropX]} onValueChange={(value) => update('cropX', Number(Array.isArray(value) ? value[0] : value))} /></label>
            <label>Vertical <strong>{asset.cropY}</strong><Slider min={0} max={100} value={[asset.cropY]} onValueChange={(value) => update('cropY', Number(Array.isArray(value) ? value[0] : value))} /></label>
          </div>
          <div className="inspector-actions"><Button variant="outline" onClick={onReplace}><Upload />Replace</Button><Button variant="outline" onClick={onDuplicate}><Copy />Duplicate</Button><Button variant="destructive" onClick={onRemove}><Trash2 />Remove from feed</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function YsabelWorkspace() {
  const [authState, setAuthState] = useState<'checking' | 'login' | 'ready'>('checking');
  const [authToken, setAuthToken] = useState('');
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginFocused, setLoginFocused] = useState(false);
  const [loginEntering, setLoginEntering] = useState(false);
  const loginRequestInFlight = useRef(false);
  useEffect(() => {
    if (!loginEntering) return;
    if (authState === 'login') { setLoginEntering(false); return; }
    if (!workspaceReady) return;
    const finish = () => setLoginEntering(false);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(finish, reduced || document.hidden ? 0 : LOGIN_SCENE.entry.durationMs);
    const visibility = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [loginEntering, workspaceReady, authState]);
  const [view, setView] = useState<ViewMode>('mobile');
  const [section, setSection] = useState<Section>('feed');
  const [edit, setEdit] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [artDirection, setArtDirection] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [colorRhythm, setColorRhythm] = useState(false);
  const [similarity, setSimilarity] = useState(true);
  const [rearrangeMode, setRearrangeMode] = useState<RearrangeMode>('swap');
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeFirst, setExchangeFirst] = useState<number | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState('board-september-2026');
  const [feeds, setFeeds] = useState<Record<string, (string | null)[]>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [captionStore, setCaptionStore] = useState<CommunityCaptionStore>({});
  const [captionActionMessage, setCaptionActionMessage] = useState('');
  const [selectedCaptionIds, setSelectedCaptionIds] = useState<string[]>([]);
  const [selectedNoteDate, setSelectedNoteDate] = useState('month');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'Saved' | 'Saving…' | 'Not saved — check connection'>('Saved');
  const [mediaProcessing, setMediaProcessing] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const dragSource = useRef<DragSource | null>(null);
  const [libraryDockOpen, setLibraryDockOpen] = useState(false);
  const [libraryDockSize, setLibraryDockSize] = useState({ width: 326, height: 520 });
  const [libraryPreviewMode, setLibraryPreviewMode] = useState<'original' | 'portrait'>('original');
  const [history, setHistory] = useState<(string | null)[][]>([]);
  const [future, setFuture] = useState<(string | null)[][]>([]);
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [mediaSelectMode, setMediaSelectMode] = useState(false);
  const [mediaSelection, setMediaSelection] = useState<string[]>([]);
  const [mediaDeleteIds, setMediaDeleteIds] = useState<string[]>([]);
  const [mediaDeleteBusy, setMediaDeleteBusy] = useState(false);
  const [mediaDeleteError, setMediaDeleteError] = useState('');
  const [autoPreview, setAutoPreview] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoIndex, setAutoIndex] = useState(0);
  const [autoTiming, setAutoTiming] = useState(4);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('September — Direction B');
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState('September — Approved');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const carouselInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const noteSaveTimer = useRef<number | null>(null);
  const assetSaveTimers = useRef(new Map<string, number>());
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const pendingNoteDate = useRef<string | null>(null);
  const pointerDrag = useRef<{ source: DragSource; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const captionActionTimer = useRef<number | null>(null);
  const dockResize = useRef<{ node: HTMLElement; pointerId: number; startX: number; startY: number; startWidth: number; startHeight: number; maxWidth: number; maxHeight: number; nextWidth: number; nextHeight: number } | null>(null);
  const dockResizeFrame = useRef<number | null>(null);
  const positions = feeds[activeBoardId] || emptyFeed();
  const activeBoard = boards.find((board) => board.id === activeBoardId) || boards[0];
  const selectedAsset = assets.find((asset) => asset.id === selectedId) || null;
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const activePublication = publications.find((publication) => publication.boardId === activeBoardId);
  const publishedSnapshot = useMemo(() => readPublishedSnapshot(activePublication, authToken), [activePublication, authToken]);
  const displayPositions = edit ? positions : (publishedSnapshot?.positions || positions);
  const displayAssets = edit ? assets : (publishedSnapshot?.assets || assets);
  const displayById = useMemo(() => new Map(displayAssets.map((asset) => [asset.id, asset])), [displayAssets]);
  const postAsset = displayAssets.find((asset) => asset.id === postId) || null;
  const used = useMemo(() => new Set(Object.values(feeds).flat().filter(Boolean)), [feeds]);
  const calendar = useMemo(() => getBoardCalendar(activeBoard?.name), [activeBoard?.name]);
  const activeNotes = useMemo(() => notes.filter((note) => note.boardId === activeBoardId), [notes, activeBoardId]);
  const savedNotes = useMemo(() => notes.filter((note) => note.body.trim()).sort((left, right) => right.updatedAt - left.updatedAt), [notes]);
  const noteBody = activeNotes.find((note) => note.noteDate === selectedNoteDate)?.body || '';

  const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (authToken) headers.set('authorization', `Bearer ${authToken}`);
    return fetch(input, { ...init, headers });
  };

  useEffect(() => {
    let storedToken = '';
    try { storedToken = window.sessionStorage.getItem('ysabel_session_token') || ''; }
    catch { /* Some mobile browsers restrict framed storage; in-memory login still works. */ }
    if (storedToken) setAuthToken(storedToken);
    const headers = new Headers();
    if (storedToken) headers.set('authorization', `Bearer ${storedToken}`);
    fetch('/contentpreview/api/auth/session', { cache: 'no-store', headers })
      .then((response) => response.ok ? response.json() as Promise<{ authenticated: boolean }> : Promise.reject())
      .then((data) => setAuthState(data.authenticated ? 'ready' : 'login'))
      .catch(() => setAuthState('login'));
  }, []);

  useEffect(() => {
    if (authState !== 'ready') return;
    let cancelled = false;
    setWorkspaceReady(false);
    authFetch('/contentpreview/api/workspace', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<WorkspaceData> : Promise.reject()).then((data) => {
      if (cancelled) return;
      const nextBoards = Array.isArray(data.boards) ? data.boards : [];
      const nextAssets = Array.isArray(data.media) ? data.media.map((asset) => ({ ...asset, slides: Array.isArray(asset.slides) ? asset.slides : [], url: mediaUrl(asset, authToken) })) : [];
      setBoards(nextBoards);
      setAssets(nextAssets);
      setActiveBoardId((current) => nextBoards.some((board) => board.id === current) ? current : (nextBoards[0]?.id || current));
      if (Array.isArray(data.positions)) {
        const next: Record<string, (string | null)[]> = {};
        for (const board of nextBoards) next[board.id] = emptyFeed();
        for (const item of data.positions) { if (!next[item.boardId]) next[item.boardId] = emptyFeed(); if (item.position < FEED_SIZE) next[item.boardId][item.position] = item.mediaId; }
        setFeeds(next);
      } else setFeeds({});
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setPublications(Array.isArray(data.publications) ? data.publications : []);
      try {
        const raw = JSON.parse(window.localStorage.getItem(COMMUNITY_CAPTION_STORAGE_KEY) || '{}') as unknown;
        const nextBoards = Array.isArray(data.boards) ? data.boards : [];
        setCaptionStore(mergeCaptionStore(raw, nextBoards.map((board) => board.id)));
      } catch {
        setCaptionStore((current) => current);
      }
      setWorkspaceReady(true);
    }).catch(() => {
      if (!cancelled) { setWorkspaceReady(false); setAuthState('login'); }
    });
    return () => { cancelled = true; };
  }, [authState, authToken]);

  useEffect(() => { setSelectedNoteDate(pendingNoteDate.current || 'month'); pendingNoteDate.current = null; }, [activeBoardId]);

  useEffect(() => {
    if (!workspaceReady) return;
    try { window.localStorage.setItem(COMMUNITY_CAPTION_STORAGE_KEY, JSON.stringify(captionStore)); } catch { /* localStorage can be restricted in some browser modes. */ }
  }, [captionStore, workspaceReady]);

  useEffect(() => {
    setSelectedCaptionIds([]);
  }, [activeBoardId, section]);

  useEffect(() => () => {
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
    if (captionActionTimer.current) {
      window.clearTimeout(captionActionTimer.current);
      captionActionTimer.current = null;
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('ysabel_library_dock') || '{}') as { width?: number; height?: number; preview?: string };
      if (Number.isFinite(saved.width) && Number.isFinite(saved.height)) setLibraryDockSize({ width: Number(saved.width), height: Number(saved.height) });
      if (saved.preview === 'portrait' || saved.preview === 'original') setLibraryPreviewMode(saved.preview);
    } catch { /* The default dock size remains available when storage is restricted. */ }
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = dockResize.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      current.nextWidth = Math.round(Math.min(current.maxWidth, Math.max(250, current.startWidth + event.clientX - current.startX)));
      current.nextHeight = Math.round(Math.min(current.maxHeight, Math.max(300, current.startHeight + event.clientY - current.startY)));
      if (dockResizeFrame.current) return;
      dockResizeFrame.current = window.requestAnimationFrame(() => {
        const latest = dockResize.current;
        if (latest) { latest.node.style.width = `${latest.nextWidth}px`; latest.node.style.height = `${latest.nextHeight}px`; }
        dockResizeFrame.current = null;
      });
    };
    const end = (event: PointerEvent) => {
      const current = dockResize.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const size = { width: current.nextWidth, height: current.nextHeight };
      setLibraryDockSize(size); dockResize.current = null;
      try { window.localStorage.setItem('ysabel_library_dock', JSON.stringify({ ...size, preview: libraryPreviewMode })); } catch { /* no-op */ }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (dockResizeFrame.current) window.cancelAnimationFrame(dockResizeFrame.current);
    };
  }, [libraryPreviewMode]);

  useEffect(() => {
    if (!autoPreview || !autoPlaying) return;
    const timer = window.setInterval(() => setAutoIndex((index) => (index + 1) % Math.max(1, displayPositions.filter(Boolean).length)), autoTiming * 1000);
    return () => window.clearInterval(timer);
  }, [autoPreview, autoPlaying, autoTiming, displayPositions]);

  const persist = (payload: Record<string, unknown>) => {
    const revision = ++saveRevision.current;
    setSaveState('Saving…');
    // Preserve gesture order even if the connection completes requests out of order.
    const saved = persistenceQueue.current.catch(() => undefined).then(async () => {
      const response = await authFetch('/contentpreview/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.status === 401) setAuthState('login');
      if (!response.ok) throw new Error('Save failed');
    });
    persistenceQueue.current = saved;
    void saved.then(() => {
      if (revision === saveRevision.current && !assetSaveTimers.current.size) setSaveState('Saved');
    }).catch(() => setSaveState('Not saved — check connection'));
    return saved;
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authState !== 'login' || loginEntering || loginRequestInFlight.current) return;
    loginRequestInFlight.current = true;
    setLoginBusy(true); setLoginError('');
    try {
      const response = await fetch('/contentpreview/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!response.ok) { setLoginError('The username or password is incorrect.'); return; }
      const data = await response.json() as { authenticated?: boolean; token?: string };
      if (data.authenticated !== true || typeof data.token !== 'string' || !data.token) throw new Error('Invalid sign-in response');
      const token = data.token;
      setAuthToken(token);
      try { if (token) window.sessionStorage.setItem('ysabel_session_token', token); }
      catch { /* The active page keeps the token in memory when framed storage is unavailable. */ }
      setLoginPassword(''); setLoginEntering(true); setAuthState('ready');
    } catch { setLoginError('Sign in is temporarily unavailable. Please try again.'); }
    finally { loginRequestInFlight.current = false; setLoginBusy(false); }
  };

  const logout = async () => {
    assetSaveTimers.current.forEach((timer) => window.clearTimeout(timer));
    assetSaveTimers.current.clear();
    await authFetch('/contentpreview/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuthToken('');
    try { window.sessionStorage.removeItem('ysabel_session_token'); } catch { /* no-op */ }
    setLoginPassword(''); setLoginError(''); setLoginFocused(false); setLoginEntering(false); setWorkspaceReady(false); setAuthState('login'); setPresentation(false);
    setAssets([]); setBoards([]); setFeeds({}); setVersions([]); setNotes([]); setPublications([]);
  };

  const updateNote = (body: string) => {
    const updatedAt = Date.now();
    setNotes((current) => {
      const exists = current.some((note) => note.boardId === activeBoardId && note.noteDate === selectedNoteDate);
      if (!exists) return [...current, { boardId: activeBoardId, noteDate: selectedNoteDate, body, updatedAt }];
      return current.map((note) => note.boardId === activeBoardId && note.noteDate === selectedNoteDate ? { ...note, body, updatedAt } : note);
    });
    setSaveState('Saving…');
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = window.setTimeout(() => persist({ action: 'save-note', boardId: activeBoardId, noteDate: selectedNoteDate, body }), 500);
  };

  const deleteNote = (boardId: string, noteDate: string) => {
    if (boardId === activeBoardId && noteDate === selectedNoteDate && noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
    setNotes((current) => current.filter((note) => !(note.boardId === boardId && note.noteDate === noteDate)));
    persist({ action: 'delete-note', boardId, noteDate });
  };

  const setCaptionPoolForBoard = (boardId: string, next: (pool: CaptionPool) => CaptionPool) => {
    setCaptionStore((current) => {
      const base = current[boardId] || DEFAULT_CAPTION_POOL;
      const updated = next(cloneCaptionPool(base));
      return { ...current, [boardId]: cloneCaptionPool(updated) };
    });
  };

  const publishCaptionMessage = (message: string) => {
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    setCaptionActionMessage(message);
    captionActionTimer.current = window.setTimeout(() => setCaptionActionMessage(''), 1400);
  };

  const clearCaptionSelection = () => setSelectedCaptionIds([]);

  const toggleCaptionSelection = (captionId: string) => {
    setSelectedCaptionIds((current) => (current.includes(captionId) ? current.filter((id) => id !== captionId) : [...current, captionId]));
  };

  const selectCaptionSet = (captions: CommunityCaption[]) => {
    setSelectedCaptionIds((current) => {
      const next = new Set(current);
      captions.forEach((caption) => next.add(caption.id));
      return [...next];
    });
  };

  const deselectCaptionSet = (captions: CommunityCaption[]) => {
    const ids = new Set(captions.map((caption) => caption.id));
    setSelectedCaptionIds((current) => current.filter((id) => !ids.has(id)));
  };

  const useCaption = (captionId: string) => {
    if (!activeBoardId) return;
    setCaptionPoolForBoard(activeBoardId, (pool) => moveCaptionBetweenPools(pool, captionId, 'used'));
    clearCaptionSelection();
    setCaptionActionMessage('');
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    publishCaptionMessage('Caption moved to used');
  };

  const removeUsedCaption = (captionId: string) => {
    if (!activeBoardId) return;
    setCaptionPoolForBoard(activeBoardId, (pool) => moveCaptionBetweenPools(pool, captionId, 'available'));
    clearCaptionSelection();
    setCaptionActionMessage('');
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    publishCaptionMessage('Caption returned to available');
  };

  const removeAllUsedCaptions = () => {
    if (!activeBoardId) return;
    setCaptionStore((current) => {
      const base = current[activeBoardId] || DEFAULT_CAPTION_POOL;
      const available = dedupeOrdered([...base.available, ...base.used]);
      return { ...current, [activeBoardId]: { available, used: [] } };
    });
    clearCaptionSelection();
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    publishCaptionMessage('All used captions returned to available');
  };

  const deleteCaption = (captionId: string) => {
    if (!activeBoardId) return;
    setCaptionStore((current) => {
      const base = current[activeBoardId] || DEFAULT_CAPTION_POOL;
      const pool = {
        available: base.available.filter((id) => id !== captionId),
        used: base.used.filter((id) => id !== captionId),
      };
      return { ...current, [activeBoardId]: pool };
    });
    setSelectedCaptionIds((current) => current.filter((id) => id !== captionId));
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    publishCaptionMessage('Caption removed from this board');
  };

  const deleteAllCaptions = () => {
    if (!activeBoardId) return;
    setCaptionStore((current) => ({ ...current, [activeBoardId]: { available: [], used: [] } }));
    clearCaptionSelection();
    if (captionActionTimer.current) window.clearTimeout(captionActionTimer.current);
    publishCaptionMessage('All captions cleared for this board');
  };

  const deleteSelectedCaptions = () => {
    if (!activeBoardId || selectedCaptionIds.length === 0) return;
    const removeSet = new Set(selectedCaptionIds);
    setCaptionStore((current) => {
      const base = current[activeBoardId] || DEFAULT_CAPTION_POOL;
      return {
        ...current,
        [activeBoardId]: {
          available: base.available.filter((id) => !removeSet.has(id)),
          used: base.used.filter((id) => !removeSet.has(id)),
        },
      };
    });
    const count = selectedCaptionIds.length;
    clearCaptionSelection();
    publishCaptionMessage(`${count} caption${count === 1 ? '' : 's'} removed`);
  };

  const copyCaption = async (captionId: string) => {
    const caption = COMMUNITY_CAPTION_BY_ID.get(captionId)?.text;
    if (!caption) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(caption);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = caption;
        textarea.style.position = 'fixed';
        textarea.style.left = '-99999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      publishCaptionMessage('Caption copied');
    } catch {
      publishCaptionMessage('Copy failed');
    }
  };

  const openSavedNote = (note: CalendarNote) => {
    if (note.boardId !== activeBoardId) { pendingNoteDate.current = note.noteDate; setActiveBoardId(note.boardId); }
    else setSelectedNoteDate(note.noteDate);
    setSection('notes');
  };

  const commitFeed = (next: (string | null)[]) => {
    setHistory((past) => [...past.slice(-29), positions]);
    setFuture([]);
    setFeeds((current) => ({ ...current, [activeBoardId]: next }));
    persist({ action: 'save', boardId: activeBoardId, positions: next });
  };

  const moveFeed = (from: number, to: number, mode = rearrangeMode) => {
    if (from === to || from < 0 || to < 0 || from >= FEED_SIZE || to >= FEED_SIZE) return;
    const next = [...positions];
    if (mode === 'swap') [next[from], next[to]] = [next[to], next[from]];
    else { const [item] = next.splice(from, 1); next.splice(to, 0, item); next.splice(FEED_SIZE); }
    commitFeed(next);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const report = () => undefined;
    const registrations = [
      context.registerTool({
        name: 'set_feed_view', title: 'Set feed view', description: 'Switch the visible Ysabel feed between mobile, desktop, and grid views.',
        inputSchema: { type: 'object', properties: { view: { type: 'string', enum: ['mobile', 'desktop', 'grid'] } }, required: ['view'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { const value = (input as { view?: string }).view; if (!['mobile','desktop','grid'].includes(String(value))) throw new Error('Invalid view'); setView(value as ViewMode); setSection('feed'); return { view: value }; },
      }, { signal: lifecycle.signal }),
      context.registerTool({
        name: 'rearrange_feed', title: 'Rearrange feed', description: 'Move or swap one 1-based position with another in the active 15-position feed.',
        inputSchema: { type: 'object', properties: { fromPosition: { type: 'integer', minimum: 1, maximum: FEED_SIZE }, toPosition: { type: 'integer', minimum: 1, maximum: FEED_SIZE }, behavior: { type: 'string', enum: ['swap', 'insert'] } }, required: ['fromPosition','toPosition'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { const value = input as { fromPosition: number; toPosition: number; behavior?: RearrangeMode }; if (!Number.isInteger(value.fromPosition) || !Number.isInteger(value.toPosition)) throw new Error('Positions must be integers'); moveFeed(value.fromPosition - 1, value.toPosition - 1, value.behavior || 'swap'); return { moved: true, fromPosition: value.fromPosition, toPosition: value.toPosition, behavior: value.behavior || 'swap' }; },
      }, { signal: lifecycle.signal }),
    ];
    registrations.forEach((item) => void Promise.resolve(item).catch(report));
    return () => lifecycle.abort();
  }, [activeBoardId, positions, rearrangeMode]);

  const onTile = (index: number, asset: Asset | null) => {
    if (!asset) { if (edit) setLibraryDockOpen(true); return; }
    if (edit) {
      if (exchangeMode) {
        if (exchangeFirst === null) setExchangeFirst(index);
        else { moveFeed(exchangeFirst, index, 'swap'); setExchangeFirst(null); }
      } else setSelectedId(asset.id);
    } else setPostId(asset.id);
  };

  const applyDrop = (source: DragSource, target: number) => {
    if (source.type === 'grid' && typeof source.index === 'number') moveFeed(source.index, target);
    if (source.type === 'library' && source.id) {
      const targetAsset = positions[target] ? byId.get(String(positions[target])) : null;
      if (targetAsset?.format === 'Carousel') {
        const slides = targetAsset.slides || [];
        if (source.id !== targetAsset.id && !slides.includes(source.id) && slides.length < 39) {
          const updated = { ...targetAsset, slides: [...slides, source.id] };
          setAssets((current) => current.map((item) => item.id === updated.id ? updated : item));
          persist({ action: 'save', boardId: activeBoardId, asset: updated });
        }
        return;
      }
      const next = [...positions]; next[target] = source.id; commitFeed(next);
    }
  };

  const onDrop = (target: number) => {
    if (!edit || !dragSource.current) return;
    applyDrop(dragSource.current, target);
    endMediaDrag();
  };

  const startMediaDrag = (source: DragSource) => { dragSource.current = source; };
  const endMediaDrag = () => { dragSource.current = null; clearDropHighlight(); };

  const removePosition = (index: number) => {
    if (!positions[index]) return;
    const removedId = positions[index];
    const next = [...positions]; next[index] = null;
    if (selectedId === removedId) setSelectedId(null);
    commitFeed(next);
  };

  const beginPointerDrag = (source: DragSource, pointer: { pointerId: number; x: number; y: number }) => {
    pointerDrag.current = { source, pointerId: pointer.pointerId, startX: pointer.x, startY: pointer.y, active: false };
  };

  const beginDockResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dock = event.currentTarget.closest<HTMLElement>('.library-dock');
    const parent = dock?.parentElement;
    if (!dock || !parent) return;
    event.preventDefault(); event.stopPropagation();
    const dockRect = dock.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dockResize.current = {
      node: dock,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: dockRect.width,
      startHeight: dockRect.height,
      maxWidth: Math.max(250, parentRect.width - 32),
      maxHeight: Math.max(300, parentRect.height - 32),
      nextWidth: dockRect.width,
      nextHeight: dockRect.height,
    };
  };

  const toggleLibraryPreview = () => {
    const preview = libraryPreviewMode === 'original' ? 'portrait' : 'original';
    setLibraryPreviewMode(preview);
    try { window.localStorage.setItem('ysabel_library_dock', JSON.stringify({ ...libraryDockSize, preview })); } catch { /* no-op */ }
  };

  useEffect(() => {
    const targetAt = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-feed-index]');
      const value = element?.dataset.feedIndex;
      return value === undefined ? null : Number(value);
    };
    const move = (event: PointerEvent) => {
      const current = pointerDrag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 9) return;
      current.active = true;
      event.preventDefault();
      highlightDrop(document.elementFromPoint(event.clientX, event.clientY));
    };
    const end = (event: PointerEvent) => {
      const current = pointerDrag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const target = targetAt(event.clientX, event.clientY);
      if (edit && event.type !== 'pointercancel' && current.active && target !== null) applyDrop(current.source, target);
      pointerDrag.current = null;
      clearDropHighlight();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [positions, rearrangeMode, activeBoardId, assets, edit]);

  const updateAsset = (asset: Asset) => {
    setAssets((current) => current.map((item) => item.id === asset.id ? asset : item));
    setSaveState('Saving…');
    window.clearTimeout(assetSaveTimers.current.get(asset.id));
    assetSaveTimers.current.set(asset.id, window.setTimeout(() => {
      assetSaveTimers.current.delete(asset.id);
      persist({ action: 'save', boardId: activeBoardId, asset });
    }, 450));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      let uploadFile = file;
      try {
        if (videoNeedsNormalization(file)) setMediaProcessing('Converting video for every device…');
        uploadFile = await normalizeVideo(file);
      } catch {
        setMediaProcessing('Video conversion failed');
        window.setTimeout(() => setMediaProcessing(''), 3200);
        continue;
      }
      const optimized = await createOptimizedMedia(uploadFile);
      const tempId = 'local-' + crypto.randomUUID();
      const localSource = isVideoFile(uploadFile) ? uploadFile : optimized.thumbnail || uploadFile;
      const draft: Asset = {
        id: tempId, name: file.name.replace(/\.[^.]+$/, ''), fileName: uploadFile.name, mimeType: uploadFile.type,
        fileSize: uploadFile.size, url: URL.createObjectURL(localSource), format: isVideoFile(uploadFile) ? 'Video' : 'Photo',
        category: 'Other', status: 'Concept', plannedDate: null, caption: '', notes: '', slides: [], cropZoom: 100,
        cropX: 50, cropY: 50, palette: '#1d3428,#bdbdb9,#2d2c2c', archived: false,
      };
      setAssets((current) => [draft, ...current]);
      const replacementId = replaceTarget.current;
      if (replacementId) {
        const index = positions.indexOf(replacementId); if (index >= 0) { const next = [...positions]; next[index] = tempId; commitFeed(next); }
        replaceTarget.current = null;
      }
      const form = new FormData(); form.append('file', uploadFile);
      if (optimized.thumbnail) form.append('thumbnail', optimized.thumbnail, 'thumbnail.webp');
      if (optimized.display) form.append('display', optimized.display, 'display.webp');
      try {
        const response = await authFetch('/contentpreview/api/media', { method: 'POST', body: form });
        if (!response.ok) continue;
        const saved = await response.json() as Asset;
        const normalized = { ...saved, url: mediaUrl({ ...saved, url: '/contentpreview/api/media/' + saved.id }, authToken) };
        setAssets((current) => current.map((item) => item.id === tempId ? normalized : item));
        URL.revokeObjectURL(draft.url);
        setFeeds((current) => {
          const nextFeed = (current[activeBoardId] || emptyFeed()).map((id) => id === tempId ? saved.id : id);
          persist({ action: 'save', boardId: activeBoardId, positions: nextFeed });
          return { ...current, [activeBoardId]: nextFeed };
        });
        setMediaProcessing('');
      } catch { /* the immediate local draft remains usable */ }
    }
    setMediaProcessing('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const uploadCarouselFiles = async (files: FileList | null, targetId: string | null) => {
    const target = assets.find((asset) => asset.id === targetId);
    if (!target || !files?.length) return;
    const chosen = Array.from(files).slice(0, Math.max(0, 39 - (target.slides || []).length));
    if (!chosen.length) return;
    if (chosen.some(videoNeedsNormalization)) setMediaProcessing('Converting videos for every device…');
    const preparedResults = await mapWithConcurrency(chosen, 2, async (file) => {
      try {
        const uploadFile = await normalizeVideo(file);
        const optimized = await createOptimizedMedia(uploadFile);
        const localSource = isVideoFile(uploadFile) ? uploadFile : optimized.thumbnail || uploadFile;
        const draft = {
          id: 'local-' + crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), fileName: uploadFile.name,
          mimeType: uploadFile.type, fileSize: uploadFile.size, url: URL.createObjectURL(localSource),
          format: isVideoFile(uploadFile) ? 'Video' : 'Photo', category: 'Other', status: 'Concept',
          plannedDate: null, caption: '', notes: '', slides: [], cropZoom: 100, cropX: 50, cropY: 50,
          palette: '#1d3428,#bdbdb9,#2d2c2c', archived: false,
        } satisfies Asset;
        return { file: uploadFile, optimized, draft };
      } catch { return null; }
    });
    const prepared = preparedResults.filter((item): item is NonNullable<typeof item> => item !== null);
    setMediaProcessing(prepared.length === chosen.length ? '' : 'Some videos could not be converted');
    if (!prepared.length) { window.setTimeout(() => setMediaProcessing(''), 3200); return; }
    const drafts = prepared.map(({ draft }) => draft);
    const optimistic = { ...target, format: 'Carousel', slides: [...(target.slides || []), ...drafts.map((draft) => draft.id)] };
    setAssets((current) => [...drafts, ...current.map((asset) => asset.id === target.id ? optimistic : asset)]);
    setSaveState('Saving…');

    const resolved = new Map<string, string>();
    await mapWithConcurrency(prepared, 2, async ({ file, optimized, draft }) => {
      const form = new FormData(); form.append('file', file);
      if (optimized.thumbnail) form.append('thumbnail', optimized.thumbnail, 'thumbnail.webp');
      if (optimized.display) form.append('display', optimized.display, 'display.webp');
      try {
        const response = await authFetch('/contentpreview/api/media', { method: 'POST', body: form });
        if (!response.ok) throw new Error('Upload failed');
        const saved = await response.json() as Asset;
        const normalized = { ...saved, url: mediaUrl({ ...saved, url: '/contentpreview/api/media/' + saved.id }, authToken) };
        resolved.set(draft.id, saved.id);
        setAssets((current) => current.map((asset) => asset.id === draft.id ? normalized : asset));
        URL.revokeObjectURL(draft.url);
      } catch {
        setAssets((current) => current.filter((asset) => asset.id !== draft.id));
        URL.revokeObjectURL(draft.url);
      }
    });

    const draftIds = new Set(drafts.map((draft) => draft.id));
    const finalSlides = optimistic.slides
      .map((id) => resolved.get(id) || id)
      .filter((id) => !draftIds.has(id));
    const finalAsset = { ...optimistic, format: finalSlides.length ? 'Carousel' : target.format, slides: finalSlides };
    setAssets((current) => current.map((asset) => asset.id === target.id ? finalAsset : asset));
    persist({ action: 'save', boardId: activeBoardId, asset: finalAsset });
    if (prepared.length === chosen.length) setMediaProcessing('');
    else window.setTimeout(() => setMediaProcessing(''), 3200);
    if (carouselInput.current) carouselInput.current.value = '';
  };

  const toggleMediaSelection = (id: string) => {
    setMediaSelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const applyDeletedMedia = (ids: string[]) => {
    const removed = new Set(ids);
    setAssets((current) => current
      .filter((asset) => !removed.has(asset.id))
      .map((asset) => ({ ...asset, slides: (asset.slides || []).filter((id) => !removed.has(id)) })));
    setFeeds((current) => Object.fromEntries(Object.entries(current).map(([boardId, feed]) => [
      boardId,
      feed.map((id) => id && removed.has(id) ? null : id),
    ])));
    setPublications((current) => current.map((publication) => {
      try {
        const snapshot = JSON.parse(publication.snapshot) as { positions?: (string | null)[]; assets?: Asset[] };
        return {
          ...publication,
          snapshot: JSON.stringify({
            ...snapshot,
            positions: (snapshot.positions || []).map((id) => id && removed.has(id) ? null : id),
            assets: (snapshot.assets || [])
              .filter((asset) => !removed.has(asset.id))
              .map((asset) => ({ ...asset, slides: (asset.slides || []).filter((id) => !removed.has(id)) })),
          }),
        };
      } catch { return publication; }
    }));
    if (selectedId && removed.has(selectedId)) setSelectedId(null);
    if (postId && removed.has(postId)) setPostId(null);
    setMediaSelection((current) => current.filter((id) => !removed.has(id)));
  };

  const deleteMedia = async () => {
    if (!mediaDeleteIds.length || mediaDeleteBusy) return;
    const ids = [...mediaDeleteIds];
    ids.forEach((id) => { window.clearTimeout(assetSaveTimers.current.get(id)); assetSaveTimers.current.delete(id); });
    const serverIds = ids.filter((id) => !id.startsWith('local-'));
    const previous = { assets, feeds, publications, mediaSelection, selectedId, postId };
    setMediaDeleteBusy(true); setMediaDeleteError('');
    applyDeletedMedia(ids);
    try {
      await persistenceQueue.current.catch(() => undefined);
      if (serverIds.length) {
        const response = await authFetch('/contentpreview/api/media', {
          method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: serverIds }),
        });
        if (!response.ok) throw new Error('Delete failed');
      }
      previous.assets.filter((asset) => ids.includes(asset.id) && asset.url.startsWith('blob:')).forEach((asset) => URL.revokeObjectURL(asset.url));
      setMediaDeleteIds([]);
      if (ids.length > 1) setMediaSelectMode(false);
    } catch {
      setAssets(previous.assets); setFeeds(previous.feeds); setPublications(previous.publications);
      setMediaSelection(previous.mediaSelection); setSelectedId(previous.selectedId); setPostId(previous.postId);
      setMediaDeleteError('The media could not be deleted. Please try again.');
    }
    finally { setMediaDeleteBusy(false); }
  };

  const undo = () => {
    const previous = history.at(-1); if (!previous) return;
    setFuture((next) => [positions, ...next]); setHistory((past) => past.slice(0, -1));
    setFeeds((current) => ({ ...current, [activeBoardId]: previous })); persist({ action: 'save', boardId: activeBoardId, positions: previous });
  };
  const redo = () => {
    const next = future[0]; if (!next) return;
    setHistory((past) => [...past, positions]); setFuture((items) => items.slice(1));
    setFeeds((current) => ({ ...current, [activeBoardId]: next })); persist({ action: 'save', boardId: activeBoardId, positions: next });
  };

  const createBoard = async (duplicate = false) => {
    const name = newBoardName.trim() || 'Untitled Direction';
    const newCaptionPool = cloneCaptionPool(duplicate ? (captionStore[activeBoardId] || DEFAULT_CAPTION_POOL) : DEFAULT_CAPTION_POOL);
    try {
      const response = await authFetch('/contentpreview/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: duplicate ? 'duplicate-board' : 'create-board', name, sourceBoardId: duplicate ? activeBoardId : undefined }) });
      const responseData = await response.json() as Board & { publication?: Publication };
      const { publication, ...board } = responseData;
      setBoards((current) => [board, ...current]); setFeeds((current) => ({ ...current, [board.id]: duplicate ? [...positions] : emptyFeed() })); setActiveBoardId(board.id);
      setCaptionStore((current) => ({ ...current, [board.id]: cloneCaptionPool(newCaptionPool) }));
      if (publication) setPublications((current) => [publication, ...current]);
    } catch {
      const id = crypto.randomUUID();
      const fallbackPositions = duplicate ? [...positions] : emptyFeed();
      setBoards((current) => [{ id, name, archived: false }, ...current]); setFeeds((current) => ({ ...current, [id]: fallbackPositions })); setActiveBoardId(id);
      setPublications((current) => [{ boardId: id, snapshot: JSON.stringify({ positions: fallbackPositions, assets }), publishedAt: Date.now() }, ...current]);
      setCaptionStore((current) => ({ ...current, [id]: cloneCaptionPool(newCaptionPool) }));
    }
    setNewBoardOpen(false);
  };

  const duplicateBoard = () => { setNewBoardName((activeBoard?.name || 'Direction') + ' — Experiment 02'); setNewBoardOpen(true); };
  const archiveBoard = () => {
    if (!activeBoard) return; setBoards((current) => current.map((board) => board.id === activeBoardId ? { ...board, archived: true } : board));
    persist({ action: 'archive-board', boardId: activeBoardId }); const next = boards.find((board) => !board.archived && board.id !== activeBoardId); if (next) setActiveBoardId(next.id);
  };
  const deleteBoard = () => {
    setBoards((current) => current.filter((board) => board.id !== activeBoardId)); persist({ action: 'delete-board', boardId: activeBoardId });
    const next = boards.find((board) => board.id !== activeBoardId && !board.archived); if (next) setActiveBoardId(next.id); setDeleteOpen(false);
    setCaptionStore((current) => { const nextState = { ...current }; delete nextState[activeBoardId]; return nextState; });
  };
  const renameBoard = () => {
    setBoards((current) => current.map((board) => board.id === activeBoardId ? { ...board, name: renameValue } : board));
    persist({ action: 'rename-board', boardId: activeBoardId, name: renameValue }); setRenameOpen(false);
  };
  const saveVersion = async () => {
    const payload = { action: 'save-version', boardId: activeBoardId, name: versionName, positions };
    try {
      const response = await authFetch('/contentpreview/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const savedVersion = await response.json() as Version;
      setVersions((current) => [savedVersion, ...current]);
    }
    catch { setVersions((current) => [{ id: crypto.randomUUID(), boardId: activeBoardId, name: versionName, snapshot: JSON.stringify(positions), createdAt: Date.now() }, ...current]); }
    setVersionOpen(false); setSaveState('Saved');
  };

  const enterPublishedMode = () => {
    setEdit(false); setSection('feed'); setSelectedId(null); setLibraryDockOpen(false); setArtDirection(false); setExchangeFirst(null);
  };

  const enterEditMode = () => { setEdit(true); setSection('feed'); };

  const publishBoard = async () => {
    if (!activeBoard || publishing) return;
    setPublishing(true); setPublishError('');
    const referenced = new Set(positions.filter(Boolean) as string[]);
    const queue = [...referenced];
    while (queue.length) {
      const asset = byId.get(queue.shift() as string);
      for (const slideId of asset?.slides || []) {
        if (!referenced.has(slideId)) { referenced.add(slideId); queue.push(slideId); }
      }
    }
    try {
      const response = await authFetch('/contentpreview/api/workspace', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish-board', boardId: activeBoardId, positions, assets: assets.filter((asset) => referenced.has(asset.id)) }),
      });
      if (!response.ok) throw new Error('Publish failed');
      const publication = await response.json() as Publication;
      setPublications((current) => [publication, ...current.filter((item) => item.boardId !== publication.boardId)]);
      setSaveState('Saved');
      enterPublishedMode();
    } catch { setPublishError('Publish failed — please try again'); }
    finally { setPublishing(false); }
  };

  const commonGridProps: FeedGridProps = {
    positions, assets, edit, grayscale, colorRhythm, similarity, exchangeFirst,
    onTile, onDragStart: startMediaDrag, onDragEnd: endMediaDrag, onPointerStart: beginPointerDrag, onDrop, onDelete: removePosition, onCrop: updateAsset,
  };

  const renderPreview = (presentationView = false) => {
    const props = {
      ...commonGridProps, positions: displayPositions, assets: displayAssets,
      edit: presentationView ? false : edit, colorRhythm: presentationView ? false : colorRhythm,
      similarity: presentationView ? false : similarity, exchangeFirst: null,
    };
    if (view === 'desktop') return <DesktopPreview {...props} />;
    if (view === 'grid') return <GridPreview {...props} />;
    return <MobilePreview {...props} />;
  };

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (libraryFilter === 'photo') return !isVideoAsset(asset);
    if (libraryFilter === 'video') return isVideoAsset(asset);
    if (libraryFilter === 'used') return used.has(asset.id);
    if (libraryFilter === 'unused') return !used.has(asset.id);
    if (libraryFilter === 'archived') return asset.archived;
    return !asset.archived;
  }), [assets, libraryFilter, used]);

  const activeCaptionPool = captionStore[activeBoardId] || DEFAULT_CAPTION_POOL;
  const availableCaptions = useMemo(() => activeCaptionPool.available
    .map((id) => COMMUNITY_CAPTION_BY_ID.get(id))
    .filter(Boolean) as CommunityCaption[], [activeCaptionPool.available, activeBoardId]);
  const usedCaptions = useMemo(() => activeCaptionPool.used
    .map((id) => COMMUNITY_CAPTION_BY_ID.get(id))
    .filter(Boolean) as CommunityCaption[], [activeCaptionPool.used, activeBoardId]);

  if (authState !== 'ready' || loginEntering) {
    return (
      <main className={`login-screen${loginEntering && workspaceReady ? ' is-entering' : ''}`} style={{ '--entry-duration': `${LOGIN_SCENE.entry.durationMs}ms` } as CSSProperties}>
        <YsabelLoginBackground focused={loginFocused} entering={loginEntering} />
        <form className="login-panel" onSubmit={submitLogin} aria-busy={loginBusy || loginEntering} onFocusCapture={() => setLoginFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setLoginFocused(false); }}>
          <div className="login-identity"><YsabelLoginLogo /></div>
          <div className="login-copy">
            <span className="page-kicker">Private creative direction</span>
            <h1>Content Media Preview</h1>
            <p aria-live="polite">{authState === 'checking' || loginEntering ? 'Opening your private workspace…' : 'Sign in to curate the next Ysabel Society content direction.'}</p>
          </div>
          <>
            <label>Username<Input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={loginUsername} disabled={authState !== 'login' || loginBusy || loginEntering} onChange={(event) => setLoginUsername(event.target.value)} /></label>
            <label>Password<Input name="password" required type="password" autoComplete="current-password" value={loginPassword} disabled={authState !== 'login' || loginBusy || loginEntering} onChange={(event) => setLoginPassword(event.target.value)} /></label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <Button type="submit" disabled={authState !== 'login' || loginBusy || loginEntering || !loginUsername || !loginPassword}>{loginEntering ? 'Opening workspace…' : loginBusy ? 'Signing in…' : <><LockKeyhole />Enter workspace</>}</Button>
          </>
          <footer>YSABEL SOCIETY · INTERNAL USE</footer>
        </form>
      </main>
    );
  }

  if (!workspaceReady) {
    return (
      <main className="workspace-loading" aria-busy="true" aria-live="polite">
        <div><BrandAvatar size="lg" /><span>Preparing current direction</span><i /></div>
      </main>
    );
  }

  if (presentation) {
    return (
      <main className="presentation-mode">
        <header><div className="presentation-brand"><BrandAvatar size="sm" /><span>YSABEL SOCIETY</span></div><Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}><TabsList variant="line" className="presentation-tabs"><TabsTrigger value="mobile">Mobile</TabsTrigger><TabsTrigger value="desktop">Desktop</TabsTrigger><TabsTrigger value="grid">Grid</TabsTrigger></TabsList></Tabs><Button variant="ghost" onClick={() => setPresentation(false)}><X />Exit presentation</Button></header>
        <div className={'presentation-canvas presentation-canvas--' + view}>{renderPreview(true)}</div>
        <footer><span>{activeBoard?.name}</span><span>YSABEL SOCIETY · CONTENT DIRECTION</span></footer>
      </main>
    );
  }

  const navItems: { label: string; value: Section; icon: typeof Grid3X3 }[] = [
    { label: 'Feed', value: 'feed', icon: Grid3X3 }, { label: 'Media', value: 'media', icon: Images },
    { label: 'Calendar', value: 'calendar', icon: CalendarDays }, { label: 'Notes', value: 'notes', icon: NotebookPen },
    { label: 'Captions', value: 'captions', icon: MessageCircle },
    { label: 'Versions', value: 'versions', icon: Columns3 },
    { label: 'Archive', value: 'archive', icon: Archive },
  ];

  return (
    <main className={'app-shell ' + (!edit ? 'app-shell--published' : 'app-shell--editing')}>
      <input ref={fileInput} className="sr-file" type="file" multiple accept="image/jpeg,image/png,image/webp,video/*,.mkv,.avi,.wmv,.flv,.mts,.m2ts,.3gp,.3g2,.ogv" onChange={(event) => uploadFiles(event.target.files)} />
      <input ref={carouselInput} className="sr-file" type="file" multiple accept="image/jpeg,image/png,image/webp,video/*,.mkv,.avi,.wmv,.flv,.mts,.m2ts,.3gp,.3g2,.ogv" onChange={(event) => uploadCarouselFiles(event.target.files, selectedId)} />
      <aside className="rail">
        <div className="rail-brand"><BrandAvatar size="sm" /></div>
        <nav className="rail-nav" aria-label="Workspace navigation">{navItems.map(({ label, value, icon: Icon }) => <button className={section === value ? 'active' : ''} key={value} onClick={() => setSection(value)} aria-label={label} title={label}><Icon /></button>)}</nav>
        <button className={'rail-settings ' + (section === 'settings' ? 'active' : '')} onClick={() => setSection('settings')} aria-label="Settings" title="Settings"><Settings /></button>
      </aside>

      <section className="workspace">
        <div className="mobile-brand-header" aria-label="Ysabel Society Content Preview">
          <span className="mobile-brand-emblem"><BrandAvatar size="sm" /></span>
          <span className="mobile-brand-wordmark"><strong>YSABEL</strong><small>SOCIETY</small></span>
          <span className="mobile-brand-rule" aria-hidden="true" />
          <em>Content Preview</em>
        </div>
        <header className="topbar">
          <DropdownMenu>
            <DropdownMenuTrigger className="board-title"><span className="board-eyebrow">Content direction</span><span className="board-name">{activeBoard?.name}<ChevronDown /></span></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="board-menu">
              <DropdownMenuGroup>
              <DropdownMenuLabel>Feed boards</DropdownMenuLabel>
              {boards.filter((board) => !board.archived).map((board) => <DropdownMenuItem key={board.id} onClick={() => { setActiveBoardId(board.id); setHistory([]); setFuture([]); setPostId(null); }}>{board.name}{board.id === activeBoardId && <span className="menu-current">Current</span>}</DropdownMenuItem>)}
              </DropdownMenuGroup>
              {edit && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setNewBoardName('September — Direction B'); setNewBoardOpen(true); }}><Plus />New board</DropdownMenuItem>
                <DropdownMenuItem onClick={duplicateBoard}><Copy />Duplicate feed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRenameValue(activeBoard?.name || ''); setRenameOpen(true); }}>Rename feed</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={archiveBoard}><Archive />Archive feed</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 />Delete feed</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
          {section === 'feed' && <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)} className="topbar-center"><TabsList variant="line" className="view-tabs"><TabsTrigger value="mobile"><Smartphone />Mobile</TabsTrigger><TabsTrigger value="desktop"><Monitor />Desktop</TabsTrigger><TabsTrigger value="grid"><Grid3X3 />Grid</TabsTrigger></TabsList></Tabs>}
          <div className="topbar-actions">
            {edit ? <span className="save-state">{mediaProcessing || `Draft · ${saveState}`}</span> : <span className="published-state" title={activePublication ? `Published ${new Date(activePublication.publishedAt).toLocaleString()}` : 'Published feed'}><Check />Live</span>}
            {edit && <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!history.length} onClick={undo}><Undo2 /></Button>}
            {edit && <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!future.length} onClick={redo}><Redo2 /></Button>}
            <Button variant="ghost" size="sm" onClick={() => setAutoPreview(true)}><Play />Auto preview</Button>
            <fieldset className="workspace-mode"><legend className="sr-only">Workspace mode</legend>
              <button className={!edit ? 'active' : ''} onClick={enterPublishedMode}><Check />Published</button>
              <button className={edit ? 'active' : ''} onClick={enterEditMode}><SlidersHorizontal />Edit</button>
            </fieldset>
            {publishError && <span className="publish-error" role="alert">{publishError}</span>}
            {edit && <Button className="publish-button" size="sm" disabled={publishing} onClick={publishBoard}><Upload /><span>{publishing ? 'Publishing…' : 'Publish changes'}</span></Button>}
            <Button variant="outline" size="sm" onClick={() => setPresentation(true)}><Maximize2 />Present</Button>
            <Button className="logout-button" variant="ghost" size="icon-sm" aria-label="Log out" title="Log out" onClick={logout}><LogOut /></Button>
          </div>
        </header>

        {section === 'feed' && (
          <div className="workspace-body">
            <div className="canvas-meta">
              <div><span className="eyebrow">{edit ? 'Draft' : 'Published'} · {view}</span><span className="dot" />{displayPositions.slice(0, FEED_SIZE).filter(Boolean).length} of 15 posts</div>
              {edit && <button className={artDirection ? 'active' : ''} onClick={() => setArtDirection(!artDirection)}><Sparkles />Art direction</button>}
            </div>
            <div className={'canvas canvas--' + view}>{renderPreview()}</div>
            {edit && <aside className="edit-dock"><SlidersHorizontal /><span>Drag posts directly</span><span className="dock-divider" /><button className={rearrangeMode === 'swap' ? 'active' : ''} onClick={() => setRearrangeMode('swap')}>Swap</button><button className={rearrangeMode === 'insert' ? 'active' : ''} onClick={() => setRearrangeMode('insert')}>Insert</button><span className="dock-divider" /><button className={exchangeMode ? 'active' : ''} onClick={() => { setExchangeMode(!exchangeMode); setExchangeFirst(null); }}><ArrowLeftRight />Exchange</button><button className={libraryDockOpen ? 'active' : ''} onClick={() => setLibraryDockOpen(!libraryDockOpen)}><Images />Library</button></aside>}
            {edit && libraryDockOpen && <aside className={'library-dock library-dock--' + libraryPreviewMode} style={{ width: libraryDockSize.width, height: libraryDockSize.height }}><header><div><span>Media library</span><small>{filteredAssets.length} assets</small></div><button aria-label="Upload media" title="Upload media" onClick={() => fileInput.current?.click()}><Upload /></button><button aria-label="Close media library" title="Close" onClick={() => setLibraryDockOpen(false)}><X /></button></header><nav aria-label="Filter media">{[['all','All'],['unused','Unused'],['photo','Photo'],['video','Video']].map(([value,label]) => <button key={value} className={libraryFilter === value ? 'active' : ''} onClick={() => setLibraryFilter(value)}>{label}</button>)}</nav><div className="library-dock-grid">{filteredAssets.map((asset) => <article key={asset.id}><button className="library-dock-asset" type="button" draggable title={asset.name} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', asset.id); startMediaDrag({ type: 'library', id: asset.id }); }} onDragEnd={endMediaDrag}><AssetVisual asset={asset} original={libraryPreviewMode === 'original'} defer />{used.has(asset.id) && <i />}</button><button className="library-touch-drag" type="button" aria-label={'Drag ' + asset.name + ' into feed'} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginPointerDrag({ type: 'library', id: asset.id }, { pointerId: event.pointerId, x: event.clientX, y: event.clientY }); }}><Move /></button><button className="library-dock-delete" type="button" aria-label={'Delete ' + asset.name} title="Delete from server" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setMediaDeleteError(''); setMediaDeleteIds([asset.id]); }}><Trash2 /></button></article>)}</div><footer><span>Drag to place · Trash to delete</span><button type="button" onClick={toggleLibraryPreview} title="Change thumbnail framing"><Expand />{libraryPreviewMode === 'original' ? 'Original' : '4:5 crop'}</button></footer><button className="library-dock-resize" type="button" aria-label="Resize media library" title="Drag to resize" onPointerDown={beginDockResize}><span /></button></aside>}
            {artDirection && <aside className="art-panel"><div className="art-panel-head"><div><span>Art direction</span><small>Visual continuity</small></div><button onClick={() => setArtDirection(false)}><X /></button></div><label><span><strong>Grayscale preview</strong><small>Read tonal balance</small></span><Switch checked={grayscale} onCheckedChange={setGrayscale} /></label><label><span><strong>Color rhythm</strong><small>Show dominant palettes</small></span><Switch checked={colorRhythm} onCheckedChange={setColorRhythm} /></label><label><span><strong>Similarity guidance</strong><small>Flag close compositions</small></span><Switch checked={similarity} onCheckedChange={setSimilarity} /></label><div className="direction-metric"><span>Average brightness <strong>42%</strong></span><i><b style={{ width: '42%' }} /></i></div><div className="direction-metric"><span>Visual density <strong>Balanced</strong></span><i><b style={{ width: '61%' }} /></i></div><div className="balance-row"><div><strong>83%</strong><span>Photography</span></div><div><strong>17%</strong><span>Video</span></div></div><div className="rhythm-strip">{['#1d3428','#a46e41','#d8c6a7','#8d1723','#1a1b19','#d8d4ca','#66523d','#1d3428'].map((color) => <i key={color} style={{ background: color }} />)}</div></aside>}
          </div>
        )}

        {section === 'media' && <section className="library-page"><header><div><span className="page-kicker">Independent collection</span><h1>Media Library</h1><p>Upload once, then place media from the compact library beside your feed.</p></div><div className="library-page-actions">{mediaSelection.length > 0 && <Button variant="destructive" onClick={() => { setMediaDeleteError(''); setMediaDeleteIds(mediaSelection); }}><Trash2 />Delete {mediaSelection.length}</Button>}<Button variant="outline" onClick={() => { setMediaSelectMode((current) => !current); setMediaSelection([]); }}>{mediaSelectMode ? <><X />Cancel selection</> : <><Check />Select media</>}</Button><Button variant="outline" onClick={() => { setSection('feed'); setEdit(true); setLibraryDockOpen(true); }}><Grid3X3 />Open beside feed</Button><Button onClick={() => fileInput.current?.click()}><Upload />Upload media</Button></div></header><Tabs value={libraryFilter} onValueChange={(value) => setLibraryFilter(String(value))}><TabsList variant="line" className="library-tabs">{[['all','All'],['photo','Photography'],['video','Video'],['used','Used'],['unused','Unused'],['archived','Archived']].map(([value,label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList></Tabs><div className="library-grid">{filteredAssets.map((asset) => { const selected = mediaSelection.includes(asset.id); return <article key={asset.id} className={selected ? 'selected' : ''}><button className="library-asset-button" draggable={!mediaSelectMode} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', asset.id); startMediaDrag({ type: 'library', id: asset.id }); }} onDragEnd={endMediaDrag} onClick={() => { if (mediaSelectMode) toggleMediaSelection(asset.id); else { setSelectedId(asset.id); setEdit(true); } }}><span className="library-thumb"><AssetVisual asset={asset} defer />{used.has(asset.id) && <em>Used</em>}{mediaSelectMode && <i className="library-selection-mark">{selected && <Check />}</i>}</span><strong>{asset.name}</strong><small>{asset.format} · {asset.category}</small></button>{!mediaSelectMode && <button className="library-delete-one" type="button" aria-label={'Delete ' + asset.name} title="Delete from server" onClick={() => { setMediaDeleteError(''); setMediaDeleteIds([asset.id]); }}><Trash2 /></button>}</article>; })}</div></section>}

        {section === 'captions' && <section className="captions-page">
          <header><span className="page-kicker">Social direction writing</span><h1>Community Captions</h1><p>Keep one list of reusable caption suggestions and track what has already been used.</p></header>
          <div className="captions-toolbar">
            <div className="captions-status">{captionActionMessage || 'Select captions from Available to mark them as used for this board.'}</div>
            <div className="captions-actions">
              {usedCaptions.length > 0 && <Button variant="outline" onClick={removeAllUsedCaptions}><Undo2 />Return used</Button>}
              {selectedCaptionIds.length > 0 && <Button variant="destructive" onClick={deleteSelectedCaptions}><Trash2 />Delete selected ({selectedCaptionIds.length})</Button>}
              <Button variant="destructive" onClick={deleteAllCaptions}><Trash2 />Delete all</Button>
            </div>
          </div>
          <div className="captions-columns">
            <article className="captions-block">
              <header>
                <div>
                  <span>Available captions</span>
                  <p>{availableCaptions.length} remaining</p>
                </div>
                <div className="captions-block-actions">
                  {availableCaptions.length > 0 && <Button size="sm" variant="outline" onClick={() => {
                    const selected = availableCaptions.filter((caption) => selectedCaptionIds.includes(caption.id)).length;
                    if (selected === availableCaptions.length) deselectCaptionSet(availableCaptions);
                    else selectCaptionSet(availableCaptions);
                  }}><Check />{availableCaptions.filter((caption) => selectedCaptionIds.includes(caption.id)).length === availableCaptions.length ? 'Clear selection' : 'Select all'}</Button>}
                </div>
              </header>
              <div className="caption-list">{availableCaptions.length ? availableCaptions.map((caption) => (
                <article key={caption.id} className="caption-item">
                  <label className="caption-select"><input type="checkbox" checked={selectedCaptionIds.includes(caption.id)} onChange={() => toggleCaptionSelection(caption.id)} /></label>
                  <p>{caption.text}</p>
                  <div className="caption-item-actions"><Button size="sm" onClick={() => useCaption(caption.id)}><Plus />Use</Button><Button size="icon-sm" variant="ghost" aria-label={'Copy caption'} onClick={() => copyCaption(caption.id)}><Copy /></Button><Button size="icon-sm" variant="ghost" aria-label={'Delete caption'} onClick={() => deleteCaption(caption.id)}><Trash2 /></Button></div>
                </article>
              )) : <div className="caption-empty">No available captions. Promote one from used with Return.</div>}</div>
            </article>
            <article className="captions-block">
              <header>
                <div>
                  <span>Used captions</span>
                  <p>{usedCaptions.length} selected</p>
                </div>
                <div className="captions-block-actions">
                  {usedCaptions.length > 0 && <Button size="sm" variant="outline" onClick={() => {
                    const selected = usedCaptions.filter((caption) => selectedCaptionIds.includes(caption.id)).length;
                    if (selected === usedCaptions.length) deselectCaptionSet(usedCaptions);
                    else selectCaptionSet(usedCaptions);
                  }}><Check />{usedCaptions.filter((caption) => selectedCaptionIds.includes(caption.id)).length === usedCaptions.length ? 'Clear selection' : 'Select all'}</Button>}
                </div>
              </header>
              <div className="caption-list">{usedCaptions.length ? usedCaptions.map((caption) => (
                <article key={caption.id} className="caption-item caption-item--used">
                  <label className="caption-select"><input type="checkbox" checked={selectedCaptionIds.includes(caption.id)} onChange={() => toggleCaptionSelection(caption.id)} /></label>
                  <p>{caption.text}</p>
                  <div className="caption-item-actions"><Button size="sm" variant="outline" onClick={() => removeUsedCaption(caption.id)}>Return</Button><Button size="icon-sm" variant="ghost" aria-label={'Copy caption'} onClick={() => copyCaption(caption.id)}><Copy /></Button><Button size="icon-sm" variant="ghost" aria-label={'Delete used caption'} onClick={() => deleteCaption(caption.id)}><Trash2 /></Button></div>
                </article>
              )) : <div className="caption-empty">No used captions yet.</div>}</div>
            </article>
          </div>
        </section>}

        {section === 'calendar' && <section className="calendar-page">
          <header><span className="page-kicker">Publication rhythm</span><h1>{calendar.label}</h1><p>Select any day to add its creative notes</p></header>
          <div className="calendar-weekdays">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">{Array.from({ length: calendar.cells }, (_, index) => {
            const day = index - calendar.first + 1;
            const dateKey = day > 0 && day <= calendar.days ? calendar.dateForDay(day) : '';
            const asset = dateKey ? assets.find((item) => item.plannedDate === dateKey) : undefined;
            const hasNote = dateKey ? activeNotes.some((note) => note.noteDate === dateKey && note.body.trim()) : false;
            return <button key={index} className={!dateKey ? 'outside' : (hasNote ? 'has-note' : '')} disabled={!dateKey} onClick={() => { if (dateKey) { setSelectedNoteDate(dateKey); setSection('notes'); } }}><span>{dateKey ? day : ''}{hasNote && <NotebookPen className="calendar-note-icon" aria-label="Notes saved" />}</span>{asset && <div><AssetVisual asset={asset} /><small>{asset.name}</small></div>}</button>;
          })}</div>
        </section>}

        {section === 'notes' && <section className="notes-page">
          <header><span className="page-kicker">Monthly creative record</span><h1>{calendar.label} Notes</h1><p>Notes are private, attached to this feed direction and saved automatically.</p></header>
          <div className="notes-layout">
            <aside className="notes-calendar">
              <button className={'notes-month-link ' + (selectedNoteDate === 'month' ? 'selected' : '')} onClick={() => setSelectedNoteDate('month')}><NotebookPen /><span><strong>Month overview</strong><small>{activeNotes.find((note) => note.noteDate === 'month')?.body.trim() ? 'Notes saved' : 'Add overall direction'}</small></span></button>
              <div className="notes-weekdays">{['M','T','W','T','F','S','S'].map((day, index) => <span key={day + index}>{day}</span>)}</div>
              <div className="notes-calendar-grid">{Array.from({ length: calendar.cells }, (_, index) => {
                const day = index - calendar.first + 1;
                const dateKey = day > 0 && day <= calendar.days ? calendar.dateForDay(day) : '';
                const hasNote = dateKey ? activeNotes.some((note) => note.noteDate === dateKey && note.body.trim()) : false;
                const hasMedia = dateKey ? assets.some((asset) => asset.plannedDate === dateKey) : false;
                return dateKey ? <button key={index} className={(selectedNoteDate === dateKey ? 'selected ' : '') + (hasNote ? 'has-note' : '')} onClick={() => setSelectedNoteDate(dateKey)}><span>{day}</span><i>{hasNote && <b className="note-dot" />}{hasMedia && <b className="media-dot" />}</i></button> : <span className="outside" key={index} />;
              })}</div>
              <footer><span><i className="note-dot" />Note</span><span><i className="media-dot" />Planned post</span></footer>
            </aside>
            <div className="notes-editor">
              <header><div><span>{selectedNoteDate === 'month' ? 'Direction notes' : 'Daily notes'}</span><h2>{selectedNoteDate === 'month' ? `${calendar.label} overview` : new Date(selectedNoteDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><small>{saveState === 'Saving…' ? 'Saving…' : 'Saved automatically'}</small></header>
              <Textarea value={noteBody} onChange={(event) => updateNote(event.target.value)} placeholder={selectedNoteDate === 'month' ? 'Write the visual direction, priorities, review feedback or reminders for this month…' : 'Write ideas, production details, caption thoughts or reminders for this day…'} />
              <footer>{selectedNoteDate === 'month' ? 'This overview stays with the active monthly feed.' : 'Choose another date from the calendar to write a separate note.'}</footer>
            </div>
          </div>
          <section className="notes-history">
            <header><div><span className="page-kicker">Saved record</span><h2>All Notes</h2></div><strong>{savedNotes.length}</strong></header>
            <div>{savedNotes.length ? savedNotes.map((note) => {
              const board = boards.find((item) => item.id === note.boardId);
              const dateLabel = note.noteDate === 'month' ? 'Month overview' : new Date(note.noteDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              return <article key={note.boardId + '-' + note.noteDate}>
                <button className="note-history-open" onClick={() => openSavedNote(note)}><NotebookPen /><span><strong>{dateLabel}</strong><small>{board?.name || 'Feed direction'} · Edited {new Date(note.updatedAt).toLocaleDateString()}</small><p>{note.body}</p></span><ChevronRight /></button>
                <button className="note-history-delete" title="Delete note" aria-label={'Delete note for ' + dateLabel} onClick={() => deleteNote(note.boardId, note.noteDate)}><Trash2 /></button>
              </article>;
            }) : <div className="notes-history-empty"><NotebookPen /><p>Your saved notes will appear here.</p></div>}</div>
          </section>
        </section>}

        {section === 'versions' && <section className="versions-page"><header><div><span className="page-kicker">Safe experimentation</span><h1>Feed Versions</h1><p>Save a direction before exploring the next one</p></div><Button onClick={() => { setVersionName((activeBoard?.name || '') + ' — Approved'); setVersionOpen(true); }}><Plus />Save new version</Button></header><div className="concept-compare"><div><span>Current concept</span><h2>{activeBoard?.name}</h2><FeedGrid {...commonGridProps} edit={false} scale="mini" colorRhythm={false} similarity={false} exchangeFirst={null} /></div><div><span>Compare with</span><h2>{versions[0]?.name || 'No saved version yet'}</h2>{versions[0] ? <FeedGrid {...commonGridProps} positions={JSON.parse(versions[0].snapshot)} edit={false} scale="mini" colorRhythm={false} similarity={false} exchangeFirst={null} /> : <div className="version-empty"><Columns3 /><p>Save this feed to compare concepts side by side.</p></div>}</div></div><div className="version-list">{versions.map((version) => <button key={version.id}><div><strong>{version.name}</strong><small>{new Date(version.createdAt).toLocaleDateString()}</small></div><ChevronRight /></button>)}</div></section>}

        {section === 'archive' && <section className="archive-page"><header><span className="page-kicker">Stored directions</span><h1>Archive</h1><p>Paused feed concepts and media remain recoverable</p></header><div className="archive-list">{boards.filter((board) => board.archived).length ? boards.filter((board) => board.archived).map((board) => <div key={board.id}><Archive /><span><strong>{board.name}</strong><small>Feed board · 15 positions</small></span><Button variant="outline" size="sm" onClick={() => { setBoards((current) => current.map((item) => item.id === board.id ? { ...item, archived: false } : item)); persist({ action: 'restore-board', boardId: board.id }); }}>Restore</Button></div>) : <div className="archive-empty"><Archive /><p>No archived feed boards.</p></div>}</div></section>}

        {section === 'settings' && <section className="settings-page"><header><span className="page-kicker">Profile preview</span><h1>Ysabel Society Identity</h1><p>Profile information imported from the official Instagram account</p></header><div className="settings-content"><div className="identity-preview"><BrandAvatar size="xl" /><div><strong>Official Instagram artwork</strong><span>Current profile image · imported September 2026</span></div></div><label>Instagram username<Input defaultValue={instagramProfile.username} /></label><label>Profile name<Input defaultValue={instagramProfile.name} /></label><label>Biography<Textarea defaultValue={`${instagramProfile.category}\nReservations: ${instagramProfile.reservations}\n📍 ${instagramProfile.location}`} /></label><label>Location<Input defaultValue={instagramProfile.location} /></label><div className="settings-actions"><Button>Save profile details</Button><Button variant="outline" onClick={logout}><LogOut />Log out</Button></div></div></section>}
      </section>

      <Inspector asset={selectedAsset} assets={assets} onClose={() => setSelectedId(null)} onChange={updateAsset} onReplace={() => { replaceTarget.current = selectedAsset?.id || null; fileInput.current?.click(); }} onAddSlides={() => carouselInput.current?.click()} onDuplicate={() => { if (!selectedAsset) return; const copy = { ...selectedAsset, id: 'local-' + crypto.randomUUID(), name: selectedAsset.name + ' — Copy' }; setAssets((current) => [copy, ...current]); }} onRemove={() => { if (!selectedId) return; commitFeed(positions.map((id) => id === selectedId ? null : id)); setSelectedId(null); }} />

      <Dialog open={Boolean(postAsset)} onOpenChange={(open) => !open && setPostId(null)}><DialogContent className="post-dialog" showCloseButton><DialogHeader className="sr-only"><DialogTitle>Instagram post preview</DialogTitle><DialogDescription>Preview of the selected planned Instagram post.</DialogDescription></DialogHeader>{postAsset && <div className="post-layout"><div className="post-media"><CarouselVisual key={postAsset.id} asset={postAsset} assets={displayAssets} contain /></div><div className="post-copy-panel"><header><BrandAvatar size="sm" /><span><strong>{instagramProfile.username}</strong><small>{instagramProfile.location}</small></span><MoreHorizontal /></header><div className="post-caption"><BrandAvatar size="sm" /><p><strong>{instagramProfile.username}</strong> {postAsset.caption || 'A study in taste, art and rhythm.'}</p></div><div className="post-actions"><span><Heart /><MessageCircle /><Send /></span><Download /></div><strong className="likes">Liked by the Ysabel Society team</strong><small className="post-date">{postAsset.plannedDate ? new Date(postAsset.plannedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Date not assigned'}</small></div></div>}</DialogContent></Dialog>

      <Dialog open={autoPreview} onOpenChange={setAutoPreview}><DialogContent className="auto-dialog" showCloseButton={false}><DialogHeader className="auto-head"><DialogTitle>Auto Preview</DialogTitle><DialogDescription>Cinematic sequence review · {activeBoard?.name}</DialogDescription></DialogHeader><div className="auto-stage">{(() => { const planned = displayPositions.filter(Boolean) as string[]; const asset = displayById.get(planned[autoIndex % Math.max(1, planned.length)]); return asset ? <CarouselVisual key={asset.id} asset={asset} assets={displayAssets} contain /> : <span>No planned media</span>; })()}</div><div className="auto-controls"><Button variant="ghost" size="icon" onClick={() => { const count = Math.max(1, displayPositions.filter(Boolean).length); setAutoIndex((autoIndex - 1 + count) % count); }}><ChevronLeft /></Button><Button className="auto-play" size="icon-lg" onClick={() => setAutoPlaying(!autoPlaying)}>{autoPlaying ? <Pause /> : <Play fill="currentColor" />}</Button><Button variant="ghost" size="icon" onClick={() => setAutoIndex((autoIndex + 1) % Math.max(1, displayPositions.filter(Boolean).length))}><ChevronRight /></Button><Select value={String(autoTiming)} onValueChange={(value) => setAutoTiming(Number(value))}><SelectTrigger size="sm"><SelectValue /></SelectTrigger><SelectContent>{[2,4,6].map((n) => <SelectItem key={n} value={String(n)}>{n} sec</SelectItem>)}</SelectContent></Select><Button variant="ghost" onClick={() => setAutoPreview(false)}>Close</Button></div></DialogContent></Dialog>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}><DialogContent className="small-dialog"><DialogHeader><DialogTitle>New feed direction</DialogTitle><DialogDescription>Create a clean board or duplicate the current arrangement.</DialogDescription></DialogHeader><label className="dialog-label">Board name<Input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} /></label><DialogFooter><Button variant="outline" onClick={() => createBoard(false)}>Create empty</Button><Button onClick={() => createBoard(true)}><Copy />Duplicate current</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={versionOpen} onOpenChange={setVersionOpen}><DialogContent className="small-dialog"><DialogHeader><DialogTitle>Save feed version</DialogTitle><DialogDescription>Preserve this exact arrangement for review or comparison.</DialogDescription></DialogHeader><label className="dialog-label">Version name<Input value={versionName} onChange={(e) => setVersionName(e.target.value)} /></label><DialogFooter><Button onClick={saveVersion}>Save version</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent className="small-dialog"><DialogHeader><DialogTitle>Rename feed</DialogTitle><DialogDescription>Update the board name without changing its arrangement.</DialogDescription></DialogHeader><label className="dialog-label">Feed name<Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} /></label><DialogFooter><Button onClick={renameBoard}>Rename</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this feed?</AlertDialogTitle><AlertDialogDescription>The feed board and its arrangement will be deleted. Media assets remain in the library.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteBoard}>Delete feed</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={mediaDeleteIds.length > 0} onOpenChange={(open) => { if (!open && !mediaDeleteBusy) { setMediaDeleteIds([]); setMediaDeleteError(''); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {mediaDeleteIds.length === 1 ? 'this media file' : `${mediaDeleteIds.length} media files`}?</AlertDialogTitle><AlertDialogDescription>The selected media will be permanently removed from the server, all feed positions, and carousel slides. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>{mediaDeleteError && <p className="media-delete-error" role="alert">{mediaDeleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={mediaDeleteBusy}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={mediaDeleteBusy} onClick={(event) => { event.preventDefault(); void deleteMedia(); }}>{mediaDeleteBusy ? 'Deleting…' : 'Delete permanently'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
