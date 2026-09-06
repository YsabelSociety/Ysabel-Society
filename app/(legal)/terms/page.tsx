import type { Metadata } from 'next';
import { appPath } from '@/lib/app-path';
export const metadata: Metadata = {
  title: 'Terms of use · Ysabel Society Marketing Data',
};

export default function Terms() {
  return (
    <>
      <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '12px 0 16px' }}>
        Terms of use
      </h1>
      <p>
        Effective 6 September 2026. These terms cover the Ysabel Society
        Marketing Data dashboard at ysabelsociety.com/marketingdata.
      </p>
      <h2>Authorized business use</h2>
      <p>
        The dashboard is an internal reporting tool for authorized Ysabel
        Society personnel. Use it only for business accounts and information you
        are entitled to access. Keep workspace credentials private and do not
        share reports or customer information outside authorized business
        purposes.
      </p>
      <h2>Connected platforms</h2>
      <p>
        Connect only accounts you own or are authorized to manage. Each
        platform's terms and permission rules continue to apply. Connections
        depend on provider approval, account eligibility and available APIs. The
        TikTok connection requests read-only profile statistics and public-video
        reporting; it does not publish content or access direct messages.
      </p>
      <h2>Understanding reports</h2>
      <p>
        Reports can be incomplete, delayed or unavailable. Different platforms
        use different metric definitions. Lifetime video counters are not daily
        traffic totals, and audiences across platforms cannot be assumed to be
        unique. Check the source, date range and import coverage before using a
        report for a business decision.
      </p>
      <h2>Access and privacy</h2>
      <p>
        The workspace administrator manages access and can disable connections.
        You can revoke platform authorization in that platform's settings.
        Previously imported reports may remain until the administrator removes
        them. See the <a href={appPath('/privacy')}>privacy policy</a> for the
        information processed, storage and deletion requests.
      </p>
      <h2>Support</h2>
      <p>
        Contact your Ysabel Society workspace administrator for help, access
        changes or removal of stored information. Ysabel Society's official
        website provides business contact options. These terms concern the
        reporting dashboard only.
      </p>
    </>
  );
}
