import Workspace from '@/components/ysabel/workspace';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Connections() {
  await requireChatGPTUser('/connections');
  return <Workspace initialPage="Connections" />;
}
