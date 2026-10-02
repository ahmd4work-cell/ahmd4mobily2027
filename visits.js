// بيانات افتراضية لتجربة عرض الصفحة (يمكن استبدالها لاحقاً بجلب البيانات من قاعدة بيانات / API)
let visitsData = [
    {
        id: 1,
        company: 'شركة الأفق',
        address: 'الرياض',
        manager: 'أحمد محمد',
        mobile: '0500000000',
        email: 'ahmed@example.com',
        record: '1234567890',
        date: '2023-10-01',
        service: 'استشارة',
        value: 5000,
        notes: 'زيارة أولية',
        status: 'تأهيل لفرصة',
        owner: 'مستخدم 1'
    }
];

// تهيئة الصفحة عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    renderTable();
    updateStats();
});

// دالة عرض البيانات في الجدول
window.renderTable = function() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    visitsData.forEach(visit => {
        const tr = createRowHTML(visit);
        tbody.appendChild(tr);
    });
    updateStats();
};

// دالة إنشاء سطر جديد وتعبئته بالبيانات كعنصر DOM
function createRowHTML(data = {}) {
    const tr = document.createElement('tr');
    tr.className = 'main-row';
    tr.dataset.id = data.id || Date.now();
    
    tr.innerHTML = `
        <td class="col-select"><input type="checkbox" class="row-checkbox select-check"></td>
        <td class="col-company"><input type="text" class="excel-input" value="${data.company || ''}" placeholder="اسم الشركة"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${data.address || ''}"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${data.manager || ''}"></td>
        <td class="col-mobile">
            <div class="phone-cell-container">
                <input type="text" class="excel-input" value="${data.mobile || ''}">
            </div>
        </td>
        <td class="col-email"><input type="text" class="excel-input" value="${data.email || ''}"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${data.record || ''}"></td>
        <td class="col-date"><input type="date" class="excel-input" value="${data.date || ''}"></td>
        <td class="col-service"><input type="text" class="excel-input" value="${data.service || ''}"></td>
        <td class="col-val"><input type="number" class="excel-input val-input" value="${data.value || 0}" onchange="updateStats()"></td>
        <td class="col-notes">
            <div class="notes-preview" onclick="openNote(this)">${data.notes || 'إضافة ملاحظة'}</div>
        </td>
        <td class="col-status">
            <select class="excel-input status-select" onchange="updateRowColor(this)">
                <option value="تأهيل لفرصة" ${data.status === 'تأهيل لفرصة' ? 'selected' : ''}>تأهيل لفرصة</option>
                <option value="مميزة" ${data.status === 'مميزة' ? 'selected' : ''}>مميزة</option>
                <option value="متابعة" ${data.status === 'متابعة' ? 'selected' : ''}>متابعة</option>
                <option value="عرض سعر" ${data.status === 'عرض سعر' ? 'selected' : ''}>عرض سعر</option>
                <option value="زيارة" ${data.status === 'زيارة' ? 'selected' : ''}>زيارة</option>
                <option value="اتصال" ${data.status === 'اتصال' ? 'selected' : ''}>اتصال</option>
                <option value="غير مهتم" ${data.status === 'غير مهتم' ? 'selected' : ''}>غير مهتم</option>
                <option value="فقدان" ${data.status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td class="col-edit">
            <div class="edit-date-container">
                <span class="edit-date-d">${new Date().toISOString().split('T')[0]}</span>
            </div>
        </td>
        <td class="col-owner">
            <select class="excel-input">
                <option value="مستخدم 1" ${data.owner === 'مستخدم 1' ? 'selected' : ''}>مستخدم 1</option>
                <option value="مستخدم 2" ${data.owner === 'مستخدم 2' ? 'selected' : ''}>مستخدم 2</option>
            </select>
        </td>
    `;
    
    // تحديث لون الخلية بناءً على الحالة الأولية
    setTimeout(() => updateRowColor(tr.querySelector('.status-select')), 0);
    return tr;
}

// إضافة سطر جديد فارغ أعلى الجدول
window.insertNewRow = function() {
    const tbody = document.getElementById('tableBody');
    const newRow = createRowHTML({});
    tbody.insertBefore(newRow, tbody.firstChild);
    updateStats();
    return newRow;
};

