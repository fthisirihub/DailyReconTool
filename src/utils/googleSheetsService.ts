/**
 * Google Sheets Integration Service for Master Daily Inventory Tracker.
 * Directly reads and pushes targeted updates to specific columns (G, H, K, L)
 * in Google Sheets Tab "{tabName}" (e.g. Tab "14") without modifying formulas.
 */

export interface GoogleSheetsAuthConfig {
  accessToken?: string;
  webhookUrl?: string;
  userEmail?: string;
}

export interface SheetUpdateItem {
  itemName: string;
  value: number;
  unitCost?: number;
}

export interface SheetUpdateResult {
  success: boolean;
  updatedCells: number;
  message: string;
  details?: any;
}

/**
 * Extracts bare spreadsheet ID from URL or bare string.
 * Example: https://docs.google.com/spreadsheets/d/1eO7P0.../edit#gid=0 -> 1eO7P0...
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  // If it's a bare ID (typically 30-50 chars containing alphanumeric, dash, underscore)
  const bareMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (bareMatch) {
    return bareMatch[0];
  }
  return trimmed;
}

/**
 * Pushes targeted preview data to a specific column in Tab "{tabName}" of Google Sheet.
 * Column Targets:
 * - Module 1 Morning: Column G
 * - Module 1 Afternoon: Column H
 * - Module 2 POS Sales: Column K
 * - Module 3 Closing Stock: Column L
 */
