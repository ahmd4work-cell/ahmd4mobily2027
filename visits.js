// =========================================================================
// visits.js - إدارة الزيارات سحابياً ومحلياً (مع نظام الملاحظات الموحد والبحث الشامل والفرز المتعدد والتقويم)
// =========================================================================
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

let activeStatusFilters = [];
let activeOwnerFilters = [];
let itemsToDelete = [];

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

// --- إدارة سجل النشاط ---
function addActivityLog(actionText) {
    const newLog = {
        date: getTodayFormatted(),
        time: getTimeFormatted(),
        user: 'المستخدم',
        action: actionText
    };
    activityLogs.unshift(newLog);
    if (activityLogs.length > 50) activityLogs.pop();
    localStorage.setItem(LOGS_KEY, JSON.stringify(activityLogs));
    renderActivityLogs();
}

function renderActivityLogs() {
    const listEl = document.getElementById('activityList');
    if (!listEl) return;
    if (!activityLogs || activityLogs.length === 0) {
        listEl.innerHTML = '<div style="color:#94a3b8; font-size:10px; text-align:center; padding:10px;">لا توجد أنشطة مسجلة بعد</div>';
        return;
    }
    listEl.innerHTML = activityLogs.map(log => `
        <div class="log-entry">
            <div class="log-header-info">
                <span><i class="far fa-user"></i> ${escapeHTML(log.user || 'المستخدم')}</span>
                <span dir="ltr"><i class="far fa-calendar-alt"></i> ${escapeHTML(log.date)} ${escapeHTML(log.time)}</span>
            </div>
            <span class="log-sep">|</span>
            <div class="log-action">${escapeHTML(log.action)}</div>
        </div>
    `).join('');
}

function toggleLogExpansion() {
    const sec = document.getElementById('activityLogSection');
    const btn = document.getElementById('toggleExpandBtn');
    if (!sec) return;
    sec.classList.toggle('expanded');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = sec.classList.contains('expanded') ? 'fas fa-compress-alt' : 'fas fa-expand-alt';
        }
    }
}

// --- الملاحظات ---
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
        
        if (mainRow) { 
            updateEditDateField(mainRow); 
            saveSingleRow(mainRow.id); 
            addActivityLog(`إضافة ملاحظة جديدة على زيارة (${mainRow.querySelector('td:nth-child(2) input')?.value || mainRow.id})`);
        }
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

// --- إضافة وقراءة البيانات ---
window.insertNewRow = async function() {
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
        addActivityLog('إضافة زيارة جديدة');
    } catch (error) {
        console.error("خطأ في إضافة زيارة جديدة سحابياً:", error);
        Swal.fire('خطأ', 'تعذر إضافة الزيارة في السحابة', 'error');
    }
}

function listenToVisits() {
    renderActivityLogs();
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

        if (needsFullRender || isInitialLoad) { 
            updateDynamicOwnerFilter();
            fullTableRender(); 
            isInitialLoad = false; 
        }
        updateStats(); 
    }, (error) => { console.error("مشكلة في مزامنة الزيارات من السحابة:", error); });
}

