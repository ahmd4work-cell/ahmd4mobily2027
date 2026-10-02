// =========================================================================
// visits.js - إدارة الزيارات سحابياً ومحلياً (مع نظام الملاحظات الموحد والبحث الشامل والفرز المتعدد والتقويم)
// =========================================================================
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// متغيرات النظام العامة
let currentActivePreview = null;
const saveTimeouts = {}; 
let searchTimeout = null;
const LOGS_KEY = 'asgate_visits_logs_v1';
let visitsDataArray = [];
let isInitialLoad = true;
let activityLogs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
let currentPickerRowId = null;
let currentPickerInput = null;
let currentPickerMonth = new Date().getMonth();
let currentPickerYear = new Date().getFullYear();

// متغيرات للتحكم في الفرز المتعدد
let activeStatusFilters = [];
let activeOwnerFilters = [];
let currentDeleteRowId = null;

// =====================================================
// التنسيق والتحقق من النصوص والتوارخ
// =====================================================

function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getTodayFormatted() { 
    const d = new Date(); 
    return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear(); 
}

function getTimeFormatted() { 
    const d = new Date(); 
    return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0'); 
}

function formatAsDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        const p = dateStr.split('-');
        if (p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`; 
    }
    return dateStr;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parts[0], parts[1]-1, parts[2]); 
        return new Date(parts[2], parts[1]-1, parts[0]); 
    }
    return new Date(0);
}

function getDateColorClass(dateStr) {
    if (!dateStr) return '';
    const todayStr = getTodayFormatted();
    if (dateStr === todayStr) return 'date-today';
    const d = parseDate(dateStr);
    const today = parseDate(todayStr);
    if (d < today) return 'date-past';
    return 'date-warning';
}

function parseEditDateHTML(editDateStr) {
    if (!editDateStr) return `<span class="edit-date-d">-</span>`;
    return `<span class="edit-date-d">${escapeHTML(editDateStr)}</span>`;
}

function updateEditDateField(tr) {
    if (!tr) return;
    const today = getTodayFormatted();
    const time = getTimeFormatted();
    const fullStr = `${today} ${time}`;
    const hiddenInput = tr.querySelector('.edit-date-val');
    if (hiddenInput) hiddenInput.value = fullStr;
    const containerMain = tr.querySelector('.edit-date-container-main');
    if (containerMain) containerMain.innerHTML = parseEditDateHTML(fullStr);
}

function cleanPhone(phone) {
    if (!phone) return '';
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('05')) {
        cleaned = '966' + cleaned.substring(1);
    }
    return cleaned;
}

// =====================================================
// نظام الملاحظات الموحد
// =====================================================

function getLastNoteOnlyFromJSON(jsonStr) { 
    try { 
        const arr = JSON.parse(jsonStr || "[]"); 
        if (Array.isArray(arr) && arr.length > 0) {
            const last = arr[arr.length - 1];
            return last.text || last.note || "أضف ملاحظة...";
        }
        return "أضف ملاحظة...";
    } catch(e) { 
        if (typeof jsonStr === 'string' && jsonStr.trim() !== '' && jsonStr !== '[]') return jsonStr;
        return "أضف ملاحظة..."; 
    } 
}

function parseNoteDateTime(dateStr, timeStr) {
    if (!dateStr) return new Date(NaN);
    let parts = dateStr.split('-');
    let year, month, day;
    if (parts.length === 3) {
        if (parts[0].length === 4) { year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; day = parseInt(parts[2], 10); } 
        else { day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10); }
    } else { return new Date(dateStr); }
    let hours = 0, minutes = 0;
    if (timeStr && timeStr.includes(':')) { let tParts = timeStr.split(':'); hours = parseInt(tParts[0], 10) || 0; minutes = parseInt(tParts[1], 10) || 0; }
    return new Date(year, month, day, hours, minutes);
}

function openNote(el) {
    currentActivePreview = el;
    let arr = []; 
    try { arr = JSON.parse(el.getAttribute('data-full-notes') || "[]"); } catch(e) {}
    
    const historyLog = document.getElementById('historyLog');
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    if (historyLog) {
        historyLog.innerHTML = arr.map((msg, index) => {
            let msgDateObj = parseNoteDateTime(msg.date, msg.time);
            let dayStr = isNaN(msgDateObj.getTime()) ? '' : days[msgDateObj.getDay()] + ' ';
            let userName = msg.user && msg.user !== "المستخدم" ? msg.user : "المستخدم";

            let showDelete = true;
            if (msg.date && msg.time) {
                let noteDateTime = parseNoteDateTime(msg.date, msg.time);
                if (!isNaN(noteDateTime.getTime())) {
                    let diffInHours = (new Date() - noteDateTime) / (1000 * 60 * 60);
                    if (diffInHours > 24) showDelete = false;
                }
            }
            
            let deleteBtnHtml = showDelete ? `<i class="fas fa-trash-alt delete-note-btn" onclick="deleteNote(${index})" title="حذف الملاحظة"></i>` : '';

            return `
            <div class="note-item">
                <div class="note-header">
                    <span class="note-meta">
                        <span class="note-user"><i class="fas fa-user-circle"></i> ${escapeHTML(userName)}</span>
                        <span dir="ltr"><i class="far fa-calendar-alt"></i> ${escapeHTML(dayStr)} ${escapeHTML(msg.date || '')}</span>
                        <span dir="ltr"><i class="far fa-clock"></i> ${escapeHTML(msg.time || '')}</span>
                    </span>
                    ${deleteBtnHtml}
                </div>
                <div class="note-body">${escapeHTML(msg.text || '')}</div>
            </div>
            `;
        }).join('') || '<div style="color:#64748b; text-align:center; font-size:11px; padding:20px; font-weight:700;">لا توجد ملاحظات سابقة</div>';
    }
    
    const noteModal = document.getElementById('noteModal');
    if (noteModal) { noteModal.style.display = "flex"; if (historyLog) historyLog.scrollTop = historyLog.scrollHeight; }
    
    const modalTextArea = document.getElementById('modalTextArea');
    if (modalTextArea) { modalTextArea.value = ""; modalTextArea.focus(); }
}

function saveNote() {
    const txt = document.getElementById('modalTextArea').value.trim();
    if (txt && currentActivePreview) {
        let arr = []; 
        try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        
        let username = "المستخدم"; 
        const mainRow = currentActivePreview.closest('.main-row');
        
        if (mainRow) { 
            const ownerInput = mainRow.querySelector('.owner-input'); 
            if (ownerInput && ownerInput.value.trim()) username = ownerInput.value.trim(); 
        }
        
        arr.push({ user: username, date: getTodayFormatted(), time: getTimeFormatted(), text: txt });
        const jsonStr = JSON.stringify(arr);
        currentActivePreview.setAttribute('data-full-notes', jsonStr); 
        currentActivePreview.innerText = txt;
        
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); }
    }
    closeNote();
}

async function deleteNote(index) {
    if (!currentActivePreview) return;
    const result = await Swal.fire({
        title: 'تأكيد الحذف؟', text: "هل أنت متأكد من حذف هذه الملاحظة؟", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8',
        confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        let arr = [];
        try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        arr.splice(index, 1);
        const jsonStr = JSON.stringify(arr);
        currentActivePreview.setAttribute('data-full-notes', jsonStr);
        currentActivePreview.innerText = getLastNoteOnlyFromJSON(jsonStr);

        const mainRow = currentActivePreview.closest('.main-row');
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); }
        openNote(currentActivePreview);
    }
}

function closeNote() { 
    const noteModal = document.getElementById('noteModal');
    if (noteModal) noteModal.style.display = "none"; 
}

// =====================================================
// سجل النشاطات (Activity Log)
// =====================================================

function addToActivityLog(type, text, details = '', status = '') {
    const today = getTodayFormatted();
    const time = getTimeFormatted();
    const newLog = { date: today, time: time, type: type, text: text, details: details, status: status };
    activityLogs.unshift(newLog);
    if (activityLogs.length > 50) activityLogs.pop();
    localStorage.setItem(LOGS_KEY, JSON.stringify(activityLogs));
    renderActivityLog();
}

function renderActivityLog() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    if (!activityLogs || activityLogs.length === 0) {
        activityList.innerHTML = '<div style="color:#64748b; text-align:center; font-size:10px; padding:10px;">لا توجد أنشطة مسجلة بعد</div>';
        return;
    }

    activityList.innerHTML = activityLogs.map(log => `
        <div class="log-entry">
            <span class="log-header-info">
                <span dir="ltr">${escapeHTML(log.date || '')} ${escapeHTML(log.time || '')}</span>
                <span class="log-sep">|</span>
                <span>${escapeHTML(log.type || 'إجراء')}</span>
            </span>
            <span class="log-sep">|</span>
            <span class="log-action">${escapeHTML(log.text || '')} ${log.details ? '(' + escapeHTML(log.details) + ')' : ''}</span>
        </div>
    `).join('');
}

function toggleLogExpansion() {
    const section = document.getElementById('activityLogSection');
    const btn = document.getElementById('toggleExpandBtn');
    if (section) {
        section.classList.toggle('expanded');
        if (section.classList.contains('expanded')) {
            if (btn) btn.innerHTML = '<i class="fas fa-compress-alt"></i>';
        } else {
            if (btn) btn.innerHTML = '<i class="fas fa-expand-alt"></i>';
        }
    }
}

// =====================================================
// التقويم المنبثق (Date Picker)
// =====================================================

function openDatePicker(inputEl, visitId) {
    currentPickerInput = inputEl;
    currentPickerRowId = visitId;
    const val = inputEl.value;
    const d = parseDate(val);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        currentPickerMonth = d.getMonth();
        currentPickerYear = d.getFullYear();
    } else {
        const todayObj = new Date();
        currentPickerMonth = todayObj.getMonth();
        currentPickerYear = todayObj.getFullYear();
    }
    
    const overlay = document.getElementById('customDatePicker');
    if (overlay) {
        overlay.classList.add('active');
        renderCalendarSelects();
        renderCalendarDays();
    }
}

function closeDatePicker() {
    const overlay = document.getElementById('customDatePicker');
    if (overlay) overlay.classList.remove('active');
    currentPickerInput = null;
    currentPickerRowId = null;
}

function renderCalendarSelects() {
    const monthSelect = document.getElementById('dpMonth');
    const yearSelect = document.getElementById('dpYear');
    if (!monthSelect || !yearSelect) return;

    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    monthSelect.innerHTML = months.map((m, idx) => `<option value="${idx}" ${idx === currentPickerMonth ? 'selected' : ''}>${m}</option>`).join('');

    const currentYear = new Date().getFullYear();
    let yearsHTML = '';
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearsHTML += `<option value="${y}" ${y === currentPickerYear ? 'selected' : ''}>${y}</option>`;
    }
    yearSelect.innerHTML = yearsHTML;

    monthSelect.onchange = (e) => { currentPickerMonth = parseInt(e.target.value, 10); renderCalendarDays(); };
    yearSelect.onchange = (e) => { currentPickerYear = parseInt(e.target.value, 10); renderCalendarDays(); };
}

function renderCalendarDays() {
    const daysGrid = document.getElementById('dpDays');
    if (!daysGrid) return;

    const firstDayIndex = new Date(currentPickerYear, currentPickerMonth, 1).getDay();
    const totalDays = new Date(currentPickerYear, currentPickerMonth + 1, 0).getDate();

    let daysHTML = '';
    for (let i = 0; i < firstDayIndex; i++) {
        daysHTML += `<div></div>`;
    }

    const todayStr = getTodayFormatted();

    for (let d = 1; d <= totalDays; d++) {
        const dayStr = String(d).padStart(2, '0') + '-' + String(currentPickerMonth + 1).padStart(2, '0') + '-' + currentPickerYear;
        const isToday = dayStr === todayStr;
        let isSelected = false;
        if (currentPickerInput && currentPickerInput.value === dayStr) {
            isSelected = true;
        }

        let cls = 'day-number';
        if (isToday) cls += ' today-day';
        if (isSelected) cls += ' selected-day';

        daysHTML += `<div class="${cls}" onclick="selectCalendarDate('${dayStr}')">${d}</div>`;
    }

    daysGrid.innerHTML = daysHTML;
}

function selectCalendarDate(dateStr) {
    if (currentPickerInput && currentPickerRowId) {
        currentPickerInput.value = dateStr;
        currentPickerInput.className = `excel-input readonly-input visit-date-val ${getDateColorClass(dateStr)}`;
        const mainRow = document.getElementById(currentPickerRowId);
        if (mainRow) {
            updateEditDateField(mainRow);
            saveSingleRow(currentPickerRowId);
        }
        addToActivityLog('تعديل', `تم تحديث تاريخ الزيارة إلى (${dateStr})`, '', 'مكتمل');
    }
    closeDatePicker();
}

function setTodayDate() {
    const todayStr = getTodayFormatted();
    selectCalendarDate(todayStr);
}

// =====================================================
// إجراءات جماعية وقوائم منسدلة
// =====================================================

function toggleDropdown(event, btn) {
    event.stopPropagation();
    const wrapper = btn.closest('.bulk-action-wrapper');
    const menu = wrapper ? wrapper.querySelector('.dropdown-menu') : null;
    document.querySelectorAll('.dropdown-menu').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    if (menu) menu.classList.toggle('show');
}

window.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.multi-select-menu').forEach(m => m.classList.remove('show'));
});

function toggleAllCheckboxes(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#tableBody .row-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}

function handleBulkAction(actionType) {
    const selectedCheckboxes = document.querySelectorAll('#tableBody .row-checkbox:checked');
    const ids = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (ids.length === 0 && actionType !== 'تصدير') {
        Swal.fire('تنبيه', 'الرجاء تحديد زيارة واحدة على الأقل', 'warning');
        return;
    }

    if (actionType === 'حذف') {
        Swal.fire({
            title: 'تأكيد الحذف الجماعي؟',
            text: `هل أنت متأكد من حذف ${ids.length} زيارة محددة؟`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const batch = writeBatch(db);
                    ids.forEach(id => {
                        batch.delete(doc(db, "visits", id));
                    });
                    await batch.commit();
                    addToActivityLog('حذف', `تم حذف ${ids.length} زيارة بشكل جماعي`, '', 'مكتمل');
                    Swal.fire('تم الحذف', 'تم حذف الزيارات المحددة بنجاح', 'success');
                } catch(e) {
                    console.error("Error bulk deleting:", e);
                    Swal.fire('خطأ', 'حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    } else if (actionType === 'تصدير') {
        exportToExcel();
    } else if (actionType === 'طباعة') {
        window.print();
    } else if (actionType === 'تغيير المالك') {
        Swal.fire({
            title: 'تغيير المالك الجماعي',
            input: 'text',
            inputPlaceholder: 'أدخل اسم المالك الجديد...',
            showCancelButton: true,
            confirmButtonText: 'تحديث',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const newOwner = result.value.trim();
                try {
                    const batch = writeBatch(db);
                    ids.forEach(id => {
                        batch.update(doc(db, "visits", id), { owner: newOwner });
                    });
                    await batch.commit();
                    addToActivityLog('تعديل', `تم تغيير مالك ${ids.length} زيارة إلى (${newOwner})`, '', 'مكتمل');
                    Swal.fire('تم', 'تم تحديث مالك الزيارات بنجاح', 'success');
                } catch(e) {
                    console.error("Error bulk updating owner:", e);
                    Swal.fire('خطأ', 'حدث خطأ أثناء التحديث', 'error');
                }
            }
        });
    }
}

function exportToExcel() {
    let csvContent = "\uFEFFالشركة,العنوان,المسؤول,رقم التواصل,البريد الإلكتروني,السجل التجاري,تاريخ الزيارة,الخدمة,القيمة,الحالة,المالك\n";
    visitsDataArray.forEach(v => {
        csvContent += `"${v.comp || ''}","${v.address || ''}","${v.mgr || ''}","${v.mob || ''}","${v.email || ''}","${v.record || ''}","${v.visitDate || ''}","${v.curServ || ''}","${v.oppValue || 0}","${v.status || ''}","${v.owner || ''}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visits_export_${getTodayFormatted()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToActivityLog('تصدير', 'تم تصدير بيانات الزيارات إلى ملف CSV', '', 'مكتمل');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    currentDeleteRowId = null;
}

