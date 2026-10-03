// ==========================================
// opportunities_3.js - إدارة الفرص البيعية سحابياً ومحلياً (حماية مزدوجة)
// ==========================================
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let currentActivePreview = null;
let saveTimeout;
let searchTimeout;
let initialScrollDone = false; 
const LOGS_KEY = 'asgate_opportunities_activity_logs_v1';
const OPP_LOCAL_KEY = 'asgate_opportunities_local_cache_v1';

let logsDataList = [];
let selectedStatusFilters = new Set();
let selectedOwnerFilters = new Set();

// ==========================================
// التشغيل التلقائي عند فتح الصفحة (لحل مشكلة عدم الظهور)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadLogsData();
    listenToOpportunities();
});

// ==========================================
// دوال المساعدة (لتقليل التكرار في أحداث الحقول)
// ==========================================
window.handleInputUpdate = function(el, rowId) {
    updateEditDateField(el.closest('tr'));
    debouncedSaveSingleRow(rowId);
};

window.handleInputBlur = function(el, fieldName) {
    const tr = el.closest('tr');
    if (!tr) return;
    const comp = tr.cells[1].querySelector('input')?.value || '';
    const owner = tr.cells[13].querySelector('input')?.value || '';
    addToActivityLog(fieldName, el.dataset.old, el.value, comp, owner);
    el.dataset.old = el.value;
};

