// =========================================================================
// table-options.js - ملف الإجراءات الجماعية الموحد (مُعدَّل مع دعم الاستيراد)
// =========================================================================

const bulkStyles = `
/* تنسيقات زر الإجراءات والقائمة المنسدلة */
.btn-bulk-trigger { height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--border-soft, #e2e8f0); background: #fff; color: var(--text-dark, #0f172a); font-family: 'Cairo', sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.02); transition: .2s; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.btn-bulk-trigger:hover { border-color: var(--accent-blue, #3b82f6); color: var(--accent-blue, #3b82f6); background: #f8fafc; }

.dropdown-menu-bulk { display: none; position: absolute; left: 0; top: 40px; background: white; border: 1px solid var(--border-soft, #e2e8f0); border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1); z-index: 1000; min-width: 140px; padding: 6px; }
.dropdown-menu-bulk button { width: 100%; padding: 8px 12px; border: none; background: none; font-family: 'Cairo', sans-serif; font-size: 10.5px; text-align: right; cursor: pointer; color: #475569; font-weight: 700; border-radius: 6px; transition: .2s; display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.dropdown-menu-bulk button:hover { background: #f1f5f9; color: var(--accent-blue, #3b82f6); padding-right: 16px; }
.dropdown-menu-bulk .del-btn:hover { background: #fee2e2; color: #ef4444; }
.dropdown-menu-bulk.show { display: flex; flex-direction: column; animation: fadeIn .2s ease; }

/* توافق الوضع الليلي */
body.dark-mode .btn-bulk-trigger { background-color: #1e293b; color: #f1f5f9; border-color: #334155; }
body.dark-mode .dropdown-menu-bulk { background-color: #1e293b; border-color: #334155; }
body.dark-mode .dropdown-menu-bulk button { color: #cbd5e1; }
body.dark-mode .dropdown-menu-bulk button:hover { background-color: #334155; color: #60a5fa; }

#sharedDeleteModal { z-index: 9999 !important; }
`;

const bulkHTML = `
<button class="btn-bulk-trigger" onclick="toggleBulkDropdown(event, this)">إجراءات جماعية <i class="fas fa-chevron-down" style="font-size:10px;"></i></button>
<div class="dropdown-menu-bulk" id="bulkDropdownMenu">
    <button onclick="if(window.handleBulkAction) handleBulkAction('تغيير المستخدم')"><i class="fas fa-user-edit"></i> تغيير المستخدم</button>
    <button onclick="if(window.handleBulkAction) handleBulkAction('طباعة')"><i class="fas fa-print"></i> طباعة</button>
    <button onclick="triggerExcelImport()"><i class="fas fa-file-import"></i> استيراد</button>
    <button onclick="if(window.handleBulkAction) handleBulkAction('تصدير')"><i class="fas fa-file-excel"></i> تصدير</button>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin: 4px 0;">
    <button class="del-btn" onclick="if(window.handleBulkAction) handleBulkAction('حذف')"><i class="fas fa-trash-alt"></i> حذف المحدد</button>
</div>
<!-- عنصر مدخل ملف الإكسيل الخفي للاستيراد -->
<input type="file" id="excelFileInput" accept=".xlsx, .xls, .csv" style="display:none" onchange="handleExcelFileSelect(event)">
`;

const deleteModalHTML = `
<!-- النافذة المنبثقة المشتركة لتأكيد الحذف -->
<div id="sharedDeleteModal" class="modal-notes" onclick="if(event.target === this) closeSharedDeleteModal()">
    <div class="modal-notes-content" style="height: auto; max-width: 450px;">
        <div style="font-weight: 800; color: #1e293b; font-size:14px; margin-bottom: 15px; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-exclamation-triangle" style="color:#ef4444"></i> تأكيد الحذف
        </div>
        <div id="sharedDeleteModalMessage" style="color: #475569; font-size: 13px; margin-bottom: 20px;">هل أنت متأكد من رغبتك في حذف العنصر المحدد؟</div>
        <div style="display:flex; justify-content: flex-end; gap:10px; margin-top:15px;">
            <button onclick="closeSharedDeleteModal()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:8px 20px; border-radius:6px; cursor:pointer; font-family:Cairo; font-size:11.5px; font-weight:700;">إلغاء</button>
            <button onclick="confirmSharedDelete()" style="background:#ef4444; border:none; color:white; padding:8px 20px; border-radius:6px; cursor:pointer; font-family:Cairo; font-size:11.5px; font-weight:800; box-shadow: 0 2px 4px rgba(239,68,68,0.3);">تأكيد الحذف</button>
        </div>
    </div>
</div>
`;

