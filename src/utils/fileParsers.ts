import * as XLSX from 'xlsx';
import { PosSaleItem } from '../data/sampleData';
import { matchToMasterItem } from './pdfParser';

/**
 * Parses uploaded POS Sales Excel (.xlsx, .xls) or CSV file.
 * Returns detected dates and extracts sales items for the selected day or date.
 */
export function parsePosSalesWorkbook(
  arrayBuffer: ArrayBuffer,
  targetDayOrDate: number | string,
  masterNames: string[] = []
): { dates: string[]; items: PosSaleItem[] } {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rawRows || rawRows.length < 4) {
    return { dates: [], items: [] };
  }

  // 1. Detect row with date headers
  let dateRowIdx = -1;
  const datePattern = /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    for (let c = 0; c < row.length; c++) {
      if (datePattern.test(String(row[c] || '').trim())) {
        dateRowIdx = r;
        break;
      }
    }
    if (dateRowIdx !== -1) break;
  }

  if (dateRowIdx === -1) {
    dateRowIdx = 2; // Default based on sample format
  }

  const dateRow = rawRows[dateRowIdx] || [];
  const subHeaderRow = rawRows[dateRowIdx + 1] || [];

  // Map each date to its columns: { [dateStr]: { orderCol, qtyCol, priceCol } }
  const dateColMap: Record<string, { orderCol: number; qtyCol: number; priceCol: number }> = {};
  const detectedDates: string[] = [];

  let currentDate = '';
  for (let c = 0; c < dateRow.length; c++) {
    const cellVal = String(dateRow[c] || '').trim();
    if (cellVal && (datePattern.test(cellVal) || cellVal.includes('2026') || cellVal.includes('2025'))) {
      currentDate = cellVal;
      if (!detectedDates.includes(currentDate)) {
        detectedDates.push(currentDate);
      }
      if (!dateColMap[currentDate]) {
        dateColMap[currentDate] = { orderCol: c, qtyCol: c + 1, priceCol: c + 2 };
      }
    }

    if (currentDate && dateColMap[currentDate]) {
      const subVal = String(subHeaderRow[c] || '').toLowerCase().trim();
      if (subVal.includes('quantity') || subVal.includes('qty')) {
        dateColMap[currentDate].qtyCol = c;
      } else if (subVal.includes('price') || subVal.includes('amount') || subVal.includes('total')) {
        dateColMap[currentDate].priceCol = c;
      } else if (subVal.includes('order')) {
        dateColMap[currentDate].orderCol = c;
      }
    }
  }

  // 2. Identify the matching date column for targetDayOrDate
  let chosenDate = '';
  const dayNum = typeof targetDayOrDate === 'number' ? targetDayOrDate : parseInt(String(targetDayOrDate), 10);
  const targetStr = String(targetDayOrDate).trim().toLowerCase();

  // Try matching by exact string or day number (e.g. Day 10 -> "10 Nov 2026")
  for (const d of detectedDates) {
    const dLower = d.toLowerCase();
    if (dLower === targetStr || dLower.includes(targetStr)) {
      chosenDate = d;
      break;
    }
    if (!isNaN(dayNum)) {
      const matchDay = d.match(/^0?(\d{1,2})\b/);
      if (matchDay && parseInt(matchDay[1], 10) === dayNum) {
        chosenDate = d;
        break;
      }
    }
  }

  if (!chosenDate && detectedDates.length > 0) {
    chosenDate = detectedDates[0];
  }

  const targetCols = chosenDate ? dateColMap[chosenDate] : null;
  const items: PosSaleItem[] = [];

  if (targetCols) {
    let currentCategory = 'General';
    const startRow = dateRowIdx + 2;

    for (let r = startRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      let firstCol = String(row[0] || '').trim();
      if (!firstCol && row.length > 1) {
        firstCol = String(row[1] || '').trim();
      }

      if (!firstCol || firstCol.toLowerCase() === 'total') continue;

      // Check if Category line (e.g. All / Saleable / Fish)
      if (firstCol.toLowerCase().includes('all / saleable /') || firstCol.endsWith('Total')) {
        currentCategory = firstCol.replace(/All\s*\/\s*Saleable\s*\/\s*/i, '').trim();
        continue;
      }

      // Check if item SKU line e.g. [MP004091] White Eggs (6pc)
      let sku = '';
      let cleanName = firstCol;
      const skuMatch = firstCol.match(/\[(.*?)\]\s*(.*)/);
      if (skuMatch) {
        sku = skuMatch[1].trim();
        cleanName = skuMatch[2].trim();
      }

      const qtyVal = parseFloat(String(row[targetCols.qtyCol] || '0').replace(/,/g, '')) || 0;
      const priceVal = parseFloat(String(row[targetCols.priceCol] || '0').replace(/,/g, '')) || 0;

      // Extract item if it has sales on this day (or if it's an active SKU)
      if (qtyVal > 0 || priceVal > 0) {
        const mappedName = matchToMasterItem(cleanName, masterNames);

        items.push({
          sku: sku || `SKU-${items.length + 1}`,
          posName: cleanName,
          category: currentCategory,
          quantitySold: Number(qtyVal.toFixed(3)),
          totalPrice: Number(priceVal.toFixed(2)),
          mappedMasterName: mappedName,
          approved: true,
        });
      }
    }
  }

  return { dates: detectedDates, items };
}

