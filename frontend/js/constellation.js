(function () {
  const canvas = document.getElementById('constellationCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const STAR_COUNT = 120;
  const CONNECTION_DIST = 140;
  const stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function randomStar() {
    return {
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.5 + 0.4,
      alpha: Math.random() * 0.5 + 0.3,
      dx:    (Math.random() - 0.5) * 0.18,
      dy:    (Math.random() - 0.5) * 0.18,
      twinkleSpeed: Math.random() * 0.008 + 0.003,
      twinkleDir: Math.random() > 0.5 ? 1 : -1,
    };
  }

  function init() {
    resize();
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) stars.push(randomStar());
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const lineAlpha = (1 - dist / CONNECTION_DIST) * 0.18;
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = `rgba(212, 175, 55, ${lineAlpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 248, 220, ${s.alpha})`;
      ctx.fill();
    });
  }

  function update() {
    stars.forEach(s => {
      s.x += s.dx;
      s.y += s.dy;

      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha > 0.85 || s.alpha < 0.2) s.twinkleDir *= -1;

      if (s.x < 0) s.x = canvas.width;
      if (s.x > canvas.width) s.x = 0;
      if (s.y < 0) s.y = canvas.height;
      if (s.y > canvas.height) s.y = 0;
    });
  }

  let animId = null;

  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function startConstellation() {
    if (animId) return;
    canvas.style.opacity = '1';
    loop();
  }

  function stopConstellation() {
    canvas.style.opacity = '0';
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function checkTheme() {
    const isNight = document.documentElement.getAttribute('data-theme') === 'night';
    isNight ? startConstellation() : stopConstellation();
  }

  const observer = new MutationObserver(checkTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  window.addEventListener('resize', () => {
    resize();
    init();
  });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    init();
    checkTheme();
  }
})();
