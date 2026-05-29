document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.vault-author, [data-author]').forEach(el => {
        if (el.textContent) el.textContent = el.textContent.trim();
    });
});