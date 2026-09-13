# Review intelligence

The Google critical report considers all ratings, including five stars. OpenAI setup is in **Google Business → Critical review reports → Connect OpenAI**, protected by the existing administrator PIN. The key is kept in Netlify's private server-side store (or supplied through `OPENAI_API_KEY`) and never returned to the UI. No secret belongs in Git.

`gpt-5.4-mini` processes the complete saved review text and overall rating using the Responses API and a strict structured output. Names, avatars and customer photos are not sent. `store:false` is set. Findings must quote an exact supporting passage from the original; ungrounded or incomplete responses are rejected. Original comments are retained, English translations are displayed separately, and uncertain findings are labelled. AI interpretation still requires human judgment, particularly for sarcasm and ambiguous wording.

The app processes two pending reviews per request while the Google report is open. Closing the report stops further requests; reopening resumes. Each result is saved against its review ID, original text, rating and analyzer version. Changed text/rating invalidates prior analysis. Concurrent sessions share short-lived locks; successful results are reused. Failures stop the loop until a retry instead of repeatedly consuming quota. The UI never claims the rules fallback is an AI result. API usage is billed to the connected OpenAI account.

Customer photo snapshots store Google-hosted image URLs against the exact reviewer profile identity in private Netlify storage. The importer verifies that each matching review already exists; it never guesses photos based on names. Original image URLs are used for full-size viewing, small thumbnails for the gallery. Some owner-view galleries expose only a subset of a review's photos; the original Google review remains the source for additional images. No missing photos are synthesized.

Validation: parser/evidence/cache tests in `tests/review-ai.test.mjs`, existing import/classification tests, frontend typecheck/build and Next production build. An actual API translation remains unverified until a valid, funded OpenAI key is entered and a real review completes. PDFs retain English text and original comments, criticism and evidence, reviewer photos, and customer image links.

References: https://developers.openai.com/api/docs/guides/structured-outputs and https://docs.netlify.com/build/data-and-storage/netlify-blobs/
