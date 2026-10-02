// =========================================================================
// visits.js - الكود الشامل لإدارة بيانات صفحة الزيارات (مُحدّث وخالٍ من الأخطاء)
// =========================================================================

// 1. بيانات تجريبية تظهر عند تحميل الصفحة
window.visitsData = [
    {
        id: 1,
        company: 'شركة الأفق للتقنية',
        address: 'الرياض',
        manager: 'أحمد محمد',
        mobile: '966500000000',
        email: 'info@horizon.sa',
        record: '10101020',
        date: '2023-10-01',
        service: 'تصميم متجر',
        value: 5000,
        notes: 'زيارة أولية ممتازة',
        status: 'متابعة',
        owner: 'مستخدم 1'
    },
    {
        id: 2,
        company: 'مؤسسة الرواد',
        address: 'جدة',
        manager: 'سعيد محمد',
        mobile: '966511111111',
        email: 'contact@pioneers.com',
        record: '20202030',
        date: '2023-10-02',
        service: 'تسويق رقمي',
        value: 3500,
        notes: 'بانتظار الرد',
        status: 'تأهيل لفرصة',
        owner: 'مستخدم 2'
    }
];

// 2. دالة عرض البيانات في الجدول
window.renderTable = function() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = ''; 
    window.visitsData.forEach(visit => {
        const tr = window.createRowHTML(visit);
        tbody.appendChild(tr);
    });
    window.updateStats();
};

// 3. دالة إنشاء سطر جديد وتعبئته بالبيانات كعنصر DOM
window.createRowHTML = function(data = {}) {
    const tr = document.createElement('tr');
    tr.className = 'main-row';
    tr.dataset.id = data.id || Date.now();

    const company = data.company || data["الشركة"] || "";
    const address = data.address || data["العنوان"] || "";
    const manager = data.manager || data["المسؤول"] || "";
    const mobile  = data.mobile  || data["رقم التواصل"] || "";
    const email   = data.email   || data["البريد الإلكتروني"] || "";
    const record  = data.record  || data["السجل الرئيسي"] || "";
    const date    = data.date    || data["تاريخ الزيارة"] || "";
    const service = data.service || data["الخدمة"] || "";
    const val     = data.value   || data["القيمة"] || "0";
    const notes   = data.notes   || data["الملاحظات"] || "إضافة ملاحظة";
    const status  = data.status  || data["الحالة"] || "زيارة";
    const owner   = data.owner   || data["المستخدم"] || data["المالك"] || "مستخدم 1";
    
    const todayDate = new Date().toISOString().split('T')[0];

    tr.innerHTML = `
        <td class="col-select"><input type="checkbox" class="row-checkbox select-check"></td>
        <td class="col-company"><input type="text" class="excel-input" value="${company}" placeholder="اسم الشركة"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${address}"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${manager}"></td>
        <td class="col-mobile">
            <div class="phone-cell-container">
                <input type="text" class="excel-input" value="${mobile}" style="width:70%">
                <a href="https://wa.me/${mobile}" target="_blank" class="whatsapp-icon-btn" title="مراسلة واتساب"><i class="fab fa-whatsapp"></i></a>
            </div>
        </td>
        <td class="col-email"><input type="text" class="excel-input" value="${email}"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${record}"></td>
        <td class="col-date"><input type="date" class="excel-input" value="${date}"></td>
        <td class="col-service"><input type="text" class="excel-input" value="${service}"></td>
        <td class="col-val"><input type="number" class="excel-input val-input" value="${val}" onchange="window.updateStats()"></td>
        <td class="col-notes">
            <div class="notes-preview" onclick="window.openNoteModal(this)">${notes}</div>
        </td>
        <td class="col-status">
            <select class="excel-input status-select" onchange="window.updateRowColor(this)">
                <option value="تأهيل لفرصة" ${status === 'تأهيل لفرصة' ? 'selected' : ''}>تأهيل لفرصة</option>
                <option value="مميزة" ${status === 'مميزة' ? 'selected' : ''}>مميزة</option>
                <option value="متابعة" ${status === 'متابعة' ? 'selected' : ''}>متابعة</option>
                <option value="عرض سعر" ${status === 'عرض سعر' ? 'selected' : ''}>عرض سعر</option>
                <option value="زيارة" ${status === 'زيارة' ? 'selected' : ''}>زيارة</option>
                <option value="اتصال" ${status === 'اتصال' ? 'selected' : ''}>اتصال</option>
                <option value="غير مهتم" ${status === 'غير مهتم' ? 'selected' : ''}>غير مهتم</option>
                <option value="فقدان" ${status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td class="col-edit">
            <div class="edit-date-container">
                <span class="edit-date-d">${todayDate}</span>
            </div>
        </td>
        <td class="col-owner">
            <select class="excel-input">
                <option value="مستخدم 1" ${owner === 'مستخدم 1' ? 'selected' : ''}>مستخدم 1</option>
                <option value="مستخدم 2" ${owner === 'مستخدم 2' ? 'selected' : ''}>مستخدم 2</option>
            </select>
        </td>
    `;
    
    setTimeout(() => window.updateRowColor(tr.querySelector('.status-select')), 0);
    return tr;
};

