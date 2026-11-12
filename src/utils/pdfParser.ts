import * as pdfjsLib from 'pdfjs-dist';
// Vite ?url import creates a local asset URL for the web worker
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
}

export interface ExtractedInvoiceItem {
  id: string;
  itemDescription: string;
  unitPrice: number;
  qty: number;
  uom: string;
  subtotal: number;
  mappedMasterName: string;
}

export interface ExtractedInvoiceData {
  invoiceNo: string;
  orderNo: string;
  date: string;
  slot: string;
  deliveryPeriod: 'Morning' | 'Afternoon';
  grandTotal: number;
  items: ExtractedInvoiceItem[];
}

/**
 * Fuzzy matches an invoice description to the closest master product name.
 */
export function matchToMasterItem(desc: string, masterNames: string[]): string {
  const clean = desc
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Direct contains check
  for (const master of masterNames) {
    const mClean = master.toLowerCase().replace(/[^\w\s]/gi, ' ').trim();
    if (clean.includes(mClean) || mClean.includes(clean)) {
      return master;
    }
  }

  // 2. Keyword based matching
  const rules: { keywords: string[]; target: string }[] = [
    { keywords: ['drumstick', 'drumsticks'], target: 'Chicken Drumstick' },
    { keywords: ['skeleton', 'soup bone', 'bones'], target: 'Chicken Soup Bones' },
    { keywords: ['thigh', 'boneless'], target: 'Chicken Thigh Boneless' },
    { keywords: ['thigh', 'whole leg'], target: 'Chicken Thigh Whole leg ( Pack of 2 )' },
    { keywords: ['skinless', 'whole uncut', 'tender'], target: 'Chicken Without skin' },
    { keywords: ['dressed with skin', 'with skin'], target: 'Chicken With Skin' },
    { keywords: ['liver', 'chicken'], target: 'Chicken Liver' },
    { keywords: ['gizzard'], target: 'Chicken Gizzard' },
    { keywords: ['lollipop'], target: 'Chicken Lollipop' },
    { keywords: ['mince', 'chicken'], target: 'Chicken Mince' },
    { keywords: ['breast', 'boneless'], target: 'Chicken Breast boneless' },
    { keywords: ['country', 'nati'], target: 'Country Chicken / Nati Koli' },
    { keywords: ['goat', 'curry cut'], target: 'Goat Curry Cut' },
    { keywords: ['goat', 'liver'], target: 'Goat Liver' },
    { keywords: ['goat', 'mince'], target: 'Goat Mince' },
    { keywords: ['goat', 'carcass'], target: 'Goat Carcass' },
    { keywords: ['goat', 'shanks'], target: 'Goat Shanks' },
    { keywords: ['catla'], target: 'Catla' },
    { keywords: ['rohu', 'rui'], target: 'Rohu' },
    { keywords: ['rupchanda', 'roopchand'], target: 'Roopchand' },
    { keywords: ['bhetki', 'seabass', 'barramundi'], target: 'Bhetki' },
    { keywords: ['baasa', 'pangasius'], target: 'Indian Baasa' },
    { keywords: ['tiger prawn'], target: 'Tiger Prawn Whole' },
    { keywords: ['prawn', 'venami', 'vannamei', 'jhinga'], target: 'Indian Prawns Whole' },
    { keywords: ['mackerel', 'bangda', 'ayala'], target: 'Mackerel / Ayala / Bangda' },
    { keywords: ['pearl spot', 'karimeen'], target: 'Pearl Spot' },
    { keywords: ['pink perch', 'kilimeen', 'sankara'], target: 'Pink Perch / Kilimeen / Sankara' },
    { keywords: ['sardine', 'mathi'], target: 'Sardine' },
    { keywords: ['seer', 'surmai'], target: 'Seer Fish Curry Cut (With Skin)' },
    { keywords: ['salmon'], target: 'Fresh Atlantic Salmon' },
    { keywords: ['tilapia'], target: 'Tilapia' },
    { keywords: ['white egg', 'chicken egg'], target: 'Fresh White Chicken Eggs - Pack of 6' },
    { keywords: ['quail egg'], target: 'Premium Quail Eggs - Pack of 12' },
    { keywords: ['duck egg'], target: 'Premium Duck Eggs - Pack of 6 Eggs' },
  ];

  for (const rule of rules) {
    if (rule.keywords.every(k => clean.includes(k))) {
      return rule.target;
    }
  }

  // 3. Fallback to clean title
  return desc.split('-')[0].trim();
}

/**
 * Parses an uploaded FreshToHome invoice PDF in the browser.
 * Extracts ONLY the items present in the uploaded PDF.
 */
