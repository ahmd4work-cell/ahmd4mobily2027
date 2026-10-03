import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// متغيرات الحالة الأساسية
let currentActivePreview = null, searchTimeout = null;
const saveTimeouts = {}; 
const LOGS_KEY = 'asgate_visits_logs_v1';
let visitsDataArray = [], isInitialLoad = true, activityLogs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
let currentPickerRowId = null, currentPickerInput = null;
let currentPickerMonth = new Date().getMonth(), currentPickerYear = new Date().getFullYear();
let activeStatusFilters = [], activeOwnerFilters = [], itemsToDelete = [];

// دوال مساعدة
const escapeHTML = str => typeof str !== 'string' ? (str || '') : str.replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[m]));
const getFormattedDateTime = (d = new Date()) => ({
    date: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
});

function formatAsDDMMYYYY(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const p = dateStr.split('-');
    return p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : dateStr;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const p = dateStr.split('-');
    return p.length === 3 ? new Date(p[p[0].length===4?0:2], p[1]-1, p[p[0].length===4?2:0]) : new Date(0);
}

function getDateColorClass(dateStr) {
    if (!dateStr) return '';
    const { date: todayStr } = getFormattedDateTime();
    if (dateStr === todayStr) return 'date-today';
    return parseDate(dateStr) < parseDate(todayStr) ? 'date-past' : 'date-warning';
}

const parseEditDateHTML = (str) => `<span class="edit-date-d">${escapeHTML(str) || '-'}</span>`;

function updateEditDateField(tr) {
    if (!tr) return;
    const { date, time } = getFormattedDateTime();
    const fullStr = `${date} ${time}`;
    tr.querySelector('.edit-date-val').value = fullStr;
    tr.querySelector('.edit-date-container-main').innerHTML = parseEditDateHTML(fullStr);
}

const cleanPhone = phone => phone ? String(phone).replace(/\D/g, '').replace(/^05/, '9665') : '';
// تمت إزالة الكتابة الوهمية لتصبح الخلية فارغة
const getLastNoteOnlyFromJSON = jsonStr => { try { const arr = JSON.parse(jsonStr || "[]"); return arr.length ? arr[arr.length-1].text || arr[arr.length-1].note : ""; } catch { return jsonStr || ""; } };

// سجل النشاط
function addActivityLog(actionText) {
    const { date, time } = getFormattedDateTime();
    activityLogs.unshift({ date, time, user: 'المستخدم', action: actionText });
    if (activityLogs.length > 50) activityLogs.pop();
    localStorage.setItem(LOGS_KEY, JSON.stringify(activityLogs));
    renderActivityLogs();
}

function renderActivityLogs() {
    const listEl = document.getElementById('activityList');
    if (!listEl) return;
    listEl.innerHTML = activityLogs.length ? activityLogs.map(log => `
        <div class="log-entry">
            <div class="log-header-info"><span><i class="far fa-user"></i> ${escapeHTML(log.user)}</span> <span dir="ltr"><i class="far fa-calendar-alt"></i> ${escapeHTML(log.date)} ${escapeHTML(log.time)}</span></div>
            <span class="log-sep">|</span><div class="log-action">${escapeHTML(log.action)}</div>
        </div>
    `).join('') : '<div style="color:#94a3b8; font-size:10px; text-align:center; padding:10px;">لا توجد أنشطة</div>';
}

window.toggleLogExpansion = function() {
    const sec = document.getElementById('activityLogSection'), btn = document.getElementById('toggleExpandBtn');
    if(sec) {
        sec.classList.toggle('expanded');
        if(btn) btn.querySelector('i').className = sec.classList.contains('expanded') ? 'fas fa-compress-alt' : 'fas fa-expand-alt';
    }
}

