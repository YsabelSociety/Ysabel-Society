import { requireChatGPTUser } from '../chatgpt-auth';
import { TikTokBusinessSetup } from '@/components/ysabel/tiktok-business';
export const dynamic = 'force-dynamic';
export default async function TikTokBusinessPage() {
  await requireChatGPTUser('/tiktok-business');
  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <a className="secondary" href="/marketingdata/#Inbox">
        Back to inbox
      </a>
      <section className="surface community-panel" style={{ marginTop: 24 }}>
        <TikTokBusinessSetup />
      </section>
    </main>
  );
}