class BulkActionsManager {
    static init() {
        // حقن تنسيقات CSS
        const style = document.createElement('style');
        style.innerHTML = bulkStyles;
        document.head.appendChild(style);

        // حقن زر وقائمة الإجراءات في المكان المخصص
        const placeholder = document.getElementById('bulkActionsPlaceholder');
        if (placeholder) {
            placeholder.innerHTML = bulkHTML;
        }

        // حقن نافذة الحذف المنبثقة في نهاية الصفحة
        if (!document.getElementById('sharedDeleteModal')) {
            document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
        }
    }
}

// ================= الوظائف العامة للمربع =================

window.toggleBulkDropdown = function(event, btn) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;
    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-menu-bulk').forEach(m => m.classList.remove('show'));
    if (!isShown) menu.classList.add('show');
};

// التحديد الجماعي لخانات الجدول
window.toggleAllCheckboxes = function(master) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = master.checked);
};

// فتح نافذة الحذف المشتركة
window.openSharedDeleteModal = function(count) {
    const modal = document.getElementById('sharedDeleteModal');
    const msg = document.getElementById('sharedDeleteModalMessage');
    if (msg) {
        msg.innerText = count > 1 
            ? `هل أنت متأكد من رغبتك في حذف ${count} عناصر محددة؟`
            : `هل أنت متأكد من رغبتك في حذف هذا العنصر؟`;
    }
    if (modal) modal.style.display = 'flex';
};

// إغلاق نافذة الحذف المشتركة
window.closeSharedDeleteModal = function() {
    const modal = document.getElementById('sharedDeleteModal');
    if (modal) modal.style.display = 'none';
};

// زر تأكيد الحذف الموجود في النافذة
window.confirmSharedDelete = function() {
    if(typeof window.executeBulkDelete === 'function') {
        window.executeBulkDelete();
    } else {
        console.warn('يجب تعريف الدالة window.executeBulkDelete() في ملف سكريبت الصفحة الحالية.');
    }
};

// ================= ووظائف الاستيراد من الإكسيل =================

window.triggerExcelImport = function() {
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
        fileInput.value = ''; // إعادة ضبط ليتسنى اختيار الملف نفسه مجدداً
        fileInput.click();
    }
    document.querySelectorAll('.dropdown-menu-bulk').forEach(m => m.classList.remove('show'));
};

window.handleExcelFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'لم يتم تحميل مكتبة XLSX الخاصة بملفات الإكسيل بشكل صحيح.'
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // تحويل ورقة العمل إلى مصفوفة من الأسطر كـ JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'تنبيه',
                    text: 'ملف الإكسيل فارغ أو لا يحتوي على بيانات متاحة.'
                });
                return;
            }

            // إرسال البيانات للـ JS الخاص بالصفحة لتطبيق الاستيراد
            if (typeof window.importDataFromExcel === 'function') {
                window.importDataFromExcel(jsonData);
            } else {
                console.log("البيانات التي تم جلبها من الإكسيل:", jsonData);
                Swal.fire({
                    icon: 'success',
                    title: 'تم الاستيراد بنجاح',
                    text: `تم التعرف على ${jsonData.length} سجل من ملف الإكسيل.`
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ في معالجة الملف',
                text: 'حدثت مشكلة أثناء قراءة ملف الإكسيل، يرجى التأكد من صيغة الملف.'
            });
        }
    };

    reader.readAsArrayBuffer(file);
};

// إغلاق القائمة المنسدلة عند النقر في أي مكان فارغ بالشاشة
document.addEventListener('click', (e) => {
    if (!e.target.closest('#bulkActionsPlaceholder')) {
        document.querySelectorAll('.dropdown-menu-bulk').forEach(m => m.classList.remove('show'));
    }
});

// تشغيل السكريبت تلقائياً عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", BulkActionsManager.init);