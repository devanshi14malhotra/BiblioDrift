const header = document.querySelector('header');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('shrink');
  } else {
    header.classList.remove('shrink');
  }
  const btn = document.getElementById('backToTop');
  if (btn) {
    if (window.scrollY > 200) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }
});

document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.copy-note-btn');
  if (!copyBtn) return;
  const targetId = copyBtn.dataset.copyTarget;
  const el = document.getElementById(targetId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const icon = copyBtn.querySelector('i');
    const origClass = icon.className;
    icon.className = 'fa-solid fa-check';
    setTimeout(() => { icon.className = origClass; }, 2000);
  }).catch(() => {
    const icon = copyBtn.querySelector('i');
    const origClass = icon.className;
    icon.className = 'fa-solid fa-xmark';
    setTimeout(() => { icon.className = origClass; }, 2000);
  });
});
