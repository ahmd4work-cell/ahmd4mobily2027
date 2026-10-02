// ==========================================
// sales.js - إدارة المبيعات سحابياً ومحلياً
// ==========================================
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const LOGS_KEY = 'asgate_sales_logs_v1';
const CUSTOMERS_STORAGE_KEY = 'crm_customers';
const saveTimeouts = {}; // كائن لتخزين المؤقتات بناءً على رقم الطلب لتجنب تداخل الحفظ

// متغيرات الفرز (الفلتر)
let activeStatusFilters = [];
let activeOwnerFilters = [];

// توليد التاريخ دائماً بصيغة DD-MM-YYYY
function getTodayFormatted() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// دالة لتوحيد شكل التاريخ في العرض
function formatDateDisplay(dateString) {
    if (!dateString || dateString === '---') {
        return dateString || '---';
    }
    
    let cleanDate = String(dateString).trim();
    if (cleanDate.includes('/')) {
        cleanDate = cleanDate.replace(/\//g, '-');
    }
    
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }
    return cleanDate;
}

// دالة لمعالجة التاريخ بغرض الترتيب (الفرز)
function parseDateForSort(dateString) {
    if (!dateString || dateString === '---') return 0;
    
    let cleanDate = String(dateString).trim().replace(/\//g, '-');
    const parts = cleanDate.split('-');
    
    if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
            return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        } else { // DD-MM-YYYY
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
    }
    return 0;
}

// دوال سجل النشاط الموحدة
function getTimeFormatted() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0');
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function addToActivityLog(fieldName, oldVal, newVal, targetName) {
    if (oldVal === newVal) return;
    
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem(LOGS_KEY) || "[]");
    } catch (e) {
        console.warn("Error parsing logs from localStorage", e);
    }

    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date();
    let dd = String(d.getDate()).padStart(2, '0');
    let mm = String(d.getMonth() + 1).padStart(2, '0');
    let yyyy = d.getFullYear();
    const dayName = days[d.getDay()];
    const timeStr = getTimeFormatted();
    const cleanTarget = targetName || 'عنصر غير مسمى';

    let actionText = '';
    if (fieldName === 'الحالة') {
        actionText = `تم تغير الحالة من ${escapeHTML(oldVal) || 'فارغ'} الى ${escapeHTML(newVal) || 'فارغ'} لـ ( ${escapeHTML(cleanTarget)} )`;
    } else if (fieldName === 'إجراء') {
        actionText = `${escapeHTML(oldVal)} لـ ( ${escapeHTML(cleanTarget)} )`;
    } else {
        actionText = `تعديل ${escapeHTML(fieldName)} من [${escapeHTML(oldVal) || 'فارغ'}] إلى [${escapeHTML(newVal) || 'فارغ'}] لـ ( ${escapeHTML(cleanTarget)} )`;
    }

    const fullLogHTML = `
        <div class="log-entry">
            <span class="log-header-info">
                <span>المستخدم</span>
                <span>${dayName}</span>
                <span dir="ltr">${dd}-${mm}-${yyyy}</span>
                <span dir="ltr">${timeStr}</span>
            </span>
            <span class="log-sep">|</span>
            <span class="log-action">${actionText}</span>
        </div>
    `;

    logs.unshift(fullLogHTML);
    logs = logs.slice(0, 100);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    renderActivityLog();
}

function renderActivityLog() {
    const list = document.getElementById('activityList');
    if (!list) return;
    
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem(LOGS_KEY) || "[]");
    } catch (e) {
        console.warn("Error parsing logs", e);
    }
    
    list.innerHTML = logs.join('') || '<div style="color:#94a3b8; text-align:center; padding:10px; font-size:11px;">لا يوجد نشاط مسجل</div>';
}

function toggleLogExpansion() {
    const logSection = document.getElementById('activityLogSection');
    const toggleBtn = document.getElementById('toggleExpandBtn');
    
    if (logSection.classList.contains('expanded')) {
        logSection.classList.remove('expanded');
        toggleBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    } else {
        logSection.classList.add('expanded');
        toggleBtn.innerHTML = '<i class="fas fa-compress-alt"></i>';
    }
}

async function initPage() {
    initStatsVisibility();
    listenToSales();
    renderActivityLog();
}