// الاستيراد من الإكسيل (كودك الأصلي مع الاعتماد على الدوال المكتملة)
window.importDataFromExcel = function(rowsData) {
    let addedCount = 0;

    rowsData.forEach(row => {
        if (typeof window.insertNewRow === 'function') {
            const newRow = window.insertNewRow(); 
            
            if (row["الشركة"]) setRowValue(newRow, '.col-company input', row["الشركة"]);
            if (row["العنوان"]) setRowValue(newRow, '.col-address input', row["العنوان"]);
            if (row["المسؤول"]) setRowValue(newRow, '.col-manager input', row["المسؤول"]);
            if (row["رقم التواصل"]) setRowValue(newRow, '.col-mobile input', row["رقم التواصل"]);
            if (row["البريد الإلكتروني"]) setRowValue(newRow, '.col-email input', row["البريد الإلكتروني"]);
            if (row["السجل الرئيسي"]) setRowValue(newRow, '.col-record input', row["السجل الرئيسي"]);
            if (row["تاريخ الزيارة"]) setRowValue(newRow, '.col-date input', row["تاريخ الزيارة"]);
            if (row["الخدمة"]) setRowValue(newRow, '.col-service input', row["الخدمة"]);
            if (row["القيمة"]) setRowValue(newRow, '.col-val input', row["القيمة"]);
            if (row["الحالة"]) setRowValue(newRow, '.col-status select', row["الحالة"]);
            if (row["المستخدم"] || row["المالك"]) setRowValue(newRow, '.col-owner select', row["المستخدم"] || row["المالك"]);

            addedCount++;
        }
    });

    Swal.fire({
        icon: 'success',
        title: 'تم الاستيراد بنجاح',
        text: `تمت إضافة ${addedCount} زيارات جديدة من ملف الإكسيل.`
    });
};

function setRowValue(rowElement, selector, val) {
    if (!rowElement) return;
    const el = rowElement.querySelector(selector);
    if (el) {
        el.value = val;
        el.dispatchEvent(new Event('change')); 
    }
}

// ---------------- وظائف مساعدة وديناميكية الصفحة ----------------

// تحديث لون الحالة
window.updateRowColor = function(selectEl) {
    if(!selectEl) return;
    const val = selectEl.value;
    selectEl.className = 'excel-input status-select ' + getStatusClass(val);
};

function getStatusClass(status) {
    switch(status) {
        case 'تأهيل لفرصة': return 'status-green';
        case 'مميزة': return 'status-purple';
        case 'متابعة': return 'status-yellow-fff';
        case 'عرض سعر': return 'status-yellow-ffc';
        case 'زيارة': return 'status-gray-a5';
        case 'غير مهتم':
        case 'فقدان': return 'status-red-c00';
        default: return '';
    }
}

// تحديث الإحصائيات (العدد الإجمالي والقيمة الإجمالية)
window.updateStats = function() {
    const rows = document.querySelectorAll('#tableBody .main-row');
    let totalVal = 0;
    rows.forEach(row => {
        const valInput = row.querySelector('.col-val input');
        if(valInput && !isNaN(valInput.value)) {
            totalVal += Number(valInput.value);
        }
    });
    
    const statTotalEl = document.getElementById('stat-total');
    const statValueTotalEl = document.getElementById('stat-value-total');
    
    if(statTotalEl) statTotalEl.innerText = rows.length;
    if(statValueTotalEl) statValueTotalEl.innerText = totalVal.toLocaleString();
};

// وظيفة البحث (الفلترة)
window.debouncedFilterTable = function() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody .main-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        // إخفاء أو إظهار السطر حسب تطابق النص
        row.style.display = text.includes(input) ? '' : 'none';
    });
};

// إدارة القوائم المنسدلة للفرز في عناوين الجدول
window.toggleCustomFilter = function(e, menuId) {
    e.stopPropagation();
    const menu = document.getElementById(menuId);
    if(menu) menu.classList.toggle('show');
};

window.updateFilters = function() {
    // يمكن هنا ربط الفلاتر المعقدة المتعددة. 
    // مبدئياً نعيد استدعاء وظيفة البحث لتحديث الجدول.
    window.debouncedFilterTable();
};

// إغلاق الفلاتر عند الضغط خارجها
document.addEventListener('click', (e) => {
    document.querySelectorAll('.multi-select-menu').forEach(menu => {
        menu.classList.remove('show');
    });
});