function confirmDelete() {
    closeDeleteModal();
}

// =====================================================
// المزامنة مع Firebase Firestore والعرض
// =====================================================

async function insertNewRow() {
    const newId = 'visit_' + Date.now();
    const today = getTodayFormatted();
    const timeStr = getTimeFormatted();
    
    const newVisit = {
        comp: '', address: '', mgr: '', mob: '', email: '', record: '',
        visitDate: today, curServ: '', oppValue: '0', notes: '[]',
        status: '', editDate: `${today} ${timeStr}`, owner: '', products: []
    };

    try {
        await setDoc(doc(db, "visits", newId), newVisit);
        addToActivityLog('إجراء', 'تمت إضافة زيارة جديدة', '', 'جديد');
    } catch (error) {
        console.error("خطأ في إضافة زيارة جديدة سحابياً:", error);
        Swal.fire('خطأ', 'تعذر إضافة الزيارة في السحابة', 'error');
    }
}

function listenToVisits() {
    const visitsRef = collection(db, "visits");
    onSnapshot(visitsRef, (snapshot) => {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        let needsFullRender = false;
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            data.id = change.doc.id;
            if (change.type === "added") { visitsDataArray.push(data); needsFullRender = true; }
            if (change.type === "modified") {
                const index = visitsDataArray.findIndex(v => v.id === data.id);
                if (index !== -1) { visitsDataArray[index] = data; updateRowDOM(data); }
            }
            if (change.type === "removed") {
                visitsDataArray = visitsDataArray.filter(v => v.id !== data.id);
                needsFullRender = true;
            }
        });

        localStorage.setItem('crm_visits', JSON.stringify(visitsDataArray.map(v => ({
            id: v.id, company: v.comp || '', responsible: v.mgr || '', phone: v.mob || '', email: v.email || '', record: v.record || ''
        }))));

        if (needsFullRender || isInitialLoad) { 
            updateDynamicOwnerFilter();
            fullTableRender(); 
            isInitialLoad = false; 
        }
        updateStats(); 
        renderActivityLog();
    }, (error) => { console.error("مشكلة في مزامنة الزيارات من السحابة:", error); });
}

