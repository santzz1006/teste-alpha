const VIGOR_INVITE_CODE = '7kGVa8eO';
const VIGOR_SIGNUP_URL = `https://vigorbuy.com/signUp?utm_source=website&utm_medium=ambassador&utm_campaign=linksharing&inviteCode=${VIGOR_INVITE_CODE}`;
const EUR_TO_CNY = 7.85;
const EUR_TO_BRL = 6.2;
const CATEGORY_LABELS = {
    todos: 'Todos',
    zapatillas: 'Tênis',
    camisetas: 'Camisetas',
    pantalones: 'Calças',
    futbol: 'Futebol',
    verano: 'Verão',
    sudaderas: 'Moletons',
    chandals: 'Conjuntos',
    abrigos: 'Casacos',
    accesorios: 'Acessórios',
    chicas: 'Feminino',
    hauls: 'Hauls',
    outfits: 'Looks'
};

const state = {
    category: 'todos',
    sort: 'default',
    query: '',
    visible: 60
};

const data = typeof products !== 'undefined' && Array.isArray(products) ? products : [];

const els = {
    grid: document.getElementById('productGrid'),
    count: document.getElementById('count'),
    search: document.getElementById('searchInput'),
    loadMore: document.getElementById('loadMoreBtn'),
    empty: document.getElementById('emptyState'),
    totalStat: document.getElementById('totalProductsStat'),
    converter: document.getElementById('converterModal'),
    linkInput: document.getElementById('linkInput'),
    resultContainer: document.getElementById('resultContainer'),
    resultInput: document.getElementById('resultInput'),
    openResultBtn: document.getElementById('openResultBtn'),
    converterError: document.getElementById('converterError'),
    scrollTop: document.getElementById('scrollTopBtn')
};

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || 'Produto';
}

function vigorUrl(url) {
    if (!url || url === '#') return VIGOR_SIGNUP_URL;

    let next = String(url).replace('https://hipobuy.com/', 'https://vigorbuy.com/');
    next = next
        .replace('https://vigorbuy.com/product/weidian/', 'https://vigorbuy.com/product/2/')
        .replace('https://vigorbuy.com/product/taobao/', 'https://vigorbuy.com/product/1/');

    if (!next.includes('vigorbuy.com')) return next;

    if (/inviteCode=/i.test(next)) {
        return next.replace(/inviteCode=[^&]+/i, `inviteCode=${VIGOR_INVITE_CODE}`);
    }

    return `${next}${next.includes('?') ? '&' : '?'}inviteCode=${VIGOR_INVITE_CODE}`;
}