function listenToSales() {
    const salesRef = collection(db, "sales");
    onSnapshot(salesRef, (snapshot) => {
        const tbody = document.getElementById('salesBody');
        if (!tbody) return;

        const salesData = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            salesData.push(data);
        });

        localStorage.setItem('asgate_sales_db', JSON.stringify(salesData));

        // فحص إذا كان المؤشر (Focus) موجود بداخل حقل في الجدول لتجنب إعادة الرسم المزعجة
        const activeElement = document.activeElement;
        const isEditingTable = activeElement && activeElement.closest('#salesBody');

        if (!isEditingTable) {
            loadSalesFromStorage(); // أعد رسم الجدول فقط إذا لم يكن المستخدم يكتب فيه
        } else {
            updateHeaderStats(); // تحديث الإحصائيات العلوية بالبيانات الجديدة فقط
        }
    });
}

function toggleStatsVisibility() {
    const container = document.getElementById('statsContainer');
    const btn = document.getElementById('eyeToggleBtn');
    if (!container || !btn) return;
    
    const isHidden = container.classList.toggle('blur-active');

    if (isHidden) {
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        localStorage.setItem('asgate_sales_stats_hidden', 'true');
    } else {
        btn.innerHTML = '<i class="fas fa-eye"></i>';
        localStorage.setItem('asgate_sales_stats_hidden', 'false');
    }
}

function initStatsVisibility() {
    const isHidden = localStorage.getItem('asgate_sales_stats_hidden') === 'true';
    const container = document.getElementById('statsContainer');
    const btn = document.getElementById('eyeToggleBtn');
    
    if (isHidden && container && btn) {
        container.classList.add('blur-active');
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    }
}

// دالة الحفظ المجدول تعتمد الآن على الحقل المُعدل وحفظ صفه فقط
function debouncedSave(inputElement) {
    if (!inputElement) return;
    const row = inputElement.closest('tr');
    if (!row) return;
    
    const id = row.cells[1].innerText.replace('#', '').trim();

    clearTimeout(saveTimeouts[id]);
    saveTimeouts[id] = setTimeout(() => {
        saveSingleRow(inputElement);
        delete saveTimeouts[id];
    }, 500);
}

// الدالة الجديدة لحفظ الصف الذي تم تعديله فقط لتقليل استهلاك فايربيز
async function saveSingleRow(inputElement) {
    if (!inputElement) return;
    const r = inputElement.closest('tr');
    if (!r) return;

    const id = r.cells[1].innerText.replace('#', '').trim();

    const salesData = {
        id: id,
        type: r.cells[2].querySelector('input').value,
        date: r.cells[3].querySelector('input').value,
        comp: r.cells[4].querySelector('input').value,
        cr: r.cells[5].querySelector('input').value,
        status: r.cells[6].querySelector('select').value,
        lastModifiedDate: r.cells[9].querySelector('input').value === '---' ? '' : r.cells[9].querySelector('input').value,
        owner: r.cells[10].querySelector('input').value
    };

    try {
        await setDoc(doc(db, "sales", id), salesData, { merge: true });

        let saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
        const index = saved.findIndex(item => String(item.id) === String(id));
        
        if (index > -1) {
            saved[index] = salesData;
        } else {
            saved.push(salesData);
        }
        
        localStorage.setItem('asgate_sales_db', JSON.stringify(saved));
        updateHeaderStats();

    } catch (e) {
        console.error("خطأ بالحفظ السحابي للمبيعات:", e);
    }
}

function generateCustomOrderId() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = year + month;
    
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    let maxSequence = 0;
    
    saved.forEach(item => {
        const idStr = String(item.id);
        if (idStr.startsWith(prefix) && idStr.length === 8) {
            const seq = parseInt(idStr.slice(4), 10);
            if (seq > maxSequence) maxSequence = seq;
        }
    });
    
    return prefix + String(maxSequence + 1).padStart(4, '0');
}

