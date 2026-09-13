export const APP_BASE = '/marketingdata';
export function appPath(path = '/') {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path === APP_BASE ||
    path.startsWith(APP_BASE + '/')
  )
    return path;
  return APP_BASE + path;
}
export function safeReturnPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith(APP_BASE) ||
    value.includes('\\')
  )
    return APP_BASE + '/';
  const parsed = new URL(value, 'https://app.local');
  if (
    parsed.origin !== 'https://app.local' ||
    (parsed.pathname !== APP_BASE &&
      !parsed.pathname.startsWith(APP_BASE + '/')) ||
    parsed.pathname.startsWith(APP_BASE + '/login') ||
    parsed.pathname.startsWith(APP_BASE + '/api/')
  )
    return APP_BASE + '/';
  return parsed.pathname + parsed.search + parsed.hash;
}