export async function pushToGoogleSheetTab(
  sheetIdOrUrl: string,
  tabName: string | number,
  moduleType: 'morning' | 'afternoon' | 'pos_sales' | 'closing_stock',
  items: SheetUpdateItem[],
  authConfig: GoogleSheetsAuthConfig
): Promise<SheetUpdateResult> {
  const spreadsheetId = extractSpreadsheetId(sheetIdOrUrl);
  const targetTab = String(tabName).trim();

  if (!spreadsheetId) {
    throw new Error('Please provide a valid Google Sheet ID or URL.');
  }

  if (items.length === 0) {
    throw new Error('No items to push. Please upload a file to preview data first.');
  }

  // 1. Webhook mode (Google Apps Script Web App)
  if (authConfig.webhookUrl) {
    try {
      const response = await fetch(authConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId,
          tabName: targetTab,
          moduleType,
          column: getTargetColumnLetter(moduleType),
          items
        })
      });
      const data = await response.json();
      return {
        success: true,
        updatedCells: data.updatedCount || items.length,
        message: `Successfully updated ${data.updatedCount || items.length} rows in Tab "${targetTab}" via Apps Script!`
      };
    } catch (err: any) {
      throw new Error(`Google Apps Script error: ${err.message || 'Failed to connect'}`);
    }
  }

  // 2. Direct Google Sheets REST API v4 (requires OAuth accessToken)
  if (!authConfig.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  const token = authConfig.accessToken;
  const colLetter = getTargetColumnLetter(moduleType);

  // Step A: Fetch existing sheet metadata and values to find matching row numbers (up to row 150)
  const encodedRange = encodeURIComponent(`'${targetTab}'!A1:M150`);
  const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
  
  let sheetValues: any[][] = [];
  try {
    const res = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Google authorization token expired or insufficient permissions. Please reconnect your Google account.');
    }

    if (res.status === 404) {
      // Check if spreadsheet or tab is missing
      const checkDocRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (checkDocRes.ok) {
        const docData = await checkDocRes.json();
        const availableTabs = (docData.sheets || []).map((s: any) => `"${s.properties.title}"`).join(', ');
        throw new Error(`Tab "${targetTab}" does not exist in your spreadsheet. Available tabs in this workbook: ${availableTabs}. Please create Tab "${targetTab}" or select a matching tab.`);
      } else {
        throw new Error(`Spreadsheet with ID "${spreadsheetId}" not found. Please verify the Google Sheet URL or ID.`);
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Google Sheets API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    sheetValues = data.values || [];
  } catch (err: any) {
    throw err;
  }

  if (sheetValues.length === 0) {
    throw new Error(`Tab "${targetTab}" appears to be empty. Please ensure the Master Tracker table headers are present in Tab "${targetTab}".`);
  }

  // Step B: Build item to row mapping (1-indexed for sheets coordinates)
  // Look for Product's Name column (typically column D / index 3)
  let nameColIdx = 3;
  let headerRowIdx = 0;

  for (let r = 0; r < Math.min(10, sheetValues.length); r++) {
    const row = sheetValues[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] || '').toLowerCase().trim();
      if (s === "product's name" || s === "product name" || s === "item name" || s === "particulars" || s === "item description") {
        headerRowIdx = r;
        nameColIdx = c;
        break;
      }
    }
  }

  // Helper to normalize names for matching
  const cleanName = (str: string) => {
    return str
      .replace(/\[.*?\]/g, '') // remove SKU [MP001179]
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // remove special chars
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const rowMap: { original: string; normalized: string; rowNum: number }[] = [];
  for (let r = headerRowIdx + 1; r < sheetValues.length; r++) {
    const row = sheetValues[r];
    if (row && row[nameColIdx]) {
      const rawName = String(row[nameColIdx]).trim();
      if (rawName && !rawName.toLowerCase().includes('total') && !rawName.toLowerCase().includes('inventory summary')) {
        rowMap.push({
          original: rawName,
          normalized: cleanName(rawName),
          rowNum: r + 1 // 1-based row index
        });
      }
    }
  }

  // Step C: Build targeted update batch
  const valueRanges: { range: string; values: any[][] }[] = [];
  const matchedItems: string[] = [];
  const unmatchedItems: string[] = [];

  for (const item of items) {
    const targetClean = cleanName(item.itemName);
    
    // 1. Exact match on clean name
    let found = rowMap.find(m => m.normalized === targetClean);

    // 2. Contains match
    if (!found) {
      found = rowMap.find(m => m.normalized.includes(targetClean) || targetClean.includes(m.normalized));
    }

    // 3. Word-token overlap match (at least 2 significant words in common)
    if (!found) {
      const targetWords = targetClean.split(' ').filter(w => w.length > 2);
      found = rowMap.find(m => {
        const mWords = m.normalized.split(' ').filter(w => w.length > 2);
        const common = targetWords.filter(w => mWords.includes(w));
        return common.length >= Math.min(2, targetWords.length);
      });
    }

    if (found) {
      valueRanges.push({
        range: `'${targetTab}'!${colLetter}${found.rowNum}`,
        values: [[item.value]]
      });
      matchedItems.push(`${item.itemName} -> Row ${found.rowNum} (${found.original})`);
    } else {
      unmatchedItems.push(item.itemName);
    }
  }

  if (valueRanges.length === 0) {
    throw new Error(`None of the ${items.length} items matched product names in Column D of Tab "${targetTab}". Please ensure Tab "${targetTab}" contains matching products in Column D.`);
  }

  // Step D: Execute batchUpdate
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueRanges
    })
  });

  if (!batchRes.ok) {
    const errBody = await batchRes.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to update cells: HTTP ${batchRes.status}`);
  }

  const batchResult = await batchRes.json();
  const totalUpdated = batchResult.totalUpdatedCells || valueRanges.length;

  return {
    success: true,
    updatedCells: totalUpdated,
    message: `Successfully pushed ${valueRanges.length} items to Tab "${targetTab}" (Column ${colLetter}) in Google Sheet!`,
    details: { matchedItems, unmatchedItems }
  };
}

export function getTargetColumnLetter(moduleType: 'morning' | 'afternoon' | 'pos_sales' | 'closing_stock'): string {
  switch (moduleType) {
    case 'morning':
      return 'G';
    case 'afternoon':
      return 'H';
    case 'pos_sales':
      return 'K';
    case 'closing_stock':
      return 'L';
  }
}