// ==========================================
// دوال حماية البيانات والتحقق الفوري
// ==========================================
function escapeHTML(str) { 
    if (typeof str !== 'string') return str;
    return String(str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); 
}
function safe(value, fallback = '-') { return escapeHTML(value && String(value).trim() ? String(value).trim() : fallback); }
function getTodayFormatted() { return new Date().toISOString().split('T')[0]; } 
function getTimeFormatted() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0'); } 
function formatDateToDisplay(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { const parts = dateStr.split('-'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }
    return dateStr;
}

function saveLogsLocalBackup() { try { localStorage.setItem(LOGS_KEY, JSON.stringify(logsDataList)); } catch (e) { console.error("Local Storage Error Logs: ", e); } }

async function loadLogsData() {
    const localLogs = localStorage.getItem(LOGS_KEY);
    if (localLogs) { try { logsDataList = JSON.parse(localLogs); } catch(e){} }
    renderLogs(logsDataList);

    try {
        const logsSnapshot = await getDocs(collection(db, "opportunities_activity_logs"));
        const freshLogs = [];
        logsSnapshot.forEach((docSnap) => { freshLogs.push(docSnap.data()); });
        freshLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        logsDataList = freshLogs;
        saveLogsLocalBackup();
        renderLogs(logsDataList);
    } catch (error) { console.error("Error loading logs from Cloud: ", error); }
}

function renderLogs(list) {
    const logsBody = document.getElementById('activityList');
    if (!logsBody) return;
    logsBody.innerHTML = '';
    
    if (!list || !list.length) {
        logsBody.innerHTML = `<div style="text-align:center;padding:28px;color:#6b7280;font-weight:700;">لا يوجد سجل نشاط بعد</div>`;
        return;
    }
    
    list.slice(0, 100).forEach(log => {
        let dayName = log.dayName || ''; let dateStr = log.date || ''; let timeStr = log.time || '';
        if (!log.dayName && log.date && log.date.includes(' ')) {
            const parts = log.date.split(' ');
            if (parts.length >= 3) { dayName = parts[0]; dateStr = parts[1]; timeStr = parts[2]; } else { dateStr = log.date; }
        }
        
        logsBody.innerHTML += `
            <div class="log-entry">
                <span class="log-header-info">
                    <span>${safe(log.user || 'المستخدم')}</span><span>${safe(dayName)}</span>
                    <span dir="ltr">${safe(dateStr)}</span><span dir="ltr">${safe(timeStr)}</span>
                </span>
                <span class="log-sep">|</span>
                <span class="log-action">${log.action}</span>
            </div>
        `;
    });
}

async function addToActivityLog(fieldName, oldVal, newVal, companyName, ownerName) { 
    if (oldVal === newVal) return; 
    const cleanCompany = companyName || 'شركة غير مسماة'; 
    
    let actionText = '';
    if (fieldName === 'الحالة') actionText = `تم تغير الحالة من ${escapeHTML(oldVal) || 'فارغ'} الى ${escapeHTML(newVal) || 'فارغ'} لـ ( ${escapeHTML(cleanCompany)} )`;
    else if (fieldName === 'إجراء') actionText = `${escapeHTML(oldVal)} لـ ( ${escapeHTML(cleanCompany)} )`;
    else actionText = `تعديل ${escapeHTML(fieldName)} من [${escapeHTML(oldVal) || 'فارغ'}] إلى [${escapeHTML(newVal) || 'فارغ'}] لـ ( ${escapeHTML(cleanCompany)} )`;
    
    const user = ownerName && ownerName.trim() ? ownerName.trim() : 'المستخدم';
    const d = new Date();
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']; 
    const logEntry = {
        user: user, dayName: days[d.getDay()],
        date: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`,
        time: getTimeFormatted(), action: actionText, timestamp: Date.now()
    };

    logsDataList.unshift(logEntry);
    logsDataList = logsDataList.slice(0, 100); 
    saveLogsLocalBackup();
    renderLogs(logsDataList);

    try { await setDoc(doc(db, "opportunities_activity_logs", logEntry.timestamp.toString()), logEntry); } 
    catch (e) { console.error("خطأ بالحفظ السحابي لسجل النشاط:", e); }
}
window.addToActivityLog = addToActivityLog; 

// دالة مساعدة لاستخراج بيانات الصف لمنع تكرار الأكواد في الحفظين المحلي والسحابي
function extractRowData(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return null;
    const subRow = document.getElementById('sub-' + rowId);
    const products = [];
    if (subRow) {
        subRow.querySelectorAll('.product-body tr').forEach(pRow => {
            const inputs = pRow.querySelectorAll('input, select');
            if (inputs.length >= 5) products.push({ type: inputs[0].value, desc: inputs[1].value, qty: inputs[2].value, sub: inputs[3].value, total: inputs[4].value });
        });
    }
    return {
        id: rowId,
        comp: row.cells[1].querySelector('input')?.value || '',
        address: row.cells[2].querySelector('input')?.value || '',
        mgr: row.cells[3].querySelector('input')?.value || '',
        mob: row.cells[4].querySelector('input')?.value || '',
        email: row.cells[5].querySelector('input')?.value || '',
        record: row.cells[6].querySelector('input')?.value || '',
        oppDate: row.querySelector('.opp-date-val')?.value || '',
        curServ: row.cells[8].querySelector('input')?.value || '',
        oppValue: row.cells[9].querySelector('.opp-value-input')?.value || '',
        notes: row.cells[10].querySelector('.notes-preview')?.getAttribute('data-full-notes') || '[]',
        status: row.cells[11].querySelector('select')?.value || '',
        expDate: row.cells[12].querySelector('.exp-date-input')?.value || '',
        editDate: row.querySelector('.edit-date-val')?.value || getTodayFormatted(),
        owner: row.cells[13].querySelector('input')?.value || '',
        products: products
    };
}

function saveRowLocally(rowId) {
    const data = extractRowData(rowId);
    if (!data) return;
    try {
        let localCache = JSON.parse(localStorage.getItem(OPP_LOCAL_KEY) || '{}');
        localCache[rowId] = data;
        localStorage.setItem(OPP_LOCAL_KEY, JSON.stringify(localCache));
    } catch (e) { console.error("خطأ بالحفظ المحلي الفوري للفرصة:", e); }
}

async function saveSingleRow(rowId) {
    saveRowLocally(rowId);
    const data = extractRowData(rowId);
    if (!data) return;
    try {
        await setDoc(doc(db, "opportunities", rowId), data, { merge: true });
        updateStats(); populateFilterDropdowns();
    } catch (e) { console.error("خطأ بالحفظ السحابي للفرصة:", e); }
}

function debouncedSaveSingleRow(rowId) {
    saveRowLocally(rowId); 
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { saveSingleRow(rowId); }, 5000); 
}
window.debouncedSaveSingleRow = debouncedSaveSingleRow; 

function listenToOpportunities() {
    const oppsRef = collection(db, "opportunities");
    onSnapshot(oppsRef, (snapshot) => {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        let openSubTables = [];
        document.querySelectorAll('.sub-table-row').forEach(row => { if (row.style.display === 'table-row') openSubTables.push(row.id); });

        let activeState = { id: null, class: null, tag: null, index: 0, selection: 0 };
        if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            const tr = document.activeElement.closest('tr');
            if (tr) {
                activeState.id = tr.id; activeState.class = document.activeElement.className; activeState.tag = document.activeElement.tagName;
                tr.querySelectorAll(`${activeState.tag}[class="${activeState.class}"]`).forEach((el, index) => { if (el === document.activeElement) activeState.index = index; });
                try { activeState.selection = document.activeElement.selectionStart; } catch(e){}
            }
        }

        // --- تعديل المعالجة لمنع الرعشة: استخدام حاوية الذاكرة (Document Fragment Approach) ---
        const tempContainer = document.createElement('tbody');

        if (!snapshot.empty) {
            snapshot.forEach((docSnapshot) => { 
                const data = docSnapshot.data(); 
                data.id = docSnapshot.id; 
                renderRow(data, tempContainer); 
                saveRowLocally(data.id); 
            });
        } else {
            try {
                const localCache = JSON.parse(localStorage.getItem(OPP_LOCAL_KEY) || '{}');
                Object.keys(localCache).forEach(id => renderRow(localCache[id], tempContainer));
            } catch(e) { console.error("خطأ في قراءة التخزين المحلي:", e); }
        }
        
        // ترتيب وتحديث الجدول الفعلي مرة واحدة فقط
        reorderRows(tempContainer); 
        updateStats();

        openSubTables.forEach(id => {
            const sub = document.getElementById(id);
            if (sub) { sub.style.display = 'table-row'; document.querySelectorAll(`#${id.replace('sub-', '')} .toggle-arrow i`).forEach(arrow => arrow.className = 'fas fa-caret-down'); }
        });

        if (activeState.id) {
            const activeRow = document.getElementById(activeState.id);
            if (activeRow) {
                const elToFocus = activeRow.querySelectorAll(`${activeState.tag}[class="${activeState.class}"]`)[activeState.index];
                if (elToFocus) { elToFocus.focus(); try { elToFocus.setSelectionRange(activeState.selection, activeState.selection); } catch(e){} }
            }
        }
    });
}

