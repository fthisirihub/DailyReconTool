export interface MasterItem {
  slNo: number;
  category: string;
  id: string;
  name: string;
  uom: string;
  openingStock: number;
  morningStock: number;   // Col G
  afternoonStock: number; // Col H
  returnWastage: number;  // Col I
  totalInventory: number; // Col J (Formula: F + G + H - I)
  totalSales: number;     // Col K
  closingStock: number;   // Col L
  shrinkage: number;      // Col M (Formula: L - (J - K))
  unitCost: number;       // ₹ from FreshToHome / DB
}

export interface TrackerMonthSheet {
  id: string;
  name: string;
  monthYear: string;
  sheetId: string;
}

export const MONTH_SHEET_PRESETS: TrackerMonthSheet[] = [
  { id: 'nov_2026', name: 'Inventory Tracker - Nov 2026 (Isiri Hub)', monthYear: 'November 2026', sheetId: '1eO7P...Nov2026IsiriHub' },
  { id: 'dec_2026', name: 'Inventory Tracker - Dec 2026 (Isiri Hub)', monthYear: 'December 2026', sheetId: '1fP8Q...Dec2026IsiriHub' },
  { id: 'oct_2026', name: 'Inventory Tracker - Oct 2026 (Isiri Hub)', monthYear: 'October 2026', sheetId: '1dM6N...Oct2026IsiriHub' },
];

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsn: string;
  unitPrice: number;
  qty: number;
  uom: string;
  discount: number;
  subtotal: number;
  mappedMasterName: string;
}

export interface PosSaleItem {
  sku: string;
  posName: string;
  category: string;
  quantitySold: number;
  totalPrice: number;
  mappedMasterName: string;
  approved: boolean;
}

