import { permanentRedirect } from "next/navigation";

export default function NewsletterRedirect() {
  permanentRedirect("/newsletters");
}