// --- تنسيق ألوان الحالات ---
window.applyStatusColor = function(selectEl) {
    if (!selectEl) return;
    selectEl.className = 'excel-input status-select';
    const val = selectEl.value.trim();
    if (val === 'تأهيل لفرصة') selectEl.classList.add('status-green');
    else if (val === 'مميزة') selectEl.classList.add('status-purple');
    else if (val === 'متابعة') selectEl.classList.add('status-yellow-fff');
    else if (val === 'عرض سعر') selectEl.classList.add('status-yellow-ffc');
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
    safeUpdate('.visit-date-val', formatAsDDMMYYYY(v.visitDate || getTodayFormatted()));
    safeUpdate('.cur-serv-val', v.curServ || '');
    safeUpdate('.opp-value-input', v.oppValue || '0');
    
    const statusSelect = mainRow.querySelector('.status-select');
    if (statusSelect && document.activeElement !== statusSelect) {
        statusSelect.value = v.status || ''; 
        window.applyStatusColor(statusSelect);
    }
    safeUpdate('.owner-input', v.owner || '');
    
    const hiddenEditDate = mainRow.querySelector('.edit-date-val');
    if (hiddenEditDate) hiddenEditDate.value = v.editDate || '';
    const editMains = mainRow.querySelector('.edit-date-container-main');
    if (editMains) editMains.innerHTML = parseEditDateHTML(v.editDate || '');

    let notesJson = v.notes || "[]";
    const noteEl = mainRow.querySelector('.notes-preview');
    if (noteEl) { noteEl.setAttribute('data-full-notes', notesJson); noteEl.innerText = getLastNoteOnlyFromJSON(notesJson); }
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
            <span class="toggle-arrow ${hasProducts ? 'arrow-open' : ''}" onclick="window.toggleSubTable('${v.id}')">▶</span>
        </td>
        <td class="col-company"><input type="text" class="excel-input" value="${escapeHTML(v.comp || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="اسم الشركة"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${escapeHTML(v.address || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="العنوان"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${escapeHTML(v.mgr || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="اسم المسؤول"></td>
        <td class="col-mobile">
            <div class="phone-cell-container">
                <input type="text" class="excel-input" value="${escapeHTML(v.mob || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="05XXXXXXXX">
                ${v.mob ? `<a href="https://wa.me/${phoneClean}" target="_blank" class="whatsapp-icon-btn" title="واتساب"><i class="fab fa-whatsapp"></i></a>` : ''}
            </div>
        </td>
        <td class="col-email"><input type="email" class="excel-input" value="${escapeHTML(v.email || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="email@domain.com"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${escapeHTML(v.record || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="السجل التجاري"></td>
        <td class="col-date">
            <input type="text" class="excel-input readonly-input visit-date-val ${getDateColorClass(visitDateFormatted)}" value="${escapeHTML(visitDateFormatted)}" onclick="window.openDatePicker(this, '${v.id}')" readonly>
        </td>
        <td class="col-service"><input type="text" class="excel-input cur-serv-val" value="${escapeHTML(v.curServ || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="نوع الخدمة"></td>
        <td class="col-val"><input type="number" class="excel-input opp-value-input" value="${v.oppValue || 0}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="0"></td>
        <td class="col-notes">
            <span class="notes-preview" data-full-notes="${escapeHTML(v.notes || '[]')}" onclick="openNote(this)">
                ${escapeHTML(getLastNoteOnlyFromJSON(v.notes))}
            </span>
        </td>
        <td class="col-status">
            <select class="excel-input status-select" onchange="window.onStatusChange(this, '${v.id}')">
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
        <td class="col-owner"><input type="text" class="excel-input owner-input" value="${escapeHTML(v.owner || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="المستخدم"></td>
    </tr>
    ${renderSubTableHTML(v)}`;
}

function renderSubTableHTML(v) {
    const products = Array.isArray(v.products) ? v.products : [];
    let rowsHtml = products.map(p => `
        <tr>
            <td><input type="text" class="p-name" value="${escapeHTML(p.name || '')}" oninput="window.debouncedSaveRow('${v.id}')" placeholder="اسم المنتج/الخدمة"></td>
            <td><input type="number" class="p-qty" value="${p.qty || 1}" oninput="window.updateProductTotal(this, '${v.id}')" placeholder="الكمية"></td>
            <td><input type="number" class="p-price" value="${p.price || 0}" oninput="window.updateProductTotal(this, '${v.id}')" placeholder="السعر"></td>
            <td><input type="text" class="p-total readonly-input" value="${(Number(p.qty || 1) * Number(p.price || 0)).toLocaleString('ar-SA')}" readonly></td>
            <td style="text-align:center;">
                <button type="button" class="sub-action-btn" onclick="window.removeProductRow(this, '${v.id}')" title="حذف المنتج"><i class="fas fa-trash-alt"></i></button>
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
                            <th style="width: 40%;">المنتج / الخدمة <button type="button" class="header-plus-btn" onclick="window.addProductRow('${v.id}')" title="إضافة منتج">+</button></th>
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

window.fullTableRender = function(dataArray = null) {
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
    tbody.querySelectorAll('.status-select').forEach(select => window.applyStatusColor(select));
}

window.toggleSubTable = function(rowId) {
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

window.addProductRow = function(visitId) {
    const subRow = document.getElementById('sub-' + visitId);
    if (!subRow) return;
    const tbody = subRow.querySelector('.product-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="p-name" value="" oninput="window.debouncedSaveRow('${visitId}')" placeholder="اسم المنتج/الخدمة"></td>
        <td><input type="number" class="p-qty" value="1" oninput="window.updateProductTotal(this, '${visitId}')" placeholder="الكمية"></td>
        <td><input type="number" class="p-price" value="0" oninput="window.updateProductTotal(this, '${visitId}')" placeholder="السعر"></td>
        <td><input type="text" class="p-total readonly-input" value="0" readonly></td>
        <td style="text-align:center;">
            <button type="button" class="sub-action-btn" onclick="window.removeProductRow(this, '${visitId}')" title="حذف المنتج"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    window.debouncedSaveRow(visitId);
}

window.removeProductRow = function(btn, visitId) {
    const tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        window.debouncedSaveRow(visitId);
    }
}

window.updateProductTotal = function(inputEl, visitId) {
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const qty = Number(tr.querySelector('.p-qty')?.value || 0);
    const price = Number(tr.querySelector('.p-price')?.value || 0);
    const totalEl = tr.querySelector('.p-total');
    if (totalEl) totalEl.value = (qty * price).toLocaleString('ar-SA');
    window.debouncedSaveRow(visitId);
}

// --- نقل الزيارة إلى الفرص البيعية وسحبها من الزيارات ---
async function transferToOpportunities(rowId, visitData) {
    try {
        const batch = writeBatch(db);
        const oppRef = doc(db, "opportunities", rowId);
        const visitRef = doc(db, "visits", rowId);

        const opportunityPayload = {
            comp: visitData.comp || '',
            address: visitData.address || '',
            mgr: visitData.mgr || '',
            mob: visitData.mob || '',
            email: visitData.email || '',
            record: visitData.record || '',
            oppDate: visitData.visitDate || getTodayFormatted(),
            visitDate: visitData.visitDate || getTodayFormatted(),
            curServ: visitData.curServ || '',
            oppValue: visitData.oppValue || '0',
            notes: visitData.notes || '[]',
            status: 'تأهيل لفرصة',
            editDate: `${getTodayFormatted()} ${getTimeFormatted()}`,
            owner: visitData.owner || '',
            products: visitData.products || []
        };

        batch.set(oppRef, opportunityPayload);
        batch.delete(visitRef);

        await batch.commit();

        addActivityLog(`نقل الزيارة (${visitData.comp || visitData.mgr || rowId}) إلى الفرص البيعية`);
        
        Swal.fire({
            title: 'تم النقل بنجاح',
            text: 'تم نقل الزيارة إلى جدول الفرص البيعية وإزالتها من الزيارات',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        console.error("خطأ أثناء نقل الزيارة إلى الفرص البيعية:", e);
        Swal.fire('خطأ', 'حدث خطأ أثناء نقل الزيارة إلى الفرص البيعية', 'error');
    }
}

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
    
    const editDate = `${getTodayFormatted()} ${getTimeFormatted()}`;

    const subRow = document.getElementById('sub-' + rowId);
    let products = [];
    if (subRow) {
        subRow.querySelectorAll('.product-body tr').forEach(pRow => {
            const name = pRow.querySelector('.p-name')?.value || '';
            const qty = pRow.querySelector('.p-qty')?.value || 1;
            const price = pRow.querySelector('.p-price')?.value || 0;
            if (name.trim()) products.push({ name, qty: Number(qty), price: Number(price) });
        });
    } else {
        const existing = visitsDataArray.find(v => v.id === rowId);
        if (existing) products = existing.products || [];
    }

    const currentVisitData = {
        comp, address, mgr, mob, email, record, visitDate, curServ,
        oppValue, notes, status, editDate, owner, products
    };

    if (status === 'تأهيل لفرصة') {
        await transferToOpportunities(rowId, currentVisitData);
        return;
    }

    try {
        await setDoc(doc(db, "visits", rowId), currentVisitData, { merge: true });
        updateEditDateField(mainRow);
    } catch(e) {
        console.error("Error saving row:", e);
    }
}

window.debouncedSaveRow = function(rowId) {
    if (saveTimeouts[rowId]) clearTimeout(saveTimeouts[rowId]);
    saveTimeouts[rowId] = setTimeout(() => saveSingleRow(rowId), 500);
}

window.onStatusChange = function(selectEl, rowId) {
    window.applyStatusColor(selectEl);
    updateEditDateField(document.getElementById(rowId));
    
    const val = selectEl.value.trim();
    if (val === 'تأهيل لفرصة') {
        saveSingleRow(rowId);
    } else {
        if (val) addActivityLog(`تغيير حالة الزيارة إلى (${val})`);
        saveSingleRow(rowId);
    }
}

// --- البحث والفلترة ---
window.debouncedFilterTable = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(window.filterTable, 300);
}

window.filterTable = function() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const filtered = visitsDataArray.filter(v => {
        const matchSearch = !query || [v.comp, v.address, v.mgr, v.mob, v.email, v.record, v.curServ, v.owner, v.status].some(val => String(val || '').toLowerCase().includes(query));
        const matchStatus = activeStatusFilters.length === 0 || activeStatusFilters.includes(v.status);
        const matchOwner = activeOwnerFilters.length === 0 || activeOwnerFilters.includes(v.owner);
        return matchSearch && matchStatus && matchOwner;
    });
    window.fullTableRender(filtered);
    updateStats(filtered);
}

window.toggleCustomFilter = function(event, menuId) {
    event.stopPropagation();
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const isShown = menu.classList.contains('show');
    document.querySelectorAll('.multi-select-menu').forEach(m => m.classList.remove('show'));
    if (!isShown) menu.classList.add('show');
}

window.updateFilters = function() {
    activeStatusFilters = Array.from(document.querySelectorAll('#statusFilterMenu input[type="checkbox"]:checked')).map(c => c.value);
    const statusDot = document.getElementById('statusFilterDot');
    if (statusDot) statusDot.style.display = activeStatusFilters.length > 0 ? 'block' : 'none';

    activeOwnerFilters = Array.from(document.querySelectorAll('#ownerFilterMenu input[type="checkbox"]:checked')).map(c => c.value);
    const ownerDot = document.getElementById('ownerFilterDot');
    if (ownerDot) ownerDot.style.display = activeOwnerFilters.length > 0 ? 'block' : 'none';

    window.filterTable();
}

function updateDynamicOwnerFilter() {
    const ownerMenu = document.getElementById('ownerFilterMenu');
    if (!ownerMenu) return;
    const uniqueOwners = [...new Set(visitsDataArray.map(v => v.owner).filter(o => o && o.trim() !== ''))].sort();
    ownerMenu.innerHTML = uniqueOwners.map(owner => `
        <label class="multi-select-item">
            <input type="checkbox" value="${escapeHTML(owner)}" ${activeOwnerFilters.includes(owner) ? 'checked' : ''} onchange="window.updateFilters()">
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
            if (v.visitDate === todayStr) todayCount++;
        }
        totalVal += Number(v.oppValue) || 0;
    });

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
    if (document.getElementById('stat-month')) document.getElementById('stat-month').innerText = thisMonth;
    if (document.getElementById('stat-today')) document.getElementById('stat-today').innerText = todayCount;
    if (document.getElementById('stat-value-total')) document.getElementById('stat-value-total').innerText = totalVal.toLocaleString('ar-SA');
    if (document.getElementById('stat-value-month')) document.getElementById('stat-value-month').innerText = monthVal.toLocaleString('ar-SA');
}

// --- نافذة الحذف الفردي ---
window.openDeleteModal = function(ids) {
    itemsToDelete = Array.isArray(ids) ? ids : [ids];
    const modal = document.getElementById('deleteModal');
    const msg = document.getElementById('deleteModalMessage');
    if (msg) {
        msg.innerText = itemsToDelete.length > 1 
            ? `هل أنت متأكد من رغبتك في حذف ${itemsToDelete.length} عناصر محددة؟`
            : `هل أنت متأكد من رغبتك في حذف هذا العنصر؟`;
    }
    if (modal) modal.style.display = 'flex';
}

window.closeDeleteModal = function() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    itemsToDelete = [];
}

window.confirmDelete = async function() {
    if (itemsToDelete.length === 0) return;
    try {
        const count = itemsToDelete.length;
        const batch = writeBatch(db);
        itemsToDelete.forEach(id => {
            batch.delete(doc(db, "visits", id));
        });
        await batch.commit();
        addActivityLog(`حذف عدد ${count} زيارة/زيارات`);
        window.closeDeleteModal();
        Swal.fire('تم الحذف', 'تم حذف العناصر المحددة بنجاح', 'success');
    } catch(e) {
        console.error("خطأ أثناء الحذف:", e);
        Swal.fire('خطأ', 'حدث خطأ أثناء الحذف', 'error');
    }
}

// --- التقويم ---
window.openDatePicker = function(inputEl, rowId) {
    currentPickerInput = inputEl;
    currentPickerRowId = rowId;
    
    const val = inputEl.value;
    const parsed = parseDate(val);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
        currentPickerMonth = parsed.getMonth();
        currentPickerYear = parsed.getFullYear();
    } else {
        const now = new Date();
        currentPickerMonth = now.getMonth();
        currentPickerYear = now.getFullYear();
    }
    
    renderDatePicker();
    const dp = document.getElementById('customDatePicker');
    if (dp) dp.classList.add('active');
}

window.closeDatePicker = function() {
    const dp = document.getElementById('customDatePicker');
    if (dp) dp.classList.remove('active');
    currentPickerInput = null;
    currentPickerRowId = null;
}

function renderDatePicker() {
    const dpMonth = document.getElementById('dpMonth');
    const dpYear = document.getElementById('dpYear');
    if (!dpMonth || !dpYear) return;

    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    dpMonth.innerHTML = monthNames.map((m, idx) => `<option value="${idx}" ${idx === currentPickerMonth ? 'selected' : ''}>${m}</option>`).join('');
    
    const startYear = new Date().getFullYear() - 5;
    let yearOptions = '';
    for (let y = startYear; y <= startYear + 10; y++) {
        yearOptions += `<option value="${y}" ${y === currentPickerYear ? 'selected' : ''}>${y}</option>`;
    }
    dpYear.innerHTML = yearOptions;

    dpMonth.onchange = (e) => { currentPickerMonth = parseInt(e.target.value, 10); renderDatePickerDays(); };
    dpYear.onchange = (e) => { currentPickerYear = parseInt(e.target.value, 10); renderDatePickerDays(); };

    renderDatePickerDays();
}

function renderDatePickerDays() {
    const dpDays = document.getElementById('dpDays');
    if (!dpDays) return;
    dpDays.innerHTML = '';

    const firstDay = new Date(currentPickerYear, currentPickerMonth, 1).getDay();
    const totalDays = new Date(currentPickerYear, currentPickerMonth + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        dpDays.appendChild(emptyDiv);
    }

    for (let d = 1; d <= totalDays; d++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-number';
        dayDiv.innerText = d;

        if (d === today.getDate() && currentPickerMonth === today.getMonth() && currentPickerYear === today.getFullYear()) {
            dayDiv.classList.add('today-day');
        }

        dayDiv.onclick = () => {
            if (currentPickerInput && currentPickerRowId) {
                const newDateStr = `${String(d).padStart(2, '0')}-${String(currentPickerMonth + 1).padStart(2, '0')}-${currentPickerYear}`;
                currentPickerInput.value = newDateStr;
                currentPickerInput.className = `excel-input readonly-input visit-date-val ${getDateColorClass(newDateStr)}`;
                saveSingleRow(currentPickerRowId);
            }
            window.closeDatePicker();
        };

        dpDays.appendChild(dayDiv);
    }
}

window.setTodayDate = function() {
    if (currentPickerInput && currentPickerRowId) {
        const newDateStr = getTodayFormatted();
        currentPickerInput.value = newDateStr;
        currentPickerInput.className = `excel-input readonly-input visit-date-val ${getDateColorClass(newDateStr)}`;
        saveSingleRow(currentPickerRowId);
    }
    window.closeDatePicker();
}

// =========================================================================
// دوال الإجراءات الجماعية (Bulk Actions) المربوطة بـ table-options.js
// =========================================================================

window.handleBulkAction = async function(action) {
    const checkedBoxes = Array.from(document.querySelectorAll('.select-check:checked'));
    const checkedIds = checkedBoxes.map(cb => cb.value);

    // أمر الطباعة لا يشترط تحديد عناصر (يطبع الصفحة الحالية)
    if (action === 'طباعة') {
        window.print();
        return;
    }

    // أمر التصدير (تصدير كافة البيانات الظاهرة أو تصدير قاعدة البيانات)
    if (action === 'تصدير') {
        if (typeof XLSX === 'undefined') {
            Swal.fire('خطأ', 'مكتبة التصدير (SheetJS) غير محملة', 'error'); 
            return;
        }
        
        const dataToExport = visitsDataArray.map(v => ({
            'الشركة': v.comp || '',
            'العنوان': v.address || '',
            'المسؤول': v.mgr || '',
            'رقم التواصل': v.mob || '',
            'البريد الإلكتروني': v.email || '',
            'السجل الرئيسي': v.record || '',
            'تاريخ الزيارة': v.visitDate || '',
            'الخدمة': v.curServ || '',
            'القيمة': v.oppValue || '0',
            'الحالة': v.status || '',
            'المستخدم': v.owner || '',
            'آخر تعديل': v.editDate || ''
        }));

        if (dataToExport.length === 0) {
            Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'warning'); return;
        }

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الزيارات");
        XLSX.writeFile(wb, "Visits_Export.xlsx");
        return;
    }

    // الإجراءات التي تتطلب تحديد عناصر مسبقاً (حذف، تغيير مستخدم)
    if (checkedIds.length === 0) {
        Swal.fire('تنبيه', 'الرجاء تحديد عنصر واحد على الأقل', 'warning');
        return;
    }

    if (action === 'حذف') {
        itemsToDelete = checkedIds; 
        if(typeof window.openSharedDeleteModal === 'function'){
            window.openSharedDeleteModal(checkedIds.length);
        }
    } 
    else if (action === 'تغيير المستخدم') {
        const { value: newOwner } = await Swal.fire({
            title: 'تغيير المستخدم',
            input: 'text',
            inputPlaceholder: 'أدخل اسم المستخدم الجديد',
            showCancelButton: true,
            confirmButtonText: 'حفظ والتطبيق على المحدد',
            cancelButtonText: 'إلغاء'
        });

        if (newOwner !== undefined && newOwner.trim() !== '') {
            try {
                const batch = writeBatch(db);
                checkedIds.forEach(id => {
                    batch.update(doc(db, "visits", id), { owner: newOwner.trim() });
                });
                await batch.commit();
                
                addActivityLog(`تغيير المستخدم لـ ${checkedIds.length} زيارة إلى (${newOwner.trim()})`);
                Swal.fire('تم', 'تم تغيير المستخدم بنجاح', 'success');
                
                // إزالة التحديد بعد التحديث
                document.querySelectorAll('.select-check').forEach(cb => cb.checked = false);
                const masterCheck = document.querySelector('.col-select input[type="checkbox"]');
                if(masterCheck) masterCheck.checked = false;
            } catch(e) {
                console.error(e);
                Swal.fire('خطأ', 'حدث خطأ أثناء التحديث سحابياً', 'error');
            }
        }
    }
};

window.executeBulkDelete = async function() {
    if (!itemsToDelete || itemsToDelete.length === 0) return;
    try {
        const count = itemsToDelete.length;
        const batch = writeBatch(db);
        itemsToDelete.forEach(id => {
            batch.delete(doc(db, "visits", id));
        });
        await batch.commit();
        
        addActivityLog(`حذف عدد ${count} زيارة (إجراء جماعي)`);
        if(typeof window.closeSharedDeleteModal === 'function') window.closeSharedDeleteModal();
        
        Swal.fire('تم الحذف', 'تم حذف العناصر المحددة بنجاح', 'success');
        
        document.querySelectorAll('.select-check').forEach(cb => cb.checked = false);
        const masterCheck = document.querySelector('.col-select input[type="checkbox"]');
        if(masterCheck) masterCheck.checked = false;
        itemsToDelete = [];
    } catch(e) {
        console.error("خطأ أثناء الحذف الجماعي:", e);
        Swal.fire('خطأ', 'حدث خطأ أثناء الحذف', 'error');
    }
};

window.importDataFromExcel = async function(jsonData) {
    try {
        Swal.fire({ title: 'جاري الاستيراد والمعالجة...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        
        const batch = writeBatch(db);
        let count = 0;
        
        jsonData.forEach(row => {
            const newId = 'visit_imp_' + Date.now() + Math.floor(Math.random() * 10000);
            const today = getTodayFormatted();
            
            const newVisit = {
                comp: row['الشركة'] || row['comp'] || '',
                address: row['العنوان'] || row['address'] || '',
                mgr: row['المسؤول'] || row['mgr'] || '',
                mob: String(row['رقم التواصل'] || row['mob'] || ''),
                email: row['البريد الإلكتروني'] || row['email'] || '',
                record: row['السجل الرئيسي'] || row['record'] || '',
                visitDate: row['تاريخ الزيارة'] || row['visitDate'] || today,
                curServ: row['الخدمة'] || row['curServ'] || '',
                oppValue: String(row['القيمة'] || row['oppValue'] || '0'),
                notes: '[]',
                status: row['الحالة'] || row['status'] || '',
                editDate: `${today} ${getTimeFormatted()}`,
                owner: row['المستخدم'] || row['owner'] || '',
                products: []
            };
            
            batch.set(doc(db, "visits", newId), newVisit);
            count++;
        });

        await batch.commit();
        addActivityLog(`استيراد ${count} زيارة جديدة من ملف الإكسيل`);
        Swal.fire('تم الاستيراد', `تم استيراد وإضافة ${count} سجل بنجاح.`, 'success');
    } catch(e) {
        console.error(e);
        Swal.fire('خطأ', 'حدث خطأ غير متوقع أثناء حفظ البيانات المستوردة', 'error');
    }
};

// بدء الاستماع لقاعدة البيانات عند التحميل
listenToVisits();