export const INITIAL_MASTER_ITEMS: MasterItem[] = [
  { slNo: 1, category: "Chicken", id: "1178", name: "Chicken Breast boneless", uom: "Kgs", openingStock: 4.6, morningStock: 27.0, afternoonStock: 2.0, returnWastage: 0, totalInventory: 33.6, totalSales: 25.95, closingStock: 4.9, shrinkage: -2.75, unitCost: 325.0 },
  { slNo: 2, category: "Chicken", id: "1241", name: "Chicken Drumstick", uom: "Kgs", openingStock: 2.8, morningStock: 5.0, afternoonStock: 1.0, returnWastage: 0, totalInventory: 8.8, totalSales: 6.02, closingStock: 0.0, shrinkage: -2.78, unitCost: 279.0 },
  { slNo: 3, category: "Chicken", id: "3104", name: "Chicken Gizzard", uom: "Kgs", openingStock: 1.7, morningStock: 1.0, afternoonStock: 0.0, returnWastage: 0.735, totalInventory: 1.965, totalSales: 2.13, closingStock: 0.0, shrinkage: 0.165, unitCost: 110.0 },
  { slNo: 4, category: "Chicken", id: "1447", name: "Chicken Liver", uom: "Kgs", openingStock: 0.4, morningStock: 3.0, afternoonStock: 0.0, returnWastage: 1.4, totalInventory: 2.0, totalSales: 1.23, closingStock: 0.0, shrinkage: -0.77, unitCost: 80.0 },
  { slNo: 5, category: "Chicken", id: "1239", name: "Chicken Lollipop", uom: "Kgs", openingStock: 0.0, morningStock: 2.0, afternoonStock: 0.0, returnWastage: 0.6, totalInventory: 1.4, totalSales: 1.36, closingStock: 0.0, shrinkage: -0.04, unitCost: 240.0 },
  { slNo: 6, category: "Chicken", id: "1186", name: "Chicken Mince", uom: "Kgs", openingStock: 0.0, morningStock: 0.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 0.0, totalSales: 0.59, closingStock: 0.0, shrinkage: 0.59, unitCost: 280.0 },
  { slNo: 7, category: "Chicken", id: "3697", name: "Chicken Soup Bones", uom: "Kgs", openingStock: 1.9, morningStock: 0.0, afternoonStock: 4.0, returnWastage: 0, totalInventory: 5.9, totalSales: 2.07, closingStock: 0.0, shrinkage: -3.83, unitCost: 54.0 },
  { slNo: 8, category: "Chicken", id: "1575", name: "Chicken Thigh Boneless", uom: "Kgs", openingStock: 0.0, morningStock: 5.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 5.0, totalSales: 5.4, closingStock: 1.1, shrinkage: 1.5, unitCost: 320.0 },
  { slNo: 9, category: "Chicken", id: "2893", name: "Chicken Thigh Whole leg ( Pack of 2 )", uom: "Pack", openingStock: 8.0, morningStock: 7.0, afternoonStock: 8.0, returnWastage: 0, totalInventory: 23.0, totalSales: 17.0, closingStock: 2.0, shrinkage: -4.0, unitCost: 146.0 },
  { slNo: 11, category: "Chicken", id: "1183", name: "Chicken With Skin", uom: "Kgs", openingStock: 2.45, morningStock: 1.1, afternoonStock: 0.0, returnWastage: 0, totalInventory: 3.55, totalSales: 2.49, closingStock: 0.0, shrinkage: -1.06, unitCost: 199.0 },
  { slNo: 12, category: "Chicken", id: "1160", name: "Chicken Without skin", uom: "Kgs", openingStock: 11.7, morningStock: 99.39, afternoonStock: 16.64, returnWastage: 0.95, totalInventory: 126.78, totalSales: 97.86, closingStock: 0.0, shrinkage: -28.92, unitCost: 215.0 },
  { slNo: 13, category: "Chicken", id: "1237", name: "Country Chicken / Nati Koli", uom: "Kgs", openingStock: 0.0, morningStock: 2.6, afternoonStock: 0.0, returnWastage: 0.6, totalInventory: 2.0, totalSales: 1.98, closingStock: 0.0, shrinkage: -0.02, unitCost: 380.0 },

  // Mutton
  { slNo: 1, category: "Mutton", id: "9798", name: "Goat Carcass", uom: "Kgs", openingStock: 0.0, morningStock: 0.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 0.0, totalSales: 0.0, closingStock: 0.0, shrinkage: 0.0, unitCost: 550.0 },
  { slNo: 2, category: "Mutton", id: "1259", name: "Goat Curry Cut", uom: "Kgs", openingStock: 0.0, morningStock: 24.59, afternoonStock: -1.3, returnWastage: 1.87, totalInventory: 21.42, totalSales: 16.14, closingStock: 2.0, shrinkage: -3.28, unitCost: 580.0 },
  { slNo: 3, category: "Mutton", id: "1463", name: "Goat Liver", uom: "Kgs", openingStock: 0.75, morningStock: 1.0, afternoonStock: 1.0, returnWastage: 0, totalInventory: 2.75, totalSales: 2.19, closingStock: 0.0, shrinkage: -0.56, unitCost: 389.0 },
  { slNo: 4, category: "Mutton", id: "1256", name: "Goat Mince", uom: "Kgs", openingStock: 0.0, morningStock: 0.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 0.0, totalSales: 2.43, closingStock: 0.0, shrinkage: 2.43, unitCost: 650.0 },
  { slNo: 5, category: "Mutton", id: "2455", name: "Mutton Paya", uom: "Kgs", openingStock: 1.0, morningStock: 0.0, afternoonStock: 1.0, returnWastage: 0, totalInventory: 2.0, totalSales: 0.5, closingStock: 1.0, shrinkage: -0.5, unitCost: 200.0 },

  // Fish
  { slNo: 1, category: "Fish", id: "1209", name: "Anchovy", uom: "Kgs", openingStock: 1.0, morningStock: 0.0, afternoonStock: 0.0, returnWastage: 0.5, totalInventory: 0.5, totalSales: 0.53, closingStock: 0.0, shrinkage: 0.03, unitCost: 263.0 },
  { slNo: 2, category: "Fish", id: "1131", name: "Bhetki", uom: "Kgs", openingStock: 1.7, morningStock: 5.02, afternoonStock: 0.0, returnWastage: 0, totalInventory: 6.72, totalSales: 3.16, closingStock: 0.0, shrinkage: -3.56, unitCost: 639.0 },
  { slNo: 3, category: "Fish", id: "969", name: "Black Pomfret", uom: "Kgs", openingStock: 0.0, morningStock: 1.27, afternoonStock: 0.9, returnWastage: 0, totalInventory: 2.17, totalSales: 1.86, closingStock: 0.0, shrinkage: -0.31, unitCost: 680.0 },
  { slNo: 4, category: "Fish", id: "2074", name: "Bombay Duck Whole", uom: "Kgs", openingStock: 0.0, morningStock: 1.0, afternoonStock: 0.0, returnWastage: 1.0, totalInventory: 0.0, totalSales: 0.0, closingStock: 0.0, shrinkage: 0.0, unitCost: 228.0 },
  { slNo: 5, category: "Fish", id: "2601", name: "Catla", uom: "Kgs", openingStock: 7.8, morningStock: 12.04, afternoonStock: 0.0, returnWastage: 0, totalInventory: 19.84, totalSales: 10.74, closingStock: 2.5, shrinkage: -6.6, unitCost: 187.0 },
  { slNo: 6, category: "Fish", id: "9744", name: "Catla Extra Large 4kg+", uom: "Kgs", openingStock: 1.6, morningStock: 0.0, afternoonStock: 5.36, returnWastage: 2.4, totalInventory: 4.56, totalSales: 7.52, closingStock: 0.0, shrinkage: 2.96, unitCost: 210.0 },
  { slNo: 7, category: "Fish", id: "2725", name: "Fresh Atlantic Salmon", uom: "Kgs", openingStock: 2.0, morningStock: 4.0, afternoonStock: 0.0, returnWastage: 0.53, totalInventory: 5.47, totalSales: 3.57, closingStock: 1.6, shrinkage: -0.3, unitCost: 950.0 },
  { slNo: 8, category: "Fish", id: "1000", name: "Indian Baasa", uom: "Kgs", openingStock: 0.0, morningStock: 4.57, afternoonStock: 0.0, returnWastage: 0, totalInventory: 4.57, totalSales: 2.2, closingStock: 0.0, shrinkage: -2.37, unitCost: 120.0 },
  { slNo: 9, category: "Fish", id: "2408", name: "Indian Prawns Whole", uom: "Kgs", openingStock: 10.8, morningStock: 9.0, afternoonStock: -2.0, returnWastage: 0, totalInventory: 17.8, totalSales: 10.82, closingStock: 0.2, shrinkage: -6.78, unitCost: 399.0 },
  { slNo: 10, category: "Fish", id: "1501", name: "Mackerel / Ayala / Bangda", uom: "Kgs", openingStock: 0.4, morningStock: 9.38, afternoonStock: 4.0, returnWastage: 0.3, totalInventory: 13.48, totalSales: 12.62, closingStock: 0.0, shrinkage: -0.86, unitCost: 263.0 },
  { slNo: 11, category: "Fish", id: "1026", name: "Pearl Spot", uom: "Kgs", openingStock: 0.0, morningStock: 1.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 1.0, totalSales: 1.26, closingStock: 1.4, shrinkage: 1.66, unitCost: 390.0 },
  { slNo: 12, category: "Fish", id: "978", name: "Pink Perch / Kilimeen / Sankara", uom: "Kgs", openingStock: 2.3, morningStock: 2.0, afternoonStock: 0.0, returnWastage: 0.7, totalInventory: 3.6, totalSales: 2.71, closingStock: 0.0, shrinkage: -0.89, unitCost: 330.0 },
  { slNo: 13, category: "Fish", id: "966", name: "Red Snapper", uom: "Kgs", openingStock: 0.0, morningStock: 3.0, afternoonStock: 3.53, returnWastage: 2.18, totalInventory: 4.35, totalSales: 2.34, closingStock: 0.6, shrinkage: -1.41, unitCost: 450.0 },
  { slNo: 14, category: "Fish", id: "999", name: "Rohu", uom: "Kgs", openingStock: 4.7, morningStock: 10.99, afternoonStock: 3.5, returnWastage: 0.915, totalInventory: 18.275, totalSales: 14.7, closingStock: 5.2, shrinkage: 1.625, unitCost: 160.0 },
  { slNo: 15, category: "Fish", id: "1145", name: "Roopchand", uom: "Kgs", openingStock: 0.0, morningStock: 1.1, afternoonStock: 0.0, returnWastage: 0, totalInventory: 1.1, totalSales: 1.39, closingStock: 1.2, shrinkage: 1.49, unitCost: 142.0 },
  { slNo: 16, category: "Fish", id: "977", name: "Sardine", uom: "Kgs", openingStock: 0.35, morningStock: 7.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 7.35, totalSales: 5.59, closingStock: 0.0, shrinkage: -1.76, unitCost: 238.0 },
  { slNo: 17, category: "Fish", id: "1015", name: "Seer Fish Curry Cut (With Skin)", uom: "Kgs", openingStock: 1.0, morningStock: 2.14, afternoonStock: 5.7, returnWastage: 1.485, totalInventory: 7.355, totalSales: 4.64, closingStock: 0.7, shrinkage: -2.015, unitCost: 750.0 },
  { slNo: 18, category: "Fish", id: "1005", name: "Tiger Prawn Whole", uom: "Kgs", openingStock: 0.4, morningStock: 3.0, afternoonStock: 2.0, returnWastage: 0, totalInventory: 5.4, totalSales: 4.77, closingStock: 0.8, shrinkage: 0.17, unitCost: 768.0 },
  { slNo: 19, category: "Fish", id: "1946", name: "Tilapia", uom: "Kgs", openingStock: 1.3, morningStock: 1.0, afternoonStock: 0.0, returnWastage: 0, totalInventory: 2.3, totalSales: 1.32, closingStock: 1.5, shrinkage: 0.52, unitCost: 130.0 },

  // Eggs & Dairy
  { slNo: 1, category: "Eggs", id: "4091", name: "Fresh White Chicken Eggs - Pack of 6", uom: "Pack's", openingStock: 5.0, morningStock: 0.0, afternoonStock: 16.0, returnWastage: 0, totalInventory: 21.0, totalSales: 10.0, closingStock: 10.0, shrinkage: -1.0, unitCost: 48.0 },
  { slNo: 2, category: "Eggs", id: "8267", name: "Premium Quail Eggs - Pack of 12", uom: "Pack's", openingStock: 0.0, morningStock: 0.0, afternoonStock: 7.0, returnWastage: 0, totalInventory: 7.0, totalSales: 4.0, closingStock: 2.0, shrinkage: -1.0, unitCost: 55.0 },
  { slNo: 3, category: "Eggs", id: "8301", name: "Premium Duck Eggs - Pack of 6 Eggs", uom: "Pack's", openingStock: 0.0, morningStock: 0.0, afternoonStock: 7.0, returnWastage: 0, totalInventory: 7.0, totalSales: 2.0, closingStock: 5.0, shrinkage: 0.0, unitCost: 95.0 }
];

