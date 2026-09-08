import type { Metadata } from "next";
import styles from "./contentpreview.module.css";
import InstallApp from "./InstallApp";

export const metadata: Metadata = {
  title: "Content Media Preview | Ysabel Society",
  description: "Private Ysabel Society content direction preview.",
  robots: { index: false, follow: false },
  manifest: '/contentpreview-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Ysabel Preview', statusBarStyle: 'default' },
  icons: { apple: '/contentpreview-icons/icon-192.png' },
};

const previewBuildTag =
  process.env.NEXT_PUBLIC_CONTENTPREVIEW_BUILD_TAG ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.COMMIT_REF ??
  process.env.GITHUB_SHA ??
  `${Date.now()}`;

export default function ContentPreviewPage() {
  const cacheBust = encodeURIComponent(previewBuildTag);
  return (
    <main className={styles.previewShell}>
      <iframe
        className={styles.previewFrame}
        src={`/contentpreview-app/index.html?v=${cacheBust}`}
        title="Ysabel Society Content Media Preview"
        allow="fullscreen"
      />
      <InstallApp />
    </main>
  );
}
