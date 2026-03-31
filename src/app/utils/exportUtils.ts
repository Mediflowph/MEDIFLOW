import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { InventoryBatch } from '@/app/types/inventory';
import { format } from 'date-fns';

// Extend jsPDF with autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

/**
 * Build the DOH Physical Inventory worksheet.
 * Structure (1-indexed rows):
 *   1  : City Government of Baguio (A) | BGO.HSO.F.PHAR.009 (K)
 *   2  : HEALTH SERVICES OFFICE
 *   3  : PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION
 *   4  : Branch info (optional)
 *   5  : Prepared-by info (optional)
 *   6  : (blank)
 *   7  : Column-group headers (NAME AND DESCRIPTION | INVENTORY | ITEMS RECEIVED | ITEMS DISPENSED | Remarks | % Util)
 *   8  : Column sub-headers (BEGINNING | UNIT | QTY | DATE RECEIVED | UNIT COST | QTY | QTY | EXPIRATION DATE | STOCK ON HAND | EXPIRED)
 *   9+ : Program group + data rows
 */
function buildDOHWorksheet(
  data: InventoryBatch[],
  branchName?: string,
  userName?: string,
): any {
  const ws: any = {};

  /* ── Fixed header rows ─────────────────────────────────────── */
  ws['A1'] = { t: 's', v: 'City Government of Baguio' };
  ws['K1'] = { t: 's', v: 'BGO.HSO.F.PHAR.009' };
  ws['A2'] = { t: 's', v: 'HEALTH SERVICES OFFICE' };
  ws['A3'] = { t: 's', v: 'PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION' };

  // Optional branch / prepared-by rows (rows 4 & 5)
  let infoRowCount = 0;
  if (branchName) {
    infoRowCount++;
    ws[`A${3 + infoRowCount}`] = { t: 's', v: `Branch: ${branchName}` };
  }
  if (userName) {
    infoRowCount++;
    ws[`A${3 + infoRowCount}`] = { t: 's', v: `Prepared By: ${userName}` };
  }

  // Row 6 (or 4/5 if no info rows) is always blank; column headers at 7 & 8
  const COL_HEADER_ROW1 = 7; // 1-indexed
  const COL_HEADER_ROW2 = 8; // 1-indexed

  /* ── Column group headers (row 7) ─────────────────────────── */
  ws[`A${COL_HEADER_ROW1}`] = { t: 's', v: 'NAME AND DESCRIPTION' };
  ws[`B${COL_HEADER_ROW1}`] = { t: 's', v: 'INVENTORY' };
  ws[`E${COL_HEADER_ROW1}`] = { t: 's', v: 'ITEMS RECEIVED DURING THE QUARTER' };
  ws[`H${COL_HEADER_ROW1}`] = { t: 's', v: 'ITEMS DISPENSED DURING THE QUARTER' };
  ws[`L${COL_HEADER_ROW1}`] = { t: 's', v: 'Remarks' };
  ws[`M${COL_HEADER_ROW1}`] = { t: 's', v: '% Utilization' };

  /* ── Column sub-headers (row 8) ───────────────────────────── */
  ws[`B${COL_HEADER_ROW2}`] = { t: 's', v: 'BEGINNING' };
  ws[`C${COL_HEADER_ROW2}`] = { t: 's', v: 'UNIT' };
  ws[`D${COL_HEADER_ROW2}`] = { t: 's', v: 'QTY' };
  ws[`E${COL_HEADER_ROW2}`] = { t: 's', v: 'DATE RECEIVED' };
  ws[`F${COL_HEADER_ROW2}`] = { t: 's', v: 'UNIT COST' };
  ws[`G${COL_HEADER_ROW2}`] = { t: 's', v: 'QTY' };
  ws[`H${COL_HEADER_ROW2}`] = { t: 's', v: 'QTY' };
  ws[`I${COL_HEADER_ROW2}`] = { t: 's', v: 'EXPIRATION DATE' };
  ws[`J${COL_HEADER_ROW2}`] = { t: 's', v: 'STOCK ON HAND' };
  ws[`K${COL_HEADER_ROW2}`] = { t: 's', v: 'EXPIRED' };

  /* ── Data rows ─────────────────────────────────────────────── */
  // Group by program, sorted A→Z
  const grouped: { [key: string]: InventoryBatch[] } = {};
  data.forEach(item => {
    const prog = item.program || 'General';
    if (!grouped[prog]) grouped[prog] = [];
    grouped[prog].push(item);
  });

  let currentRow = COL_HEADER_ROW2; // last header row (1-indexed)

  // Sort programs A→Z, and items within each program A→Z by drugName
  const sortedPrograms = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  sortedPrograms.forEach(program => {
    const sortedItems = grouped[program].slice().sort((a, b) => a.drugName.localeCompare(b.drugName));
    // Program group row
    currentRow++;
    ws[`A${currentRow}`] = { t: 's', v: program };

    // Item rows
    sortedItems.forEach(item => {
      currentRow++;
      const stockOnHand =
        item.beginningInventory + item.quantityReceived - item.quantityDispensed;
      const totalIn = item.beginningInventory + item.quantityReceived;
      const utilization =
        totalIn > 0 ? Math.min((item.quantityDispensed / totalIn) * 100, 100) : 0;
      const isExpired = item.expirationDate
        ? new Date(item.expirationDate) < new Date()
        : false;

      const safeDate = (d: string) => {
        try {
          return d ? format(new Date(d), 'M/d/yyyy') : '';
        } catch {
          return d || '';
        }
      };

      ws[`A${currentRow}`] = {
        t: 's',
        v: [item.drugName, item.dosage].filter(Boolean).join(' '),
      };
      ws[`B${currentRow}`] = { t: 'n', v: item.beginningInventory };
      ws[`C${currentRow}`] = { t: 's', v: item.unit || 'units' };
      ws[`D${currentRow}`] = { t: 'n', v: item.quantityReceived };
      ws[`E${currentRow}`] = { t: 's', v: safeDate(item.dateReceived) };
      ws[`F${currentRow}`] = { t: 'n', v: item.unitCost, z: '0.00' };
      ws[`G${currentRow}`] = { t: 'n', v: item.quantityReceived };
      ws[`H${currentRow}`] = { t: 'n', v: item.quantityDispensed };
      ws[`I${currentRow}`] = { t: 's', v: safeDate(item.expirationDate) };
      ws[`J${currentRow}`] = { t: 'n', v: stockOnHand };
      ws[`K${currentRow}`] = { t: 'n', v: isExpired ? stockOnHand : 0 };
      ws[`L${currentRow}`] = { t: 's', v: item.remarks || '' };
      ws[`M${currentRow}`] = { t: 's', v: `${utilization.toFixed(0)}%` };
    });
  });

  /* ── Worksheet range ──────────────────────────────────────── */
  ws['!ref'] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: 12, r: currentRow - 1 }, // 0-indexed
  });

  /* ── Merges (all 0-indexed) ───────────────────────────────── */
  const r7 = COL_HEADER_ROW1 - 1; // 0-indexed = 6
  const r8 = COL_HEADER_ROW2 - 1; // 0-indexed = 7

  ws['!merges'] = [
    // Fixed header rows
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },  // City Government (A1:J1)
    { s: { r: 0, c: 10 }, e: { r: 0, c: 12 } }, // BGO.HSO.F.PHAR.009 (K1:M1)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },  // HEALTH SERVICES OFFICE
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },  // Title
    // Optional info rows
    ...(branchName ? [{ s: { r: 3, c: 0 }, e: { r: 3, c: 12 } }] : []),
    ...(userName
      ? [{ s: { r: 3 + (branchName ? 1 : 0), c: 0 }, e: { r: 3 + (branchName ? 1 : 0), c: 12 } }]
      : []),
    // Column group headers
    { s: { r: r7, c: 0 }, e: { r: r8, c: 0 } },   // NAME AND DESCRIPTION (spans 2 rows)
    { s: { r: r7, c: 1 }, e: { r: r7, c: 3 } },   // INVENTORY
    { s: { r: r7, c: 4 }, e: { r: r7, c: 6 } },   // ITEMS RECEIVED
    { s: { r: r7, c: 7 }, e: { r: r7, c: 10 } },  // ITEMS DISPENSED
    { s: { r: r7, c: 11 }, e: { r: r8, c: 11 } }, // Remarks (spans 2 rows)
    { s: { r: r7, c: 12 }, e: { r: r8, c: 12 } }, // % Utilization (spans 2 rows)
  ];

  /* ── Column widths ────────────────────────────────────────── */
  ws['!cols'] = [
    { wch: 38 }, // A: NAME AND DESCRIPTION
    { wch: 12 }, // B: BEGINNING
    { wch: 8 },  // C: UNIT
    { wch: 8 },  // D: QTY (received)
    { wch: 14 }, // E: DATE RECEIVED
    { wch: 12 }, // F: UNIT COST
    { wch: 8 },  // G: QTY
    { wch: 8 },  // H: QTY (dispensed)
    { wch: 16 }, // I: EXPIRATION DATE
    { wch: 14 }, // J: STOCK ON HAND
    { wch: 10 }, // K: EXPIRED
    { wch: 18 }, // L: Remarks
    { wch: 14 }, // M: % Utilization
  ];

  /* ── Row heights ──────────────────────────────────────────── */
  ws['!rows'] = [];
  ws['!rows'][r7] = { hpt: 36 }; // taller header rows
  ws['!rows'][r8] = { hpt: 28 };

  /* ── Styles ───────────────────────────────────────────────── */
  // Title / info cells (rows 1-5)
  const titleCells = ['A1', 'K1', 'A2', 'A3'];
  if (branchName) titleCells.push('A4');
  if (userName) titleCells.push(`A${3 + infoRowCount}`);
  titleCells.forEach(addr => {
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };
    }
  });

  // Column header group row (row 7, 0-indexed r7)
  for (let col = 0; col < 13; col++) {
    const addr = XLSX.utils.encode_cell({ r: r7, c: col });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    }
  }

  // Column sub-header row (row 8, 0-indexed r8)
  for (let col = 0; col < 13; col++) {
    const addr = XLSX.utils.encode_cell({ r: r8, c: col });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, sz: 9 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'E8E8E8' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    }
  }

  // Data rows - add borders and alternating background
  const dataStartRow = COL_HEADER_ROW2; // data starts after sub-header (1-indexed)
  for (let r = dataStartRow; r < currentRow; r++) {
    const isGroupHeader =
      ws[`A${r + 1}`] &&
      ws[`A${r + 1}`].t === 's' &&
      !ws[`B${r + 1}`]; // group rows only have col A

    for (let col = 0; col < 13; col++) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      if (ws[addr]) {
        ws[addr].s = {
          font: isGroupHeader ? { bold: true, italic: true, sz: 9 } : { sz: 9 },
          alignment: {
            horizontal: col === 0 ? 'left' : 'center',
            vertical: 'center',
          },
          fill: isGroupHeader
            ? { patternType: 'solid', fgColor: { rgb: 'F5F0FB' } }
            : { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } },
          },
        };
      }
    }
  }

  return ws;
}