export const SAMPLE_FRESHTOHOME_INVOICE_ITEMS: InvoiceLineItem[] = [
  { id: "1", description: "Chicken Skeleton Soup Bones (for Broth / Stock) (Janatha Chicken) - Whole", hsn: "16023200", unitPrice: 54.00, qty: 4.0, uom: "Kg", discount: 0, subtotal: 216.00, mappedMasterName: "Chicken Soup Bones" },
  { id: "2", description: "Premium Antibiotic-residue-free Chicken - Thigh Boneless", hsn: "02071300", unitPrice: 320.00, qty: 2.0, uom: "Kg", discount: 0, subtotal: 640.00, mappedMasterName: "Chicken Thigh Boneless" },
  { id: "3", description: "Premium Antibiotic-residue-free Chicken Thigh / Whole Leg - Pack of 2 Pcs", hsn: "02071300", unitPrice: 146.00, qty: 15.0, uom: "pack", discount: 0, subtotal: 2190.00, mappedMasterName: "Chicken Thigh Whole leg ( Pack of 2 )" },
  { id: "4", description: "Premium Tender and Antibiotic-residue-free Chicken - Whole Uncut (Skinless)", hsn: "02071300", unitPrice: 215.00, qty: 45.82, uom: "Kg", discount: 0, subtotal: 9851.30, mappedMasterName: "Chicken Without skin" },
  { id: "5", description: "Catla / ಕಾಟ್ಲಾ (1kg to 2kg) - Whole (Not Descaled,Not Cleaned, Not Cut In Pieces)", hsn: "03027300", unitPrice: 187.00, qty: 3.06, uom: "Kg", discount: 0, subtotal: 572.22, mappedMasterName: "Catla" },
  { id: "6", description: "Indian Prawns / Venami / Vannamei / Jhinga / Chemmin (60+ Count/kg) - Whole", hsn: "03063500", unitPrice: 399.00, qty: 10.0, uom: "Kg", discount: 0, subtotal: 3990.00, mappedMasterName: "Indian Prawns Whole" },
  { id: "7", description: "Bombay Duck Fish / Bombil - Whole", hsn: "03028990", unitPrice: 228.00, qty: 1.0, uom: "Kg", discount: 0, subtotal: 228.00, mappedMasterName: "Bombay Duck Whole" },
  { id: "8", description: "Mackerel / Ayala / Bangda / Aylai / ಬಂಗಡೆ (5 to 9 Count/kg) - Whole", hsn: "03024400", unitPrice: 263.00, qty: 2.0, uom: "Kg", discount: 0, subtotal: 526.00, mappedMasterName: "Mackerel / Ayala / Bangda" },
  { id: "9", description: "Premium Goat Liver / ಮೇಕೆ ಲಿವರ್ - Cut Pieces", hsn: "02068010", unitPrice: 389.00, qty: 1.0, uom: "Kg", discount: 0, subtotal: 389.00, mappedMasterName: "Goat Liver" },
  { id: "10", description: "Premium Antibiotic-residue-free Chicken - Liver Cut Pieces", hsn: "02071300", unitPrice: 80.00, qty: 2.0, uom: "Kg", discount: 0, subtotal: 160.00, mappedMasterName: "Chicken Liver" },
  { id: "11", description: "Premium Antibiotic-residue-free Chicken Dressed with Skin - Whole", hsn: "02071300", unitPrice: 199.00, qty: 1.09, uom: "Kg", discount: 0, subtotal: 216.91, mappedMasterName: "Chicken With Skin" },
  { id: "12", description: "Premium Chicken Drumsticks (Free from all growth hormones and antibiotics) - Skinless", hsn: "02071300", unitPrice: 279.00, qty: 3.0, uom: "Kg", discount: 0, subtotal: 837.00, mappedMasterName: "Chicken Drumstick" },
  { id: "13", description: "Anchovy / Natholi / ಬೊಲಿಂಗೆ (Medium) - Whole", hsn: "03024200", unitPrice: 263.00, qty: 1.0, uom: "Kg", discount: 0, subtotal: 263.00, mappedMasterName: "Anchovy" },
  { id: "14", description: "Premium Antibiotic-residue-free Chicken - Boneless Breast Fillet", hsn: "02071300", unitPrice: 325.00, qty: 15.0, uom: "Kg", discount: 0, subtotal: 4875.00, mappedMasterName: "Chicken Breast boneless" },
  { id: "15", description: "Rupchanda / Roopchand / River Pomfret - Whole", hsn: "03028990", unitPrice: 142.00, qty: 1.05, uom: "Kg", discount: 0, subtotal: 149.10, mappedMasterName: "Roopchand" },
  { id: "16", description: "Bhetki / ভেটকী / Barramundi / Asian Seabass / Kalanji - Whole", hsn: "03028990", unitPrice: 639.00, qty: 3.48, uom: "Kg", discount: 0, subtotal: 2223.72, mappedMasterName: "Bhetki" },
  { id: "17", description: "Tiger Prawn (Super Large) - Whole", hsn: "03063500", unitPrice: 768.00, qty: 2.0, uom: "Kg", discount: 0, subtotal: 1536.00, mappedMasterName: "Tiger Prawn Whole" },
  { id: "18", description: "Fresh Indian Baasa / Pangasius - Whole", hsn: "03028990", unitPrice: 120.00, qty: 2.28, uom: "Kg", discount: 0, subtotal: 273.60, mappedMasterName: "Indian Baasa" },
  { id: "19", description: "Rohu / Rui / ರೋಹು (1kg to 1.5kg) - Whole", hsn: "03027300", unitPrice: 160.00, qty: 7.8, uom: "Kg", discount: 0, subtotal: 1248.00, mappedMasterName: "Rohu" },
  { id: "20", description: "Pink Perch / Kilimeen / Sankara Meen / Thread Finned Bream - Whole", hsn: "03027300", unitPrice: 330.00, qty: 1.0, uom: "Kg", discount: 0, subtotal: 330.00, mappedMasterName: "Pink Perch / Kilimeen / Sankara" },
  { id: "21", description: "Premium Sardine / Mathi - Whole", hsn: "03024300", unitPrice: 238.00, qty: 2.0, uom: "Kg", discount: 0, subtotal: 476.00, mappedMasterName: "Sardine" }
];