function parsePrice(price) {
    const match = String(price || '').replace(',', '.').match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function formatBrl(value) {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDualPrice(price) {
    const parsed = parsePrice(price);
    if (parsed === Number.MAX_SAFE_INTEGER) {
        return '<span class="price-cny">Consultar</span>';
    }

    const cny = Math.round(parsed * EUR_TO_CNY);
    const brl = parsed * EUR_TO_BRL;

    return `
        <span class="price-cny">CNY ${cny}</span>
        <span class="price-brl">R$ ${formatBrl(brl)}</span>
    `;
}

function currentItems() {
    const query = normalizeText(state.query);
    let items = data.filter((item) => {
        const categoryMatch = state.category === 'todos' || item.category === state.category;
        if (!categoryMatch) return false;
        if (!query) return true;

        return [item.title, item.category, categoryLabel(item.category), item.price]
            .map(normalizeText)
            .some((field) => field.includes(query));
    });

    if (state.sort === 'asc') {
        items = [...items].sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (state.sort === 'desc') {
        items = [...items].sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    }

    return items;
}

function productCard(item, index) {
    const title = escapeHtml(item.title || 'Produto');
    const price = formatDualPrice(item.price);
    const category = escapeHtml(categoryLabel(item.category));
    const image = escapeHtml(item.image || './image/logo-alphacore.jpg');
    const url = escapeHtml(vigorUrl(item.url));
    const loading = index < 8 ? 'eager' : 'lazy';

    if (item.category === 'outfits' && Array.isArray(item.parts)) {
        const parts = item.parts.map((part) => {
            const partUrl = escapeHtml(vigorUrl(part.url));
            const partImage = escapeHtml(part.image || './image/logo-alphacore.jpg');
            const partName = escapeHtml(part.name || 'Item');
            const partPrice = formatDualPrice(part.price);
            return `
                <a class="outfit-part" href="${partUrl}" target="_blank" rel="noopener">
                    <img src="${partImage}" alt="${partName}" loading="lazy" onerror="this.src='./image/logo-alphacore.jpg'">
                    <span>
                        <strong>${partName}</strong>
                        <small>${partPrice}</small>
                    </span>
                    <i class="fas fa-arrow-right text-[#00a2ff]"></i>
                </a>
            `;
        }).join('');

        return `
            <article class="product-card outfit-card">
                <div class="image-wrap">
                    <img src="${image}" alt="${title}" loading="${loading}" onerror="this.src='./image/logo-alphacore.jpg'">
                </div>
                <div class="card-body">
                    <div class="card-tag">Looks</div>
                    <h3 class="card-title">${title}</h3>
                    <div class="price-row">
                        <span class="price">${price}</span>
                        <span class="view-link">Pe&ccedil;as</span>
                    </div>
                    <div class="outfit-parts">${parts}</div>
                </div>
            </article>
        `;
    }

    return `
        <a class="product-card" href="${url}" target="_blank" rel="noopener">
            <button class="share-btn" type="button" data-share-url="${url}" data-share-title="${title}" aria-label="Compartilhar produto">
                <i class="fas fa-share-nodes"></i>
            </button>
            <div class="image-wrap">
                <img src="${image}" alt="${title}" loading="${loading}" onerror="this.src='./image/logo-alphacore.jpg'">
            </div>
            <div class="card-body">
                <div class="card-tag">${category}</div>
                <h3 class="card-title">${title}</h3>
                <div class="price-row">
                    <span class="price">${price}</span>
                    <span class="view-link">Ver link</span>
                </div>
            </div>
        </a>
    `;
}

function render() {
    const items = currentItems();
    const visibleItems = items.slice(0, state.visible);

    els.grid.innerHTML = visibleItems.map(productCard).join('');
    els.count.textContent = items.length.toLocaleString('pt-BR');
    els.empty.classList.toggle('hidden', items.length !== 0);
    els.loadMore.classList.toggle('hidden', state.visible >= items.length);
}

function resetAndRender() {
    state.visible = 60;
    render();
}

function setActiveButton(selector, button) {
    document.querySelectorAll(selector).forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
}

function detectProduct(url) {
    const text = String(url || '');
    const lower = text.toLowerCase();
    let platform = '2';
    let id = null;

    const matchers = [
        /[?&](?:id|itemid|item_id|itemID)=([0-9]+)/i,
        /\/product\/[a-zA-Z0-9]+\/([0-9]+)/i,
        /\/offer\/([0-9]+)\.html/i,
        /\/i\/([0-9]+)/i,
        /item\.html\?itemID=([0-9]+)/i
    ];

    for (const matcher of matchers) {
        const match = text.match(matcher);
        if (match) {
            id = match[1];
            break;
        }
    }

    if (!id) return null;

    if (lower.includes('taobao.com') || lower.includes('tmall.com')) {
        platform = '1';
    } else if (lower.includes('1688.com')) {
        platform = '0';
    } else if (lower.includes('weidian.com') || lower.includes('koudai.com')) {
        platform = '2';
    } else {
        const source = lower.match(/[?&](?:source|shop_type|platform|type)=([^&]+)/);
        const value = source ? source[1] : '';
        if (value.includes('taobao') || value === 'tb') platform = '1';
        if (value.includes('1688') || value.includes('ali')) platform = '0';
        if (value.includes('weidian') || value === 'wd') platform = '2';
    }

    return `https://vigorbuy.com/product/${platform}/${id}?inviteCode=${VIGOR_INVITE_CODE}`;
}

function openMobileMenu() {
    document.getElementById('mobileMenu')?.classList.add('active');
    document.getElementById('mobileOverlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    document.getElementById('mobileMenu')?.classList.remove('active');
    document.getElementById('mobileOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function openDiscordModal(event) {
    if (event) event.preventDefault();
    closeMobileMenu();
    const overlay = document.getElementById('discordModalOverlay');
    const modal = document.getElementById('discordModal');
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.remove('opacity-0');
    modal.classList.remove('scale-95');
    modal.classList.add('scale-100');
    document.body.style.overflow = 'hidden';
}

function closeDiscordModal() {
    const overlay = document.getElementById('discordModalOverlay');
    const modal = document.getElementById('discordModal');
    overlay.classList.add('opacity-0');
    modal.classList.remove('scale-100');
    modal.classList.add('scale-95');
    document.body.style.overflow = '';
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

function showToast(message) {
    let toast = document.getElementById('planilhaToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'planilhaToast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

document.querySelectorAll('.cat-btn').forEach((button) => {
    button.addEventListener('click', () => {
        state.category = button.dataset.cat || 'todos';
        setActiveButton('.cat-btn', button);
        resetAndRender();
    });
});

document.querySelectorAll('.sort-btn').forEach((button) => {
    button.addEventListener('click', () => {
        state.sort = button.dataset.sort || 'default';
        setActiveButton('.sort-btn', button);
        resetAndRender();
    });
});

els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    resetAndRender();
});

els.loadMore.addEventListener('click', () => {
    state.visible += 60;
    render();
});

document.getElementById('openConverterBtn')?.addEventListener('click', () => {
    els.converter.classList.add('active');
    els.converter.setAttribute('aria-hidden', 'false');
    els.linkInput.focus();
});

document.getElementById('closeConverterBtn')?.addEventListener('click', () => {
    els.converter.classList.remove('active');
    els.converter.setAttribute('aria-hidden', 'true');
});

els.converter.addEventListener('click', (event) => {
    if (event.target === els.converter) {
        els.converter.classList.remove('active');
        els.converter.setAttribute('aria-hidden', 'true');
    }
});

document.getElementById('convertBtn')?.addEventListener('click', () => {
    const result = detectProduct(els.linkInput.value);
    els.converterError.classList.toggle('hidden', Boolean(result));
    els.resultContainer.classList.toggle('hidden', !result);
    if (!result) return;

    els.resultInput.value = result;
    els.openResultBtn.href = result;
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(els.resultInput.value);
        showToast('Link copiado');
    } catch (error) {
        els.resultInput.select();
        showToast('Selecione e copie o link');
    }
});

document.addEventListener('click', async (event) => {
    const button = event.target.closest('.share-btn');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const url = button.dataset.shareUrl;
    const title = button.dataset.shareTitle || 'Produto Alpha Core';

    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
    }

    try {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado');
    } catch (error) {
        showToast('Nao foi possivel copiar');
    }
});

window.addEventListener('scroll', () => {
    els.scrollTop.style.display = window.scrollY > 320 ? 'block' : 'none';
});

els.scrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.totalStat.textContent = data.length.toLocaleString('pt-BR');
render();
