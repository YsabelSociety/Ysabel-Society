import { identity, apiError } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/admin-access';
import { connectorGroup } from '@/lib/connector-catalog';
import { beginOAuth } from '@/lib/server/connector-oauth';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const user = await requireAdmin(req),
      group = connectorGroup((await params).provider),
      result = await beginOAuth(user.userId, group.id, req);
    return Response.json(
      { url: result.url },
      {
        headers: {
          'Set-Cookie': result.cookie,
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