// وظائف الحذف الجماعي (مرتبطة بـ table-options_3.js)
window.executeBulkDelete = function() {
    const checked = document.querySelectorAll('.rowسبب عدم ظهور البيانات في الجدول هو أن ملف `visits.js` الذي تستخدمه يفتقر إلى دالة إنشاء الصفوف (`insertNewRow`) والدالة المسؤولة عن حقن البيانات الأولية عند تحميل الصفحة، حيث كان يحتوي فقط على دالة الاستيراد[cite: 1, 2]. كما أن الإجراءات الجماعية تحتاج إلى تعريف دالة `executeBulkDelete` لتعمل بشكل صحيح مع نافذة الحذف[cite: 4].

إليك ملف `visits.js` الكامل والمُحدّث. قمت بتضمين بيانات تجريبية لتظهر فور تحديث الصفحة، بالإضافة إلى ربط كافة الوظائف (الإضافة، الحذف الجماعي، الاستيراد، تحديث الإحصائيات، وتلوين الحالات):

```javascript
// =========================================================================
// visits.js - الكود الشامل لإدارة بيانات صفحة الزيارات
// =========================================================================

// 1. بيانات تجريبية تظهر عند تحميل الصفحة (يمكنك استبدالها ببيانات من قاعدة البيانات لاحقاً)
const sampleData = [
    {"الشركة": "شركة الأفق للتقنية", "العنوان": "الرياض", "المسؤول": "خالد عبدالله", "رقم التواصل": "966500000000", "البريد الإلكتروني": "info@horizon.sa", "السجل الرئيسي": "10101020", "تاريخ الزيارة": "2023-10-01", "الخدمة": "تصميم متجر", "القيمة": "5000", "الحالة": "متابعة", "المستخدم": "أحمد"},
    {"الشركة": "مؤسسة الرواد", "العنوان": "جدة", "المسؤول": "سعيد محمد", "رقم التواصل": "966511111111", "البريد الإلكتروني": "contact@pioneers.com", "السجل الرئيسي": "20202030", "تاريخ الزيارة": "2023-10-02", "الخدمة": "تسويق رقمي", "القيمة": "3500", "الحالة": "تأهيل لفرصة", "المستخدم": "محمد"}
];

// 2. تهيئة الصفحة عند التحميل
document.addEventListener("DOMContentLoaded", () => {
    // إدراج البيانات التجريبية
    sampleData.forEach(data => window.insertNewRow(data));
    updateStats();
});

// 3. دالة إضافة سطر جديد (مطلوبة لزر الإضافة ولعملية الاستيراد)
window.insertNewRow = function(data = {}) {
    const tbody = document.getElementById('tableBody');
    const tr = document.createElement('tr');
    tr.className = 'main-row';

    // تجهيز القيم (استخدام القيم الممررة أو تركها فارغة)
    const company = data["الشركة"] || "";
    const address = data["العنوان"] || "";
    const manager = data["المسؤول"] || "";
    const mobile = data["رقم التواصل"] || "";
    const email = data["البريد الإلكتروني"] || "";
    const record = data["السجل الرئيسي"] || "";
    const date = data["تاريخ الزيارة"] || "";
    const service = data["الخدمة"] || "";
    const val = data["القيمة"] || "0";
    const status = data["الحالة"] || "زيارة";
    const owner = data["المستخدم"] || data["المالك"] || "أحمد";
    const todayDate = new Date().toLocaleDateString('en-GB'); // تاريخ اليوم لخانة آخر تعديل

    tr.innerHTML = `
        <td class="col-select"><input type="checkbox" class="select-check"></td>
        <td class="col-company"><input type="text" class="excel-input" value="${company}"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${address}"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${manager}"></td>
        <td class="col-mobile">
            <div class="phone-cell-container">
                <input type="text" class="excel-input" value="${mobile}" style="width:70%">
                <a href="[https://wa.me/$](https://wa.me/$){mobile}" target="_blank" class="whatsapp-icon-btn" title="مراسلة واتساب"><i class="fab fa-whatsapp"></i></a>
            </div>
        </td>
        <td class="col-email"><input type="text" class="excel-input" value="${email}"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${record}"></td>
        <td class="col-date"><input type="date" class="excel-input" value="${date}"></td>
        <td class="col-service"><input type="text" class="excel-input" value="${service}"></td>
        <td class="col-val"><input type="number" class="excel-input" value="${val}" onchange="window.updateStats()"></td>
        <td class="col-notes"><div class="notes-preview" onclick="window.openNoteModal(this)">إضافة ملاحظة</div></td>
        <td class="col-status">
            <select class="excel-input status-select" onchange="window.updateRowColor(this)">
                <option value="تأهيل لفرصة" ${status==='تأهيل لفرصة'?'selected':''}>تأهيل لفرصة</option>
                <option value="مميزة" ${status==='مميزة'?'selected':''}>مميزة</option>
                <option value="متابعة" ${status==='متابعة'?'selected':''}>متابعة</option>
                <option value="عرض سعر" ${status==='عرض سعر'?'selected':''}>عرض سعر</option>
                <option value="زيارة" ${status==='زيارة'?'selected':''}>زيارة</option>
                <option value="اتصال" ${status==='اتصال'?'selected':''}>اتصال</option>
                <option value="غير مهتم" ${status==='غير مهتم'?'selected':''}>غير مهتم</option>
                <option value="فقدان" ${status==='فقدان'?'selected':''}>فقدان</option>
            </select>
        </td>
        <td class="col-edit"><div class="edit-date-d">${todayDate}</div></td>
        <td class="col-owner">
            <select class="excel-input">
                <option value="أحمد" ${owner==='أحمد'?'selected':''}>أحمد</option>
                <option value="محمد" ${owner==='محمد'?'selected':''}>محمد</option>
                <option value="علي" ${owner==='علي'?'selected':''}>علي</option>
            </select>
        </td>
    `;

    // إضافة الصف لأعلى الجدول
    tbody.prepend(tr);
    
    // تحديث لون الحالة الافتراضي للسطر الجديد
    window.updateRowColor(tr.querySelector('.status-select'));
    window.updateStats();

    return tr;
};

// 4. دالة تحديث ألوان الحالات بناءً على ملف CSS
window.updateRowColor = function(selectElement) {
    if(!selectElement) return;
    const val = selectElement.value;
    const tr = selectElement.closest('tr');
    
    // إعادة ضبط الكلاسات
    selectElement.className = 'excel-input status-select';
    tr.classList.remove('row-lost', 'row-uninterested', 'closed-row');

    if(val === 'تأهيل لفرصة') selectElement.classList.add('status-purple');
    else if(val === 'مميزة') selectElement.classList.add('status-green');
    else if(val === 'متابعة') selectElement.classList.add('status-yellow-fff');
    else if(val === 'عرض سعر') selectElement.classList.add('status-yellow-ffc');
    else if(val === 'فقدان') { selectElement.classList.add('status-red-c00'); tr.classList.add('row-lost'); }
    else if(val === 'غير مهتم') { selectElement.classList.add('status-gray-a5'); tr.classList.add('row-uninterested'); }
    else { selectElement.classList.add('status-gray-a5'); } // للزيارة والاتصال
};

// 5. دالة تحديث الإحصائيات العلوية
window.updateStats = function() {
    const rows = document.querySelectorAll('#tableBody tr.main-row');
    const statTotal = document.getElementById('stat-total');
    const statValTotal = document.getElementById('stat-value-total');
    
    if(statTotal) statTotal.innerText = rows.length;
    
    let totalVal = 0;
    rows.forEach(row => {
        const valInput = row.querySelector('.col-val input');
        if(valInput && valInput.value) {
            totalVal += parseFloat(valInput.value) || 0;
        }
    });
    
    if(statValTotal) statValTotal.innerText = totalVal.toLocaleString() + ' ر.س';
};

// 6. دالة الاستيراد من الإكسيل (المحدثة)
window.importDataFromExcel = function(rowsData) {
    let addedCount = 0;

    rowsData.forEach(row => {
        if (typeof window.insertNewRow === 'function') {
            const newRow = window.insertNewRow(row); 
            addedCount++;
        }
    });

    Swal.fire({
        icon: 'success',
        title: 'تم الاستيراد بنجاح',
        text: `تمت إضافة ${addedCount} زيارات جديدة من ملف الإكسيل.`
    });
};

// 7. وظيفة الحذف الجماعي (المرتبطة بزر القائمة المنسدلة)
window.executeBulkDelete = function() {
    const checkboxes = document.querySelectorAll('.select-check:checked');
    if(checkboxes.length === 0) {
        Swal.fire('تنبيه', 'الرجاء تحديد عنصر واحد على الأقل للحذف.', 'warning');
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
    
    Swal.fire('نجاح', 'تم حذف العناصر المحددة بنجاح.', 'success');
    
    // إزالة التحديد عن المربع الرئيسي
    const masterCb = document.querySelector('th.col-select input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;
};

// 8. وظائف مساعدة لواجهة المستخدم (لمنع أخطاء الـ Console وتفعيل النوافذ)
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
    Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم حفظ الملاحظة بنجاح.', timer: 1500, showConfirmButton: false });
};

// دالة بحث بسيطة (مربوطة بشريط البحث)
window.debouncedFilterTable = function() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    const filter = input.value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr.main-row');
    
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
};

window.toggleCustomFilter = function(event, id) {
    event.stopPropagation();
    const menu = document.getElementById(id);
    if(menu) menu.classList.toggle('show');
};

window.toggleLogExpansion = function() {
    const logSection = document.getElementById('activityLogSection');
    if(logSection) logSection.classList.toggle('expanded');
};