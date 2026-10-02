// ==========================================
// navbar.js - مكون الشريط العلوي الشامل الموحد (HTML + CSS + JS) - نسخة محصنة ومحدثة
// ==========================================
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ------------------------------------------
// 1. كود التنسيق (CSS) - يحقن تلقائياً في <head>
// ------------------------------------------
const navbarStyles = `
/* حماية الهيكل الأساسي من أي تنسيقات خارجية */
.top-navbar[data-unified="true"] {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    background-color: var(--bg-card, #ffffff) !important;
    padding: 10px 24px !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06) !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 99999 !important; /* ضمان بقائه فوق جميع العناصر */
    transition: background-color 0.3s ease, color 0.3s ease;
    border-bottom: 1px solid var(--border-color, #e2e8f0) !important;
    width: 100% !important;
    box-sizing: border-box !important;
    margin: 0 !important;
}

.top-navbar[data-unified="true"] * {
    box-sizing: border-box;
}

/* تنسيق روابط القائمة العلوية بحماية عالية */
.top-navbar .nav-links {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    margin: 0 !important;
    padding: 0 !important;
    list-style: none !important;
}

.top-navbar .nav-links a {
    text-decoration: none !important;
    color: var(--text-main, #334155) !important;
    font-weight: 700 !important;
    font-size: 13.5px !important;
    padding: 7px 14px !important;
    border-radius: 6px !important;
    transition: all 0.2s ease !important;
    display: inline-block !important;
    line-height: normal !important;
    margin: 0 !important;
}

.top-navbar .nav-links a:hover {
    background-color: var(--bg-hover, #f1f5f9) !important;
    color: #2563eb !important;
}

.top-navbar .nav-links a.active {
    background-color: var(--primary-green, #0a3a22) !important;
    color: #ffffff !important;
}

/* شريط البحث الموحد */
.top-navbar .nav-search-container {
    position: relative;
    width: 100%;
    max-width: 380px;
    margin: 0;
}
.top-navbar .nav-search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}
.top-navbar .nav-search-input-wrapper i.search-icon {
    position: absolute;
    right: 14px;
    color: var(--text-muted, #888);
    font-size: 13px;
    pointer-events: none;
}
.top-navbar #globalSearchInput {
    width: 100%;
    padding: 8px 38px 8px 15px !important;
    border-radius: 8px !important;
    border: 1px solid var(--border-color, #cbd5e1) !important;
    background-color: var(--bg-input, #f8fafc) !important;
    color: var(--text-main, #333) !important;
    font-family: inherit !important;
    font-size: 13px !important;
    outline: none !important;
    transition: all 0.2s ease !important;
    margin: 0 !important;
    height: 36px !important;
}
.top-navbar #globalSearchInput:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
    background-color: var(--bg-card, #ffffff) !important;
}

/* قائمة نتائج البحث المنسدلة */
.top-navbar .search-results-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    left: 0;
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    max-height: 380px;
    overflow-y: auto;
    display: none;
    z-index: 1050;
    text-align: right;
}
.top-navbar .search-results-dropdown.show {
    display: block;
}
.top-navbar .search-result-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color, #f0f0f0);
    text-decoration: none;
    color: var(--text-main, #333);
    transition: background 0.15s ease;
}
.top-navbar .search-result-item:last-child { border-bottom: none; }
.top-navbar .search-result-item:hover {
    background-color: var(--bg-hover, #f4f6f8);
}
.top-navbar .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.top-navbar .result-title {
    font-weight: 700;
    font-size: 13.5px;
    color: var(--text-main, #2c3e50);
}
.top-navbar .result-badge {
    font-size: 10.5px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
}
.badge-customers { background: #e3f2fd; color: #0d47a1; }
.badge-visits { background: #e8f5e9; color: #1b5e20; }
.badge-opportunities { background: #fff3e0; color: #e65100; }
.badge-sales { background: #f3e5f5; color: #4a148c; }
.top-navbar .result-details {
    font-size: 11.5px;
    color: var(--text-muted, #666);
}
.top-navbar .search-no-results {
    padding: 16px;
    text-align: center;
    color: var(--text-muted, #777);
    font-size: 13px;
}

/* الأزرار والأدوات */
.top-navbar .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
}
.top-navbar .nav-btn {
    background: transparent !important;
    border: 1px solid var(--border-color, #ddd) !important;
    color: var(--text-main, #444) !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 15px !important;
    transition: all 0.2s ease !important;
    padding: 0 !important;
    margin: 0 !important;
}
.top-navbar .nav-btn:hover {
    background-color: var(--bg-hover, #f0f0f0) !important;
    transform: translateY(-1px);
}

/* متغيرات الوضع الليلي */
body.dark-mode {
    --bg-card: #1e293b;
    --bg-input: #0f172a;
    --border-color: #334155;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --bg-hover: #334155;
}
body.dark-mode .top-navbar .nav-links a {
    color: #cbd5e1 !important;
}
body.dark-mode .top-navbar .nav-links a:hover {
    background-color: #334155 !important;
    color: #60a5fa !important;
}
body.dark-mode .top-navbar .nav-links a.active {
    background-color: #34d399 !important;
    color: #0f172a !important;
}
body.dark-mode .badge-customers { background: #1e3a8a; color: #93c5fd; }
body.dark-mode .badge-visits { background: #14532d; color: #86efac; }
body.dark-mode .badge-opportunities { background: #7c2d12; color: #fdba74; }
body.dark-mode .badge-sales { background: #581c87; color: #f0abfc; }
`;

