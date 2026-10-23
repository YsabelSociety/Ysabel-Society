import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "../components/Header/Header";
import { newsletterArchive } from "@/lib/newsletter-archive";
import styles from "./newsletters.module.css";

export const metadata: Metadata = {
  title: "Newsletters | Ysabel Society",
  description:
    "Explore the Ysabel Society newsletter archive. Seasonal menus, stories, and invitations from Ysabel Garden, Italian, and Asian.",
  alternates: { canonical: "https://ysabelsociety.com/newsletters" },
  openGraph: {
    title: "Newsletters | Ysabel Society",
    description: "Stories, seasonal menus, and invitations. A collection of moments from Ysabel Society.",
    url: "https://ysabelsociety.com/newsletters",
    type: "website",
    images: [{ url: `https://ysabelsociety.com${newsletterArchive[0].image}` }],
  },
};

function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function NewslettersPage() {
  return (
    <div className={styles.page}>
      <Header />
      <section className={styles.hero} aria-labelledby="newsletters-title">
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Ysabel Society · The archive</p>
          <div className={styles.heroRow}>
            <h1 id="newsletters-title">Newsletters<span className={styles.titleDot}>.</span></h1>
            <p className={styles.intro}>
              Stories, seasonal menus, and invitations.<br />
              A collection of moments from Ysabel.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.archive} aria-labelledby="archive-title">
        <div className={styles.archiveHeading}>
          <h2 id="archive-title">All editions <span>({String(newsletterArchive.length).padStart(2, "0")})</span></h2>
          <p>2026 <span aria-hidden="true">/</span> Newest first</p>
        </div>
        <ol className={styles.editions}>
          {newsletterArchive.map((edition, index) => (
            <li key={edition.id}>
              <article className={styles.edition}>
                <a href={edition.href} className={styles.editionLink} aria-labelledby={`${edition.id}-title`}>
                  <div className={styles.artwork}>
                    <Image
                      src={edition.image}
                      alt={edition.imageAlt}
                      fill
                      sizes="(max-width: 640px) calc(100vw - 48px), (max-width: 960px) calc((100vw - 88px) / 2), (max-width: 1440px) calc((100vw - 160px) / 3), 420px"
                      style={{ objectFit: "cover", objectPosition: edition.imagePosition }}
                      priority={index === 0}
                    />
                    <span className={styles.editionNumber} aria-hidden="true">N° {String(newsletterArchive.length - index).padStart(2, "0")}</span>
                    <span className={styles.imageArrow}><Arrow /></span>
                  </div>
                  <div className={styles.editionMeta}>
                    <span>{edition.venue}</span>
                    <time dateTime={edition.published}>{edition.dateLabel}</time>
                  </div>
                  <h3 id={`${edition.id}-title`}>{edition.title}</h3>
                  <p className={styles.description}>{edition.description}</p>
                  <span className={styles.read}>Read the newsletter <Arrow /></span>
                </a>
              </article>
            </li>
          ))}
        </ol>
        <div className={styles.archiveNote}>
          <span className={styles.noteStar} aria-hidden="true">✳</span>
          <p>A place to return to.<br /><span>More stories, as they unfold.</span></p>
          <Link href="/">Back to Ysabel <Arrow /></Link>
        </div>
      </section>
    </div>
  );
}