function updateHeaderStats() {
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');

    const d = new Date();
    const currMonth = String(d.getMonth() + 1).padStart(2, '0');
    const currYear = String(d.getFullYear());

    let totalComp = 0, totalPend = 0, monthCount = 0;
    let monthComp = 0, monthPend = 0;

    saved.forEach(item => {
        const sums = calculateOrderSums(item.id);
        totalComp += sums.completed;
        totalPend += sums.pending;

        let isThisMonth = false;
        if (item.date) {
            let cleanDate = item.date.replace(/\//g, '-');
            let parts = cleanDate.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                    if (parts[1] === currMonth && parts[0] === currYear) isThisMonth = true;
                } else { // DD-MM-YYYY
                    if (parts[1] === currMonth && parts[2] === currYear) isThisMonth = true;
                }
            }
        }

        if (isThisMonth) {
            monthCount++;
            monthComp += sums.completed;
            monthPend += sums.pending;
        }
    });

    if (document.getElementById('count-total')) document.getElementById('count-total').innerText = saved.length;
    if (document.getElementById('month-count')) document.getElementById('month-count').innerText = monthCount;
    if (document.getElementById('sum-completed')) document.getElementById('sum-completed').innerText = totalComp.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (document.getElementById('sum-pending')) document.getElementById('sum-pending').innerText = totalPend.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (document.getElementById('month-completed')) document.getElementById('month-completed').innerText = monthComp.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (document.getElementById('month-pending')) document.getElementById('month-pending').innerText = monthPend.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function calculateOrderSums(orderId) {
    const productsDb = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    const products = productsDb[orderId] || [];
    let completed = 0, pending = 0;
    
    products.forEach(p => {
        const lineTotal = (parseFloat(p.qty) || 0) * (parseFloat(String(p.sub).replace(/[^\d.]/g, '')) || 0);
        if (p.status === "مكتمل") completed += lineTotal;
        if (p.status === "معلق") pending += lineTotal;
    });
    
    return { completed, pending };
}

function loadSalesFromStorage() {
    const tbody = document.getElementById('salesBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');

    // ترتيب المصفوفة بناءً على تاريخ الإنشاء (الأحدث في الأعلى والأقدم في الأسفل)
    saved.sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date));

    saved.forEach(obj => renderTableRow(obj));
    updateHeaderStats();
    populateFilters(); // تحديث القوائم المنسدلة للفرز
    filterSalesTable(); // تطبيق الفلتر إن وجد
}