/** Export current branch inventory to Excel (for Pharmacy Staff) */
export const exportToExcel = (
  data: InventoryBatch[],
  fileName: string,
  branchName?: string,
  userName?: string,
) => {
  const wb = XLSX.utils.book_new();
  const ws = buildDOHWorksheet(data, branchName, userName);
  XLSX.utils.book_append_sheet(wb, ws, 'DOH Physical Inventory');
  XLSX.writeFile(
    wb,
    `DOH_Physical_Inventory_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
  );
};

/** Generate Excel for a specific branch and return as Blob (for Admin download) */
export const generateExcelReportWithBranchInfo = (
  data: InventoryBatch[],
  branchName: string,
  userName: string,
  _userId?: string, // kept for API compatibility but not used in the file
): Blob => {
  const wb = XLSX.utils.book_new();
  const ws = buildDOHWorksheet(data, branchName, userName);
  XLSX.utils.book_append_sheet(wb, ws, 'DOH Physical Inventory');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

export const exportToPDF = (data: InventoryBatch[], fileName: string, title: string) => {
  const doc = new jsPDF('landscape');
  doc.setFontSize(10);
  doc.text('City Government of Baguio', 148, 12, { align: 'center' });
  doc.text('HEALTH SERVICES OFFICE', 148, 18, { align: 'center' });
  doc.setFontSize(8);
  doc.text('BGO.HSO.F.PHAR.009', 280, 12, { align: 'right' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(
    'PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION',
    148,
    27,
    { align: 'center' },
  );

  const tableData = data.map(item => {
    const stockOnHand =
      item.beginningInventory + item.quantityReceived - item.quantityDispensed;
    const totalIn = item.beginningInventory + item.quantityReceived;
    const utilization =
      totalIn > 0 ? Math.min((item.quantityDispensed / totalIn) * 100, 100) : 0;
    const isExpired = new Date(item.expirationDate) < new Date();
    return [
      `${item.program}\n${item.drugName} ${item.dosage}`,
      item.beginningInventory,
      item.unit,
      item.quantityReceived,
      item.dateReceived,
      item.unitCost.toFixed(2),
      item.quantityDispensed,
      format(new Date(item.expirationDate), 'MM/dd/yy'),
      stockOnHand,
      isExpired ? stockOnHand : 0,
      item.remarks || '',
      `${utilization.toFixed(0)}%`,
    ];
  });

  doc.autoTable({
    startY: 35,
    head: [[
      'NAME AND DESCRIPTION', 'BEGINNING', 'UNIT', 'QTY REC.',
      'DATE REC.', 'COST', 'QTY DISP.', 'EXPIRY', 'SOH', 'EXPIRED', 'REMARKS', '% UTIL',
    ]],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [217, 217, 217],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
    },
    bodyStyles: { lineWidth: 0.1 },
    theme: 'grid',
    margin: { top: 35, left: 8, right: 8 },
  });

  doc.save(`DOH_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};