export const SAMPLE_POS_DATES = [
  "01 Nov 2026", "02 Nov 2026", "03 Nov 2026", "04 Nov 2026", "05 Nov 2026",
  "06 Nov 2026", "07 Nov 2026", "08 Nov 2026", "09 Nov 2026", "10 Nov 2026", "11 Nov 2026"
];

export const SAMPLE_POS_SALES_BY_DATE: Record<string, PosSaleItem[]> = {
  "10 Nov 2026": [
    { sku: "MP002614", posName: "Chicken Whole (Skinless)", category: "Poultry", quantitySold: 29.715, totalPrice: 9182.03, mappedMasterName: "Chicken Without skin", approved: true },
    { sku: "MP001179", posName: "Chicken Boneless Breast", category: "Poultry", quantitySold: 9.175, totalPrice: 4303.11, mappedMasterName: "Chicken Breast boneless", approved: true },
    { sku: "MP001242", posName: "Chicken Drumsticks (Skinless)", category: "Poultry", quantitySold: 2.375, totalPrice: 1042.63, mappedMasterName: "Chicken Drumstick", approved: true },
    { sku: "MP001448", posName: "Chicken Liver", category: "Poultry", quantitySold: 2.795, totalPrice: 472.38, mappedMasterName: "Chicken Liver", approved: true },
    { sku: "MP002893", posName: "Chicken Whole Leg (2pc)", category: "Poultry", quantitySold: 3.0, totalPrice: 297.0, mappedMasterName: "Chicken Thigh Whole leg ( Pack of 2 )", approved: true },
    { sku: "MP008195", posName: "Chicken Thigh Boneless", category: "Poultry", quantitySold: 0.305, totalPrice: 143.05, mappedMasterName: "Chicken Thigh Boneless", approved: true },
    { sku: "MP008260", posName: "Chicken Soup Bones", category: "Poultry", quantitySold: 3.99, totalPrice: 514.71, mappedMasterName: "Chicken Soup Bones", approved: true },
    { sku: "MP009798", posName: "Goat Carcass Curry Cut", category: "Meat", quantitySold: 1.185, totalPrice: 1183.82, mappedMasterName: "Goat Curry Cut", approved: true },
    { sku: "MP009803", posName: "Goat Carcass Leg", category: "Meat", quantitySold: 0.74, totalPrice: 813.26, mappedMasterName: "Goat Curry Cut", approved: true },
    { sku: "MP002455", posName: "Mutton Paya (4pc)", category: "Meat", quantitySold: 2.0, totalPrice: 230.0, mappedMasterName: "Mutton Paya", approved: true },
    { sku: "MP000999", posName: "Rohu Whole", category: "Fish", quantitySold: 2.065, totalPrice: 514.19, mappedMasterName: "Rohu", approved: true },
    { sku: "MP001501", posName: "Mackerel Whole (L)", category: "Fish", quantitySold: 0.845, totalPrice: 421.66, mappedMasterName: "Mackerel / Ayala / Bangda", approved: true },
    { sku: "MP000977", posName: "Premium Sardine Whole", category: "Fish", quantitySold: 0.81, totalPrice: 363.70, mappedMasterName: "Sardine", approved: true },
    { sku: "MP001000", posName: "Indian Basa Whole", category: "Fish", quantitySold: 1.98, totalPrice: 445.50, mappedMasterName: "Indian Baasa", approved: true },
    { sku: "MP002408", posName: "Indian Prawns Whole (60+)", category: "Fish", quantitySold: 5.995, totalPrice: 3591.03, mappedMasterName: "Indian Prawns Whole", approved: true },
    { sku: "MP002601", posName: "Catla Whole (Uncleaned, 1-2kg)", category: "Fish", quantitySold: 8.21, totalPrice: 2290.60, mappedMasterName: "Catla", approved: true },
    { sku: "MP004091", posName: "White Eggs (6pc)", category: "Dairy", quantitySold: 1.0, totalPrice: 69.00, mappedMasterName: "Fresh White Chicken Eggs - Pack of 6", approved: true }
  ]
};