function injectNavbarStyles() {
    let styleTag = document.getElementById('navbar-styles-element');
    if (styleTag) {
        styleTag.textContent = navbarStyles;
    } else {
        styleTag = document.createElement('style');
        styleTag.id = 'navbar-styles-element';
        styleTag.textContent = navbarStyles;
        document.head.appendChild(styleTag);
    }
}

// ------------------------------------------
// 2. كود الهيكل (HTML) - يحقن تلقائياً
// ------------------------------------------
const navbarHTML = `
<nav class="top-navbar" data-unified="true">
    <div class="nav-links">
        <a href="index.html">الرئيسية</a>
        <a href="visits.html">الزيارات</a>
        <a href="opportunities.html">الفرص البيعية</a>
        <a href="customers.html">العملاء</a>
        <a href="sales.html">المبيعات</a>
        <a href="reminders.html">التذكيرات</a>
    </div>

    <div class="nav-actions-wrapper" style="display:flex; align-items:center; gap:15px; margin:0;">
        <div class="nav-search-container">
            <div class="nav-search-input-wrapper">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="globalSearchInput" placeholder="بحث شامل..." autocomplete="off">
            </div>
            <div id="searchResults" class="search-results-dropdown"></div>
        </div>

        <div class="nav-actions">
            <button id="darkModeToggle" class="nav-btn" title="تبديل الوضع الليلي">
                <i class="fas fa-moon"></i>
            </button>
        </div>
    </div>
</nav>
`;

function injectNavbarHTML() {
    // 1. التخلص من أي شريط قديم موجود في الصفحة (السبب الرئيسي لعدم ظهوره في بعض الصفحات)
    const oldNavbars = document.querySelectorAll('.top-navbar:not([data-unified="true"])');
    oldNavbars.forEach(nav => nav.remove());

    // 2. التأكد من عدم تكرار حقن الشريط الجديد
    if (document.querySelector('.top-navbar[data-unified="true"]')) return;
    
    const placeholder = document.getElementById('navbarPlaceholder');
    if (placeholder) {
        placeholder.innerHTML = navbarHTML;
    } else {
        document.body.insertAdjacentHTML('afterbegin', navbarHTML);
    }
}

// ------------------------------------------
// 3. المنطق البرمجي (JavaScript)
// ------------------------------------------
let globalSearchCache = null;
let isFetchingSearchData = false;

function highlightActiveLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.top-navbar .nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function initDarkMode() {
    const toggleBtn = document.getElementById('darkModeToggle');
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('i');

    const isDark = localStorage.getItem('crm_dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    }

    // إزالة أي أحداث سابقة لتجنب التكرار
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    const newIcon = newToggleBtn.querySelector('i');

    newToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const darkModeActive = document.body.classList.contains('dark-mode');
        localStorage.setItem('crm_dark_mode', darkModeActive);
        
        if (newIcon) {
            if (darkModeActive) {
                newIcon.classList.replace('fa-moon', 'fa-sun');
            } else {
                newIcon.classList.replace('fa-sun', 'fa-moon');
            }
        }
    });
}