function applyStatusColor(selectEl) {
    if (!selectEl) return;
    selectEl.className = 'excel-input status-select';
    const val = selectEl.value.trim();
    if (val === 'تأهيل لفرصة') selectEl.classList.add('status-green');
    else if (val === 'مميزة') selectEl.classList.add('status-purple');
    else if (val === 'متابعة') selectEl.classList.add('status-yellow-fff');
    else if (val === 'عرض سعر') selectEl.classList.add('status-yellow-ffc');
    else if (val === 'زيارة') selectEl.classList.add('status-green');
    else if (val === 'اتصال') selectEl.classList.add('status-gray-a5');
    else if (val === 'غير مهتم') selectEl.classList.add('status-gray-a5');
    else if (val === 'فقدان') selectEl.classList.add('status-red-c00');
    
    const tr = selectEl.closest('tr');
    if (tr) {
        tr.classList.remove('row-lost', 'row-uninterested');
        if (val === 'فقدان') tr.classList.add('row-lost');
        else if (val === 'غير مهتم') tr.classList.add('row-uninterested');
    }
}

function updateRowDOM(v) {
    const mainRow = document.getElementById(v.id);
    if (!mainRow) return;

    const safeUpdate = (selector, newVal) => {
        const el = mainRow.querySelector(selector);
        if (el && document.activeElement !== el) {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') { el.value = newVal; } 
            else { el.innerHTML = newVal; }
        }
    };

    safeUpdate('td:nth-child(2) input', v.comp || '');
    safeUpdate('td:nth-child(3) input', v.address || '');
    safeUpdate('td:nth-child(4) input', v.mgr || '');
    safeUpdate('td:nth-child(5) input', v.mob || '');
    safeUpdate('td:nth-child(6) input', v.email || '');
    safeUpdate('td:nth-child(7) input', v.record || '');
    
    const visitDate = formatAsDDMMYYYY(v.visitDate || getTodayFormatted());
    safeUpdate('.visit-date-val', visitDate);
    
    safeUpdate('.cur-serv-val', v.curServ || '');
    safeUpdate('.opp-value-input', v.oppValue || '0');
    
    const statusSelect = mainRow.querySelector('.status-select');
    if (statusSelect && document.activeElement !== statusSelect) {
        statusSelect.value = v.status || ''; 
        applyStatusColor(statusSelect);
    }
    safeUpdate('.owner-input', v.owner || '');
    
    const hiddenEditDate = mainRow.querySelector('.edit-date-val');
    if (hiddenEditDate) hiddenEditDate.value = v.editDate || '';
    const editMains = mainRow.querySelector('.edit-date-container-main');
    if (editMains) editMains.innerHTML = parseEditDateHTML(v.editDate || '');

    let notesJson = v.notes || "[]";
    const noteEl = mainRow.querySelector('.notes-preview');
    if (noteEl) { noteEl.setAttribute('data-full-notes', notesJson); noteEl.innerText = getLastNoteOnlyFromJSON(notesJson); }

    const subRow = document.getElementById('sub-' + v.id);
    if (subRow && !subRow.contains(document.activeElement)) {
         const tbody = subRow.querySelector('.product-body');
         if (tbody) {
             const products = Array.isArray(v.products) ? v.products : [];
             tbody.innerHTML = products.map(p => `
                <tr>
                    <td><input type="text" class="p-name" value="${escapeHTML(p.name || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="اسم المنتج/الخدمة"></td>
                    <td><input type="number" class="p-qty" value="${p.qty || 1}" oninput="updateProductTotal(this, '${v.id}')" placeholder="الكمية"></td>
                    <td><input type="number" class="p-price" value="${p.price || 0}" oninput="updateProductTotal(this, '${v.id}')" placeholder="السعر"></td>
                    <td><input type="text" class="p-total readonly-input" value="${(Number(p.qty || 1) * Number(p.price || 0)).toLocaleString('ar-SA')}" readonly></td>
                    <td style="text-align:center;">
                        <button type="button" class="sub-action-btn" onclick="removeProductRow(this, '${v.id}')" title="حذف المنتج"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
             `).join('');
         }
    }
}

