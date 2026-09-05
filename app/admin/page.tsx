import Workspace from '@/components/ysabel/workspace';
import { requireChatGPTUser } from '../chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireChatGPTUser('/admin');
  return <Workspace initialPage="Admin Panel" />;
}