// تمرير (this) في جميع أحداث الإدخال للحفظ المستقل لكل صف
function renderTableRow(obj) {
    const tbody = document.getElementById('salesBody');
    const sums = calculateOrderSums(obj.id);
    const row = tbody.insertRow(-1);
    row.className = 'main-row';
    row.id = `row-${obj.id}`;

    if (obj.status === "فقدان") {
        row.classList.add('lost-row');
    }

    row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" data-id="${obj.id}"></td>
        <td><a href="./order_details.html?id=${obj.id}" class="order-link" title="فتح التفاصيل">#${obj.id}</a></td>
        <td>
            <input type="text" class="excel-input order-name-input" value="${obj.type || ''}" data-old="${obj.type || ''}" 
                   onfocus="this.dataset.old=this.value" 
                   onkeyup="updateDateField(this); debouncedSave(this);" 
                   onblur="logEdit('اسم الطلب', this, '${obj.comp}', '${obj.id}')">
        </td>
        <td>
            <input type="text" class="excel-input readonly-input date-field" value="${formatDateDisplay(obj.date)}" readonly 
                   style="color:var(--text-muted); font-weight:700; text-align: center;" dir="ltr">
        </td>
        <td>
            <input type="text" class="excel-input" value="${obj.comp || ''}" data-old="${obj.comp || ''}" 
                   onfocus="this.dataset.old=this.value" 
                   onkeyup="updateDateField(this); debouncedSave(this);" 
                   onblur="logEdit('الشركة', this, '${obj.comp}', '${obj.id}')">
        </td>
        <td>
            <input type="text" class="excel-input" value="${obj.cr || ''}" data-old="${obj.cr || ''}" 
                   onfocus="this.dataset.old=this.value" 
                   onkeyup="updateDateField(this); debouncedSave(this);" 
                   onblur="logEdit('السجل', this, '${obj.comp}', '${obj.id}')">
        </td>
        <td>
            <select class="excel-input status-select ${getStatusClass(obj.status)}" data-old="${obj.status || 'جديد'}" 
                    onchange="handleStatusChange(this, '${obj.id}', '${obj.comp}')">
                <option value="مكتمل" ${obj.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                <option value="توثيق مستخدم" ${obj.status === 'توثيق مستخدم' ? 'selected' : ''}>توثيق مستخدم</option>
                <option value="توثيق مفوض" ${obj.status === 'توثيق مفوض' ? 'selected' : ''}>توثيق مفوض</option>
                <option value="تركيبات" ${obj.status === 'تركيبات' ? 'selected' : ''}>تركيبات</option>
                <option value="تفعيلات" ${obj.status === 'تفعيلات' ? 'selected' : ''}>تفعيلات</option>
                <option value="استلام ايميل" ${obj.status === 'استلام ايميل' ? 'selected' : ''}>استلام ايميل</option>
                <option value="ارسال ايميل" ${obj.status === 'ارسال ايميل' ? 'selected' : ''}>ارسال ايميل</option>
                <option value="موافقة" ${obj.status === 'موافقة' ? 'selected' : ''}>موافقة</option>
                <option value="جديد" ${obj.status === 'جديد' ? 'selected' : ''}>جديد</option>
                <option value="فقدان" ${obj.status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td>
            <input type="text" class="excel-input readonly-input" value="${sums.completed.toFixed(2)}" readonly 
                   style="color:var(--success); font-weight:800;">
        </td>
        <td>
            <input type="text" class="excel-input readonly-input" value="${sums.pending.toFixed(2)}" readonly 
                   style="color:var(--danger); font-weight:800;">
        </td>
        <td>
            <input type="text" class="excel-input readonly-input last-mod-field date-field" value="${formatDateDisplay(obj.lastModifiedDate || '---')}" readonly 
                   style="color:var(--text-muted); font-weight:700; text-align: center;" dir="ltr">
        </td>
        <td>
            <input type="text" class="excel-input" value="${obj.owner || 'المستخدم'}" data-old="${obj.owner || ''}" 
                   onfocus="this.dataset.old=this.value" 
                   onkeyup="updateDateField(this); debouncedSave(this);" 
                   onblur="logEdit('المستخدم', this, '${obj.comp}', '${obj.id}')">
        </td>
    `;
}

function getStatusClass(status) {
    if (status === 'مكتمل') return 'status-complete';
    if (status === 'توثيق مستخدم') return 'status-user-doc';
    if (status === 'توثيق مفوض') return 'status-auth-doc';
    if (status === 'تركيبات') return 'status-installations';
    if (status === 'تفعيلات') return 'status-activations';
    if (status === 'استلام ايميل') return 'status-email-receive';
    if (status === 'ارسال ايميل') return 'status-email-send';
    if (status === 'موافقة') return 'status-approval';
    if (status === 'جديد') return 'status-new';
    if (status === 'فقدان') return 'status-lost';
    return 'status-default';
}

function handleStatusChange(el, orderId, company) {
    const val = el.value;
    const oldVal = el.dataset.old;
    const row = el.closest('tr');
    
    el.className = `excel-input status-select ${getStatusClass(val)}`;

    if (val === "فقدان") {
        row.classList.add('lost-row');
    } else {
        row.classList.remove('lost-row');
    }

    addToActivityLog('الحالة', oldVal, val, company);
    updateDateField(el);
    el.dataset.old = val;
    debouncedSave(el); // تمرير العنصر ليتم حفظ صفه مباشرة
}

function updateDateField(inputElement) {
    const row = inputElement.closest('tr');
    const modField = row.querySelector('.last-mod-field');
    if (modField) {
        modField.value = getTodayFormatted();
    }
}

function logEdit(fieldName, el, comp, id) {
    const newVal = el.value;
    const oldVal = el.dataset.old;
    if (newVal !== oldVal) {
        addToActivityLog(fieldName, oldVal, newVal, comp);
        el.dataset.old = newVal;
    }
}

// ----------------------------------------------------
// دوال الفرز (الفلتر المنسدل) للحالة والمستخدم
// ----------------------------------------------------
function populateFilters() {
    const statuses = ["مكتمل", "توثيق مستخدم", "توثيق مفوض", "تركيبات", "تفعيلات", "استلام ايميل", "ارسال ايميل", "موافقة", "جديد", "فقدان"];
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    const owners = [...new Set(saved.map(item => item.owner || 'المستخدم'))];

    const statusMenu = document.getElementById('statusFilterMenu');
    if (statusMenu) {
        statusMenu.innerHTML = statuses.map(s => `
            <label class="filter-menu-item">
                <input type="checkbox" value="${s}" onchange="applyColumnFilters()" ${activeStatusFilters.includes(s) ? 'checked' : ''}>
                ${s}
            </label>
        `).join('');
    }

    const ownerMenu = document.getElementById('ownerFilterMenu');
    if (ownerMenu) {
        ownerMenu.innerHTML = owners.map(o => `
            <label class="filter-menu-item">
                <input type="checkbox" value="${o}" onchange="applyColumnFilters()" ${activeOwnerFilters.includes(o) ? 'checked' : ''}>
                ${o}
            </label>
        `).join('');
    }
}

function toggleFilterMenu(e, menuId) {
    e.stopPropagation();
    document.querySelectorAll('.filter-menu').forEach(m => {
        if (m.id !== menuId) m.classList.remove('show');
    });
    
    const menu = document.getElementById(menuId);
    if (menu) menu.classList.toggle('show');
}

function applyColumnFilters() {
    const statusCheckboxes = document.querySelectorAll('#statusFilterMenu input[type="checkbox"]:checked');
    activeStatusFilters = Array.from(statusCheckboxes).map(c => c.value);

    const ownerCheckboxes = document.querySelectorAll('#ownerFilterMenu input[type="checkbox"]:checked');
    activeOwnerFilters = Array.from(ownerCheckboxes).map(c => c.value);

    filterSalesTable();
}

// دالة لدعم البحث الشامل وفلاتر الأعمدة معاً
function filterSalesTable() {
    const query = document.getElementById('globalSearch').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#salesBody .main-row');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const matchGlobal = text.includes(query);

        const statusSelect = row.querySelector('.status-select');
        const status = statusSelect ? statusSelect.value : '';
        const matchStatus = activeStatusFilters.length === 0 || activeStatusFilters.includes(status);

        const ownerInput = row.cells[10] ? row.cells[10].querySelector('input') : null;
        const owner = ownerInput ? ownerInput.value : '';
        const matchOwner = activeOwnerFilters.length === 0 || activeOwnerFilters.includes(owner);

        row.style.display = (matchGlobal && matchStatus && matchOwner) ? '' : 'none';
    });
}
// ----------------------------------------------------

// إغلاق الفلاتر عند النقر بالخارج (تمت إزالة كود القائمة الجماعية لوجوده في الملف المشترك)
window.onclick = (e) => {
    if (!e.target.closest('.th-filter-wrapper') && !e.target.closest('.filter-menu')) {
        document.querySelectorAll('.filter-menu').forEach(m => m.classList.remove('show'));
    }
};

// ----------------------------------------------------
// التكامل مع الملف المشترك للإجراءات الجماعية
// ----------------------------------------------------
window.handleBulkAction = async function(action) {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    
    if (selected.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', text: 'يرجى تحديد صف واحد على الأقل', confirmButtonColor: '#3b82f6' });
        }
        return;
    }

    if (action === 'حذف') {
        // استدعاء نافذة الحذف المنبثقة من الملف المشترك إذا وجدت
        if (window.openSharedDeleteModal) {
            window.openSharedDeleteModal(selected.length);
        } else {
            // بديل احتياطي في حال عدم تحميل الملف
            window.executeBulkDelete(); 
        }
    } else {
        Swal.fire({
            icon: 'success',
            title: 'تم',
            text: 'تم تنفيذ الإجراء (' + action + ') على ' + selected.length + ' صف',
            showConfirmButton: false,
            timer: 1500
        });
    }
};

// يتم استدعاؤها من نافذة الحذف في الملف المشترك
window.executeBulkDelete = async function() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    let saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    const orderIdsToDelete = [];

    for (let chk of selected) {
        const row = chk.closest('tr');
        const orderId = row.cells[1].innerText.replace('#', '').trim();
        const comp = row.cells[4].querySelector('input').value;
        orderIdsToDelete.push(orderId);

        try {
            await deleteDoc(doc(db, "sales", orderId));
            addToActivityLog('إجراء', 'تم حذف الطلب', '', comp);
        } catch (e) {
            console.error("خطأ أثناء الحذف السحابي:", e);
        }
    }

    saved = saved.filter(item => !orderIdsToDelete.includes(item.id));
    localStorage.setItem('asgate_sales_db', JSON.stringify(saved));
    updateHeaderStats();
    
    if (window.closeSharedDeleteModal) {
        window.closeSharedDeleteModal();
    }
    
    Swal.fire({ icon: 'success', title: 'تم الحذف', showConfirmButton: false, timer: 1500 });
};
// ----------------------------------------------------

function openOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) modal.style.display = 'flex';
}

function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) modal.style.display = 'none';
    
    ['mSearchField', 'mType', 'mComp', 'mCr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function searchCustomerInModal(el) {
    const query = el.value.toLowerCase().trim();
    const resDiv = document.getElementById('mResults');
    const customers = JSON.parse(localStorage.getItem(CUSTOMERS_STORAGE_KEY) || '[]');

    if (query.length < 1) {
        if (resDiv) resDiv.style.display = 'none';
        return;
    }

    const filtered = customers.filter(c => {
        const cName = (c.comp || "").toLowerCase();
        const crMain = (c.cr1 || c.cr || "");
        const crSub = (c.cr2 || "");
        return cName.includes(query) || crMain.includes(query) || crSub.includes(query);
    });

    if (resDiv) {
        resDiv.innerHTML = filtered.map(c => {
            const displayCr = c.cr1 || c.cr || c.cr2 || '';
            return `<div onclick="window.selectCustomer('${c.comp}', '${displayCr}')">${c.comp} - ${displayCr}</div>`;
        }).join('') || '<div style="color:#94a3b8; text-align:center; padding: 10px;">لا يوجد نتائج</div>';
        resDiv.style.display = 'block';
    }
}

function selectCustomer(comp, cr) {
    const mComp = document.getElementById('mComp');
    const mCr = document.getElementById('mCr');
    const resDiv = document.getElementById('mResults');
    const searchField = document.getElementById('mSearchField');
    
    if (mComp) mComp.value = comp;
    if (mCr) mCr.value = cr;
    if (resDiv) resDiv.style.display = 'none';
    if (searchField) searchField.value = comp;
}

async function addOrderRow() {
    const type = document.getElementById('mType').value.trim();
    const comp = document.getElementById('mComp').value.trim();
    const cr = document.getElementById('mCr').value.trim();

    if (!type || !comp) {
        Swal.fire({ icon: 'warning', text: 'يرجى اختيار العميل وإدخال اسم الطلب', confirmButtonColor: '#3b82f6' });
        return;
    }

    const newId = generateCustomOrderId();
    const newOrder = {
        id: newId,
        type: type,
        date: getTodayFormatted(),
        comp: comp,
        cr: cr,
        status: 'جديد',
        lastModifiedDate: getTodayFormatted(),
        owner: 'المستخدم' // يتم حفظه بهذا الاسم كقيمة افتراضية
    };

    let saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    saved.unshift(newOrder);
    localStorage.setItem('asgate_sales_db', JSON.stringify(saved));
    loadSalesFromStorage();

    try {
        await setDoc(doc(db, "sales", newId), newOrder);
        addToActivityLog('إجراء', 'تم إنشاء طلب جديد', '', comp);
        closeOrderModal();
        Swal.fire({ icon: 'success', title: 'تم الإنشاء', text: `تم إنشاء الطلب #${newId} بنجاح`, timer: 2000, showConfirmButton: false });
    } catch (e) {
        console.error("خطأ إنشاء الطلب:", e);
    }
}

Object.assign(window, {
    initPage,
    toggleStatsVisibility,
    debouncedSave,
    saveSingleRow,
    toggleLogExpansion,
    filterSalesTable,
    handleBulkAction,
    executeBulkDelete,
    openOrderModal,
    closeOrderModal,
    searchCustomerInModal,
    selectCustomer,
    addOrderRow,
    handleStatusChange,
    logEdit,
    updateDateField,
    toggleFilterMenu,
    applyColumnFilters
});

document.addEventListener('DOMContentLoaded', () => {
    initPage();
});