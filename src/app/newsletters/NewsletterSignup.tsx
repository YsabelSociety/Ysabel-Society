"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./newsletters.module.css";

const FORM_ID = "750dcd2a-cf0e-11f1-a78f-2763974ba562";
const FORM_SCRIPT = `https://eocampaign1.com/form/${FORM_ID}.js?v=20261023-2`;

export default function NewsletterSignup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let mounted = true;

    const checkForm = () => {
      const form = container.querySelector("form");
      if (!form) return;
      form.setAttribute("aria-label", "Subscribe to Ysabel newsletters");
      const email = form.querySelector<HTMLInputElement>('input[type="email"]');
      email?.setAttribute("aria-label", "Email address");
      email?.setAttribute("autocomplete", "email");
      for (const [selector, role] of [
        [".emailoctopus-success-message", "status"],
        [".emailoctopus-error-message", "alert"],
      ]) {
        const message = container.querySelector(selector);
        message?.setAttribute("role", role);
        message?.setAttribute("aria-atomic", "true");
      }
      if (mounted) setStatus("ready");
    };

    const observer = new MutationObserver(checkForm);
    observer.observe(container, { childList: true, subtree: true });

    // EmailOctopus replaces its script with the live form. Remember insertion
    // on the container so React Strict Mode does not insert a second copy.
    if (!container.dataset.signupInitialized) {
      container.dataset.signupInitialized = "true";
      const script = document.createElement("script");
      script.async = true;
      script.src = FORM_SCRIPT;
      script.dataset.form = FORM_ID;
      script.onerror = () => {
        if (mounted) setStatus("error");
      };
      container.appendChild(script);
    }
    checkForm();

    const timeout = window.setTimeout(() => {
      if (mounted && !container.querySelector("form")) setStatus("error");
    }, 15000);

    return () => {
      mounted = false;
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <section id="subscribe" className={styles.signup} aria-labelledby="subscribe-title">
      <div className={styles.signupCopy}>
        <p className={styles.signupEyebrow}>Stay in the know</p>
        <h2 id="subscribe-title">The next story,<br />in your inbox.</h2>
        <p>Seasonal menus, special evenings, and invitations from Ysabel Society.</p>
      </div>
      <div className={styles.signupFields}>
        {status === "loading" && <p className={styles.signupLoading} role="status">Loading signup form…</p>}
        <div ref={containerRef} className={styles.signupEmbed} />
        {status === "error" && (
          <div className={styles.signupError} role="alert">
            <p>We couldn’t load the signup form. Please try again.</p>
            <button type="button" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
        <noscript><p>Enable JavaScript to subscribe to our newsletters.</p></noscript>
        <p className={styles.captchaNotice}>
          This site is protected by reCAPTCHA. Google’s{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>{" "}
          and <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.
        </p>
      </div>
    </section>
  );
}