function renderRow(v = {}, container = null) {
    const target = container || document.getElementById('tableBody');
    if (!target) return;
    const rowId = v.id || ('row-' + Date.now() + Math.random().toString(36).substr(2, 5));
    const mainRow = document.createElement('tr'); mainRow.className = 'main-row'; mainRow.id = rowId;
    const subRow = document.createElement('tr'); subRow.className = 'sub-table-row'; subRow.id = 'sub-' + rowId; subRow.style.display = 'none';
    
    const oppDate = v.oppDate || v.visitDate || getTodayFormatted(); 
    const notesJson = typeof v.notes === 'string' ? v.notes : JSON.stringify(v.notes || []);
    
    mainRow.innerHTML = `
        <td class="col-select"><input type="checkbox" class="select-check row-checkbox"><span class="toggle-arrow" onclick="toggleSubTable('${rowId}')"><i class="fas fa-caret-left"></i></span></td>
        <td><input type="text" class="excel-input" value="${v.comp || ''}" data-old="${v.comp || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'الشركة')" onmouseenter="showStatusTooltip(this)" onmouseleave="hideStatusTooltip()"></td>
        <td><input type="text" class="excel-input" value="${v.address || ''}" data-old="${v.address || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'العنوان')"></td>
        <td><input type="text" class="excel-input" value="${v.mgr || ''}" data-old="${v.mgr || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'المسؤول')"></td>
        <td>
            <div class="phone-cell-container">
                <a class="whatsapp-icon-btn" onclick="openWhatsAppChat(this)" title="مراسلة عبر واتساب"><i class="fa-brands fa-whatsapp"></i></a>
                <input type="text" class="excel-input" value="${v.mob || ''}" data-old="${v.mob || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, ''); handleInputUpdate(this, '${rowId}')" onfocus="this.dataset.old=this.value" onblur="handleInputBlur(this, 'رقم التواصل')">
            </div>
        </td>
        <td><input type="text" class="excel-input" value="${v.email || ''}" data-old="${v.email || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'الإيميل')"></td>
        <td><input type="text" class="excel-input" value="${v.record || ''}" data-old="${v.record || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, ''); handleInputUpdate(this, '${rowId}')" onfocus="this.dataset.old=this.value" onblur="handleInputBlur(this, 'السجل الرئيسي')"></td>
        <td><input type="text" class="excel-input readonly-input" value="${formatDateToDisplay(oppDate)}" style="color:var(--text-muted); font-weight:700;" readonly><input type="hidden" class="opp-date-val" value="${oppDate}"></td>
        <td><input type="text" class="excel-input cur-serv-val" value="${v.curServ || ''}" data-old="${v.curServ || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'الخدمة')" onmouseenter="showStatusTooltip(this)" onmouseleave="hideStatusTooltip()"></td>
        <td><input type="number" class="excel-input opp-value-input readonly-input" value="${v.oppValue || ''}" readonly style="color:var(--accent-blue); font-weight:800; cursor:not-allowed; background: transparent;"></td>
        <td><div class="notes-preview" onclick="openNote(this)" data-full-notes='${notesJson.replace(/'/g, "&apos;")}' id="preview-${Date.now()}">${getLastNoteOnlyFromJSON(notesJson)}</div></td>
        <td>
            <select class="excel-input status-select" data-old="${v.status || ''}" onfocus="this.dataset.old=this.value" onchange="handleStatusChange(this, '${rowId}')">
                <option value="" ${v.status === '' ? 'selected' : ''}>-</option><option value="مهتم" ${v.status === 'مهتم' || v.status === 'تأهيل لفرصة' ? 'selected' : ''}>مهتم</option>
                <option value="رابح" ${v.status === 'رابح' ? 'selected' : ''}>رابح</option><option value="فقدان" ${v.status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td>
            <input type="text" class="excel-input exp-date-input-display readonly-input" value="${formatDateToDisplay(v.expDate || '')}" readonly style="cursor:pointer;" onclick="openCustomDatePicker(event, this, '${rowId}')" placeholder="اختر التاريخ">
            <input type="hidden" class="exp-date-input" value="${v.expDate || ''}" data-old="${v.expDate || ''}">
            <input type="hidden" class="edit-date-val" value="${v.editDate || ''}">
        </td>
        <td><input type="text" class="excel-input" value="${v.owner || ''}" data-old="${v.owner || ''}" onfocus="this.dataset.old=this.value" onkeyup="handleInputUpdate(this, '${rowId}')" onblur="handleInputBlur(this, 'المستخدم')"></td>
    `;

    subRow.innerHTML = `
        <td colspan="14" style="padding:15px 10px; background:#f8fafc; box-shadow: inset 0 2px 4px rgba(0,0,0,.02);">
            <div style="display: flex; gap: 15px; align-items: stretch;">
                <div class="sub-table-container" style="flex: 0 0 50%; padding: 0;">
                    <table class="inner-table" style="width: 100%;">
                        <thead><tr><th>المنتج</th><th>التفاصيل</th><th>العدد</th><th>الاشتراك</th><th>الإجمالي</th><th style="width:75px"><button class="header-plus-btn" onclick="addProductRow('${rowId}')" title="إضافة منتج"><i class="fas fa-plus"></i></button></th></tr></thead>
                        <tbody class="product-body"></tbody>
                    </table>
                </div>
                <div style="width: 250px; background: white; border: 1px solid var(--border-soft); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,.05);">
                    <div style="font-weight:bold; color:#2e1065; margin-bottom:10px; font-size:12px;">تفاصيل التعديل والوقت:</div>
                    <div class="edit-date-container-sub" style="display:flex; flex-direction:column; align-items:center;">${parseEditDateHTML(v.editDate || '')}</div>
                </div>
            </div>
        </td>
    `;

    target.appendChild(mainRow); target.appendChild(subRow); 
    applyStatusColor(mainRow.querySelector('.status-select'));
    if (v.products && v.products.length > 0) v.products.forEach(p => addProductRow(rowId, p, subRow)); else addProductRow(rowId, {}, subRow);
    calculateMainVisitValue(rowId, false, mainRow, subRow);
}

