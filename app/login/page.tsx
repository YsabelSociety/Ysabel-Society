import LoginForm from '@/components/ysabel/login-form';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { APP_BASE, safeReturnPath } from '@/lib/app-path';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (await getSessionUser()) {
    // The framework prepends basePath, so pass the path within the app.
    const destination = safeReturnPath((await searchParams).returnTo);
    redirect(destination.slice(APP_BASE.length) || '/');
  }
  return <LoginForm />;
}