// نظام الملاحظات
window.openNote = function(el) {
    currentActivePreview = el;
    let arr = []; try { arr = JSON.parse(el.getAttribute('data-full-notes') || "[]"); } catch(e) {}
    const historyLog = document.getElementById('historyLog');
    
    if (historyLog) {
        historyLog.innerHTML = arr.length ? arr.map((msg, idx) => `
            <div class="note-item">
                <div class="note-header">
                    <span class="note-meta"><span class="note-user"><i class="fas fa-user-circle"></i> ${escapeHTML(msg.user || "المستخدم")}</span>
                    <span dir="ltr"><i class="far fa-calendar-alt"></i> ${escapeHTML(msg.date || '')}</span> <span dir="ltr"><i class="far fa-clock"></i> ${escapeHTML(msg.time || '')}</span></span>
                    <i class="fas fa-trash-alt delete-note-btn" onclick="deleteNote(${idx})" title="حذف"></i>
                </div>
                <div class="note-body">${escapeHTML(msg.text || '')}</div>
            </div>`).join('') : '<div style="color:#64748b; text-align:center; font-size:11px; padding:20px;">لا توجد ملاحظات سابقة</div>';
    }
    document.getElementById('noteModal').style.display = "flex";
    if (historyLog) historyLog.scrollTop = historyLog.scrollHeight;
    document.getElementById('modalTextArea').value = ""; document.getElementById('modalTextArea').focus();
}

window.saveNote = function() {
    const txt = document.getElementById('modalTextArea').value.trim();
    if (txt && currentActivePreview) {
        let arr = []; try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        const mainRow = currentActivePreview.closest('.main-row');
        const username = mainRow?.querySelector('.owner-input')?.value.trim() || "المستخدم";
        const { date, time } = getFormattedDateTime();
        
        arr.push({ user: username, date, time, text: txt });
        const jsonStr = JSON.stringify(arr);
        currentActivePreview.setAttribute('data-full-notes', jsonStr);
        currentActivePreview.innerText = txt;
        
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); addActivityLog(`إضافة ملاحظة على زيارة (${mainRow.id})`); }
    }
    window.closeNote();
}