function renderRowHTML(v) {
    const hasProducts = Array.isArray(v.products) && v.products.length > 0;
    const visitDateFormatted = formatAsDDMMYYYY(v.visitDate || getTodayFormatted());
    const phoneClean = cleanPhone(v.mob);

    let rowClass = 'main-row';
    if (v.status === 'فقدان') rowClass += ' row-lost';
    if (v.status === 'غير مهتم') rowClass += ' row-uninterested';

    return `
    <tr id="${v.id}" class="${rowClass}">
        <td class="col-select">
            <input type="checkbox" class="row-checkbox select-check" value="${v.id}">
            <span class="toggle-arrow ${hasProducts ? 'arrow-open' : ''}" onclick="toggleSubTable('${v.id}')">▶</span>
        </td>
        <td class="col-company"><input type="text" class="excel-input" value="${escapeHTML(v.comp || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="اسم الشركة"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${escapeHTML(v.address || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="العنوان"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${escapeHTML(v.mgr || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="اسم المسؤول"></td>
        <td class="col-mobile">
            <div class="phone-cell-container">
                <input type="text" class="excel-input" value="${escapeHTML(v.mob || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="05XXXXXXXX">
                ${v.mob ? `<a href="https://wa.me/${phoneClean}" target="_blank" class="whatsapp-icon-btn" title="واتساب"><i class="fab fa-whatsapp"></i></a>` : ''}
            </div>
        </td>
        <td class="col-email"><input type="email" class="excel-input" value="${escapeHTML(v.email || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="email@domain.com"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${escapeHTML(v.record || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="السجل التجاري"></td>
        <td class="col-date">
            <input type="text" class="excel-input readonly-input visit-date-val ${getDateColorClass(visitDateFormatted)}" value="${escapeHTML(visitDateFormatted)}" readonly onclick="openDatePicker(this, '${v.id}')">
        </td>
        <td class="col-service"><input type="text" class="excel-input cur-serv-val" value="${escapeHTML(v.curServ || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="نوع الخدمة"></td>
        <td class="col-val"><input type="number" class="excel-input opp-value-input" value="${v.oppValue || 0}" oninput="debouncedSaveRow('${v.id}')" placeholder="0"></td>
        <td class="col-notes">
            <span class="notes-preview" data-full-notes="${escapeHTML(v.notes || '[]')}" onclick="openNote(this)">
                ${escapeHTML(getLastNoteOnlyFromJSON(v.notes))}
            </span>
        </td>
        <td class="col-status">
            <select class="excel-input status-select" onchange="onStatusChange(this, '${v.id}')">
                <option value="">-- اختر --</option>
                <option value="تأهيل لفرصة" ${v.status === 'تأهيل لفرصة' ? 'selected' : ''}>تأهيل لفرصة</option>
                <option value="مميزة" ${v.status === 'مميزة' ? 'selected' : ''}>مميزة</option>
                <option value="متابعة" ${v.status === 'متابعة' ? 'selected' : ''}>متابعة</option>
                <option value="عرض سعر" ${v.status === 'عرض سعر' ? 'selected' : ''}>عرض سعر</option>
                <option value="زيارة" ${v.status === 'زيارة' ? 'selected' : ''}>زيارة</option>
                <option value="اتصال" ${v.status === 'اتصال' ? 'selected' : ''}>اتصال</option>
                <option value="غير مهتم" ${v.status === 'غير مهتم' ? 'selected' : ''}>غير مهتم</option>
                <option value="فقدان" ${v.status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td class="col-edit">
            <input type="hidden" class="edit-date-val" value="${escapeHTML(v.editDate || '')}">
            <div class="edit-date-container-main">${parseEditDateHTML(v.editDate || '')}</div>
        </td>
        <td class="col-owner"><input type="text" class="excel-input owner-input" value="${escapeHTML(v.owner || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="المالك"></td>
    </tr>
    ${renderSubTableHTML(v)}`;
}

