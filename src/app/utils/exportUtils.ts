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

export const exportToExcel = (data: InventoryBatch[], fileName: string, branchName?: string, userName?: string) => {
  // Group data by program
  const groupedData: { [key: string]: InventoryBatch[] } = {};
  data.forEach(item => {
    if (!groupedData[item.program]) {
      groupedData[item.program] = [];
    }
    groupedData[item.program].push(item);
  });

  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare worksheet data with merged cells
  const ws: any = {};
  
  // Set up the range
  let currentRow = 0;
  
  // Header section
  // Row 1: City Government + Form Number
  ws['A1'] = { t: 's', v: 'City Government of Baguio' };
  ws['K1'] = { t: 's', v: 'BGO.HSO.F.PHAR.009' };
  currentRow++;
  
  // Row 2: Health Services Office
  ws['A2'] = { t: 's', v: 'HEALTH SERVICES OFFICE' };
  currentRow++;
  
  // Row 3: Report Title
  ws['A3'] = { t: 's', v: 'PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION' };
  currentRow++;
  
  // Row 4: Branch Name (if provided)
  if (branchName) {
    currentRow++;
    ws[`A${currentRow}`] = { t: 's', v: `Branch: ${branchName}` };
  }
  
  // Row 5: User Name (if provided)
  if (userName) {
    currentRow++;
    ws[`A${currentRow}`] = { t: 's', v: `Prepared by: ${userName}` };
  }
  
  // Blank row
  currentRow++;
  
  // Column headers - Row 1 (merged headers)
  const headerRow1 = currentRow + 1;
  ws[`A${headerRow1}`] = { t: 's', v: 'NAME AND DESCRIPTION' };
  ws[`B${headerRow1}`] = { t: 's', v: 'INVENTORY' };
  ws[`E${headerRow1}`] = { t: 's', v: 'ITEMS RECEIVED DURING THE QUARTER(July-Sept 2025)' };
  ws[`H${headerRow1}`] = { t: 's', v: 'ITEMS DISPENSED DURING THE QUARTER(July-Sept 2025)' };
  ws[`L${headerRow1}`] = { t: 's', v: 'Remarks' };
  ws[`M${headerRow1}`] = { t: 's', v: '% Utilization' };
  currentRow++;
  
  // Column headers - Row 2 (sub-headers)
  const headerRow2 = currentRow + 1;
  ws[`B${headerRow2}`] = { t: 's', v: 'BEGINNING' };
  ws[`C${headerRow2}`] = { t: 's', v: 'UNIT' };
  ws[`D${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`E${headerRow2}`] = { t: 's', v: 'DATE RECEIVED' };
  ws[`F${headerRow2}`] = { t: 's', v: 'UNIT COST' };
  ws[`G${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`H${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`I${headerRow2}`] = { t: 's', v: 'EXPIRATION DATE' };
  ws[`J${headerRow2}`] = { t: 's', v: 'STOCK ON HAND' };
  ws[`K${headerRow2}`] = { t: 's', v: 'EXPIRED' };
  currentRow++;
  
  // Add data rows grouped by program
  let dataStartRow = currentRow + 1;
  Object.keys(groupedData).forEach((program) => {
    // Add program header row
    const programRow = currentRow + 1;
    ws[`A${programRow}`] = { t: 's', v: program };
    currentRow++;
    
    // Add items in this program
    groupedData[program].forEach((item) => {
      const row = currentRow + 1;
      const totalInventory = item.beginningInventory + item.quantityReceived;
      const stockOnHand = totalInventory - item.quantityDispensed;
      const utilization = totalInventory > 0 ? Math.min((item.quantityDispensed / totalInventory) * 100, 100) : 0;
      const isExpired = new Date(item.expirationDate) < new Date();
      
      ws[`A${row}`] = { t: 's', v: `${item.drugName} ${item.dosage}` };
      ws[`B${row}`] = { t: 'n', v: item.beginningInventory };
      ws[`C${row}`] = { t: 's', v: item.unit };
      ws[`D${row}`] = { t: 'n', v: item.quantityReceived };
      ws[`E${row}`] = { t: 's', v: format(new Date(item.dateReceived), 'M/d/yyyy') };
      ws[`F${row}`] = { t: 'n', v: item.unitCost, z: '0.00' };
      ws[`G${row}`] = { t: 'n', v: item.quantityReceived };
      ws[`H${row}`] = { t: 'n', v: item.quantityDispensed };
      ws[`I${row}`] = { t: 's', v: format(new Date(item.expirationDate), 'M/d/yyyy') };
      ws[`J${row}`] = { t: 'n', v: stockOnHand };
      ws[`K${row}`] = { t: 'n', v: isExpired ? stockOnHand : 0 };
      ws[`L${row}`] = { t: 's', v: item.remarks || '' };
      ws[`M${row}`] = { t: 's', v: `${utilization.toFixed(0)}%` };
      currentRow++;
    });
  });
  
  // Define the range of the worksheet
  const range = {
    s: { c: 0, r: 0 }, // Start: A1
    e: { c: 12, r: currentRow } // End: M + last row
  };
  ws['!ref'] = XLSX.utils.encode_range(range);
  
  // Merge cells
  const merges = [
    // Header merges
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // City Government line
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Health Services Office
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } }, // Title
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } }, // Branch Name
    { s: { r: 4, c: 0 }, e: { r: 4, c: 12 } }, // Prepared By
    
    // Column header merges (adjusted for new rows)
    { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }, // NAME AND DESCRIPTION
    { s: { r: 7, c: 1 }, e: { r: 7, c: 3 } }, // INVENTORY
    { s: { r: 7, c: 4 }, e: { r: 7, c: 6 } }, // ITEMS RECEIVED...
    { s: { r: 7, c: 7 }, e: { r: 7, c: 10 } }, // ITEMS DISPENSED...
    { s: { r: 7, c: 11 }, e: { r: 8, c: 11 } }, // Remarks
    { s: { r: 7, c: 12 }, e: { r: 8, c: 12 } }, // % Utilization
  ];
  
  ws['!merges'] = merges;
  
  // Set column widths
  ws['!cols'] = [
    { wch: 35 }, // NAME AND DESCRIPTION
    { wch: 12 }, // BEGINNING
    { wch: 10 }, // UNIT
    { wch: 8 },  // QTY
    { wch: 14 }, // DATE RECEIVED
    { wch: 12 }, // UNIT COST
    { wch: 8 },  // QTY
    { wch: 8 },  // QTY (dispensed)
    { wch: 16 }, // EXPIRATION DATE
    { wch: 14 }, // STOCK ON HAND
    { wch: 10 }, // EXPIRED
    { wch: 15 }, // Remarks
    { wch: 14 }  // % Utilization
  ];
  
  // Apply styles using cell objects
  // Header styles (bold, centered)
  ['A1', 'A2', 'A3', 'A4', 'A5', 'K1'].forEach(cell => {
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
  });
  
  // Column header styles
  for (let col = 0; col < 13; col++) {
    const cell1 = XLSX.utils.encode_cell({ r: 7, c: col });
    const cell2 = XLSX.utils.encode_cell({ r: 8, c: col });
    
    if (ws[cell1]) {
      ws[cell1].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { fgColor: { rgb: 'E0E0E0' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
    
    if (ws[cell2]) {
      ws[cell2].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'E0E0E0' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'DOH Physical Inventory');
  
  // Save file
  XLSX.writeFile(wb, `DOH_Physical_Inventory_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportToPDF = (data: InventoryBatch[], fileName: string, title: string) => {
  const doc = new jsPDF('landscape'); // Landscape is better for this many columns
  
  // Official Header
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('City Government of Baguio', 148, 15, { align: 'center' });
  doc.text('HEALTH SERVICES OFFICE', 148, 20, { align: 'center' });
  
  doc.setFontSize(8);
  doc.text('BGO.HSO.F.PHAR.009', 280, 15, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION', 148, 30, { align: 'center' });
  
  const tableData = data.map(item => {
    const totalInventory = item.beginningInventory + item.quantityReceived;
    const stockOnHand = totalInventory - item.quantityDispensed;
    const utilization = totalInventory > 0 ? Math.min((item.quantityDispensed / totalInventory) * 100, 100) : 0;
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
      `${utilization.toFixed(0)}%`
    ];
  });

  doc.autoTable({
    startY: 40,
    head: [[
      'NAME AND DESCRIPTION', 'BEGINNING', 'UNIT', 'RECEIVED', 'DATE REC.', 
      'COST', 'DISPENSED', 'EXPIRY', 'SOH', 'EXPIRED', 'REMARKS', '% UTIL'
    ]],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
    bodyStyles: { lineWidth: 0.1 },
    theme: 'grid',
    margin: { top: 40, left: 10, right: 10 }
  });

  doc.save(`DOH_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Generate Excel report with branch info (returns Blob for admin downloading branch reports)
export const generateExcelReportWithBranchInfo = (
  data: InventoryBatch[], 
  branchName: string, 
  userName: string,
  userId: string
): Blob => {
  // Group data by program
  const groupedData: { [key: string]: InventoryBatch[] } = {};
  data.forEach(item => {
    if (!groupedData[item.program]) {
      groupedData[item.program] = [];
    }
    groupedData[item.program].push(item);
  });

  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare worksheet data with merged cells
  const ws: any = {};
  
  // Set up the range
  let currentRow = 0;
  
  // Header section
  // Row 1: City Government + Form Number - REMOVE Form Number
  ws['A1'] = { t: 's', v: 'City Government of Baguio' };
  // ws['K1'] = { t: 's', v: 'BGO.HSO.F.PHAR.009' }; // REMOVED
  currentRow++;
  
  // Row 2: Health Services Office - REMOVED
  // ws['A2'] = { t: 's', v: 'HEALTH SERVICES OFFICE' }; // REMOVED
  // currentRow++;
  
  // Row 3 -> Row 2: Report Title
  ws['A2'] = { t: 's', v: 'PHYSICAL INVENTORY REPORT FORM-DOH AUGMENTATION/DONATION' };
  currentRow++;
  
  // Row 4 -> Row 3: Branch Name
  ws['A3'] = { t: 's', v: `Branch: ${branchName}` };
  currentRow++;
  
  // Row 5 -> Row 4: Prepared By
  ws['A4'] = { t: 's', v: `Prepared By: ${userName}` };
  currentRow++;
  
  // Row 6 -> Row 5: User ID
  ws['A5'] = { t: 's', v: `User ID: ${userId}` };
  currentRow++;
  
  // Blank row
  currentRow++;
  
  // Column headers - Row 1 (merged headers)
  const headerRow1 = currentRow + 1;
  ws[`A${headerRow1}`] = { t: 's', v: 'NAME AND DESCRIPTION' };
  ws[`B${headerRow1}`] = { t: 's', v: 'INVENTORY' };
  ws[`E${headerRow1}`] = { t: 's', v: `ITEMS RECEIVED - ${branchName}` }; // Changed from QUARTER
  ws[`H${headerRow1}`] = { t: 's', v: `ITEMS DISPENSED - ${branchName}` }; // Changed from QUARTER
  ws[`L${headerRow1}`] = { t: 's', v: 'Remarks' };
  ws[`M${headerRow1}`] = { t: 's', v: '% Utilization' };
  currentRow++;
  
  // Column headers - Row 2 (sub-headers)
  const headerRow2 = currentRow + 1;
  ws[`B${headerRow2}`] = { t: 's', v: 'BEGINNING' };
  ws[`C${headerRow2}`] = { t: 's', v: 'UNIT' };
  ws[`D${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`E${headerRow2}`] = { t: 's', v: 'DATE RECEIVED' };
  ws[`F${headerRow2}`] = { t: 's', v: 'UNIT COST' };
  ws[`G${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`H${headerRow2}`] = { t: 's', v: 'QTY' };
  ws[`I${headerRow2}`] = { t: 's', v: 'EXPIRATION DATE' };
  ws[`J${headerRow2}`] = { t: 's', v: 'STOCK ON HAND' };
  ws[`K${headerRow2}`] = { t: 's', v: 'EXPIRED' };
  currentRow++;
  
  // Add data rows grouped by program
  let dataStartRow = currentRow + 1;
  Object.keys(groupedData).forEach((program) => {
    // Add program header row
    const programRow = currentRow + 1;
    ws[`A${programRow}`] = { t: 's', v: program };
    currentRow++;
    
    // Add items in this program
    groupedData[program].forEach((item) => {
      const row = currentRow + 1;
      const totalInventory = item.beginningInventory + item.quantityReceived;
      const stockOnHand = totalInventory - item.quantityDispensed;
      const utilization = totalInventory > 0 ? Math.min((item.quantityDispensed / totalInventory) * 100, 100) : 0;
      const isExpired = new Date(item.expirationDate) < new Date();
      
      ws[`A${row}`] = { t: 's', v: `${item.drugName} ${item.dosage}` };
      ws[`B${row}`] = { t: 'n', v: item.beginningInventory };
      ws[`C${row}`] = { t: 's', v: item.unit };
      ws[`D${row}`] = { t: 'n', v: item.quantityReceived };
      ws[`E${row}`] = { t: 's', v: format(new Date(item.dateReceived), 'M/d/yyyy') };
      ws[`F${row}`] = { t: 'n', v: item.unitCost, z: '0.00' };
      ws[`G${row}`] = { t: 'n', v: item.quantityReceived };
      ws[`H${row}`] = { t: 'n', v: item.quantityDispensed };
      ws[`I${row}`] = { t: 's', v: format(new Date(item.expirationDate), 'M/d/yyyy') };
      ws[`J${row}`] = { t: 'n', v: stockOnHand };
      ws[`K${row}`] = { t: 'n', v: isExpired ? stockOnHand : 0 };
      ws[`L${row}`] = { t: 's', v: item.remarks || '' };
      ws[`M${row}`] = { t: 's', v: `${utilization.toFixed(0)}%` };
      currentRow++;
    });
  });
  
  // Define the range of the worksheet
  const range = {
    s: { c: 0, r: 0 }, // Start: A1
    e: { c: 12, r: currentRow } // End: M + last row
  };
  ws['!ref'] = XLSX.utils.encode_range(range);
  
  // Merge cells
  const merges = [
    // Header merges (adjusted for removed rows)
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // City Government line
    // Row 1 (Health Services Office) REMOVED
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }, // Title (was row 3, now row 2)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } }, // Branch Name (was row 4, now row 3)
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } }, // Prepared By (was row 5, now row 4)
    { s: { r: 4, c: 0 }, e: { r: 4, c: 12 } }, // User ID (was row 6, now row 5)
    
    // Column header merges (adjusted for new rows - starting at row 7, since we removed 2 header rows)
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // NAME AND DESCRIPTION
    { s: { r: 6, c: 1 }, e: { r: 6, c: 3 } }, // INVENTORY
    { s: { r: 6, c: 4 }, e: { r: 6, c: 6 } }, // ITEMS RECEIVED...
    { s: { r: 6, c: 7 }, e: { r: 6, c: 10 } }, // ITEMS DISPENSED...
    { s: { r: 6, c: 11 }, e: { r: 7, c: 11 } }, // Remarks
    { s: { r: 6, c: 12 }, e: { r: 7, c: 12 } }, // % Utilization
  ];
  
  ws['!merges'] = merges;
  
  // Set column widths
  ws['!cols'] = [
    { wch: 35 }, // NAME AND DESCRIPTION
    { wch: 12 }, // BEGINNING
    { wch: 10 }, // UNIT
    { wch: 8 },  // QTY
    { wch: 14 }, // DATE RECEIVED
    { wch: 12 }, // UNIT COST
    { wch: 8 },  // QTY
    { wch: 8 },  // QTY (dispensed)
    { wch: 16 }, // EXPIRATION DATE
    { wch: 14 }, // STOCK ON HAND
    { wch: 10 }, // EXPIRED
    { wch: 15 }, // Remarks
    { wch: 14 }  // % Utilization
  ];
  
  // Apply styles using cell objects
  // Header styles (bold, centered)
  ['A1', 'A2', 'A3', 'A4', 'A5', 'K1'].forEach(cell => {
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
  });
  
  // Column header styles
  for (let col = 0; col < 13; col++) {
    const cell1 = XLSX.utils.encode_cell({ r: 7, c: col });
    const cell2 = XLSX.utils.encode_cell({ r: 8, c: col });
    
    if (ws[cell1]) {
      ws[cell1].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { fgColor: { rgb: 'E0E0E0' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
    
    if (ws[cell2]) {
      ws[cell2].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'E0E0E0' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'DOH Physical Inventory');
  
  // Write to buffer and return as Blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};