window.deleteNote = async function(index) {
    if (!currentActivePreview) return;
    if ((await Swal.fire({ title: 'تأكيد الحذف؟', text: "متأكد من حذف الملاحظة؟", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' })).isConfirmed) {
        let arr = []; try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        arr.splice(index, 1);
        const jsonStr = JSON.stringify(arr);
        currentActivePreview.setAttribute('data-full-notes', jsonStr);
        currentActivePreview.innerText = getLastNoteOnlyFromJSON(jsonStr);
        const mainRow = currentActivePreview.closest('.main-row');
        if (mainRow) { updateEditDateField(mainRow); saveSingleRow(mainRow.id); }
        window.openNote(currentActivePreview);
    }
}
window.closeNote = () => document.getElementById('noteModal').style.display = "none";

// الإضافة والتحديث (Firebase)
window.insertNewRow = async function() {
    const newId = 'visit_' + Date.now();
    const { date, time } = getFormattedDateTime();
    try {
        await setDoc(doc(db, "visits", newId), { comp: '', address: '', mgr: '', mob: '', email: '', record: '', visitDate: date, curServ: '', oppValue: '', notes: '[]', status: '', editDate: `${date} ${time}`, owner: '', products: [] });
        addActivityLog('إضافة زيارة جديدة');
    } catch (error) { Swal.fire('خطأ', 'تعذر إضافة الزيارة', 'error'); }
}

function listenToVisits() {
    renderActivityLogs();
    onSnapshot(collection(db, "visits"), (snapshot) => {
        let needsFullRender = false;
        snapshot.docChanges().forEach(change => {
            const data = { ...change.doc.data(), id: change.doc.id };
            if (change.type === "added") { visitsDataArray.push(data); needsFullRender = true; }
            else if (change.type === "modified") { const idx = visitsDataArray.findIndex(v => v.id === data.id); if (idx > -1) { visitsDataArray[idx] = data; updateRowDOM(data); } }
            else if (change.type === "removed") { visitsDataArray = visitsDataArray.filter(v => v.id !== data.id); needsFullRender = true; }
        });
        if (needsFullRender || isInitialLoad) { updateDynamicOwnerFilter(); fullTableRender(); isInitialLoad = false; }
        updateStats();
    });
}

window.applyStatusColor = function(selectEl) {
    if (!selectEl) return;
    selectEl.className = `excel-input status-select ${{'تأهيل لفرصة':'status-green','مميزة':'status-purple','متابعة':'status-yellow-fff','عرض سعر':'status-yellow-ffc','غير مهتم':'status-gray-a5','فقدان':'status-red-c00'}[selectEl.value.trim()] || ''}`;
    const tr = selectEl.closest('tr');
    if (tr) { tr.classList.remove('row-lost', 'row-uninterested'); if(selectEl.value.trim() === 'فقدان') tr.classList.add('row-lost'); else if(selectEl.value.trim() === 'غير مهتم') tr.classList.add('row-uninterested'); }
}

function updateRowDOM(v) {
    const mainRow = document.getElementById(v.id);
    if (!mainRow) return;
    const safeUpdate = (selector, val, isProp = 'value') => { const el = mainRow.querySelector(selector); if (el && document.activeElement !== el) el[isProp] = val; };
    
    // معالجة القيمة الصفرية لتظهر فارغة
    const valOpp = v.oppValue == '0' ? '' : (v.oppValue || '');
    
    ['td:nth-child(2) input', 'td:nth-child(3) input', 'td:nth-child(4) input', 'td:nth-child(5) input', 'td:nth-child(6) input', 'td:nth-child(7) input', '.visit-date-val', '.cur-serv-val', '.opp-value-input', '.owner-input', '.edit-date-val'].forEach((sel, i) => safeUpdate(sel, [v.comp, v.address, v.mgr, v.mob, v.email, v.record, formatAsDDMMYYYY(v.visitDate || getFormattedDateTime().date), v.curServ, valOpp, v.owner, v.editDate][i] || ''));
    
    const statSel = mainRow.querySelector('.status-select');
    if(statSel && document.activeElement !== statSel) { statSel.value = v.status || ''; window.applyStatusColor(statSel); }
    safeUpdate('.edit-date-container-main', parseEditDateHTML(v.editDate || ''), 'innerHTML');
    
    const noteEl = mainRow.querySelector('.notes-preview');
    if (noteEl) { noteEl.setAttribute('data-full-notes', v.notes || "[]"); noteEl.innerText = getLastNoteOnlyFromJSON(v.notes); }
}

function renderRowHTML(v) {
    const hasProducts = Array.isArray(v.products) && v.products.length > 0;
    const vDate = formatAsDDMMYYYY(v.visitDate || getFormattedDateTime().date);
    let rowClass = `main-row ${v.status === 'فقدان' ? 'row-lost' : v.status === 'غير مهتم' ? 'row-uninterested' : ''}`;
    const opts = ['تأهيل لفرصة','مميزة','متابعة','عرض سعر','زيارة','اتصال','غير مهتم','فقدان'].map(o => `<option value="${o}" ${v.status === o ? 'selected' : ''}>${o}</option>`).join('');
    const valOpp = v.oppValue == '0' ? '' : (v.oppValue || '');

    // إزالة خصائص placeholder من جميع الحقول
    return `
    <tr id="${v.id}" class="${rowClass}">
        <td class="col-select"><input type="checkbox" class="row-checkbox select-check" value="${v.id}"><span class="toggle-arrow ${hasProducts ? 'arrow-open' : ''}" onclick="window.toggleSubTable('${v.id}')">▶</span></td>
        <td class="col-company"><input type="text" class="excel-input" value="${escapeHTML(v.comp)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-address"><input type="text" class="excel-input" value="${escapeHTML(v.address)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-manager"><input type="text" class="excel-input" value="${escapeHTML(v.mgr)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-mobile"><div class="phone-cell-container"><input type="text" class="excel-input" value="${escapeHTML(v.mob)}" oninput="window.debouncedSaveRow('${v.id}')">
            ${v.mob ? `<a href="https://wa.me/${cleanPhone(v.mob)}" target="_blank" class="whatsapp-icon-btn"><i class="fab fa-whatsapp"></i></a>` : ''}</div></td>
        <td class="col-email"><input type="email" class="excel-input" value="${escapeHTML(v.email)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-record"><input type="text" class="excel-input" value="${escapeHTML(v.record)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-date"><input type="text" class="excel-input readonly-input visit-date-val ${getDateColorClass(vDate)}" value="${escapeHTML(vDate)}" onclick="window.openDatePicker(this, '${v.id}')" readonly></td>
        <td class="col-service"><input type="text" class="excel-input cur-serv-val" value="${escapeHTML(v.curServ)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-val"><input type="number" class="excel-input opp-value-input" value="${valOpp}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td class="col-notes"><span class="notes-preview" data-full-notes="${escapeHTML(v.notes || '[]')}" onclick="openNote(this)">${escapeHTML(getLastNoteOnlyFromJSON(v.notes))}</span></td>
        <td class="col-status"><select class="excel-input status-select" onchange="window.onStatusChange(this, '${v.id}')"><option value="">-- اختر --</option>${opts}</select></td>
        <td class="col-edit"><input type="hidden" class="edit-date-val" value="${escapeHTML(v.editDate || '')}"><div class="edit-date-container-main">${parseEditDateHTML(v.editDate)}</div></td>
        <td class="col-owner"><input type="text" class="excel-input owner-input" value="${escapeHTML(v.owner)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
    </tr>${renderSubTableHTML(v)}`;
}

function renderSubTableHTML(v) {
    const products = Array.isArray(v.products) ? v.products : [];
    let rowsHtml = products.map(p => `<tr>
        <td><input type="text" class="p-name" value="${escapeHTML(p.name)}" oninput="window.debouncedSaveRow('${v.id}')"></td>
        <td><input type="number" class="p-qty" value="${p.qty || 1}" oninput="window.updateProductTotal(this, '${v.id}')"></td>
        <td><input type="number" class="p-price" value="${p.price || ''}" oninput="window.updateProductTotal(this, '${v.id}')"></td>
        <td><input type="text" class="p-total readonly-input" value="${(Number(p.qty||1) * Number(p.price||0)).toLocaleString('ar-SA')}" readonly></td>
        <td style="text-align:center;"><button type="button" class="sub-action-btn" onclick="window.removeProductRow(this, '${v.id}')"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`).join('');
    return `<tr id="sub-${v.id}" class="sub-table-row"><td colspan="14"><div class="sub-table-container"><table class="inner-table"><thead><tr><th style="width: 40%;">المنتج <button type="button" class="header-plus-btn" onclick="window.addProductRow('${v.id}')">+</button></th><th style="width: 15%;">الكمية</th><th style="width: 20%;">السعر</th><th style="width: 20%;">الإجمالي</th><th style="width: 5%;">إجراء</th></tr></thead><tbody class="product-body">${rowsHtml}</tbody></table></div></td></tr>`;
}

window.fullTableRender = function(dataArray = visitsDataArray) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    let fullHTML = '', currentMonthYear = '';
    [...dataArray].sort((a, b) => parseDate(b.visitDate) - parseDate(a.visitDate)).forEach(v => {
        const dObj = parseDate(v.visitDate);
        if (!isNaN(dObj.getTime()) && dObj.getFullYear() > 1970) {
            const myStr = `${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][dObj.getMonth()]} ${dObj.getFullYear()}`;
            if (myStr !== currentMonthYear) { currentMonthYear = myStr; fullHTML += `<tr class="month-separator"><td colspan="14"><div class="sep-text">${currentMonthYear}</div></td></tr>`; }
        }
        fullHTML += renderRowHTML(v);
    });
    tbody.innerHTML = fullHTML;
    tbody.querySelectorAll('.status-select').forEach(select => window.applyStatusColor(select));
}

// الدوال الفرعية للجدول (Sub Table)
window.toggleSubTable = id => { const sub = document.getElementById('sub-'+id), arrow = document.querySelector(`#${id} .toggle-arrow`); if(sub) { const isVis = sub.style.display === 'table-row'; sub.style.display = isVis ? 'none' : 'table-row'; if(arrow) arrow.classList.toggle('arrow-open', !isVis); } };
window.addProductRow = id => { const tb = document.querySelector(`#sub-${id} .product-body`); if(tb) { tb.insertAdjacentHTML('beforeend', `<tr><td><input type="text" class="p-name" oninput="window.debouncedSaveRow('${id}')"></td><td><input type="number" class="p-qty" value="1" oninput="window.updateProductTotal(this, '${id}')"></td><td><input type="number" class="p-price" value="" oninput="window.updateProductTotal(this, '${id}')"></td><td><input type="text" class="p-total readonly-input" value="" readonly></td><td style="text-align:center;"><button type="button" class="sub-action-btn" onclick="window.removeProductRow(this, '${id}')"><i class="fas fa-trash-alt"></i></button></td></tr>`); window.debouncedSaveRow(id); } };
window.removeProductRow = (btn, id) => { btn.closest('tr')?.remove(); window.debouncedSaveRow(id); };
window.updateProductTotal = (inputEl, id) => { const tr = inputEl.closest('tr'); if(tr) tr.querySelector('.p-total').value = (Number(tr.querySelector('.p-qty')?.value || 0) * Number(tr.querySelector('.p-price')?.value || 0)).toLocaleString('ar-SA'); window.debouncedSaveRow(id); };

async function saveSingleRow(rowId) {
    const row = document.getElementById(rowId); if (!row) return;
    const qv = (nth) => row.querySelector(`td:nth-child(${nth}) input`)?.value || '';
    const { date, time } = getFormattedDateTime();
    let products = [];
    document.querySelectorAll(`#sub-${rowId} .product-body tr`).forEach(pr => { const name = pr.querySelector('.p-name')?.value; if(name) products.push({name, qty: Number(pr.querySelector('.p-qty')?.value||1), price: Number(pr.querySelector('.p-price')?.value||0)}); });
    if(!products.length) products = visitsDataArray.find(v => v.id === rowId)?.products || [];
    
    const data = { comp: qv(2), address: qv(3), mgr: qv(4), mob: qv(5), email: qv(6), record: qv(7), visitDate: qv(8) || date, curServ: qv(9), oppValue: qv(10) || '', notes: row.querySelector('.notes-preview')?.getAttribute('data-full-notes') || '[]', status: row.querySelector('.status-select')?.value || '', editDate: `${date} ${time}`, owner: row.querySelector('.owner-input')?.value || '', products };

    if (data.status === 'تأهيل لفرصة') {
        const batch = writeBatch(db);
        batch.set(doc(db, "opportunities", rowId), { ...data, oppDate: data.visitDate });
        batch.delete(doc(db, "visits", rowId));
        await batch.commit();
        addActivityLog(`نقل الزيارة (${data.comp || rowId}) للفرص البيعية`);
        Swal.fire({ title: 'تم النقل', text: 'تم نقل الزيارة بنجاح', icon: 'success', timer: 2000, showConfirmButton: false });
    } else {
        await setDoc(doc(db, "visits", rowId), data, { merge: true });
        updateEditDateField(row);
    }
}
window.debouncedSaveRow = id => { clearTimeout(saveTimeouts[id]); saveTimeouts[id] = setTimeout(() => saveSingleRow(id), 500); };
window.onStatusChange = (sel, id) => { window.applyStatusColor(sel); updateEditDateField(document.getElementById(id)); if(sel.value && sel.value !== 'تأهيل لفرصة') addActivityLog(`تغيير حالة (${sel.value})`); saveSingleRow(id); };

// الفلترة والبحث
window.filterTable = function() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const filtered = visitsDataArray.filter(v => (!query || Object.values(v).some(val => String(val||'').toLowerCase().includes(query))) && (!activeStatusFilters.length || activeStatusFilters.includes(v.status)) && (!activeOwnerFilters.length || activeOwnerFilters.includes(v.owner)));
    window.fullTableRender(filtered); updateStats(filtered);
}
window.debouncedFilterTable = () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(window.filterTable, 300); };