function addProductRow(rowId, data = {}, subRowEl = null) {
    const subRow = subRowEl || document.getElementById('sub-' + rowId);
    if (!subRow) return;
    const tbody = subRow.querySelector('.product-body');
    const row = tbody.insertRow();
    row.innerHTML = `
        <td><select onchange="updateEditDateField(this.closest('.sub-table-row').previousElementSibling); debouncedSaveSingleRow('${rowId}');"><option value="">-</option><option value="جوال" ${data.type === 'جوال' ? 'selected' : ''}>جوال</option><option value="بيانات" ${data.type === 'بيانات' ? 'selected' : ''}>بيانات</option><option value="هاتف" ${data.type === 'هاتف' ? 'selected' : ''}>هاتف</option><option value="فايبر نت" ${data.type === 'فايبر نت' ? 'selected' : ''}>فايبر نت</option><option value="DIA" ${data.type === 'DIA' ? 'selected' : ''}>DIA</option><option value="IPVPN" ${data.type === 'IPVPN' ? 'selected' : ''}>IPVPN</option><option value="SIP" ${data.type === 'SIP' ? 'selected' : ''}>SIP</option></select></td>
        <td><input type="text" value="${data.desc || ''}" onkeyup="updateEditDateField(this.closest('.sub-table-row').previousElementSibling); debouncedSaveSingleRow('${rowId}');"></td>
        <td><input type="number" class="prod-qty" min="0" value="${data.qty || ''}" onkeyup="updateEditDateField(this.closest('.sub-table-row').previousElementSibling); calculateMainVisitValue('${rowId}')" oninput="calculateMainVisitValue('${rowId}')"></td>
        <td><input type="number" class="prod-sub" min="0" value="${data.sub || ''}" onkeyup="updateEditDateField(this.closest('.sub-table-row').previousElementSibling); calculateMainVisitValue('${rowId}')" oninput="calculateMainVisitValue('${rowId}')"></td>
        <td><input type="number" class="prod-total readonly-input" value="${data.total || ''}" readonly style="color:var(--text-muted); font-weight:700; cursor:not-allowed;"></td>
        <td><div style="display:flex; justify-content:center;"><button class="sub-action-btn" title="حذف" onclick="if(this.closest('tbody').rows.length > 1) { const main = this.closest('.sub-table-row').previousElementSibling; updateEditDateField(main); this.closest('tr').remove(); calculateMainVisitValue('${rowId}'); }"><i class="fas fa-trash-alt" style="font-size:10px;"></i></button></div></td>
    `;
}
window.addProductRow = addProductRow; 

function calculateMainVisitValue(rowId, shouldSave = true, mainRowEl = null, subRowEl = null) {
    const subRow = subRowEl || document.getElementById('sub-' + rowId);
    if (!subRow) return;
    let grandTotal = 0;
    subRow.querySelectorAll('.product-body tr').forEach(pRow => {
        const qty = parseFloat(pRow.querySelector('.prod-qty').value) || 0;
        const sub = parseFloat(pRow.querySelector('.prod-sub').value) || 0;
        const rowTotal = qty * sub;
        pRow.querySelector('.prod-total').value = rowTotal > 0 ? rowTotal : '';
        grandTotal += rowTotal;
    });
    const mainRow = mainRowEl || document.getElementById(rowId);
    if (mainRow) {
        const oppVal = mainRow.querySelector('.opp-value-input');
        if (oppVal) oppVal.value = grandTotal > 0 ? grandTotal : '';
    }
    if (shouldSave) debouncedSaveSingleRow(rowId);
}
window.calculateMainVisitValue = calculateMainVisitValue; 

function handleStatusChange(selectEl, rowId) {
    const newVal = selectEl.value; const oldVal = selectEl.dataset.old; 
    const mainRow = selectEl.closest('tr');
    const companyName = mainRow.cells[1].querySelector('input').value;
    const ownerName = mainRow.cells[13].querySelector('input').value;
    
    applyStatusColor(selectEl); addToActivityLog('الحالة', oldVal, newVal, companyName, ownerName); 
    updateEditDateField(mainRow); saveSingleRow(rowId); updateStats(); 
    selectEl.dataset.old = newVal;
}
window.handleStatusChange = handleStatusChange; 

