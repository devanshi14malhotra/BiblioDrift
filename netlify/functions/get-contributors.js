// Netlify Function: get-contributors
// Expects query params: owner, repo, per_page (optional)
// Uses GITHUB_TOKEN env var when present. Caches results in-memory for TTL.

const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
let cache = {}; // simple in-memory cache: { key: { ts, data } }

exports.handler = async function(event) {
  try {
    const q = event.queryStringParameters || {};
    const owner = q.owner || 'devanshi14malhotra';
    const repo = q.repo || 'BiblioDrift';
    const per_page = q.per_page || '100';

    const cacheKey = `${owner}/${repo}?per_page=${per_page}`;
    const now = Date.now();
    if(cache[cacheKey] && (now - cache[cacheKey].ts) < CACHE_TTL){
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache[cacheKey].data),
      };
    }

    const token = process.env.GITHUB_TOKEN;
    const headers = { 'User-Agent': 'BiblioDrift-landing' };
    if(token) headers['Authorization'] = `token ${token}`;

    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${per_page}`;
    const res = await fetch(url, { headers });

    if(!res.ok){
      const text = await res.text();
      return { statusCode: res.status, body: text };
    }

    const data = await res.json();
    cache[cacheKey] = { ts: now, data };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch(err){
    return { statusCode: 500, body: String(err) };
  }
};
