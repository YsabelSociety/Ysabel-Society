# Google Business review recovery and daily reconciliation

Ysabel Society's Cloud project `ysabel-society-analytics` (684690867260) still had zero Account Management API quota on 13 September 2026. Do not label it an active API feed. Support cases: 4-2052000041307 and 0-4245000041665. No paid connector or billing has been added.

## Working fallback

Use the owner's signed-in Chrome Google Business interface to capture reviews and the private dashboard's **Import Google snapshot** control to upsert them. This is browser-assisted collection, not unattended server API access. It requires the computer, Codex, and the owner's Google session to be available. Do not access browser cookies or call undocumented Google endpoints. Do not send review replies or change the business profile.

1. Open the observed owner page `https://www.google.com/local/business/2654256529003455405/customers/reviews?hl=en` through the approved browser tool. Verify that it is the Ysabel Society profile. If Google requests sign-in, ask the user to complete it.
2. Keep **All** reviews selected. Follow **More Reviews** until no more pages are returned; allow each page to finish loading before the next click. Inspect the final count against the displayed total. Never claim hidden or removed records were retrieved.
3. Read the actual review-card DOM through the browser tool. In the observed interface, cards are `article[aria-label="Review"]`. Inspect current markup before relying on selectors. Each card has a profile anchor containing `/maps/contrib/`, reviewer name in its text node, an `img` avatar, a star image with an accessible rating, `.KEfuhb` relative date, and `[data-share-review-url]` original review link. Full comment text is in `[jsname="PBWx0c"]`, with collapsed text in `[jsname="lvvS4b"]`; preserve line breaks and include Google sub-ratings from `.VvNSNb`. These are page DOM elements, not hidden application state. Use the UI to expand details when necessary. Do not use internal endpoints.
4. Prepare JSON in the browser-tool session:
   `{ "businessId": "2654256529003455405", "capturedAt": "<actual ISO capture time>", "reviews": [{ "profileId": "<Google profile number>", "name": "...", "profileUrl": "https://www.google.com/maps/contrib/.../reviews", "avatar": "https://...", "rating": 1, "timeLabel": "Yesterday", "reviewUrl": "https://www.google.com/maps/reviews/...", "text": "Full original comment", "details": "Google sub-ratings and details" }] }`.
5. Open `https://ysabelsociety.com/marketingdata#Google%20Business`. Wait for existing reviews to load. Click **Import Google snapshot**, paste that JSON into **Review snapshot**, and click **Preview review import**. The app calculates additions, updates and retained history using existing Google profile identities. Reject obviously wrong business IDs, missing ratings, truncated comments or unexpected large additions.
6. Click **Import reviews** in this dialog. This writes batches of 40 through the existing authenticated community importer. It does not require an API grant or an administrator PIN. It does not delete anything. Retrying uses the same IDs and is safe from duplicate additions.
7. Wait for the success message. Close the dialog and verify the saved review count and newest reviews. Check that **Critical review reports** reflects new criticism. Report new-review count and any genuine failure; remain quiet when a scheduled check changes nothing.

## Data integrity

The importer preserves existing record IDs, timestamps, owner replies and missing avatar/link fields. Relative Google dates for newly captured reviews stay explicitly approximate. Existing API-owned records are skipped to avoid creating file duplicates. A Google review no longer visible stays in captured history. The source remains `file` because this is an owner-view snapshot; automatic API access remains separate.

On 13 September the owner interface displayed 335 reviews while returning 334 distinct review cards. Reconciliation found eight new reviewer profiles (seven recent and one older), updated 326 records and retained two previously saved records that Google did not return. The verified app total became 336 with all old records retained. All eight additions have profile photos and review links. Always recompute counts; do not hard-code this historical result.

The preview separately reports unchanged records; skip submitting when both new and updated counts are zero, and stay quiet. Google category sub-scores of 1–3 are now used as direct evidence for critical-review categorization, even when comments are untranslated. An overall low score alone does not assign a topic.

## Eventual direct API activation

After Google grants nonzero quota, discover and select only the actual Ysabel Society API location, test paginated Reviews API retrieval, reconcile file and API identities before enabling dual imports, and verify the server schedule. New/updated review notifications can then trigger retrieval via Google's supported notification service. No such event feed is claimed active now.
