Netlify functions

get-contributors
- Purpose: proxy to GitHub contributors endpoint with server-side caching.
- Required env var: `GITHUB_TOKEN` (recommended). Create a GitHub personal access token (no scopes needed for public repo reads) and add it to Netlify site settings as `GITHUB_TOKEN`.
- Deploy: Netlify will automatically detect the `netlify/functions` folder and deploy functions.

Client usage
- The landing page now calls: `/.netlify/functions/get-contributors?owner=devanshi14malhotra&repo=BiblioDrift&per_page=100`
- If `GITHUB_TOKEN` is set, the function will use it to avoid rate limits. The function caches results for 12 hours.