export const SAMPLE_CLOSING_STOCK_MAP: Record<string, number> = {
  "Chicken Breast boneless": 4.9,
  "Chicken Drumstick": 0.0,
  "Chicken Gizzard": 0.0,
  "Chicken Liver": 0.0,
  "Chicken Lollipop": 0.0,
  "Chicken Mince": 0.0,
  "Chicken Soup Bones": 0.0,
  "Chicken Thigh Boneless": 1.1,
  "Chicken Thigh Whole leg ( Pack of 2 )": 2.0,
  "Chicken With Skin": 0.0,
  "Chicken Without skin": 0.0,
  "Country Chicken / Nati Koli": 0.0,
  "Goat Curry Cut": 2.0,
  "Goat Liver": 0.0,
  "Mutton Paya": 1.0,
  "Catla": 2.5,
  "Catla Extra Large 4kg+": 0.0,
  "Fresh Atlantic Salmon": 1.6,
  "Indian Baasa": 0.0,
  "Indian Prawns Whole": 0.2,
  "Mackerel / Ayala / Bangda": 0.0,
  "Pearl Spot": 1.4,
  "Pink Perch / Kilimeen / Sankara": 0.0,
  "Red Snapper": 0.6,
  "Rohu": 5.2,
  "Roopchand": 1.2,
  "Sardine": 0.0,
  "Seer Fish Curry Cut (With Skin)": 0.7,
  "Tiger Prawn Whole": 0.8,
  "Tilapia": 1.5,
  "Fresh White Chicken Eggs - Pack of 6": 10.0,
  "Premium Quail Eggs - Pack of 12": 2.0,
  "Premium Duck Eggs - Pack of 6 Eggs": 5.0
};

export interface TrackerCatalogItem {
  slNo: number;
  category: string;
  id: string;
  name: string;
  uom: string;
}

/**
 * Complete canonical product list from Column D ("Product's Name") of
 * Inventory_Tracker_-_Nov_2026_-_Isiri_Hub, preserving exact category order.
 */