function applyStatusColor(selectEl) { 
    if (!selectEl) return; 
    const val = selectEl.value; const mainRow = selectEl.closest('.main-row'); 
    selectEl.classList.remove('status-yellow', 'status-green', 'status-red'); 
    if (mainRow) mainRow.classList.remove('closed-row'); 
    
    if (val === 'مهتم' || val === 'تأهيل لفرصة') { selectEl.classList.add('status-yellow'); } 
    else if (val === 'رابح') { selectEl.classList.add('status-green'); if (mainRow) mainRow.classList.add('closed-row'); } 
    else if (val === 'فقدان') { selectEl.classList.add('status-red'); if (mainRow) mainRow.classList.add('closed-row'); } 
    updateAllDateColors(); 
}

function updateAllDateColors() {
    const todayObj = new Date(getTodayFormatted());
    document.querySelectorAll('#tableBody .main-row').forEach(row => {
        const hiddenInput = row.querySelector('.exp-date-input');
        const displayInput = row.querySelector('.exp-date-input-display');
        if(!hiddenInput || !displayInput) return;
        const status = row.querySelector('.status-select').value;
        displayInput.classList.remove('date-today', 'date-warning', 'date-past');
        if (status === 'رابح' || status === 'فقدان') return;
        const dVal = hiddenInput.value;
        if (!dVal) return;
        const diffDays = Math.round((new Date(dVal) - todayObj) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) displayInput.classList.add('date-past');       
        else if (diffDays === 0) displayInput.classList.add('date-today');      
        else if (diffDays > 0 && diffDays <= 3) displayInput.classList.add('date-warning');    
    });
}

function openNote(el) {
    currentActivePreview = el;
    let arr = []; try { arr = JSON.parse(el.getAttribute('data-full-notes') || "[]"); } catch(e) {}
    const historyLog = document.getElementById('historyLog');
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    if (historyLog) {
        historyLog.innerHTML = arr.map((msg, index) => {
            let msgDateObj = new Date(msg.date);
            let dayStr = isNaN(msgDateObj) ? '' : days[msgDateObj.getDay()] + ' ';
            let userName = msg.user && msg.user !== "المستخدم" ? msg.user : "المستخدم";
            let showDelete = true;
            if (msg.date && msg.time) {
                let diffInHours = (new Date() - new Date(`${msg.date}T${msg.time}:00`)) / (1000 * 60 * 60);
                if (diffInHours > 24) showDelete = false;
            }
            return `
            <div class="note-item">
                <div class="note-header">
                    <span class="note-meta">
                        <span class="note-user"><i class="fas fa-user-circle"></i> ${escapeHTML(userName)}</span>
                        <span dir="ltr"><i class="far fa-calendar-alt"></i> ${escapeHTML(dayStr)} ${escapeHTML(msg.date)}</span>
                        <span dir="ltr"><i class="far fa-clock"></i> ${escapeHTML(msg.time)}</span>
                    </span>
                    ${showDelete ? `<i class="fas fa-trash-alt delete-note-btn" onclick="deleteNote(${index})" title="حذف الملاحظة"></i>` : ''}
                </div>
                <div class="note-body">${escapeHTML(msg.text)}</div>
            </div>`;
        }).join('') || '<div style="color:#64748b; text-align:center; font-size:11px; padding:20px; font-weight:700;">لا توجد ملاحظات سابقة</div>';
    }
    
    const noteModal = document.getElementById('noteModal');
    if (noteModal) { noteModal.style.display = "flex"; if (historyLog) historyLog.scrollTop = historyLog.scrollHeight; }
    const modalTextArea = document.getElementById('modalTextArea');
    if (modalTextArea) { modalTextArea.value = ""; modalTextArea.focus(); }
}
window.openNote = openNote; 

async function deleteNote(index) {
    if (!currentActivePreview) return;
    const result = await Swal.fire({ title: 'تأكيد الحذف؟', text: "هل أنت متأكد من حذف هذه الملاحظة؟", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء' });
    if (result.isConfirmed) {
        let arr = []; try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        arr.splice(index, 1);
        const jsonStr = JSON.stringify(arr);
        currentActivePreview.setAttribute('data-full-notes', jsonStr); currentActivePreview.innerText = getLastNoteOnlyFromJSON(jsonStr);
        const mainRow = currentActivePreview.closest('.main-row');
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); }
        openNote(currentActivePreview);
    }
}
window.deleteNote = deleteNote;

function saveNote() {
    const txt = document.getElementById('modalTextArea').value.trim();
    if (txt && currentActivePreview) {
        let arr = []; try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        let username = "المستخدم"; const mainRow = currentActivePreview.closest('.main-row');
        if (mainRow) { const ownerInput = mainRow.cells[13]?.querySelector('input'); if (ownerInput && ownerInput.value.trim()) username = ownerInput.value.trim(); }
        arr.push({ user: username, date: getTodayFormatted(), time: getTimeFormatted(), text: txt });
        currentActivePreview.setAttribute('data-full-notes', JSON.stringify(arr)); currentActivePreview.innerText = txt;
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); }
    }
    closeNote();
}
window.saveNote = saveNote;
window.closeNote = function() { document.getElementById('noteModal').style.display = "none"; };