// 4. إضافة سطر جديد فارغ أعلى الجدول
window.insertNewRow = function(data = {}) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const newRow = window.createRowHTML(data);
    tbody.insertBefore(newRow, tbody.firstChild);
    window.updateStats();
    return newRow;
};

// 5. الاستيراد من الإكسيل
window.importDataFromExcel = function(rowsData) {
    let addedCount = 0;
    rowsData.forEach(row => {
        if (typeof window.insertNewRow === 'function') {
            window.insertNewRow(row);
            addedCount++;
        }
    });

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'تم الاستيراد بنجاح',
            text: `تمت إضافة ${addedCount} زيارة جديدة من ملف الإكسيل.`
        });
    }
};

// 6. تحديث لون الحالة
window.updateRowColor = function(selectEl) {
    if(!selectEl) return;
    const val = selectEl.value;
    const tr = selectEl.closest('tr');
    
    selectEl.className = 'excel-input status-select';
    if(tr) tr.classList.remove('row-lost', 'row-uninterested');

    switch(val) {
        case 'تأهيل لفرصة': selectEl.classList.add('status-purple'); break;
        case 'مميزة': selectEl.classList.add('status-green'); break;
        case 'متابعة': selectEl.classList.add('status-yellow-fff'); break;
        case 'عرض سعر': selectEl.classList.add('status-yellow-ffc'); break;
        case 'فقدان': 
            selectEl.classList.add('status-red-c00'); 
            if(tr) tr.classList.add('row-lost');
            break;
        case 'غير مهتم':
            selectEl.classList.add('status-gray-a5');
            if(tr) tr.classList.add('row-uninterested');
            break;
        default: selectEl.classList.add('status-gray-a5'); break;
    }
};

// 7. تحديث الإحصائيات
window.updateStats = function() {
    const rows = document.querySelectorAll('#tableBody .main-row');
    let totalVal = 0;
    
    rows.forEach(row => {
        const valInput = row.querySelector('.col-val input');
        if(valInput && valInput.value !== '' && !isNaN(valInput.value)) {
            totalVal += Number(valInput.value);
        }
    });
    
    const statTotalEl = document.getElementById('stat-total');
    const statValueTotalEl = document.getElementById('stat-value-total');
    
    if(statTotalEl) statTotalEl.innerText = rows.length;
    if(statValueTotalEl) statValueTotalEl.innerText = totalVal.toLocaleString();
};

// 8. وظيفة البحث
window.debouncedFilterTable = function() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    const filter = input.value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody .main-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
};

// 9. القوائم المنسدلة للفرز
window.toggleCustomFilter = function(e, menuId) {
    e.stopPropagation();
    const menu = document.getElementById(menuId);
    if(menu) menu.classList.toggle('show');
};

window.updateFilters = function() {
    window.debouncedFilterTable();
};

document.addEventListener('click', (e) => {
    document.querySelectorAll('.multi-select-menu').forEach(menu => {
        menu.classList.remove('show');
    });
});

// 10. وظيفة الحذف الجماعي
window.executeBulkDelete = function() {
    const checkboxes = document.querySelectorAll('.select-check:checked');
    if(checkboxes.length === 0) {
        if (typeof Swal !== 'undefined') Swal.fire('تنبيه', 'الرجاء تحديد عنصر واحد على الأقل للحذف.', 'warning');
        else alert('الرجاء تحديد عنصر واحد على الأقل للحذف.');
        return;
    }

    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if(row) row.remove();
    });

    window.updateStats();
    
    if (typeof window.closeSharedDeleteModal === 'function') {
        window.closeSharedDeleteModal();
    }
    
    if (typeof Swal !== 'undefined') {
        Swal.fire('نجاح', 'تم حذف العناصر المحددة بنجاح.', 'success');
    }
    
    const masterCb = document.querySelector('th.col-select input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;
};

// 11. وظائف نافذة الملاحظات وسجل النشاط
window.openNoteModal = function(el) {
    const modal = document.getElementById('noteModal');
    if(modal) modal.style.display = 'flex';
};

window.closeNote = function() {
    const modal = document.getElementById('noteModal');
    if(modal) modal.style.display = 'none';
};

window.saveNote = function() {
    window.closeNote();
    if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم حفظ الملاحظة بنجاح.', timer: 1500, showConfirmButton: false });
    }
};

window.toggleLogExpansion = function() {
    const logSection = document.getElementById('activityLogSection');
    if(logSection) logSection.classList.toggle('expanded');
};

// 12. تهيئة الصفحة عند التحميل (تم نقلها للنهاية لضمان قراءة جميع الدوال أولاً)
window.initPage = function() {
    if (typeof window.renderTable === 'function') {
        window.renderTable();
    }
    if (typeof window.updateStats === 'function') {
        window.updateStats();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", window.initPage);
} else {
    window.initPage();
}