window.toggleCustomFilter = (e, menuId) => { e.stopPropagation(); document.querySelectorAll('.multi-select-menu').forEach(m => m.id !== menuId && m.classList.remove('show')); document.getElementById(menuId)?.classList.toggle('show'); };
window.updateFilters = () => {
    activeStatusFilters = Array.from(document.querySelectorAll('#statusFilterMenu input:checked')).map(c => c.value);
    activeOwnerFilters = Array.from(document.querySelectorAll('#ownerFilterMenu input:checked')).map(c => c.value);
    document.getElementById('statusFilterDot').style.display = activeStatusFilters.length ? 'block' : 'none';
    document.getElementById('ownerFilterDot').style.display = activeOwnerFilters.length ? 'block' : 'none';
    window.filterTable();
}
function updateDynamicOwnerFilter() {
    const menu = document.getElementById('ownerFilterMenu'); if(!menu) return;
    menu.innerHTML = [...new Set(visitsDataArray.map(v => v.owner).filter(o => o?.trim()))].sort().map(o => `<label class="multi-select-item"><input type="checkbox" value="${escapeHTML(o)}" ${activeOwnerFilters.includes(o)?'checked':''} onchange="window.updateFilters()"><span class="custom-cb"><i class="fas fa-check"></i></span> ${escapeHTML(o)}</label>`).join('');
}
function updateStats(data = visitsDataArray) {
    const { date: todayStr } = getFormattedDateTime(), today = parseDate(todayStr);
    let total = data.length, month = 0, todayC = 0, valTotal = 0, valMonth = 0;
    data.forEach(v => {
        const dObj = parseDate(v.visitDate), val = Number(v.oppValue) || 0;
        if (!isNaN(dObj.getTime())) { if (dObj.getMonth() === today.getMonth() && dObj.getFullYear() === today.getFullYear()) { month++; valMonth += val; } if (v.visitDate === todayStr) todayC++; }
        valTotal += val;
    });
    ['total','month','today'].forEach(id => { const el = document.getElementById(`stat-${id}`); if(el) el.innerText = eval(id==='today'?'todayC':id); });
    if(document.getElementById('stat-value-total')) document.getElementById('stat-value-total').innerText = valTotal.toLocaleString('ar-SA');
    if(document.getElementById('stat-value-month')) document.getElementById('stat-value-month').innerText = valMonth.toLocaleString('ar-SA');
}

