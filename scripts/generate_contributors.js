// scripts/generate_contributors.js
// Fetch GitHub contributors and write to frontend/data/contributors.json

const fs = require('fs');
const path = require('path');

async function run(){
  const owner = process.env.OWNER || 'devanshi14malhotra';
  const repo = process.env.REPO || 'BiblioDrift';
  const perPage = Number(process.env.PER_PAGE || '100');
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'User-Agent': 'BiblioDrift-generate-script',
    'Accept': 'application/vnd.github+json'
  };

  if(token){
    headers.Authorization = `Bearer ${token}`;
  }

  const contributors = [];
  const maxPages = Number(process.env.MAX_PAGES || '20');

  for(let page = 1; page <= maxPages; page += 1){
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${perPage}&page=${page}`;
    console.log('Fetching contributors from', url);

    const res = await fetch(url, { headers });
    if(!res.ok){
      const text = await res.text();
      console.error('Failed to fetch contributors:', res.status, text);
      process.exit(2);
    }

    const data = await res.json();
    if(!Array.isArray(data) || data.length === 0){
      break;
    }

    contributors.push(...data);
    if(data.length < perPage){
      break;
    }
  }

  const uniqueContributors = Array.from(
    new Map(contributors.filter((user) => user && user.login).map((user) => [user.login, user])).values()
  );

  const outDir = path.join(__dirname, '..', 'frontend', 'data');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'contributors.json');
  fs.writeFileSync(outPath, JSON.stringify(uniqueContributors, null, 2), 'utf8');
  console.log(`Wrote ${uniqueContributors.length} contributors to`, outPath);
}

run().catch(err => { console.error(err); process.exit(99); });
