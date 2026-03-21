const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const navButtons = Array.from(document.querySelectorAll('[data-target]'));
const sections = Array.from(document.querySelectorAll('.manual-section'));
const printManualBtn = document.getElementById('printManualBtn');

let activeFilter = 'all';

function matchesAudience(section, filterValue) {
    if (filterValue === 'all') {
        return true;
    }

    const audience = (section.dataset.audience || '').split(/\s+/);
    return audience.includes(filterValue);
}

function setActiveFilter(filterValue) {
    activeFilter = filterValue;

    filterButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.filter === filterValue);
    });

    sections.forEach((section) => {
        section.classList.toggle('is-hidden', !matchesAudience(section, filterValue));
    });

    const firstVisibleSection = sections.find((section) => !section.classList.contains('is-hidden'));
    if (firstVisibleSection) {
        setActiveSection(firstVisibleSection.id);
        firstVisibleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setActiveSection(sectionId) {
    navButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.target === sectionId);
    });
}

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        setActiveFilter(button.dataset.filter);
    });
});

navButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const targetSection = document.getElementById(button.dataset.target);
        if (!targetSection || targetSection.classList.contains('is-hidden')) {
            return;
        }

        setActiveSection(button.dataset.target);
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

if (printManualBtn) {
    printManualBtn.addEventListener('click', () => {
        window.print();
    });
}

const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
        .filter((entry) => entry.isIntersecting && !entry.target.classList.contains('is-hidden'))
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio);

    if (visibleEntries.length > 0) {
        setActiveSection(visibleEntries[0].target.id);
    }
}, {
    rootMargin: '-25% 0px -55% 0px',
    threshold: [0.2, 0.45, 0.7]
});

sections.forEach((section) => observer.observe(section));

setActiveFilter(activeFilter);