// نافذة الحذف الفردي
window.openDeleteModal = ids => { itemsToDelete = Array.isArray(ids) ? ids : [ids]; document.getElementById('deleteModalMessage').innerText = itemsToDelete.length > 1 ? `تأكيد حذف ${itemsToDelete.length} عنصر؟` : `تأكيد حذف هذا العنصر؟`; document.getElementById('deleteModal').style.display = 'flex'; };
window.closeDeleteModal = () => { document.getElementById('deleteModal').style.display = 'none'; itemsToDelete = []; };
window.confirmDelete = async () => {
    if (!itemsToDelete.length) return;
    try { const batch = writeBatch(db); itemsToDelete.forEach(id => batch.delete(doc(db, "visits", id))); await batch.commit(); addActivityLog(`حذف ${itemsToDelete.length} زيارات`); window.closeDeleteModal(); Swal.fire('نجاح', 'تم الحذف', 'success'); } catch(e) { Swal.fire('خطأ', 'فشل الحذف', 'error'); }
};

// التقويم المخصص
window.openDatePicker = (input, id) => { currentPickerInput = input; currentPickerRowId = id; const d = parseDate(input.value); const valid = !isNaN(d.getTime()) && d.getFullYear()>1970; currentPickerMonth = valid ? d.getMonth() : new Date().getMonth(); currentPickerYear = valid ? d.getFullYear() : new Date().getFullYear(); renderDatePicker(); document.getElementById('customDatePicker')?.classList.add('active'); };
window.closeDatePicker = () => { document.getElementById('customDatePicker')?.classList.remove('active'); currentPickerInput = currentPickerRowId = null; };
function renderDatePicker() {
    const dpMonth = document.getElementById('dpMonth'), dpYear = document.getElementById('dpYear');
    if(!dpMonth) return;
    dpMonth.innerHTML = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"].map((m,i) => `<option value="${i}" ${i===currentPickerMonth?'selected':''}>${m}</option>`).join('');
    const sy = new Date().getFullYear()-5; dpYear.innerHTML = Array.from({length:11}, (_,i) => sy+i).map(y => `<option value="${y}" ${y===currentPickerYear?'selected':''}>${y}</option>`).join('');
    dpMonth.onchange = e => { currentPickerMonth = +e.target.value; renderDatePickerDays(); }; dpYear.onchange = e => { currentPickerYear = +e.target.value; renderDatePickerDays(); };
    renderDatePickerDays();
}
function renderDatePickerDays() {
    const dpDays = document.getElementById('dpDays'); if(!dpDays) return; dpDays.innerHTML = '';
    const fd = new Date(currentPickerYear, currentPickerMonth, 1).getDay(), td = new Date(currentPickerYear, currentPickerMonth+1, 0).getDate(), today = new Date();
    for (let i = 0; i < fd; i++) dpDays.appendChild(document.createElement('div'));
    for (let d = 1; d <= td; d++) {
        const div = document.createElement('div'); div.className = `day-number ${d===today.getDate() && currentPickerMonth===today.getMonth() && currentPickerYear===today.getFullYear() ? 'today-day' : ''}`; div.innerText = d;
        div.onclick = () => { if(currentPickerInput && currentPickerRowId) { const dateStr = `${String(d).padStart(2,'0')}-${String(currentPickerMonth+1).padStart(2,'0')}-${currentPickerYear}`; currentPickerInput.value = dateStr; currentPickerInput.className = `excel-input readonly-input visit-date-val ${getDateColorClass(dateStr)}`; saveSingleRow(currentPickerRowId); } window.closeDatePicker(); };
        dpDays.appendChild(div);
    }
}
window.setTodayDate = () => { if(currentPickerInput) { const dStr = getFormattedDateTime().date; currentPickerInput.value = dStr; currentPickerInput.className = `excel-input readonly-input visit-date-val ${getDateColorClass(dStr)}`; saveSingleRow(currentPickerRowId); } window.closeDatePicker(); };

