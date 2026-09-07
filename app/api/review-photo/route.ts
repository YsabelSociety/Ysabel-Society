import { identity, apiError, requireText } from '@/lib/server/db';
import { readGoogleReview } from '@/lib/server/community-store';
import { fetchReviewPhoto } from '@/lib/server/review-photo';
export async function GET(req: Request) {
  try {
    const owner = (await identity()).userId,
      params = new URL(req.url).searchParams;
    const review = await readGoogleReview(
      owner,
      requireText(params.get('accountId'), 300),
      requireText(params.get('id'), 300),
    );
    const photo = review?.avatar ? await fetchReviewPhoto(review.avatar) : null;
    if (!photo)
      return new Response(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    return new Response(photo.bytes, {
      headers: {
        'Content-Type': photo.type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