async function preloadGlobalSearchData() {
    if (isFetchingSearchData || globalSearchCache) return;
    isFetchingSearchData = true;
    let allData = [];
    const collectionsToFetch = [
        { name: 'customers', type: 'customer', url: 'customer-details.html?code=' },
        { name: 'visits', type: 'visit', url: 'visit-details.html?id=' },
        { name: 'opportunities', type: 'opportunity', url: 'opportunity-details.html?id=' },
        { name: 'sales', type: 'sale', url: 'sale-details.html?id=' }
    ];

    for (const coll of collectionsToFetch) {
        try {
            const snap = await getDocs(collection(db, coll.name));
            snap.forEach(docSnap => {
                const data = docSnap.data();
                data._searchType = coll.type;
                data._searchUrlBase = coll.url;
                data._docId = docSnap.id;
                allData.push(data);
            });
        } catch(e) {
            console.error(`Error fetching ${coll.name}:`, e);
        }
    }
    globalSearchCache = allData;
    isFetchingSearchData = false;
}

function initGlobalSearch() {
    const globalInput = document.getElementById('globalSearchInput');
    const resultsContainer = document.getElementById('searchResults');
    let globalSearchTimeout;

    if (!globalInput || !resultsContainer) return;

    // استنساخ العنصر لإزالة أي أحداث سابقة لتجنب التكرار
    const newGlobalInput = globalInput.cloneNode(true);
    globalInput.parentNode.replaceChild(newGlobalInput, globalInput);

    newGlobalInput.addEventListener('focus', () => {
        if (!globalSearchCache && !isFetchingSearchData) {
            preloadGlobalSearchData();
        }
    });

    newGlobalInput.addEventListener('input', (e) => {
        clearTimeout(globalSearchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            resultsContainer.classList.remove('show');
            return;
        }

        globalSearchTimeout = setTimeout(() => {
            performGlobalSearch(query, resultsContainer);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-search-container')) {
            resultsContainer.classList.remove('show');
        }
    });
}

async function performGlobalSearch(query, container) {
    const lowerQuery = query.toLowerCase();
    
    if (!globalSearchCache) {
        container.innerHTML = `<div class="search-no-results"><i class="fas fa-spinner fa-spin"></i> جاري البحث...</div>`;
        container.classList.add('show');
        await preloadGlobalSearchData();
    }

    let results = [];
    const matchedData = (globalSearchCache || []).filter(item => {
        const searchString = [
            item.comp, item.companyName, 
            item.mgr, item.delegateName, item.managerName,
            item.mob, item.delegateMob, item.mobile,
            item.email, item.delegateEmail, 
            item.cr1, item.cr, item.mainCr,
            item.code, item.customerCode,
            item.orderNo, item.orderNumber
        ].map(v => String(v || '').toLowerCase().trim()).join(' ');
        
        return searchString.includes(lowerQuery);
    }).slice(0, 10);

    matchedData.forEach(item => {
        let title = item.comp || item.companyName || 'بدون اسم / عنوان';
        let codeOrId = item.code || item.orderNo || item.orderNumber || item.id || item._docId;
        let mgr = item.mgr || item.delegateName || item.managerName || '-';
        let mob = item.mob || item.delegateMob || item.mobile || '-';
        
        results.push({
            type: item._searchType,
            title: title,
            code: codeOrId,
            details: `المسؤول: ${mgr} | تواصل: ${mob}`,
            url: item._searchUrlBase + codeOrId
        });
    });

    renderSearchResults(results, container, query);
}

function renderSearchResults(results, container, query) {
    container.innerHTML = '';
    
    if (results.length === 0) {
        container.innerHTML = `<div class="search-no-results">لا توجد نتائج مطابقة لـ "${escapeHTML(query)}"</div>`;
    } else {
        results.forEach(res => {
            let badgeClass = 'badge-customers';
            let badgeText = 'عميل';

            if (res.type === 'visit') { badgeClass = 'badge-visits'; badgeText = 'زيارة'; }
            if (res.type === 'opportunity') { badgeClass = 'badge-opportunities'; badgeText = 'فرصة بيعية'; }
            if (res.type === 'sale') { badgeClass = 'badge-sales'; badgeText = 'مبيعات'; }

            const item = document.createElement('a');
            item.href = res.url;
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="result-header">
                    <span class="result-title">${escapeHTML(res.title)} <span style="color:var(--text-muted); font-size:10px;">(${escapeHTML(res.code)})</span></span>
                    <span class="result-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="result-details">
                    <span>${escapeHTML(res.details)}</span>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    container.classList.add('show');
}

function escapeHTML(str) { 
    return String(str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); 
}

function initNavbarComponent() {
    injectNavbarStyles();
    injectNavbarHTML();
    highlightActiveLink();
    initDarkMode();
    initGlobalSearch();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbarComponent);
} else {
    initNavbarComponent();
}