// الإجراءات الجماعية
window.handleBulkAction = async action => {
    const checked = Array.from(document.querySelectorAll('.select-check:checked')).map(cb => cb.value);
    if(action === 'طباعة') return window.print();
    if(action === 'تصدير') {
        if(typeof XLSX === 'undefined') return Swal.fire('خطأ', 'مكتبة SheetJS غير محملة', 'error');
        if(!visitsDataArray.length) return Swal.fire('تنبيه', 'لا بيانات', 'warning');
        const ws = XLSX.utils.json_to_sheet(visitsDataArray.map(v => ({'الشركة':v.comp,'العنوان':v.address,'المسؤول':v.mgr,'رقم التواصل':v.mob,'البريد':v.email,'السجل':v.record,'التاريخ':v.visitDate,'الخدمة':v.curServ,'القيمة':v.oppValue,'الحالة':v.status,'المستخدم':v.owner,'تعديل':v.editDate})));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "الزيارات"); XLSX.writeFile(wb, "Visits.xlsx");
        return;
    }
    if(!checked.length) return Swal.fire('تنبيه', 'حدد عنصراً', 'warning');
    if(action === 'حذف') { itemsToDelete = checked; if(typeof window.openSharedDeleteModal === 'function') window.openSharedDeleteModal(checked.length); }
    else if(action === 'تغيير المستخدم') {
        const { value: nOwner } = await Swal.fire({ title: 'المستخدم الجديد', input: 'text', showCancelButton: true });
        if(nOwner?.trim()) { const batch = writeBatch(db); checked.forEach(id => batch.update(doc(db, "visits", id), { owner: nOwner.trim() })); await batch.commit(); document.querySelectorAll('.select-check').forEach(cb => cb.checked = false); Swal.fire('نجاح', 'تم التغيير', 'success'); }
    }
};