window.showStatusTooltip = function(el) { const val = el.value || "فارغ"; let tooltip = document.getElementById('status-custom-tooltip'); if(!tooltip) { tooltip = document.createElement('div'); tooltip.id = 'status-custom-tooltip'; Object.assign(tooltip.style, {position:'absolute', background:'#1e293b', color:'#fff', padding:'5px 10px', borderRadius:'4px', fontSize:'11px', zIndex:'3000', pointerEvents:'none'}); document.body.appendChild(tooltip); } tooltip.innerText = val; tooltip.style.display = 'block'; const rect = el.getBoundingClientRect(); tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 6) + 'px'; tooltip.style.left = (rect.left + window.scrollX + (rect.width/2) - (tooltip.offsetWidth/2)) + 'px'; };
window.hideStatusTooltip = function() { const tooltip = document.getElementById('status-custom-tooltip'); if(tooltip) tooltip.style.display = 'none'; };

function updateEditDateField(row) {
    if (!row) return; const dateFormatted = getTodayFormatted(); const time24 = getTimeFormatted();
    const hiddenInput = row.querySelector('.edit-date-val');
    if (hiddenInput) hiddenInput.value = `${dateFormatted} ${time24}`;
    const subContainer = document.getElementById('sub-' + row.id)?.querySelector('.edit-date-container-sub');
    if (subContainer) subContainer.innerHTML = `<span class="edit-date-d">${dateFormatted}</span><span class="edit-date-t">${time24}</span>`;
}
window.updateEditDateField = updateEditDateField;

function parseEditDateHTML(fullDateTime) { if (!fullDateTime || !fullDateTime.includes(' ')) return `<span class="edit-date-d">${fullDateTime || ''}</span><span class="edit-date-t"></span>`; const parts = fullDateTime.split(' '); return `<span class="edit-date-d">${parts[0]}</span><span class="edit-date-t">${parts[1]}</span>`; }

window.toggleSubTable = function(rowId) { const sub = document.getElementById('sub-' + rowId); const arrows = document.querySelectorAll(`#${rowId} .toggle-arrow i`); if (!sub) return; const isOpen = sub.style.display === 'table-row'; sub.style.display = isOpen ? 'none' : 'table-row'; arrows.forEach(arrow => arrow.className = isOpen ? 'fas fa-caret-left' : 'fas fa-caret-down'); };
window.toggleLogExpansion = function() { const logSection = document.getElementById('activityLogSection'); const toggleBtn = document.getElementById('toggleExpandBtn'); if(!logSection || !toggleBtn) return; if (logSection.classList.contains('expanded')) { logSection.classList.remove('expanded'); toggleBtn.innerHTML = '<i class="fas fa-expand-alt"></i>'; } else { logSection.classList.add('expanded'); toggleBtn.innerHTML = '<i class="fas fa-compress-alt"></i>'; } };

function reorderRows(sourceContainer = null) { 
    const tbody = document.getElementById('tableBody'); if (!tbody) return; 
    
    // الاعتماد على الحاوية المؤقتة إذا وجدت لمنع الرعشة
    const container = sourceContainer || tbody;
    const rows = Array.from(container.querySelectorAll('.main-row')); 
    const today = getTodayFormatted(), currentMonth = today.substring(0, 7); 
    
    const rowsData = rows.map(row => { 
        const expInput = row.querySelector('.exp-date-input'); 
        const subRow = container.querySelector('#sub-' + row.id) || document.getElementById('sub-' + row.id);
        return { row: row, subRow: subRow, date: (expInput && expInput.value) ? expInput.value : '9999-12-31' }; 
    }); 
    
    const groups = {}; 
    rowsData.forEach(item => { const month = item.date === '9999-12-31' ? 'بدون تاريخ متوقع' : item.date.substring(0, 7); if (!groups[month]) groups[month] = []; groups[month].push(item); }); 
    
    const fragment = document.createDocumentFragment(); 
    const sortedMonths = Object.keys(groups).sort((a, b) => { if (a === 'بدون تاريخ متوقع') return -1; if (b === 'بدون تاريخ متوقع') return 1; return b.localeCompare(a); });

    sortedMonths.forEach(month => { 
        const sepRow = document.createElement('tr'); sepRow.className = 'month-separator'; 
        const isCurrentMonth = (month === currentMonth); const isNoDate = (month === 'بدون تاريخ متوقع');
        const sepStyle = isCurrentMonth ? 'background-color: #a855f7 !important; color:#fff !important; box-shadow: 0 2px 4px rgba(168,85,247,0.3);' : isNoDate ? 'background-color: #f59e0b !important; color:#fff !important; box-shadow: 0 2px 4px rgba(245,158,11,0.3);' : 'background-color: #3b82f6 !important; color:#fff !important; box-shadow: 0 2px 4px rgba(59,130,246,0.3);'; 
        const monthText = isNoDate ? 'فرص مؤهلة حديثاً (تحتاج تحديد تاريخ)' : `الفرص المتوقعة لشهر ${month}`;

        sepRow.innerHTML = `<td colspan="14"><div class="sep-text" style="${sepStyle}"><i class="far fa-calendar-alt"></i> ${monthText}</div></td>`; 
        if (isCurrentMonth) sepRow.id = 'current-month-separator';
        fragment.appendChild(sepRow); 
        groups[month].sort((a, b) => (a.date > b.date ? -1 : (a.date < b.date ? 1 : 0))).forEach(item => { fragment.appendChild(item.row); if (item.subRow) fragment.appendChild(item.subRow); }); 
    }); 
    
    // عملية تحديث واحدة ونهائية لشجرة المتصفح (تمنع الرعشة بالكامل)
    tbody.innerHTML = ''; 
    tbody.appendChild(fragment); 
    
    updateAllDateColors(); populateFilterDropdowns(); applyHeaderFilters();

    if (!initialScrollDone && rows.length > 0) {
        setTimeout(() => {
            const tableWrapper = document.querySelector('.table-wrapper'); const currentMonthSep = document.getElementById('current-month-separator');
            if (currentMonthSep && tableWrapper) { tableWrapper.scrollTo({ top: tableWrapper.scrollTop + (currentMonthSep.getBoundingClientRect().top - tableWrapper.getBoundingClientRect().top) - 42, behavior: 'smooth' }); initialScrollDone = true; } 
            else if (tableWrapper) initialScrollDone = true;
        }, 100); 
    }
}