function renderSubTableHTML(v) {
    const products = Array.isArray(v.products) ? v.products : [];
    let rowsHtml = products.map(p => `
        <tr>
            <td><input type="text" class="p-name" value="${escapeHTML(p.name || '')}" oninput="debouncedSaveRow('${v.id}')" placeholder="اسم المنتج/الخدمة"></td>
            <td><input type="number" class="p-qty" value="${p.qty || 1}" oninput="updateProductTotal(this, '${v.id}')" placeholder="الكمية"></td>
            <td><input type="number" class="p-price" value="${p.price || 0}" oninput="updateProductTotal(this, '${v.id}')" placeholder="السعر"></td>
            <td><input type="text" class="p-total readonly-input" value="${(Number(p.qty || 1) * Number(p.price || 0)).toLocaleString('ar-SA')}" readonly></td>
            <td style="text-align:center;">
                <button type="button" class="sub-action-btn" onclick="removeProductRow(this, '${v.id}')" title="حذف المنتج"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');

    return `
    <tr id="sub-${v.id}" class="sub-table-row">
        <td colspan="14">
            <div class="sub-table-container">
                <table class="inner-table">
                    <thead>
                        <tr>
                            <th style="width: 40%;">المنتج / الخدمة <button type="button" class="header-plus-btn" onclick="addProductRow('${v.id}')" title="إضافة منتج">+</button></th>
                            <th style="width: 15%;">الكمية</th>
                            <th style="width: 20%;">السعر</th>
                            <th style="width: 20%;">الإجمالي</th>
                            <th style="width: 5%;">إجراء</th>
                        </tr>
                    </thead>
                    <tbody class="product-body">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </td>
    </tr>`;
}

function fullTableRender(dataArray = null) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const list = dataArray || visitsDataArray;
    let fullHTML = '';
    let currentMonthYear = '';

    const sortedList = [...list].sort((a, b) => parseDate(b.visitDate) - parseDate(a.visitDate));

    sortedList.forEach(v => {
        const dObj = parseDate(v.visitDate);
        if (!isNaN(dObj.getTime()) && dObj.getFullYear() > 1970) {
            const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
            const myStr = `${monthNames[dObj.getMonth()]} ${dObj.getFullYear()}`;
            if (myStr !== currentMonthYear) {
                currentMonthYear = myStr;
                fullHTML += `<tr class="month-separator"><td colspan="14"><div class="sep-text">${currentMonthYear}</div></td></tr>`;
            }
        }
        fullHTML += renderRowHTML(v);
    });

    tbody.innerHTML = fullHTML;

    tbody.querySelectorAll('.status-select').forEach(select => {
        applyStatusColor(select);
    });
}

function toggleSubTable(rowId) {
    const subRow = document.getElementById('sub-' + rowId);
    const arrow = document.querySelector(`#${rowId} .toggle-arrow`);
    if (subRow) {
        const isVisible = subRow.style.display === 'table-row';
        subRow.style.display = isVisible ? 'none' : 'table-row';
        if (arrow) {
            if (isVisible) arrow.classList.remove('arrow-open');
            else arrow.classList.add('arrow-open');
        }
    }
}

function addProductRow(visitId) {
    const subRow = document.getElementById('sub-' + visitId);
    if (!subRow) return;
    const tbody = subRow.querySelector('.product-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="p-name" value="" oninput="debouncedSaveRow('${visitId}')" placeholder="اسم المنتج/الخدمة"></td>
        <td><input type="number" class="p-qty" value="1" oninput="updateProductTotal(this, '${visitId}')" placeholder="الكمية"></td>
        <td><input type="number" class="p-price" value="0" oninput="updateProductTotal(this, '${visitId}')" placeholder="السعر"></td>
        <td><input type="text" class="p-total readonly-input" value="0" readonly></td>
        <td style="text-align:center;">
            <button type="button" class="sub-action-btn" onclick="removeProductRow(this, '${visitId}')" title="حذف المنتج"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    debouncedSaveRow(visitId);
}

function removeProductRow(btn, visitId) {
    const tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        debouncedSaveRow(visitId);
    }
}

function updateProductTotal(inputEl, visitId) {
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const qty = Number(tr.querySelector('.p-qty')?.value || 0);
    const price = Number(tr.querySelector('.p-price')?.value || 0);
    const totalEl = tr.querySelector('.p-total');
    if (totalEl) totalEl.value = (qty * price).toLocaleString('ar-SA');
    debouncedSaveRow(visitId);
}

// =====================================================
// الحفظ والتحديث السحابي المنفرد
// =====================================================

async function saveSingleRow(rowId) {
    const mainRow = document.getElementById(rowId);
    if (!mainRow) return;

    const comp = mainRow.querySelector('td:nth-child(2) input')?.value || '';
    const address = mainRow.querySelector('td:nth-child(3) input')?.value || '';
    const mgr = mainRow.querySelector('td:nth-child(4) input')?.value || '';
    const mob = mainRow.querySelector('td:nth-child(5) input')?.value || '';
    const email = mainRow.querySelector('td:nth-child(6) input')?.value || '';
    const record = mainRow.querySelector('td:nth-child(7) input')?.value || '';
    const visitDate = mainRow.querySelector('td:nth-child(8) input')?.value || getTodayFormatted();
    const curServ = mainRow.querySelector('td:nth-child(9) input')?.value || '';
    const oppValue = mainRow.querySelector('td:nth-child(10) input')?.value || '0';
    
    const notesPreview = mainRow.querySelector('.notes-preview');
    const notes = notesPreview ? notesPreview.getAttribute('data-full-notes') || '[]' : '[]';
    
    const statusSelect = mainRow.querySelector('.status-select');
    const status = statusSelect ? statusSelect.value : '';
    
    const owner = mainRow.querySelector('.owner-input')?.value || '';
    
    const today = getTodayFormatted();
    const time = getTimeFormatted();
    const editDate = `${today} ${time}`;

    const subRow = document.getElementById('sub-' + rowId);
    let products = [];
    if (subRow) {
        const productRows = subRow.querySelectorAll('.product-body tr');
        productRows.forEach(pRow => {
            const name = pRow.querySelector('.p-name')?.value || '';
            const qty = pRow.querySelector('.p-qty')?.value || 1;
            const price = pRow.querySelector('.p-price')?.value || 0;
            if (name.trim()) {
                products.push({ name, qty: Number(qty), price: Number(price) });
            }
        });
    } else {
        const existing = visitsDataArray.find(v => v.id === rowId);
        if (existing) products = existing.products || [];
    }

    const updatedData = {
        comp, address, mgr, mob, email, record, visitDate, curServ,
        oppValue, notes, status, editDate, owner, products
    };

    try {
        await setDoc(doc(db, "visits", rowId), updatedData, { merge: true });
        updateEditDateField(mainRow);
    } catch(e) {
        console.error("Error saving row:", e);
    }
}

function debouncedSaveRow(rowId) {
    if (saveTimeouts[rowId]) clearTimeout(saveTimeouts[rowId]);
    saveTimeouts[rowId] = setTimeout(() => {
        saveSingleRow(rowId);
    }, 500);
}

function onStatusChange(selectEl, rowId) {
    applyStatusColor(selectEl);
    updateEditDateField(document.getElementById(rowId));
    saveSingleRow(rowId);
    const val = selectEl.value;
    addToActivityLog('تعديل', `تم تغيير حالة الزيارة إلى (${val || 'بدون'})`, '', 'مكتمل');
}

// =====================================================
// البحث والفلترة المتعددة والتقويم والإحصائيات
// =====================================================

function debouncedFilterTable() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterTable, 300);
}

