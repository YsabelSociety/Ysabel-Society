import type { Metadata } from "next";
import styles from "./contentpreview.module.css";

export const metadata: Metadata = {
  title: "Content Media Preview | Ysabel Society",
  description: "Private Ysabel Society content direction preview.",
  robots: { index: false, follow: false },
};

export default function ContentPreviewPage() {
  return (
    <main className={styles.previewShell}>
      <iframe
        className={styles.previewFrame}
        src="https://ysabel-society-media-preview.arberhalili1.chatgpt.site/"
        title="Ysabel Society Content Media Preview"
        allow="fullscreen"
      />
    </main>
  );
}
