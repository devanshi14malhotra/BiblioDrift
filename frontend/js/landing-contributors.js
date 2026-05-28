/**
 * Landing Page Contributors Loader
 * Fetches and displays contributors in a carousel and grid view
 */

(function(){
    const lists = document.querySelectorAll('.contributors-list');
    if(!lists.length) return;

    const REFRESH_INTERVAL_MS = 8 * 60 * 60 * 1000;
    const FEATURED_LIMIT = 10;
    const STATIC_PATHS = [
        '../data/contributors.json',
        '/data/contributors.json',
        'frontend/data/contributors.json'
    ];

    function storageGet(key){
        try { return window.localStorage.getItem(key); }
        catch(e){ return null; }
    }

    function storageSet(key, value){
        try { window.localStorage.setItem(key, value); }
        catch(e){}
    }

    lists.forEach(container => {
        const owner = container.dataset.owner || 'devanshi14malhotra';
        const repo = container.dataset.repo || 'BiblioDrift';
        const loading = container.querySelector('.contributors-loading');
        const section = container.closest('.landing-section');
        const cacheKey = `biblioDrift.contributors.${owner}.${repo}`;
        const cacheTimeKey = `${cacheKey}.fetchedAt`;

        let contributors = [];
        let renderVersion = 0;

        function readCachedContributors(){
            const raw = storageGet(cacheKey);
            if(!raw) return [];
            try { return JSON.parse(raw); }
            catch(e){ return []; }
        }

        function writeCachedContributors(data){
            storageSet(cacheKey, JSON.stringify(data));
            storageSet(cacheTimeKey, String(Date.now()));
        }

        function cacheAgeMs(){
            const raw = storageGet(cacheTimeKey);
            if(!raw) return Number.POSITIVE_INFINITY;
            const parsed = Number(raw);
            if(!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
            return Date.now() - parsed;
        }

        function createContributorCard(user){
            const a = document.createElement('a');
            a.className = 'contributor-item';
            a.href = user.html_url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            const img = document.createElement('img');
            img.className = 'contributor-avatar-img';
            img.loading = 'lazy';
            img.alt = user.login;
            img.src = `${user.avatar_url}?s=160`;

            const meta = document.createElement('div');
            meta.className = 'contributor-meta';
            const name = document.createElement('div');
            name.className = 'contributor-name';
            name.textContent = user.login;
            const count = document.createElement('div');
            count.className = 'contrib-count';
            count.textContent = user.contributions ? `${user.contributions} contributions` : 'GitHub contributor';

            meta.appendChild(name);
            meta.appendChild(count);
            a.appendChild(img);
            a.appendChild(meta);
            return a;
        }

        function startTicker(track, slider, version){
            if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
                return;
            }

            const originals = Array.from(track.children);
            let singleWidth = 0;
            const imgs = track.querySelectorAll('img');
            let started = false;
            let bootAttempts = 0;
            let animationFrameId = 0;
            let resizeObserver = null;

            const compute = ()=>{
                let width = track.scrollWidth ? track.scrollWidth / 2 : 0;
                if(!width){
                    width = originals.reduce((sum, el)=> sum + el.getBoundingClientRect().width, 0);
                }
                if(!width){
                    width = originals.reduce((sum, el)=> sum + el.offsetWidth, 0);
                }
                singleWidth = Math.max(0, width);
                track.style.width = `${Math.max(singleWidth * 2, track.scrollWidth)}px`;
            };

            const run = ()=>{
                if(started){
                    return;
                }
                started = true;
                track.style.display = 'flex';
                track.style.transition = 'none';
                compute();

                if(window.ResizeObserver){
                    resizeObserver = new ResizeObserver(()=> {
                        const previousWidth = singleWidth;
                        compute();
                        if(previousWidth !== singleWidth && singleWidth > 0){
                            pos = singleWidth ? pos % singleWidth : 0;
                            track.style.transform = `translateX(-${pos}px)`;
                        }
                    });
                    resizeObserver.observe(track);
                }

                let pos = 0;
                const speed = 90;
                let last = performance.now();

                function frame(now){
                    if(container.dataset.renderVersion !== String(version)){
                        if(resizeObserver){
                            resizeObserver.disconnect();
                        }
                        return;
                    }

                    const dt = (now - last) / 1000;
                    last = now;
                    if(singleWidth > 0){
                        pos = (pos + speed * dt) % singleWidth;
                        track.style.transform = `translateX(-${pos}px)`;
                    }
                    animationFrameId = requestAnimationFrame(frame);
                }

                animationFrameId = requestAnimationFrame(frame);
            };

            const boot = ()=>{
                if(container.dataset.renderVersion !== String(version)){
                    return;
                }

                compute();

                if(singleWidth > 0){
                    run();
                    return;
                }

                if(bootAttempts < 45){
                    bootAttempts += 1;
                    requestAnimationFrame(boot);
                    return;
                }

                run();
            };

            imgs.forEach(img => {
                const retry = ()=> {
                    if(!started){
                        boot();
                    } else {
                        compute();
                    }
                };

                if(img.complete){
                    retry();
                    return;
                }

                img.addEventListener('load', retry, { once: true });
                img.addEventListener('error', retry, { once: true });
            });

            requestAnimationFrame(boot);
            setTimeout(boot, 600);
        }

        function renderContributors(data){
            if(!Array.isArray(data) || !data.length){
                if(loading) loading.textContent = 'No contributors found.';
                return;
            }

            contributors = data;
            container.dataset.renderVersion = String(renderVersion += 1);
            if(loading && loading.parentNode){
                loading.remove();
            }

            container.innerHTML = '';
            const panel = document.createElement('div');
            panel.className = 'contributors-panel';

            const slider = document.createElement('div');
            slider.className = 'contributors-slider';
            const track = document.createElement('div');
            track.className = 'slider-track';

            const shown = data.slice(0, Math.min(FEATURED_LIMIT, data.length));
            shown.forEach(user => {
                const slide = document.createElement('div');
                slide.className = 'slide';
                slide.appendChild(createContributorCard(user));
                track.appendChild(slide);
            });

            slider.appendChild(track);
            panel.appendChild(slider);

            const grid = document.createElement('div');
            grid.className = 'contributors-grid-view';
            data.forEach(user => {
                grid.appendChild(createContributorCard(user));
            });
            panel.appendChild(grid);

            container.appendChild(panel);
            const duplicates = Array.from(track.children);
            duplicates.forEach(node => track.appendChild(node.cloneNode(true)));

            startTicker(track, slider, renderVersion);
        }

        async function fetchStaticContributors(){
            for(const path of STATIC_PATHS){
                try{
                    const res = await fetch(path);
                    if(!res.ok) continue;
                    const data = await res.json();
                    if(Array.isArray(data) && data.length){
                        return data;
                    }
                }catch(e){
                    continue;
                }
            }
            return [];
        }

        async function fetchGitHubContributors(){
            const perPage = 100;
            const all = [];

            for(let page = 1; page <= 20; page += 1){
                const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${perPage}&page=${page}`;
                const res = await fetch(url, {
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'BiblioDrift-contributors'
                    }
                });

                if(!res.ok){
                    throw new Error(`GitHub returned ${res.status}`);
                }

                const data = await res.json();
                if(!Array.isArray(data) || !data.length){
                    break;
                }

                all.push(...data);
                if(data.length < perPage){
                    break;
                }
            }

            return Array.from(new Map(all.filter(user => user && user.login).map(user => [user.login, user])).values());
        }

        async function refreshContributorSource(force = false){
            const cached = readCachedContributors();
            if(cached.length && !force && cacheAgeMs() < REFRESH_INTERVAL_MS){
                renderContributors(cached);
                return;
            }

            const staticData = await fetchStaticContributors();
            if(staticData.length){
                renderContributors(staticData);
            } else if(cached.length){
                renderContributors(cached);
            }

            try{
                if(!force && cached.length && cacheAgeMs() < REFRESH_INTERVAL_MS){
                    return;
                }

                const liveData = await fetchGitHubContributors();
                if(liveData.length){
                    writeCachedContributors(liveData);
                    renderContributors(liveData);
                }
            }catch(e){
                if(!staticData.length && !cached.length){
                    if(loading){
                        loading.textContent = 'Contributors not available.';
                        const link = document.createElement('a');
                        link.href = `https://github.com/${owner}/${repo}/graphs/contributors`;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = 'View contributors on GitHub';
                        link.style.display = 'inline-block';
                        link.style.marginTop = '8px';
                        loading.appendChild(link);
                    }
                }
            }
        }

        refreshContributorSource(false);
        setInterval(()=> refreshContributorSource(true), REFRESH_INTERVAL_MS);
    });
})();