function filterTable() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    const filtered = visitsDataArray.filter(v => {
        const matchSearch = !query || [
            v.comp, v.address, v.mgr, v.mob, v.email, v.record, v.curServ, v.owner, v.status
        ].some(val => String(val || '').toLowerCase().includes(query));

        const matchStatus = activeStatusFilters.length === 0 || activeStatusFilters.includes(v.status);
        const matchOwner = activeOwnerFilters.length === 0 || activeOwnerFilters.includes(v.owner);

        return matchSearch && matchStatus && matchOwner;
    });

    fullTableRender(filtered);
    updateStats(filtered);
}

function toggleCustomFilter(event, menuId) {
    event.stopPropagation();
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.multi-select-menu').forEach(m => m.classList.remove('show'));
    
    if (!isShown) menu.classList.add('show');
}

function updateFilters() {
    const statusChecked = Array.from(document.querySelectorAll('#statusFilterMenu input[type="checkbox"]:checked')).map(c => c.value);
    activeStatusFilters = statusChecked;
    const statusDot = document.getElementById('statusFilterDot');
    if (statusDot) statusDot.style.display = statusChecked.length > 0 ? 'block' : 'none';

    const ownerChecked = Array.from(document.querySelectorAll('#ownerFilterMenu input[type="checkbox"]:checked')).map(c => c.value);
    activeOwnerFilters = ownerChecked;
    const ownerDot = document.getElementById('ownerFilterDot');
    if (ownerDot) ownerDot.style.display = ownerChecked.length > 0 ? 'block' : 'none';

    filterTable();
}