export async function parseFreshToHomePdf(
  fileOrBuffer: File | ArrayBuffer,
  masterNames: string[] = []
): Promise<ExtractedInvoiceData> {
  const buffer = fileOrBuffer instanceof File
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  let invoiceNo = '';
  let orderNo = '';
  let invoiceDate = '';
  let deliverySlot = '';
  let deliveryPeriod: 'Morning' | 'Afternoon' = 'Morning';
  let grandTotal = 0;

  const extractedItems: ExtractedInvoiceItem[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .map((it: any) => ({
        str: String(it.str || '').trim(),
        x: Number(it.transform[4] || 0),
        y: Number(it.transform[5] || 0),
      }))
      .filter((it: any) => it.str);

    // Group items by line according to Y-coordinate
    const lineBuckets: { y: number; items: typeof items }[] = [];
    for (const it of items) {
      let bucket = lineBuckets.find(b => Math.abs(b.y - it.y) <= 4.5);
      if (!bucket) {
        bucket = { y: it.y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push(it);
    }

    lineBuckets.sort((a, b) => b.y - a.y);

    for (let i = 0; i < lineBuckets.length; i++) {
      const bucket = lineBuckets[i];
      bucket.items.sort((a, b) => a.x - b.x);
      const strParts = bucket.items.map(it => it.str);
      const fullLine = strParts.join(' ');

      // Metadata extraction
      if (!invoiceNo && /Invoice\s*#\s*([A-Za-z0-9]+)/i.test(fullLine)) {
        const m = fullLine.match(/Invoice\s*#\s*([A-Za-z0-9]+)/i);
        if (m) invoiceNo = m[1];
      }
      if (!orderNo && /Order\s*#\s*([A-Za-z0-9]+)/i.test(fullLine)) {
        const m = fullLine.match(/Order\s*#\s*([A-Za-z0-9]+)/i);
        if (m) orderNo = m[1];
      }
      if (!deliverySlot && /Delivery Slot:\s*([^|]+)/i.test(fullLine)) {
        const m = fullLine.match(/Delivery Slot:\s*([^|]+)/i);
        if (m) deliverySlot = m[1].trim();
      }
      if (!invoiceDate && /Invoice Date:\s*([^|]+)/i.test(fullLine)) {
        const m = fullLine.match(/Invoice Date:\s*([^|]+)/i);
        if (m) invoiceDate = m[1].trim();
      }

      // Detect table rows: must have rupee symbol ₹, UoM (Kg or pack), and HSN 8-digit code
      const hasRupee = strParts.some(s => s.startsWith('₹') || s.includes('₹'));
      const hasUom = strParts.some(s => /^(?:Kg|pack|packs|nos|gm)$/i.test(s));
      const hsnIdx = strParts.findIndex(s => /^\d{8}$/.test(s));

      if (hasRupee && hasUom && hsnIdx !== -1) {
        // Collect multi-line descriptions (consecutive line below without price/HSN)
        const descParts = strParts.slice(0, hsnIdx);
        if (i + 1 < lineBuckets.length) {
          const nextB = lineBuckets[i + 1];
          nextB.items.sort((a, b) => a.x - b.x);
          const nextParts = nextB.items.map(it => it.str);
          const nextHasPrice = nextParts.some(s => s.startsWith('₹'));
          const nextHasHsn = nextParts.some(s => /^\d{8}$/.test(s));
          if (!nextHasPrice && !nextHasHsn && nextParts.length > 0 && nextB.y > 80) {
            const firstNext = nextParts[0] || '';
            if (!firstNext.startsWith('GST') && !firstNext.startsWith('Invoice') && !firstNext.startsWith('Grand') && !firstNext.startsWith('Total')) {
              descParts.push(...nextParts);
            }
          }
        }

        const rawDesc = descParts.join(' ').replace(/\s+/g, ' ').trim();
        const priceTokens = strParts
          .filter(s => s.includes('₹'))
          .map(s => parseFloat(s.replace(/[^\d.]/g, '')))
          .filter(n => !isNaN(n));

        const unitPrice = priceTokens[0] || 0;
        const uomToken = strParts.find(s => /^(?:Kg|pack|packs|nos|gm)$/i.test(s)) || 'Kg';

        // Find quantity token between HSN and UOM
        let qty = 1;
        const afterHsn = strParts.slice(hsnIdx + 1);
        for (const token of afterHsn) {
          const cleanToken = token.replace(/,/g, '').trim();
          const num = parseFloat(cleanToken);
          if (!isNaN(num) && !token.includes('₹') && cleanToken.toLowerCase() !== uomToken.toLowerCase()) {
            qty = num;
            break;
          }
        }

        const subtotal = priceTokens.length > 1
          ? priceTokens[priceTokens.length - 1]
          : parseFloat((unitPrice * qty).toFixed(2));

        const mappedMasterName = matchToMasterItem(rawDesc, masterNames);

        extractedItems.push({
          id: `item_${extractedItems.length + 1}_${Date.now()}`,
          itemDescription: rawDesc,
          unitPrice,
          qty,
          uom: uomToken,
          subtotal,
          mappedMasterName,
        });
      }
    }
  }

  // If slot contains afternoon or pm, mark as Afternoon
  if (deliverySlot) {
    const lowerSlot = deliverySlot.toLowerCase();
    if (lowerSlot.includes('pm') || lowerSlot.includes('afternoon') || lowerSlot.includes('evening')) {
      deliveryPeriod = 'Afternoon';
    } else {
      deliveryPeriod = 'Morning';
    }
  }

  grandTotal = extractedItems.reduce((acc, it) => acc + it.subtotal, 0);

  return {
    invoiceNo: invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
    orderNo: orderNo || `ORD-${Date.now().toString().slice(-6)}`,
    date: invoiceDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    slot: deliverySlot || '8:00am - 10:30am',
    deliveryPeriod,
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    items: extractedItems,
  };
}