function updateStats() { 
    const rows = document.querySelectorAll('#tableBody .main-row'); 
    const today = getTodayFormatted(), currentMonth = today.substring(0, 7); 
    let total = 0, tMonth = 0, tDay = 0, valTotal = 0, valMonth = 0; 
    
    rows.forEach(row => { 
        if (row.style.display === 'none') return;
        const status = row.querySelector('.status-select')?.value || '';
        if (status === 'مهتم' || status === 'تأهيل لفرصة') {
            total++;
            const visitVal = parseFloat(row.querySelector('.opp-value-input')?.value) || 0; 
            valTotal += visitVal;
            const oppDate = row.querySelector('.opp-date-val')?.value; 
            if (oppDate) { if (oppDate === today) tDay++; if (oppDate.startsWith(currentMonth)) tMonth++; }
            const expDate = row.querySelector('.exp-date-input')?.value;
            if (expDate && expDate.startsWith(currentMonth)) valMonth += visitVal;
        }
    }); 
    
    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total; 
    if (document.getElementById('stat-today')) document.getElementById('stat-today').innerText = tDay; 
    if (document.getElementById('stat-month')) document.getElementById('stat-month').innerText = tMonth; 
    if (document.getElementById('stat-value-total')) document.getElementById('stat-value-total').innerText = valTotal.toLocaleString() + ' ر.س'; 
    if (document.getElementById('stat-value-month')) document.getElementById('stat-value-month').innerText = valMonth.toLocaleString() + ' ر.س'; 
}

function getLastNoteOnlyFromJSON(jsonStr) { try { const arr = JSON.parse(jsonStr); return arr.length > 0 ? arr[arr.length - 1].text : "أضف ملاحظة..."; } catch(e) { return "أضف ملاحظة..."; } }