function updateDynamicOwnerFilter() {
    const ownerMenu = document.getElementById('ownerFilterMenu');
    if (!ownerMenu) return;

    const uniqueOwners = [...new Set(visitsDataArray.map(v => v.owner).filter(o => o && o.trim() !== ''))].sort();
    
    ownerMenu.innerHTML = uniqueOwners.map(owner => `
        <label class="multi-select-item">
            <input type="checkbox" value="${escapeHTML(owner)}" ${activeOwnerFilters.includes(owner) ? 'checked' : ''} onchange="updateFilters()">
            <span class="custom-cb"><i class="fas fa-check"></i></span> ${escapeHTML(owner)}
        </label>
    `).join('');
}

function updateStats(dataArray = null) {
    const list = dataArray || visitsDataArray;
    const todayStr = getTodayFormatted();
    const today = parseDate(todayStr);
    
    let total = list.length;
    let thisMonth = 0;
    let todayCount = 0;
    let totalVal = 0;
    let monthVal = 0;

    list.forEach(v => {
        const dObj = parseDate(v.visitDate);
        if (!isNaN(dObj.getTime())) {
            if (dObj.getMonth() === today.getMonth() && dObj.getFullYear() === today.getFullYear()) {
                thisMonth++;
                monthVal += Number(v.oppValue) || 0;
            }
            if (v.visitDate === todayStr) {
                todayCount++;
            }
        }
        totalVal += Number(v.oppValue) || 0;
    });

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
    if (document.getElementById('stat-month')) document.getElementById('stat-month').innerText = thisMonth;
    if (document.getElementById('stat-today')) document.getElementById('stat-today').innerText = todayCount;
    if (document.getElementById('stat-value-total')) document.getElementById('stat-value-total').innerText = totalVal.toLocaleString('ar-SA');
    if (document.getElementById('stat-value-month')) document.getElementById('stat-value-month').innerText = monthVal.toLocaleString('ar-SA');
}

// تصدير جميع الدوال الضرورية للعمل مع نافذة المتصفح والعناصر المنبثقة
window.insertNewRow = insertNewRow;
window.debouncedFilterTable = debouncedFilterTable;
window.toggleCustomFilter = toggleCustomFilter;
window.updateFilters = updateFilters;
window.openNote = openNote;
window.saveNote = saveNote;
window.closeNote = closeNote;
window.deleteNote = deleteNote;
window.toggleSubTable = toggleSubTable;
window.addProductRow = addProductRow;
window.removeProductRow = removeProductRow;
window.updateProductTotal = updateProductTotal;
window.debouncedSaveRow = debouncedSaveRow;
window.onStatusChange = onStatusChange;
window.toggleLogExpansion = toggleLogExpansion;
window.openDatePicker = openDatePicker;
window.closeDatePicker = closeDatePicker;
window.selectCalendarDate = selectCalendarDate;
window.setTodayDate = setTodayDate;
window.toggleDropdown = toggleDropdown;
window.toggleAllCheckboxes = toggleAllCheckboxes;
window.handleBulkAction = handleBulkAction;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;

// تفعيل الاستماع للسحابة عند تشغيل التطبيق
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", listenToVisits);
} else {
    listenToVisits();
}