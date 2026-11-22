const search = document.getElementById('docs-search');
const sections = Array.from(document.querySelectorAll('[data-doc-section]'));
const links = Array.from(document.querySelectorAll('[data-section-link]'));
const emptyMessage = document.getElementById('search-empty');

function filterDocs() {
    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;
    sections.forEach(section => {
        const visible = !query || section.textContent.toLowerCase().includes(query);
        section.hidden = !visible;
        if (visible) visibleCount++;
    });
    links.forEach(link => {
        const section = document.querySelector(link.getAttribute('href'));
        link.hidden = Boolean(query) && (!section || section.hidden);
    });
    emptyMessage.hidden = visibleCount > 0;
}

search.addEventListener('input', filterDocs);
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            search.focus();
        }
        if (event.key === 'Escape' && document.activeElement === search) {
            search.value = '';
            filterDocs();
            search.blur();
        }
});