/**
 * Parses uploaded Closing Stock Excel (.xlsx, .xls) or CSV file.
 * Returns closing map: { [itemName]: closingCount } for the selected day or date.
 */
export function parseClosingStockWorkbook(
  arrayBuffer: ArrayBuffer,
  targetDayOrDate: number | string
): { dateHeaders: string[]; closingMap: Record<string, number> } {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rawRows || rawRows.length < 2) {
    return { dateHeaders: [], closingMap: {} };
  }

  const headerRow = rawRows[0] || [];
  const dateHeaders: string[] = [];

  for (let c = 1; c < headerRow.length; c++) {
    const val = String(headerRow[c] || '').trim();
    if (val && val !== 'Total' && val !== 'Category') {
      dateHeaders.push(val);
    }
  }

  // Find target column index
  const dayNum = typeof targetDayOrDate === 'number' ? targetDayOrDate : parseInt(String(targetDayOrDate), 10);
  const targetStr = String(targetDayOrDate).trim().toLowerCase();

  let targetColIdx = -1;

  // 1. Direct match with targetStr (e.g. "10-11")
  for (let c = 1; c < headerRow.length; c++) {
    const val = String(headerRow[c] || '').trim().toLowerCase();
    if (val === targetStr || val.startsWith(targetStr + '-') || val.startsWith(targetStr + '/')) {
      targetColIdx = c;
      break;
    }
  }

  // 2. Match with dayNum (e.g. day 10 matches "10-11")
  if (targetColIdx === -1 && !isNaN(dayNum)) {
    for (let c = 1; c < headerRow.length; c++) {
      const val = String(headerRow[c] || '').trim();
      const matchDay = val.match(/^(\d{1,2})/);
      if (matchDay && parseInt(matchDay[1], 10) === dayNum) {
        targetColIdx = c;
        break;
      }
    }
  }

  if (targetColIdx === -1 && headerRow.length > 1) {
    targetColIdx = 1; // Fallback to first date column
  }

  const closingMap: Record<string, number> = {};

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const itemName = String(row[0] || '').trim();
    if (!itemName || ['MEAT', 'FISH', 'EGGS', 'Marinates', 'Total', 'Category'].includes(itemName)) {
      continue;
    }

    const valStr = String(row[targetColIdx] || '0').replace(/,/g, '').trim();
    const count = parseFloat(valStr) || 0;
    closingMap[itemName] = Number(count.toFixed(3));
  }

  return { dateHeaders, closingMap };
}
