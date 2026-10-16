import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowDownToLine, ArrowUpRight, Building2, ChevronRight, Compass, Globe2, MapPin, Minus, Monitor, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { number, type Range } from '@/lib/analytics';
import { cityKey, countryCode, geographyCSV, geographyNormalize, locateCities, locationName, type CityReference, type GeoAudience, type GeoDevice, type GeoMetric, type GeoResult, type GeoRow } from '@/lib/website-geography';
import styles from './website-geography.module.css';

type View = 'world' | 'countries' | 'cities';
type Boundaries = GeoJSON.FeatureCollection<GeoJSON.Geometry, { code: string; name: string }>;
const assets = import.meta.env.BASE_URL + 'maps/';
const palette = ['#dceae6', '#b2d4ca', '#7eb7a5', '#478d78', '#24634f'];
const metrics: Record<GeoMetric, string> = { sessions: 'Visits', activeUsers: 'Active users', engagedSessions: 'Engaged visits' };
const audiences: Record<GeoAudience, string> = { all: 'All visitors', new: 'First-time visitors', returning: 'Returning visitors' };
const devices: Record<GeoDevice, string> = { all: 'All devices', mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' };
const dataCache = new Map<string, { at: number; value: GeoResult }>();
let boundaryPromise: Promise<Boundaries> | undefined;
const atlasCache = new Map<string, Promise<CityReference[]>>();
function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> { return fetch(url, { credentials: 'same-origin', signal }).then(async response => { const body = await response.json(); if (!response.ok) throw Error(typeof body.error === 'string' ? body.error : 'The audience report could not be loaded. Please refresh or check the Google Analytics connection in Data Center.'); return body as T; }); }
function getBoundaries() { return boundaryPromise ||= fetchJSON<Boundaries>(assets + 'website-countries.geojson').catch(error => { boundaryPromise = undefined; throw error; }); }
function getCities(code: string) { if (!atlasCache.has(code)) atlasCache.set(code, fetchJSON<CityReference[]>(assets + 'website-cities/' + code + '.json').catch(error => { atlasCache.delete(code); throw error; })); return atlasCache.get(code)!; }
const fmt = (value: number | null | undefined) => value == null ? '—' : number(value);
const band = (value: number, maximum: number) => Math.min(4, Math.floor(Math.sqrt(value / Math.max(1, maximum)) * 4.999));
const pointText = (name: string, value: number | null, metric: string) => { const element = document.createElement('span'); element.textContent = name + ' · ' + fmt(value) + ' ' + metric.toLowerCase(); return element; };

export default function WebsiteGeographyExplorer({ range, fixture }: { range: Range; fixture?: GeoResult }) {
  const [view, setView] = useState<View>('world'), [audience, setAudience] = useState<GeoAudience>('all'), [device, setDevice] = useState<GeoDevice>('all');
  const [metric, setMetric] = useState<GeoMetric>('sessions'), [country, setCountry] = useState(''), [city, setCity] = useState(''), [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState<{ key: string; value: GeoResult }>(), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [boundaries, setBoundaries] = useState<Boundaries>(), [references, setReferences] = useState(new Map<string, CityReference[]>()), [mapError, setMapError] = useState('');
  const [ready, setReady] = useState(false), [atlasLoading, setAtlasLoading] = useState(false), [listLimit, setListLimit] = useState(30);
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), countryLayer = useRef<L.GeoJSON | null>(null), cityLayer = useRef<L.LayerGroup | null>(null), tiles = useRef<L.TileLayer | null>(null);
  const selectCountryRef = useRef<(code: string) => void>(() => {}), selectCityRef = useRef<(key: string) => void>(() => {});
  const requestKey = [range.start, range.end, audience, device].join('|');
  const data = fixture ? { ...fixture, audience, device } : loaded?.key === requestKey ? loaded.value : undefined;
  const refresh = useCallback(() => { dataCache.delete(requestKey); setRevision(value => value + 1); }, [requestKey]);
  useEffect(() => {
    if (fixture) { setLoading(false); return; }
    let alive = true; const controller = new AbortController();
    const cached = dataCache.get(requestKey); setError('');
    if (cached) setLoaded({ key: requestKey, value: cached.value });
    if (cached && Date.now() - cached.at < 120000) { setLoading(false); return; }
    setLoading(true);
    const query = new URLSearchParams({ start: range.start, end: range.end, audience, device });
    fetchJSON<GeoResult>('/marketingdata/api/website-geography?' + query, controller.signal).then(value => {
      if (!alive) return;
      if (value.period.start !== range.start || value.period.end !== range.end || value.audience !== audience || value.device !== device) throw Error('The report dates did not match. Please refresh.');
      dataCache.set(requestKey, { at: Date.now(), value }); while (dataCache.size > 20) dataCache.delete(dataCache.keys().next().value!);
      setLoaded({ key: requestKey, value });
    }).catch(reason => { if (alive && reason.name !== 'AbortError') setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [requestKey, revision, fixture]);
  useEffect(() => {
    const timer = window.setInterval(() => { const rect = stage.current?.getBoundingClientRect(); if (document.visibilityState === 'visible' && rect && rect.top < window.innerHeight && rect.bottom > 0) refresh(); }, 300000);
    window.addEventListener('ysabel:sources-updated', refresh);
    return () => { clearInterval(timer); window.removeEventListener('ysabel:sources-updated', refresh); };
  }, [refresh]);
  useEffect(() => { let alive = true; getBoundaries().then(value => { if (alive) setBoundaries(value); }).catch(() => { if (alive) setMapError('The reference map could not load. Your audience counts remain available in the list.'); }); return () => { alive = false; }; }, []);
  const countries = useMemo(() => [...(data?.countries.rows || [])].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1)), [data, metric]);
  const cityRows = useMemo(() => (data?.cities.rows || []).filter(row => !country || countryCode(row) === country), [data, country]);
  const countryName = countries.find(row => countryCode(row) === country)?.country || country;
  const atlasCodes = useMemo(() => view === 'world' ? [] : [...new Set(cityRows.map(countryCode).filter(Boolean))].sort(), [cityRows, view]);
  const atlasKey = atlasCodes.join(',');
  useEffect(() => {
    let alive = true; setAtlasLoading(atlasCodes.length > 0); setReferences(new Map());
    // Load reference cities only for countries in this report, at most four files
    // together. Large public atlases never delay the initial dashboard load.
    const result = new Map<string, CityReference[]>(), queue = [...atlasCodes];
    Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => { while (queue.length && alive) { const code = queue.shift()!; try { result.set(code, await getCities(code)); } catch { /* Unmatched cities remain visible in the list. */ } } })).then(() => { if (alive) { setReferences(result); setAtlasLoading(false); } });
    return () => { alive = false; };
  }, [atlasKey]);
  const located = useMemo(() => locateCities(cityRows, references), [cityRows, references]);
  const matchingRows = useMemo(() => {
    const rows = view === 'world' ? countries : cityRows;
    const query = geographyNormalize(search);
    return [...rows].filter(row => !query || geographyNormalize([row.country, row.region, row.city].join(' ')).includes(query)).sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1));
  }, [countries, cityRows, view, search, metric]);
  const listedKeys = useMemo(() => new Set(matchingRows.map(cityKey)), [matchingRows]);
  const points = useMemo(() => located.points.filter(point => listedKeys.has(point.key)), [located, listedKeys]);
  const pointsByKey = useMemo(() => new Map(located.points.map(point => [point.key, point])), [located]);
  const selectedRow = country ? countries.find(row => countryCode(row) === country) : data?.totals;
  const maximum = Math.max(1, ...matchingRows.map(row => row[metric] || 0));
  const selectCountry = useCallback((code: string) => { if (!code) return; setCountry(code); setCity(''); setSearch(''); setView('countries'); }, []);
  selectCountryRef.current = selectCountry;
  selectCityRef.current = key => { setCity(key); setView('cities'); };
  const changeView = (next: View) => {
    setView(next); setSearch('');
    const code = next === 'world' ? '' : country || countryCode(countries.find(row => countryCode(row)) || {} as GeoRow);
    setCountry(code);
    const firstCity = next === 'cities' ? [...(data?.cities.rows || [])].filter(row => countryCode(row) === code && locationName(row.city) !== 'Location not reported').sort((a,b)=>(b[metric]||0)-(a[metric]||0))[0] : undefined;
    setCity(firstCity ? cityKey(firstCity) : '');
  };
  useEffect(() => { setListLimit(30); }, [search, view, country, audience, device, range.start, range.end]);
  useEffect(() => {
    if (!stage.current || map.current) return;
    const instance = L.map(stage.current, { center: [24, 5], zoom: 2, minZoom: 2, maxZoom: 17, zoomControl: false, attributionControl: true, scrollWheelZoom: false, preferCanvas: false, worldCopyJump: false, zoomAnimation: animate, fadeAnimation: animate, markerZoomAnimation: animate, maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: .75 });
    instance.attributionControl.setPrefix(false);
    instance.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · City centres: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>)');
    cityLayer.current = L.layerGroup().addTo(instance); map.current = instance; setReady(true);
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false })); resize.observe(stage.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; setReady(false); };
  }, []);
  useEffect(() => {
    const instance = map.current; if (!instance || !boundaries) return;
    countryLayer.current?.remove();
    const byCode = new Map(countries.map(row => [countryCode(row), row]));
    const top = Math.max(1, ...countries.map(row => row[metric] || 0));
    const layer = L.geoJSON(boundaries, {
      style: feature => { const code = feature?.properties.code, row = byCode.get(code); return { fillColor: row?.[metric] ? palette[band(row[metric]!, top)] : '#f4f4ee', fillOpacity: view === 'world' ? .95 : country === code ? .17 : .08, color: country === code ? '#264f43' : '#fff', weight: country === code ? 2 : .8 }; },
      onEachFeature: (feature, part) => {
        const code = feature.properties.code, row = byCode.get(code), name = String(row?.country || feature.properties.name);
        if (part instanceof L.Path) { part.bindTooltip(pointText(name, row?.[metric] ?? null, metrics[metric]), { sticky: true, className: styles.tooltip }); part.on('click', () => selectCountryRef.current(code)); }
        part.on('add', () => { const element = (part as L.Path).getElement?.(); if (!element) return; element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', 'Explore ' + name + ', ' + fmt(row?.[metric]) + ' ' + metrics[metric]); element.addEventListener('keydown', event => { if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') { event.preventDefault(); selectCountryRef.current(code); } }); });
      },
    }).addTo(instance);
    countryLayer.current = layer;
    cityLayer.current?.eachLayer(part => { if (part instanceof L.Path) part.bringToFront(); });
    return () => { layer.remove(); };
  }, [boundaries, countries, metric, view, country, ready]);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    if (view !== 'world' && !tiles.current) {
      tiles.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>', maxZoom: 19, referrerPolicy: 'origin', updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1 }).addTo(instance);
    } else if (view === 'world' && tiles.current) { tiles.current.remove(); tiles.current = null; }
  }, [view, ready]);
  useEffect(() => {
    const group = cityLayer.current; if (!group) return; group.clearLayers();
    if (view === 'world') return;
    for (const point of points) {
      const count = point.row[metric]; if (count == null || count === 0) continue;
      const marker = L.circleMarker([point.lat, point.lng], { radius: 5 + Math.sqrt(count / maximum) * 18, color: '#fff', weight: 2, fillColor: city === point.key ? '#ad713b' : palette[band(count, maximum)], fillOpacity: .87, className: styles.cityDot }).bindTooltip(pointText(point.name + ', ' + point.country, count, metrics[metric]), { className: styles.tooltip });
      marker.on('click', () => selectCityRef.current(point.key));
      marker.on('add', () => { const element = marker.getElement(); if (!element) return; element.setAttribute('tabindex', '0'); element.setAttribute('role', 'button'); element.setAttribute('aria-label', point.name + ', ' + fmt(count) + ' ' + metrics[metric]); element.addEventListener('keydown', event => { if ((event as KeyboardEvent).key === 'Enter') selectCityRef.current(point.key); }); });
      marker.addTo(group);
    }
  }, [points, maximum, metric, city, view, ready]);
  const fitView = useCallback(() => {
    const instance = map.current; if (!instance) return;
    if (city && pointsByKey.has(city)) { const point = pointsByKey.get(city)!; instance.flyTo([point.lat, point.lng], 12, { duration: .8, animate }); return; }
    const feature = boundaries?.features.find(feature => feature.properties.code === country);
    if (country && feature) instance.fitBounds(L.geoJSON(feature).getBounds(), { padding: [35, 35], maxZoom: 9, animate, duration: .65 });
    else if (view !== 'world' && points.length) instance.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng] as [number, number])), { padding: [40, 40], maxZoom: 9, animate });
    else instance.setView([24, 5], 2, { animate });
  }, [country, city, boundaries, pointsByKey, ready, view]);
  useEffect(() => { if (!atlasLoading) fitView(); }, [country, city, view, boundaries, ready, atlasLoading]);
  const selectedCity = pointsByKey.get(city), selectedCityRow = cityRows.find(row => cityKey(row) === city);
  const exportRows = () => { const url = URL.createObjectURL(new Blob(['\uFEFF' + geographyCSV(matchingRows)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `ysabel-website-${view}-${audience}-${device}-${range.start}-${range.end}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section className={styles.explorer} aria-labelledby="website-geography-title" aria-busy={loading}>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}><Globe2 size={14} /> WEBSITE · AUDIENCE GEOGRAPHY</div><h2 id="website-geography-title">A world of connections.</h2><p>Explore where your visitors are, from the world to one city.</p></div>
      <div className={styles.source}><span className={styles.sourcePill}><span /> Google Analytics API</span><span>{range.start} — {range.end}</span><button type="button" onClick={refresh} disabled={loading || !!fixture} aria-label="Refresh audience geography"><RefreshCw size={14} className={loading ? styles.spinning : ''} />{loading ? 'Updating…' : 'Refresh'}</button></div>
    </header>
    <div className={styles.audienceTabs} role="group" aria-label="Website audience">
      {(Object.keys(audiences) as GeoAudience[]).map(key => <button type="button" key={key} aria-pressed={audience === key} onClick={() => { setAudience(key); setCity(''); }}><Users size={15} />{audiences[key]}</button>)}
    </div>
    <div className={styles.toolbar}>
      <div className={styles.viewTabs} role="group" aria-label="Map view">{([['world', Globe2, 'World'], ['countries', Compass, 'Countries'], ['cities', Building2, 'Cities']] as const).map(([key, Icon, label]) => <button type="button" key={key} disabled={!data} aria-pressed={view === key} onClick={() => changeView(key)}><Icon size={16} />{label}</button>)}</div>
      <div className={styles.selects}>
        <label><Monitor size={14} /><select aria-label="Audience device" value={device} onChange={event => setDevice(event.target.value as GeoDevice)}>{(Object.keys(devices) as GeoDevice[]).map(key => <option key={key} value={key}>{devices[key]}</option>)}</select></label>
        <label><select aria-label="Map measurement" value={metric} onChange={event => setMetric(event.target.value as GeoMetric)}>{(Object.keys(metrics) as GeoMetric[]).map(key => <option key={key} value={key}>{metrics[key]}</option>)}</select></label>
        <button type="button" className={styles.export} onClick={exportRows} disabled={!matchingRows.length}><ArrowDownToLine size={15} />Export</button>
      </div>
    </div>
    {error && <div role="alert" className={styles.error}>{error}<button type="button" onClick={refresh}>Try again</button></div>}
    <div className={styles.mapLayout}>
      <div className={styles.mapWrap}>
        <div ref={stage} className={styles.map} aria-label="Interactive website audience map. Drag to pan; use the zoom controls or keyboard to explore." />
        <div className={styles.breadcrumb}><button type="button" onClick={() => changeView('world')}><Globe2 size={14} />World</button>{country && <><ChevronRight size={13} /><button type="button" onClick={() => { setCity(''); setView('countries'); }}>{countryName}</button></>}{selectedCityRow && <><ChevronRight size={13} /><span>{locationName(selectedCityRow.city)}</span></>}</div>
        <div className={styles.zoom}><button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={18} /></button><button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={18} /></button><button type="button" aria-label="Reset map view" onClick={fitView}><Compass size={18} /></button></div>
        <div className={styles.mapCaption}><span>{view === 'world' ? 'COUNTRIES' : 'CITY CENTRES'}</span><strong>{view === 'world' ? 'Every connection has a place.' : countryName || 'Across your audience'}</strong><small>{view === 'world' ? 'Select a country to explore its cities.' : 'Markers show reference city centres, not visitor positions.'}</small></div>
        <div className={styles.legend}><span>{fmt(0)}</span>{palette.map(color => <i key={color} style={{ background: color }} />)}<span>{fmt(view === 'world' ? Math.max(0, ...countries.map(row => row[metric] || 0)) : maximum)} {metrics[metric].toLowerCase()}</span></div>
        {(loading && !data) && <div className={styles.loading} role="status"><RefreshCw size={21} className={styles.spinning} /><strong>Finding your audience</strong><span>Loading the selected Google Analytics report…</span></div>}
        {mapError && <div className={styles.mapNotice}>{mapError}</div>}
      </div>
      <aside className={styles.sidebar} aria-label="Audience locations">
        <div className={styles.summary}><span>{country ? 'COUNTRY TOTAL' : 'AUDIENCE TOTAL'} · {audiences[audience]}</span><strong>{fmt(selectedRow?.[metric])}</strong><div>{metrics[metric]}<span><MapPin size={12} />{country ? countryName : 'Worldwide'}</span></div></div>
        {view !== 'world' && <label className={styles.countrySelect}>Explore a country<select aria-label="Country to explore" value={country} onChange={event => { setCountry(event.target.value); setCity(''); setSearch(''); }}><option value="">All reported countries</option>{countries.filter(row => countryCode(row)).map(row => <option key={countryCode(row)} value={countryCode(row)}>{row.country}</option>)}</select></label>}
        <label className={styles.search}><Search size={15} /><input aria-label="Search map locations" placeholder={view === 'world' ? 'Find a country' : 'Find a city'} value={search} onChange={event => { setSearch(event.target.value); setCity(''); }} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear location search"><X size={14} /></button>}</label>
        <div className={styles.listHeading}><span>{view === 'world' ? 'COUNTRIES & TERRITORIES' : 'REPORTED CITIES'}</span><span>{matchingRows.length}</span></div>
        <div className={styles.locationList}>
          {matchingRows.slice(0, listLimit).map((row, index) => { const key = view === 'world' ? countryCode(row) || String(row.country) : cityKey(row), mapped = view === 'world' ? boundaries?.features.some(feature => feature.properties.code === countryCode(row)) : pointsByKey.has(key); return <button type="button" key={key} className={city === key ? styles.selectedLocation : ''} onClick={() => { if (view === 'world') selectCountry(countryCode(row)); else { setCity(key); setView('cities'); } }} aria-label={'Explore ' + locationName(view === 'world' ? row.country : row.city)}><span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span><span className={styles.locationName}><strong>{locationName(view === 'world' ? row.country : row.city)}</strong><small>{view === 'world' ? (countryCode(row) || 'Not reported') : [locationName(row.region), locationName(row.country)].filter(value => value !== 'Location not reported').join(' · ')}{!mapped && !atlasLoading ? ' · Not mapped' : ''}</small><i style={{ width: Math.max(0, (row[metric] || 0) / maximum * 100) + '%' }} /></span><span className={styles.locationValue}>{fmt(row[metric])}<ArrowUpRight size={12} /></span></button>; })}
          {!matchingRows.length && !loading && <div className={styles.empty}><MapPin size={22} /><strong>{search ? 'No matching places' : 'No geography reported'}</strong><p>{search ? 'Try another country or city.' : 'Google Analytics has not supplied locations for this selection. Choose other dates, devices or visitors.'}</p></div>}
          {matchingRows.length > listLimit && <button type="button" className={styles.more} onClick={() => setListLimit(value => value + 50)}>Show more locations ({matchingRows.length - listLimit})</button>}
        </div>
        {selectedCityRow && <div className={styles.cityDetail}><button type="button" aria-label="Close city details" onClick={() => setCity('')}><X size={13} /></button><span>SELECTED CITY</span><strong>{locationName(selectedCityRow.city)}</strong><p>{locationName(selectedCityRow.region)} · {locationName(selectedCityRow.country)}</p><div>{fmt(selectedCityRow[metric])} <small>{metrics[metric].toLowerCase()}</small></div>{!selectedCity && <small>No unambiguous reference coordinates are available. This city is still included in the report.</small>}</div>}
      </aside>
    </div>
    <footer className={styles.footer}>
      <div><span className={styles.freshness} />{data ? 'Updated ' + new Date(data.observedAt).toLocaleString('en-GB', { timeZone: 'Europe/Tirane', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Google Analytics website report'} · Refreshes while you explore</div>
      <p>{metric === 'activeUsers' ? 'Users are counted for the selected period. Location groups and first-time / returning groups can overlap; do not add them to calculate unique visitors. ' : 'Visits = sessions. Engaged visits = engaged sessions. '}Geography is approximate and may be incomplete for privacy. {data?.countries.thresholded || data?.cities.thresholded ? 'Google applied privacy thresholds. ' : ''}{data?.countries.sampled || data?.cities.sampled ? 'Google returned sampled data. ' : ''}{data?.countries.truncated || data?.cities.truncated ? 'Showing the top 4,000 locations; the audience total covers the full selection. ' : ''}{view !== 'world' && !atlasLoading && located.unmapped.length ? located.unmapped.length + ' reported locations could not be mapped; they remain in the list and export. ' : ''}Current-day reports may still be processing. {data ? 'Report timezone: ' + data.countries.timezone + '.' : ''}</p>
    </footer>
  </section>;
}