window.openWhatsAppChat = function(el) { const inputEl = el.closest('.phone-cell-container').querySelector('input'); let rawPhone = inputEl.value.trim(); if (!rawPhone) { Swal.fire({icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال رقم الجوال أولاً', confirmButtonText: 'حسناً', confirmButtonColor: '#3b82f6'}); return; } let cleanNumber = rawPhone.replace(/\D/g, ''); if (cleanNumber.startsWith('00966')) cleanNumber = cleanNumber.substring(2); else if (cleanNumber.startsWith('05')) cleanNumber = '966' + cleanNumber.substring(1); else if (cleanNumber.startsWith('5') && cleanNumber.length === 9) cleanNumber = '966' + cleanNumber; window.open("https://wa.me/" + cleanNumber, '_blank'); };
window.toggleAllCheckboxes = function(source) { document.querySelectorAll('.select-check, .row-checkbox').forEach(chk => chk.checked = source.checked); };
window.debouncedFilterTable = function() { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyHeaderFilters, 300); };

function applyHeaderFilters() {
    const q = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    document.querySelectorAll('#tableBody .main-row').forEach(row => {
        const text = Array.from(row.cells).slice(1, 7).map(c => c.querySelector('input')?.value.toLowerCase() || '').join(' ');
        const subRow = document.getElementById('sub-' + row.id);
        const rawStatus = row.querySelector('.status-select')?.value.trim() || '';
        const rawOwner = row.cells[13]?.querySelector('input')?.value.trim() || '';
        
        const matchesSearch = !q || text.includes(q);
        const matchesStatus = (selectedStatusFilters.size === 0) || selectedStatusFilters.has(rawStatus === '' ? 'غير محدد' : rawStatus);
        const matchesOwner = (selectedOwnerFilters.size === 0) || selectedOwnerFilters.has(rawOwner === '' ? 'بدون مستخدم' : rawOwner);

        const show = matchesSearch && matchesStatus && matchesOwner;
        row.style.display = show ? 'table-row' : 'none';
        if (subRow) subRow.style.display = show && subRow.style.display === 'table-row' ? 'table-row' : 'none';
    });
    updateStats();
}
window.applyHeaderFilters = applyHeaderFilters;

function populateFilterDropdowns() {
    const rows = document.querySelectorAll('#tableBody .main-row'); if (!rows.length) return;
    const availableStatuses = new Set(), availableOwners = new Set();
    rows.forEach(row => {
        availableStatuses.add((row.querySelector('.status-select')?.value.trim() || '') === '' ? 'غير محدد' : row.querySelector('.status-select').value.trim());
        availableOwners.add((row.cells[13]?.querySelector('input')?.value.trim() || '') === '' ? 'بدون مستخدم' : row.cells[13].querySelector('input').value.trim());
    });
    renderFilterDropdown('statusFilterDropdown', Array.from(availableStatuses), selectedStatusFilters, 'status');
    renderFilterDropdown('ownerFilterDropdown', Array.from(availableOwners), selectedOwnerFilters, 'owner');
}

function renderFilterDropdown(dropdownId, optionsList, selectedSet, filterType) {
    const dropdown = document.getElementById(dropdownId); if (!dropdown) return;
    if (!dropdown.dataset.initialized) { optionsList.forEach(opt => selectedSet.add(opt)); dropdown.dataset.initialized = "true"; } 
    else { optionsList.forEach(opt => { if (!dropdown.dataset['seen_' + opt]) { selectedSet.add(opt); dropdown.dataset['seen_' + opt] = "true"; } }); }
    let html = `<div class="filter-actions-header"><span>تصفية (${filterType === 'status' ? 'الحالة' : 'المستخدم'})</span><div style="display:flex; gap:4px;"><button type="button" class="filter-action-btn" onclick="selectAllFilters('${filterType}')">الكل</button><button type="button" class="filter-action-btn" onclick="clearAllFilters('${filterType}')">تفريغ</button></div></div>`;
    optionsList.forEach(option => html += `<label class="filter-item" onclick="event.stopPropagation()"><span class="filter-item-label">${escapeHTML(option)}</span><input type="checkbox" value="${escapeHTML(option)}" ${selectedSet.has(option) ? 'checked' : ''} onchange="handleFilterCheckboxChange('${filterType}', this)"></label>`);
    dropdown.innerHTML = html;
}

window.handleFilterCheckboxChange = function(filterType, checkbox) { const selectedSet = filterType === 'status' ? selectedStatusFilters : selectedOwnerFilters; checkbox.checked ? selectedSet.add(checkbox.value) : selectedSet.delete(checkbox.value); applyHeaderFilters(); };
window.selectAllFilters = function(filterType) { const selectedSet = filterType === 'status' ? selectedStatusFilters : selectedOwnerFilters; const dropdown = document.getElementById(filterType === 'status' ? 'statusFilterDropdown' : 'ownerFilterDropdown'); if (dropdown) { dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => { chk.checked = true; selectedSet.add(chk.value); }); applyHeaderFilters(); } };
window.clearAllFilters = function(filterType) { const selectedSet = filterType === 'status' ? selectedStatusFilters : selectedOwnerFilters; const dropdown = document.getElementById(filterType === 'status' ? 'statusFilterDropdown' : 'ownerFilterDropdown'); if (dropdown) { dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false); selectedSet.clear(); applyHeaderFilters(); } };
window.toggleHeaderFilterMenu = function(menuId, e) { if (e) e.stopPropagation(); const menu = document.getElementById(menuId); if (!menu) return; document.querySelectorAll('.header-filter-menu, .dropdown-menu').forEach(m => { if (m !== menu) m.classList.remove('show'); }); menu.classList.toggle('show'); };
document.addEventListener('click', (e) => { if (!e.target.closest('.header-filter-container')) document.querySelectorAll('.header-filter-menu').forEach(m => m.classList.remove('show')); });

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let activeInputDisplayTarget = null, activeInputHiddenTarget = null, activeRowTargetId = null;
let viewYear = new Date().getFullYear(), viewMonth = new Date().getMonth(), tempSelectedDateStr = "";

function setupCalendarEvents() {
    const monthSelect = document.getElementById('calMonthSelect');
    if(monthSelect) { monthSelect.innerHTML = ''; MONTH_NAMES.forEach((name, index) => monthSelect.appendChild(new Option(name, index))); monthSelect.addEventListener('change', (e) => { viewMonth = parseInt(e.target.value, 10); }); }
}

function populateYearSelect() {
    const yearSelect = document.getElementById('calYearSelect');
    if (!yearSelect) return;
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        yearSelect.appendChild(new Option(i, i));
    }
    yearSelect.value = viewYear;
}

window.openCustomDatePicker = function(e, displayTarget, rowId) {
    activeInputDisplayTarget = displayTarget; activeRowTargetId = rowId;
    const mainRow = document.getElementById(rowId);
    if(mainRow) activeInputHiddenTarget = mainRow.querySelector('.exp-date-input');
    const overlay = document.getElementById('calendarOverlay');
    if(overlay) overlay.classList.add('active');
    populateYearSelect();
    setupCalendarEvents();
};

document.getElementById('calCancelBtn')?.addEventListener('click', () => { document.getElementById('calendarOverlay')?.classList.remove('active'); });