window.executeBulkDelete = async () => {
    if(!itemsToDelete.length) return;
    try { const batch = writeBatch(db); itemsToDelete.forEach(id => batch.delete(doc(db, "visits", id))); await batch.commit(); document.querySelectorAll('.select-check').forEach(c => c.checked=false); itemsToDelete=[]; Swal.fire('نجاح', 'تم الحذف', 'success'); } catch(e) { Swal.fire('خطأ', 'فشل', 'error'); }
};

window.importDataFromExcel = async json => {
    Swal.fire({ title: 'جاري الاستيراد...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try { const batch = writeBatch(db); const { date, time } = getFormattedDateTime(); json.forEach(r => batch.set(doc(db, "visits", 'visit_imp_'+Date.now()+Math.floor(Math.random()*10000)), { comp: r['الشركة']||r['comp']||'', address: r['العنوان']||r['address']||'', mgr: r['المسؤول']||r['mgr']||'', mob: String(r['رقم التواصل']||r['mob']||''), email: r['البريد الإلكتروني']||r['email']||'', record: r['السجل الرئيسي']||r['record']||'', visitDate: r['تاريخ الزيارة']||r['visitDate']||date, curServ: r['الخدمة']||r['curServ']||'', oppValue: String(r['القيمة']||r['oppValue']||''), notes: '[]', status: r['الحالة']||r['status']||'', editDate: `${date} ${time}`, owner: r['المستخدم']||r['owner']||'', products: [] })); await batch.commit(); Swal.fire('تم', 'تم الاستيراد بنجاح', 'success'); } catch(e) { Swal.fire('خطأ', 'فشل الاستيراد', 'error'); }
};

listenToVisits();