import { appPath } from '@/lib/app-path';
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src={appPath('/ysabel-society-logo.png')}
      alt="Ysabel Society"
      width={8000}
      height={4500}
      className={'brand-logo ' + className}
    />
  );
}
