window.importDataFromExcel = function(rowsData) {
    let addedCount = 0;

    rowsData.forEach(row => {
        // إنشاء سطر جديد في جدولك
        if (typeof window.insertNewRow === 'function') {
            const newRow = window.insertNewRow(); // يفترض أن هذه الدالة ترجع السطر المنشأ أو تضيفه للـ DOM

            // تعبئة البيانات حسب اسم العمود في الإكسيل
            // خريطة أسماء الأعمدة المطابقة:
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
        el.dispatchEvent(new Event('change')); // إطلاق حدث التغيير لحفظ القيمة إذا لزم الأمر
    }
}