export const INVENTORY_TRACKER_CATALOGUE: TrackerCatalogItem[] = [
  // Chicken (17 items)
  { slNo: 1, category: "Chicken", id: "1178", name: "Chicken Breast boneless", uom: "Kgs" },
  { slNo: 2, category: "Chicken", id: "1241", name: "Chicken Drumstick", uom: "Kgs" },
  { slNo: 3, category: "Chicken", id: "3104", name: "Chicken Gizzard", uom: "Kgs" },
  { slNo: 4, category: "Chicken", id: "1447", name: "Chicken Liver", uom: "Kgs" },
  { slNo: 5, category: "Chicken", id: "1239", name: "Chicken Lollipop", uom: "Kgs" },
  { slNo: 6, category: "Chicken", id: "1186", name: "Chicken Mince", uom: "Kgs" },
  { slNo: 7, category: "Chicken", id: "3697", name: "Chicken Soup Bones", uom: "Kgs" },
  { slNo: 8, category: "Chicken", id: "1575", name: "Chicken Thigh Boneless", uom: "Kgs" },
  { slNo: 9, category: "Chicken", id: "2893", name: "Chicken Thigh Whole leg ( Pack of 2 )", uom: "Pack" },
  { slNo: 10, category: "Chicken", id: "1369", name: "Chicken Wings", uom: "Kgs" },
  { slNo: 11, category: "Chicken", id: "1183", name: "Chicken With Skin", uom: "Kgs" },
  { slNo: 12, category: "Chicken", id: "1160", name: "Chicken Without skin", uom: "Kgs" },
  { slNo: 13, category: "Chicken", id: "1237", name: "Country Chicken / Nati Koli", uom: "Kgs" },
  { slNo: 14, category: "Chicken", id: "1253", name: "Vigova Duck", uom: "Kgs" },
  { slNo: 15, category: "Chicken", id: "1347", name: "Quail", uom: "Kgs" },
  { slNo: 16, category: "Chicken", id: "1539", name: "Kadaknath Chicken", uom: "Kgs" },
  { slNo: 17, category: "Chicken", id: "13322", name: "Chicken Hearts (480g to 500g Pack)", uom: "Pack" },

  // Mutton (21 items)
  { slNo: 1, category: "Mutton", id: "", name: "Goat Boneless", uom: "Kgs" },
  { slNo: 2, category: "Mutton", id: "9798", name: "Goat Carcass", uom: "Kgs" },
  { slNo: 3, category: "Mutton", id: "1259", name: "Goat Curry Cut", uom: "Kgs" },
  { slNo: 4, category: "Mutton", id: "", name: "Goat Curry Cut", uom: "Kgs" },
  { slNo: 5, category: "Mutton", id: "", name: "Goat Kapura", uom: "Kgs" },
  { slNo: 6, category: "Mutton", id: "", name: "Goat Kidney", uom: "Pack's" },
  { slNo: 7, category: "Mutton", id: "", name: "Goat Leg", uom: "Kgs" },
  { slNo: 8, category: "Mutton", id: "1463", name: "Goat Liver", uom: "Kgs" },
  { slNo: 9, category: "Mutton", id: "1256", name: "Goat Mince", uom: "Kgs" },
  { slNo: 10, category: "Mutton", id: "", name: "Goat Ribs & Chops", uom: "Kgs" },
  { slNo: 11, category: "Mutton", id: "2421", name: "Goat Shanks", uom: "Kgs" },
  { slNo: 12, category: "Mutton", id: "", name: "Goat Shoulder", uom: "Kgs" },
  { slNo: 13, category: "Mutton", id: "", name: "Lamb Boneless", uom: "Kgs" },
  { slNo: 14, category: "Mutton", id: "", name: "Lamb Carcass", uom: "Kgs" },
  { slNo: 15, category: "Mutton", id: "1266", name: "Lamb Curry Cut", uom: "Kgs" },
  { slNo: 16, category: "Mutton", id: "", name: "Lamb Mince", uom: "Kgs" },
  { slNo: 17, category: "Mutton", id: "", name: "Lamb Ribs Chops", uom: "Kgs" },
  { slNo: 18, category: "Mutton", id: "", name: "Lamb Shanks", uom: "Kgs" },
  { slNo: 19, category: "Mutton", id: "", name: "Mutton Boti", uom: "Kgs" },
  { slNo: 20, category: "Mutton", id: "", name: "Mutton Paya", uom: "Kgs" },
  { slNo: 21, category: "Mutton", id: "", name: "Mutton Soup Bones", uom: "Kgs" },

  // Fish (71 items)
  { slNo: 1, category: "Fish", id: "2575", name: "Aar", uom: "Kgs" },
  { slNo: 2, category: "Fish", id: "1209", name: "Anchovy", uom: "Kgs" },
  { slNo: 3, category: "Fish", id: "980", name: "Barracuda", uom: "Kgs" },
  { slNo: 4, category: "Fish", id: "1868", name: "Bata Fish", uom: "Kgs" },
  { slNo: 5, category: "Fish", id: "1131", name: "Bhetki", uom: "Kgs" },
  { slNo: 6, category: "Fish", id: "969", name: "Black Pomfret", uom: "Kgs" },
  { slNo: 7, category: "Fish", id: "1792", name: "Blue Crab", uom: "Kgs" },
  { slNo: 8, category: "Fish", id: "1284", name: "BOAL", uom: "Kgs" },
  { slNo: 9, category: "Fish", id: "2074", name: "Bombay Duck Whole", uom: "Kgs" },
  { slNo: 10, category: "Fish", id: "2601", name: "Catla", uom: "Kgs" },
  { slNo: 11, category: "Fish", id: "9744", name: "Catla Extra Large 4kg+", uom: "Kgs" },
  { slNo: 12, category: "Fish", id: "4018", name: "Charapona - Baby Rohu", uom: "Kgs" },
  { slNo: 13, category: "Fish", id: "1889", name: "Chitol", uom: "Kgs" },
  { slNo: 14, category: "Fish", id: "732", name: "Clam Meat / Kakka", uom: "Kgs" },
  { slNo: 15, category: "Fish", id: "974", name: "Cobia Motha", uom: "Kgs" },
  { slNo: 16, category: "Fish", id: "968", name: "Emperor", uom: "Kgs" },
  { slNo: 17, category: "Fish", id: "2725", name: "Fresh Atlantic Salmon", uom: "Kgs" },
  { slNo: 18, category: "Fish", id: "1488", name: "Grey Mullet", uom: "Kgs" },
  { slNo: 19, category: "Fish", id: "3975", name: "Hilsa Whole", uom: "Kgs" },
  { slNo: 20, category: "Fish", id: "1074", name: "Horse Mackerel", uom: "Kgs" },
  { slNo: 21, category: "Fish", id: "1000", name: "Indian Baasa", uom: "Kgs" },
  { slNo: 22, category: "Fish", id: "9734", name: "Indian Baasa boneless 250 g", uom: "Kgs" },
  { slNo: 23, category: "Fish", id: "2408", name: "Indian Prawns Whole", uom: "Kgs" },
  { slNo: 24, category: "Fish", id: "1335", name: "Indian Salmon", uom: "Kgs" },
  { slNo: 25, category: "Fish", id: "1670", name: "Koi", uom: "Kgs" },
  { slNo: 26, category: "Fish", id: "1027", name: "Lady Fish Whole", uom: "Kgs" },
  { slNo: 27, category: "Fish", id: "9661", name: "Live Murrel", uom: "Kgs" },
  { slNo: 28, category: "Fish", id: "990", name: "Long Rayed Silver Biddy", uom: "Kgs" },
  { slNo: 29, category: "Fish", id: "1501", name: "Mackerel / Ayala / Bangda", uom: "Kgs" },
  { slNo: 30, category: "Fish", id: "975", name: "Mahi Mahi", uom: "Kgs" },
  { slNo: 31, category: "Fish", id: "971", name: "Marine Milk Fish", uom: "Kgs" },
  { slNo: 32, category: "Fish", id: "1150", name: "Mud Crab", uom: "Kgs" },
  { slNo: 33, category: "Fish", id: "1734", name: "Pabda Catfish", uom: "Kgs" },
  { slNo: 34, category: "Fish", id: "1420", name: "Parrot Fish", uom: "Kgs" },
  { slNo: 35, category: "Fish", id: "1038", name: "Parshe", uom: "Kgs" },
  { slNo: 36, category: "Fish", id: "1026", name: "Pearl Spot", uom: "Kgs" },
  { slNo: 37, category: "Fish", id: "978", name: "Pink Perch / Kilimeen / Sankara", uom: "Kgs" },
  { slNo: 38, category: "Fish", id: "1549", name: "Pony Fish", uom: "Kgs" },
  { slNo: 39, category: "Fish", id: "2776", name: "Puti Maach", uom: "Kgs" },
  { slNo: 40, category: "Fish", id: "", name: "Queen Fish", uom: "Kgs" },
  { slNo: 41, category: "Fish", id: "966", name: "Red Snapper", uom: "Kgs" },
  { slNo: 42, category: "Fish", id: "999", name: "Rohu", uom: "Kgs" },
  { slNo: 43, category: "Fish", id: "1524", name: "Rohu Extra large", uom: "Kgs" },
  { slNo: 44, category: "Fish", id: "1145", name: "Roopchand", uom: "Kgs" },
  { slNo: 45, category: "Fish", id: "977", name: "Sardine", uom: "Kgs" },
  { slNo: 46, category: "Fish", id: "1271", name: "Sea Crab", uom: "Kgs" },
  { slNo: 47, category: "Fish", id: "1015", name: "Seer Fish Curry Cut (With Skin)", uom: "Kgs" },
  { slNo: 48, category: "Fish", id: "1586", name: "Seer Fish Head And Tail", uom: "Kgs" },
  { slNo: 49, category: "Fish", id: "", name: "Shark", uom: "Kgs" },
  { slNo: 50, category: "Fish", id: "1410", name: "Shrimp Scad / VattaPaara", uom: "Kgs" },
  { slNo: 51, category: "Fish", id: "", name: "Silver Belly", uom: "Kgs" },
  { slNo: 52, category: "Fish", id: "996", name: "Silver Croakar", uom: "Kgs" },
  { slNo: 53, category: "Fish", id: "1366", name: "Silver Pomfret", uom: "Kgs" },
  { slNo: 54, category: "Fish", id: "1805", name: "Small clean prawns", uom: "Kgs" },
  { slNo: 55, category: "Fish", id: "", name: "Small Shrimp / Chingdi", uom: "Kgs" },
  { slNo: 56, category: "Fish", id: "9661", name: "Snake Head Fish-Live", uom: "Kgs" },
  { slNo: 57, category: "Fish", id: "983", name: "Sole Fish", uom: "Kgs" },
  { slNo: 58, category: "Fish", id: "997", name: "Squid Whole", uom: "Kgs" },
  { slNo: 59, category: "Fish", id: "1040", name: "Tengra", uom: "Kgs" },
  { slNo: 60, category: "Fish", id: "1005", name: "Tiger Prawn Whole", uom: "Kgs" },
  { slNo: 61, category: "Fish", id: "1946", name: "Tilapia", uom: "Kgs" },
  { slNo: 62, category: "Fish", id: "2077", name: "Topse/Mango", uom: "Kgs" },
  { slNo: 63, category: "Fish", id: "1009", name: "Trevalley Vatta", uom: "Kgs" },
  { slNo: 64, category: "Fish", id: "1033", name: "Tuna", uom: "Kgs" },
  { slNo: 65, category: "Fish", id: "981", name: "White Fish /Parwa", uom: "Kgs" },
  { slNo: 66, category: "Fish", id: "970", name: "White Pomret (200g to 300)", uom: "Kgs" },
  { slNo: 67, category: "Fish", id: "994", name: "White Prawns /Vinami", uom: "Kgs" },
  { slNo: 68, category: "Fish", id: "1010", name: "White Sardine Whole", uom: "Kgs" },
  { slNo: 69, category: "Fish", id: "1244", name: "Yellow Fin Tuna", uom: "Kgs" },
  { slNo: 70, category: "Fish", id: "1803", name: "Mourala", uom: "Kgs" },
  { slNo: 71, category: "Fish", id: "1524", name: "Catla Large ( 2kg to 3.5kg )", uom: "Kgs" },

  // Batter & Dairy (7 items)
  { slNo: 1, category: "Batter", id: "2587", name: "Idly / Dosa Batter (Freshly Stone-ground, no added preservatives/chemicals) - 1kg Pack", uom: "Pack's" },
  { slNo: 2, category: "Batter", id: "7961", name: "Palak Idly / Dosa Batter - 1kg Pack", uom: "Pack's" },
  { slNo: 3, category: "Batter", id: "7962", name: "Beetroot Idly / Dosa Batter - 1kg Pack", uom: "Pack's" },
  { slNo: 4, category: "Batter", id: "7963", name: "Carrot Idly / Dosa Batter - 1kg Pack", uom: "Pack's" },
  { slNo: 5, category: "Batter", id: "7964", name: "Ragi Idly / Dosa Batter (1kg Pack)", uom: "Pack's" },
  { slNo: 6, category: "Dairy", id: "10958", name: "Paneer (200g Pack)", uom: "Pack's" },
  { slNo: 7, category: "Dairy", id: "11018", name: "Freshtohome Curd (425g Pack)", uom: "Pack's" },

  // Eggs (9 items)
  { slNo: 1, category: "Eggs", id: "4091", name: "Fresh White Chicken Eggs - Pack of 6", uom: "Pack's" },
  { slNo: 2, category: "Eggs", id: "10989", name: "White Chicken Eggs (Pack of 12)", uom: "Pack's" },
  { slNo: 3, category: "Eggs", id: "11721", name: "White Chicken Eggs (Box of 30 Eggs)", uom: "Pack's" },
  { slNo: 4, category: "Eggs", id: "4090", name: "Fresh Premium Brown Chicken Eggs - Pack of 6", uom: "Pack's" },
  { slNo: 5, category: "Eggs", id: "4955", name: "Fresh Premium Country Chicken Eggs - Pack of 6", uom: "Pack's" },
  { slNo: 6, category: "Eggs", id: "8010", name: "Premium Kadaknath Chicken Eggs - Pack of 6", uom: "Pack's" },
  { slNo: 7, category: "Eggs", id: "8011", name: "Jumbo Chicken Eggs - Pack of 6", uom: "Pack's" },
  { slNo: 8, category: "Eggs", id: "8267", name: "Premium Quail Eggs - Pack of 12", uom: "Pack's" },
  { slNo: 9, category: "Eggs", id: "8301", name: "Premium Duck Eggs - Pack of 6 Eggs", uom: "Pack's" },

  // Marinates (55 items)
  { slNo: 1, category: "Marinates", id: "", name: "Cheese Coen Nuggets", uom: "Pack's" },
  { slNo: 2, category: "Marinates", id: "", name: "Veg Burger Patty", uom: "Pack's" },
  { slNo: 3, category: "Marinates", id: "", name: "Crispy Chipotle Chicken Fries", uom: "Pack's" },
  { slNo: 4, category: "Marinates", id: "", name: "Chicken & Cheese Nuggets", uom: "Pack's" },
  { slNo: 5, category: "Marinates", id: "", name: "Crenchy Chicken Popcron", uom: "Pack's" },
  { slNo: 6, category: "Marinates", id: "", name: "Herb Roast Whole Chicken", uom: "Pack's" },
  { slNo: 7, category: "Marinates", id: "", name: "Crunchy Chicken Kebab Bites", uom: "Pack's" },
  { slNo: 8, category: "Marinates", id: "", name: "Chicken Schezwan Momos", uom: "Pack's" },
  { slNo: 9, category: "Marinates", id: "", name: "Chicken Momos", uom: "Pack's" },
  { slNo: 10, category: "Marinates", id: "", name: "Spicy Chicken Salami", uom: "Pack's" },
  { slNo: 11, category: "Marinates", id: "", name: "Butter Chicken Samosa", uom: "Pack's" },
  { slNo: 12, category: "Marinates", id: "", name: "Spicy Chicken Sausages", uom: "Pack's" },
  { slNo: 13, category: "Marinates", id: "", name: "Malabar Chicken Samosa", uom: "Pack's" },
  { slNo: 14, category: "Marinates", id: "", name: "Mutton Cutlets", uom: "Pack's" },
  { slNo: 15, category: "Marinates", id: "", name: "Tangy Chicken Ghee Roast", uom: "Pack's" },
  { slNo: 16, category: "Marinates", id: "", name: "Meaty Mutton Kakori Kebab", uom: "Pack's" },
  { slNo: 17, category: "Marinates", id: "", name: "African Peri Peri Chicken Drumsticks", uom: "Pack's" },
  { slNo: 18, category: "Marinates", id: "", name: "Peri Peri chicken Wings", uom: "Pack's" },
  { slNo: 19, category: "Marinates", id: "", name: "Murgh Kaali Mirch", uom: "Pack's" },
  { slNo: 20, category: "Marinates", id: "", name: "Gongura Chicken Andhra Style", uom: "Pack's" },
  { slNo: 21, category: "Marinates", id: "", name: "Goan Style Chicken Cafreal", uom: "Pack's" },
  { slNo: 22, category: "Marinates", id: "", name: "Lemon Pepper Chicken Wings", uom: "Pack's" },
  { slNo: 23, category: "Marinates", id: "", name: "Coconut Chutney", uom: "Pack's" },
  { slNo: 24, category: "Marinates", id: "", name: "Tomota Chutney", uom: "Pack's" },
  { slNo: 25, category: "Marinates", id: "", name: "Mint Chutney", uom: "Pack's" },
  { slNo: 26, category: "Marinates", id: "", name: "Wheat Parota", uom: "Pack's" },
  { slNo: 27, category: "Marinates", id: "", name: "Malabar Parota", uom: "Pack's" },
  { slNo: 28, category: "Marinates", id: "", name: "Chicken Burger Patty", uom: "Pack's" },
  { slNo: 29, category: "Marinates", id: "", name: "Andhra Spicy Green Chilly Chicken", uom: "Pack's" },
  { slNo: 30, category: "Marinates", id: "", name: "Chicken Dumplings Momos", uom: "Pack's" },
  { slNo: 31, category: "Marinates", id: "", name: "Meaty Chicken Punjabi Seekh Kebab", uom: "Pack's" },
  { slNo: 32, category: "Marinates", id: "", name: "Tender Chicken Malai Tikka", uom: "Pack's" },
  { slNo: 33, category: "Marinates", id: "", name: "Meaty Chicken Seekh Kebab", uom: "Pack's" },
  { slNo: 34, category: "Marinates", id: "", name: "Spicy Chettinad Chicken", uom: "Pack's" },
  { slNo: 35, category: "Marinates", id: "", name: "Marinated Tandoori Spring Chicken", uom: "Pack's" },
  { slNo: 36, category: "Marinates", id: "", name: "Kerala Prawn Roast", uom: "Pack's" },
  { slNo: 37, category: "Marinates", id: "", name: "Yummy Chicken cutlet", uom: "Pack's" },
  { slNo: 38, category: "Marinates", id: "", name: "Chicken Boneless 65", uom: "Pack's" },
  { slNo: 39, category: "Marinates", id: "", name: "Mackerel Pickel", uom: "Pack's" },
  { slNo: 40, category: "Marinates", id: "", name: "Chicken Breakfast Sausages", uom: "Pack's" },
  { slNo: 41, category: "Marinates", id: "", name: "Butter Chicken", uom: "Pack's" },
  { slNo: 42, category: "Marinates", id: "", name: "Achari Chicken Tikka", uom: "Pack's" },
  { slNo: 43, category: "Marinates", id: "", name: "Mutton Kheema Samosa", uom: "Pack's" },
  { slNo: 44, category: "Marinates", id: "", name: "Prawn Ghee Roast", uom: "Pack's" },
  { slNo: 45, category: "Marinates", id: "", name: "Manghsher Chop Mutton Cutlet", uom: "Pack's" },
  { slNo: 46, category: "Marinates", id: "", name: "Chicken Mince Dry Fry Kheema", uom: "Pack's" },
  { slNo: 47, category: "Marinates", id: "", name: "Coconut Chicken Curry", uom: "Pack's" },
  { slNo: 48, category: "Marinates", id: "", name: "Chicken Pepper Sausages", uom: "Pack's" },
  { slNo: 49, category: "Marinates", id: "", name: "Chicken & Cheese Cutlets", uom: "Pack's" },
  { slNo: 50, category: "Marinates", id: "", name: "Peri peri fried chicken", uom: "Pack's" },
  { slNo: 51, category: "Marinates", id: "", name: "Ghost chilly fried", uom: "Pack's" },
  { slNo: 52, category: "Marinates", id: "", name: "Lemon Fried chicken", uom: "Pack's" },
  { slNo: 53, category: "Marinates", id: "", name: "Spicy chicken lollipop", uom: "Pack's" },
  { slNo: 54, category: "Marinates", id: "", name: "Spicy chicken wings", uom: "Pack's" },
  { slNo: 55, category: "Marinates", id: "", name: "Mutton Seek kabab", uom: "Pack's" },

  // Heat & Eat (13 items)
  { slNo: 1, category: "Heat & Eat", id: "12962", name: "Idli + Sambar", uom: "Pack's" },
  { slNo: 2, category: "Heat & Eat", id: "12963", name: "Medu Vada + Sambar", uom: "Pack's" },
  { slNo: 3, category: "Heat & Eat", id: "12571", name: "Poha", uom: "Pack's" },
  { slNo: 4, category: "Heat & Eat", id: "12744", name: "Madras Chicken Fry", uom: "Pack's" },
  { slNo: 5, category: "Heat & Eat", id: "12748", name: "Prawns Dry Fry", uom: "Pack's" },
  { slNo: 6, category: "Heat & Eat", id: "12964", name: "Paneer Tikka", uom: "Pack's" },
  { slNo: 7, category: "Heat & Eat", id: "10876", name: "Hyderabadi Chicken Dum Biryani", uom: "Pack's" },
  { slNo: 8, category: "Heat & Eat", id: "13076", name: "Lebanese Minced Chicken Rice / Chicken Hashweh", uom: "Pack's" },
  { slNo: 9, category: "Heat & Eat", id: "12754", name: "Chicken Fried Rice & Chicken Manchurian", uom: "Pack's" },
  { slNo: 10, category: "Heat & Eat", id: "12265", name: "Chicken Alfredo Penne Pasta", uom: "Pack's" },
  { slNo: 11, category: "Heat & Eat", id: "12759", name: "Chicken Ghee Roast & Rice", uom: "Pack's" },
  { slNo: 12, category: "Heat & Eat", id: "12763", name: "Fish Pothichoru", uom: "Pack's" },
  { slNo: 13, category: "Heat & Eat", id: "12761", name: "Methi Malai Chicken & Matar Rice", uom: "Pack's" }
];

