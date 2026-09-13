export function verifiedMetaExpiry(
  data: {
    is_valid?: boolean;
    app_id?: string;
    expires_at?: number;
    data_access_expires_at?: number;
  },
  appId: string,
  now = Date.now(),
) {
  if (data.is_valid !== true || String(data.app_id) !== appId)
    throw new Error(
      'INPUT:Meta authorization is no longer valid. Connect this platform again.',
    );
  const limits = [data.expires_at, data.data_access_expires_at]
    .filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
    )
    .map((v) => v * 1000);
  if (limits.some((v) => v <= now + 90000))
    throw new Error(
      'INPUT:Meta authorization expired. Connect this platform again.',
    );
  // An omitted/zero expiry is not a one-hour token. Revalidate with Meta hourly.
  return limits.length ? Math.min(...limits) : now + 3600000;
}
