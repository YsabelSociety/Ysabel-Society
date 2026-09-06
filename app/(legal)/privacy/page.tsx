import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Privacy policy · Ysabel Society Marketing Data',
};

export default function Privacy() {
  return (
    <>
      <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '12px 0 16px' }}>
        Privacy policy
      </h1>
      <p>
        Effective 6 September 2026. This notice covers the Ysabel Society
        Marketing Data dashboard at ysabelsociety.com/marketingdata, an internal
        workspace operated for Ysabel Society.
      </p>
      <h2>Information the dashboard uses</h2>
      <p>
        Authorized users can connect business accounts and import reports. The
        dashboard stores selected account identifiers, report data, connection
        settings and synchronization history. Other connected sources can
        include social content and audience reports, website analytics, business
        reviews and permitted customer conversations. The information available
        depends on the provider and permissions granted.
      </p>
      <h2>TikTok connection</h2>
      <p>
        TikTok sign-in takes place on TikTok. This dashboard does not ask for or
        store your TikTok password. With authorization, the connection reads
        your account identifier and display name, follower/following counts,
        total likes, video count, and accessible public videos with their
        titles, links, covers and lifetime views, likes, comments and shares. It
        stores authorization and refresh tokens to retrieve these reports. The
        current TikTok connection does not request posting, direct-message or
        private-video access.
      </p>
      <h2>Purpose, access and service providers</h2>
      <p>
        The information is used to display and compare Ysabel Society's
        marketing performance and maintain its connections. Reports require
        workspace sign-in. Authorized workspace users can view and export
        reports; they are responsible for handling exported files. App
        credentials and provider tokens are encrypted in server storage. Hosting
        and storage are supplied through OpenAI Sites and Cloudflare; the public
        website is delivered through its website hosting provider. Connected
        platforms process authorization and API requests under their own
        policies. This dashboard has no feature for selling imported data or
        sending it to advertising audiences.
      </p>
      <h2>Storage, cookies and deletion</h2>
      <p>
        Essential session cookies keep users signed in and verify connection
        requests. Imported reports are retained for historical comparison until
        removed by the workspace administrator; there is no automatic
        report-retention deadline. Disconnecting an account stops its automatic
        synchronization but does not erase previous reports or necessarily
        revoke the provider's grant. Revoke access in the connected platform's
        settings to stop that grant, and contact the Ysabel Society workspace
        administrator to request deletion of stored reports and connection
        credentials. Requests can also be directed to Ysabel Society through the
        contact options on its official website.
      </p>
      <h2>Updates and questions</h2>
      <p>
        Changes to this notice will appear here with an updated effective date.
        Contact your Ysabel Society workspace administrator about access,
        correction, deletion or the way dashboard information is used.
      </p>
    </>
  );
}
