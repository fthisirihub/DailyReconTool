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

  // 1. Direct exact or longest contains check against masterNames
  const sortedMasters = [...masterNames].sort((a, b) => b.length - a.length);
  for (const master of sortedMasters) {
    const mClean = master.toLowerCase().replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!mClean) continue;
    if (clean === mClean) {
      return master;
    }
  }
  for (const master of sortedMasters) {
    const mClean = master.toLowerCase().replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (mClean.length < 3) continue;
    if (clean.includes(mClean) || mClean.includes(clean)) {
      return master;
    }
  }

  // 2. Priority-ordered keyword based matching (specific variants BEFORE generic ones)
  const rules: { keywords: string[]; target: string }[] = [
    // Chicken
    { keywords: ['chicken', 'heart'], target: 'Chicken Hearts (480g to 500g Pack)' },
    { keywords: ['thigh', 'whole leg'], target: 'Chicken Thigh Whole leg ( Pack of 2 )' },
    { keywords: ['thigh', 'boneless'], target: 'Chicken Thigh Boneless' },
    { keywords: ['breast', 'boneless'], target: 'Chicken Breast boneless' },
    { keywords: ['breast', 'chicken'], target: 'Chicken Breast boneless' },
    { keywords: ['drumstick'], target: 'Chicken Drumstick' },
    { keywords: ['gizzard'], target: 'Chicken Gizzard' },
    { keywords: ['chicken', 'liver'], target: 'Chicken Liver' },
    { keywords: ['lollipop', 'spicy'], target: 'Spicy chicken lollipop' },
    { keywords: ['lollipop'], target: 'Chicken Lollipop' },
    { keywords: ['chicken', 'mince', 'dry'], target: 'Chicken Mince Dry Fry Kheema' },
    { keywords: ['chicken', 'mince'], target: 'Chicken Mince' },
    { keywords: ['chicken', 'keema'], target: 'Chicken Mince' },
    { keywords: ['chicken', 'kheema'], target: 'Chicken Mince' },
    { keywords: ['soup bone', 'chicken'], target: 'Chicken Soup Bones' },
    { keywords: ['skeleton', 'soup bone'], target: 'Chicken Soup Bones' },
    { keywords: ['peri peri', 'wing'], target: 'Peri Peri chicken Wings' },
    { keywords: ['lemon pepper', 'wing'], target: 'Lemon Pepper Chicken Wings' },
    { keywords: ['spicy', 'wing'], target: 'Spicy chicken wings' },
    { keywords: ['chicken', 'wing'], target: 'Chicken Wings' },
    { keywords: ['dressed with skin'], target: 'Chicken With Skin' },
    { keywords: ['with skin', 'chicken'], target: 'Chicken With Skin' },
    { keywords: ['skinless', 'whole uncut'], target: 'Chicken Without skin' },
    { keywords: ['without skin', 'chicken'], target: 'Chicken Without skin' },
    { keywords: ['whole', 'skinless', 'chicken'], target: 'Chicken Without skin' },
    { keywords: ['country chicken'], target: 'Country Chicken / Nati Koli' },
    { keywords: ['nati'], target: 'Country Chicken / Nati Koli' },
    { keywords: ['duck', 'egg'], target: 'Premium Duck Eggs - Pack of 6 Eggs' },
    { keywords: ['duck'], target: 'Vigova Duck' },
    { keywords: ['quail', 'egg'], target: 'Premium Quail Eggs - Pack of 12' },
    { keywords: ['quail'], target: 'Quail' },
    { keywords: ['kadaknath', 'egg'], target: 'Premium Kadaknath Chicken Eggs - Pack of 6' },
    { keywords: ['kadaknath'], target: 'Kadaknath Chicken' },

    // Mutton & Lamb
    { keywords: ['goat', 'boneless'], target: 'Goat Boneless' },
    { keywords: ['goat', 'carcass'], target: 'Goat Carcass' },
    { keywords: ['goat', 'curry cut'], target: 'Goat Curry Cut' },
    { keywords: ['goat', 'kapura'], target: 'Goat Kapura' },
    { keywords: ['goat', 'kidney'], target: 'Goat Kidney' },
    { keywords: ['goat', 'leg'], target: 'Goat Leg' },
    { keywords: ['goat', 'liver'], target: 'Goat Liver' },
    { keywords: ['goat', 'mince'], target: 'Goat Mince' },
    { keywords: ['goat', 'keema'], target: 'Goat Mince' },
    { keywords: ['goat', 'ribs'], target: 'Goat Ribs & Chops' },
    { keywords: ['goat', 'chops'], target: 'Goat Ribs & Chops' },
    { keywords: ['goat', 'shank'], target: 'Goat Shanks' },
    { keywords: ['goat', 'shoulder'], target: 'Goat Shoulder' },
    { keywords: ['lamb', 'boneless'], target: 'Lamb Boneless' },
    { keywords: ['lamb', 'carcass'], target: 'Lamb Carcass' },
    { keywords: ['lamb', 'curry cut'], target: 'Lamb Curry Cut' },
    { keywords: ['lamb', 'mince'], target: 'Lamb Mince' },
    { keywords: ['lamb', 'ribs'], target: 'Lamb Ribs Chops' },
    { keywords: ['lamb', 'chops'], target: 'Lamb Ribs Chops' },
    { keywords: ['lamb', 'shank'], target: 'Lamb Shanks' },
    { keywords: ['mutton', 'boti'], target: 'Mutton Boti' },
    { keywords: ['mutton', 'paya'], target: 'Mutton Paya' },
    { keywords: ['paya'], target: 'Mutton Paya' },
    { keywords: ['mutton', 'soup bone'], target: 'Mutton Soup Bones' },
    { keywords: ['mutton', 'curry cut'], target: 'Goat Curry Cut' },

    // Fish & Seafood (specific variants first!)
    { keywords: ['catla', '4kg'], target: 'Catla Extra Large 4kg+' },
    { keywords: ['catla', 'extra large'], target: 'Catla Extra Large 4kg+' },
    { keywords: ['catla', 'large'], target: 'Catla Large ( 2kg to 3.5kg )' },
    { keywords: ['catla'], target: 'Catla' },
    { keywords: ['charapona'], target: 'Charapona - Baby Rohu' },
    { keywords: ['baby rohu'], target: 'Charapona - Baby Rohu' },
    { keywords: ['rohu', 'extra large'], target: 'Rohu Extra large' },
    { keywords: ['rohu'], target: 'Rohu' },
    { keywords: ['rui'], target: 'Rohu' },
    { keywords: ['rupchanda'], target: 'Roopchand' },
    { keywords: ['roopchand'], target: 'Roopchand' },
    { keywords: ['river pomfret'], target: 'Roopchand' },
    { keywords: ['black pomfret'], target: 'Black Pomfret' },
    { keywords: ['silver pomfret'], target: 'Silver Pomfret' },
    { keywords: ['white pomfret'], target: 'White Pomret (200g to 300)' },
    { keywords: ['white pomret'], target: 'White Pomret (200g to 300)' },
    { keywords: ['bhetki'], target: 'Bhetki' },
    { keywords: ['seabass'], target: 'Bhetki' },
    { keywords: ['barramundi'], target: 'Bhetki' },
    { keywords: ['baasa', 'boneless'], target: 'Indian Baasa boneless 250 g' },
    { keywords: ['basa', 'boneless'], target: 'Indian Baasa boneless 250 g' },
    { keywords: ['baasa'], target: 'Indian Baasa' },
    { keywords: ['pangasius'], target: 'Indian Baasa' },
    { keywords: ['basa'], target: 'Indian Baasa' },
    { keywords: ['tiger prawn'], target: 'Tiger Prawn Whole' },
    { keywords: ['white prawn'], target: 'White Prawns /Vinami' },
    { keywords: ['small clean prawn'], target: 'Small clean prawns' },
    { keywords: ['small shrimp'], target: 'Small Shrimp / Chingdi' },
    { keywords: ['chingdi'], target: 'Small Shrimp / Chingdi' },
    { keywords: ['prawn', 'venami'], target: 'Indian Prawns Whole' },
    { keywords: ['prawn', 'vannamei'], target: 'Indian Prawns Whole' },
    { keywords: ['indian prawn'], target: 'Indian Prawns Whole' },
    { keywords: ['jhinga'], target: 'Indian Prawns Whole' },
    { keywords: ['horse mackerel'], target: 'Horse Mackerel' },
    { keywords: ['mackerel', 'pickel'], target: 'Mackerel Pickel' },
    { keywords: ['mackerel'], target: 'Mackerel / Ayala / Bangda' },
    { keywords: ['bangda'], target: 'Mackerel / Ayala / Bangda' },
    { keywords: ['ayala'], target: 'Mackerel / Ayala / Bangda' },
    { keywords: ['white sardine'], target: 'White Sardine Whole' },
    { keywords: ['sardine'], target: 'Sardine' },
    { keywords: ['mathi'], target: 'Sardine' },
    { keywords: ['seer', 'head'], target: 'Seer Fish Head And Tail' },
    { keywords: ['seer'], target: 'Seer Fish Curry Cut (With Skin)' },
    { keywords: ['surmai'], target: 'Seer Fish Curry Cut (With Skin)' },
    { keywords: ['indian salmon'], target: 'Indian Salmon' },
    { keywords: ['rawas'], target: 'Indian Salmon' },
    { keywords: ['atlantic salmon'], target: 'Fresh Atlantic Salmon' },
    { keywords: ['salmon'], target: 'Fresh Atlantic Salmon' },
    { keywords: ['yellow fin tuna'], target: 'Yellow Fin Tuna' },
    { keywords: ['yellowfin tuna'], target: 'Yellow Fin Tuna' },
    { keywords: ['tuna'], target: 'Tuna' },
    { keywords: ['pearl spot'], target: 'Pearl Spot' },
    { keywords: ['karimeen'], target: 'Pearl Spot' },
    { keywords: ['pink perch'], target: 'Pink Perch / Kilimeen / Sankara' },
    { keywords: ['kilimeen'], target: 'Pink Perch / Kilimeen / Sankara' },
    { keywords: ['sankara'], target: 'Pink Perch / Kilimeen / Sankara' },
    { keywords: ['red snapper'], target: 'Red Snapper' },
    { keywords: ['bombay duck'], target: 'Bombay Duck Whole' },
    { keywords: ['bombil'], target: 'Bombay Duck Whole' },
    { keywords: ['anchovy'], target: 'Anchovy' },
    { keywords: ['natholi'], target: 'Anchovy' },
    { keywords: ['tilapia'], target: 'Tilapia' },
    { keywords: ['blue crab'], target: 'Blue Crab' },
    { keywords: ['mud crab'], target: 'Mud Crab' },
    { keywords: ['sea crab'], target: 'Sea Crab' },
    { keywords: ['barracuda'], target: 'Barracuda' },
    { keywords: ['bata'], target: 'Bata Fish' },
    { keywords: ['boal'], target: 'BOAL' },
    { keywords: ['chitol'], target: 'Chitol' },
    { keywords: ['clam'], target: 'Clam Meat / Kakka' },
    { keywords: ['cobia'], target: 'Cobia Motha' },
    { keywords: ['emperor'], target: 'Emperor' },
    { keywords: ['grey mullet'], target: 'Grey Mullet' },
    { keywords: ['hilsa'], target: 'Hilsa Whole' },
    { keywords: ['lady fish'], target: 'Lady Fish Whole' },
    { keywords: ['live murrel'], target: 'Live Murrel' },
    { keywords: ['murrel'], target: 'Live Murrel' },
    { keywords: ['silver biddy'], target: 'Long Rayed Silver Biddy' },
    { keywords: ['mahi mahi'], target: 'Mahi Mahi' },
    { keywords: ['milk fish'], target: 'Marine Milk Fish' },
    { keywords: ['pabda'], target: 'Pabda Catfish' },
    { keywords: ['parrot fish'], target: 'Parrot Fish' },
    { keywords: ['parshe'], target: 'Parshe' },
    { keywords: ['pony fish'], target: 'Pony Fish' },
    { keywords: ['puti maach'], target: 'Puti Maach' },
    { keywords: ['queen fish'], target: 'Queen Fish' },
    { keywords: ['shrimp scad'], target: 'Shrimp Scad / VattaPaara' },
    { keywords: ['silver belly'], target: 'Silver Belly' },
    { keywords: ['silver croaker'], target: 'Silver Croakar' },
    { keywords: ['silver croakar'], target: 'Silver Croakar' },
    { keywords: ['snake head'], target: 'Snake Head Fish-Live' },
    { keywords: ['sole fish'], target: 'Sole Fish' },
    { keywords: ['squid'], target: 'Squid Whole' },
    { keywords: ['tengra'], target: 'Tengra' },
    { keywords: ['topse'], target: 'Topse/Mango' },
    { keywords: ['trevalley'], target: 'Trevalley Vatta' },
    { keywords: ['white fish'], target: 'White Fish /Parwa' },
    { keywords: ['mourala'], target: 'Mourala' },
    { keywords: ['aar'], target: 'Aar' },
    { keywords: ['koi'], target: 'Koi' },

    // Eggs & Batter/Dairy
    { keywords: ['white', 'egg', '12'], target: 'White Chicken Eggs (Pack of 12)' },
    { keywords: ['white', 'egg', '30'], target: 'White Chicken Eggs (Box of 30 Eggs)' },
    { keywords: ['white egg'], target: 'Fresh White Chicken Eggs - Pack of 6' },
    { keywords: ['white', 'chicken egg'], target: 'Fresh White Chicken Eggs - Pack of 6' },
    { keywords: ['brown', 'egg'], target: 'Fresh Premium Brown Chicken Eggs - Pack of 6' },
    { keywords: ['country', 'egg'], target: 'Fresh Premium Country Chicken Eggs - Pack of 6' },
    { keywords: ['jumbo', 'egg'], target: 'Jumbo Chicken Eggs - Pack of 6' },
    { keywords: ['palak', 'batter'], target: 'Palak Idly / Dosa Batter - 1kg Pack' },
    { keywords: ['beetroot', 'batter'], target: 'Beetroot Idly / Dosa Batter - 1kg Pack' },
    { keywords: ['carrot', 'batter'], target: 'Carrot Idly / Dosa Batter - 1kg Pack' },
    { keywords: ['ragi', 'batter'], target: 'Ragi Idly / Dosa Batter (1kg Pack)' },
    { keywords: ['batter'], target: 'Idly / Dosa Batter (Freshly Stone-ground, no added preservatives/chemicals) - 1kg Pack' },
    { keywords: ['paneer', 'tikka'], target: 'Paneer Tikka' },
    { keywords: ['paneer'], target: 'Paneer (200g Pack)' },
    { keywords: ['curd'], target: 'Freshtohome Curd (425g Pack)' },
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
