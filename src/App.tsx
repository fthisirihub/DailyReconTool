import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  BarChart3,
  ClipboardList,
  Scale,
  TrendingUp,
  Link2,
  Code2,
  Sun,
  Sunset,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  DollarSign,
  Package,
  Terminal,
  ShieldCheck,
  KeyRound,
  Upload,
  Eye,
  Send,
  Table as TableIcon,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers,
  FileSpreadsheet,
  PlusCircle,
  ExternalLink,
  RotateCcw,
  Loader2,
  Trash2,
  Zap
} from 'lucide-react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  INITIAL_MASTER_ITEMS,
  MONTH_SHEET_PRESETS,
  TrackerMonthSheet,
  MasterItem,
  InvoiceLineItem,
  PosSaleItem
} from './data/sampleData';
import { PYTHON_FILES, PythonFileDoc } from './data/pythonSourceCode';
import { parseFreshToHomePdf } from './utils/pdfParser';
import { parsePosSalesWorkbook, parseClosingStockWorkbook } from './utils/fileParsers';
import { pushToGoogleSheetTab, GoogleSheetsAuthConfig, extractSpreadsheetId } from './utils/googleSheetsService';
import { GoogleSheetsConnectModal } from './components/GoogleSheetsConnectModal';

type TabType = 'reconcile' | 'mod1' | 'mod2' | 'mod3' | 'profit' | 'mapper' | 'python_code';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('reconcile');

  // ---------------- MONTHLY SHEET SELECTION STATE ----------------
  const [monthSheets, setMonthSheets] = useState<TrackerMonthSheet[]>(MONTH_SHEET_PRESETS);
  const [selectedMonthSheet, setSelectedMonthSheet] = useState<TrackerMonthSheet>(MONTH_SHEET_PRESETS[0]);
  const [showAddSheetModal, setShowAddSheetModal] = useState<boolean>(false);
  const [newSheetName, setNewSheetName] = useState<string>('');
  const [newSheetId, setNewSheetId] = useState<string>('');

  // ---------------- DATE & DAY (1..30) SELECTION STATE ----------------
  // Tracker sheet has sheet name nth day indicating day of the month (1, 2, 3 ... 30)
  const [selectedDay, setSelectedDay] = useState<number>(10);
  const [selectedDateIso, setSelectedDateIso] = useState<string>('2026-11-10');

  // Master items stored per day of month: day -> MasterItem[]
  const [dailyMasterData, setDailyMasterData] = useState<Record<number, MasterItem[]>>(() => {
    const map: Record<number, MasterItem[]> = {};
    for (let d = 1; d <= 30; d++) {
      if (d === 10) {
        map[d] = JSON.parse(JSON.stringify(INITIAL_MASTER_ITEMS));
      } else {
        // baseline items for other days
        map[d] = INITIAL_MASTER_ITEMS.map(i => ({
          ...i,
          morningStock: 0,
          afternoonStock: 0,
          totalSales: 0,
          closingStock: 0,
          totalInventory: i.openingStock - i.returnWastage,
          shrinkage: -(i.openingStock - i.returnWastage)
        }));
      }
    }
    return map;
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Current active day's master items
  const currentDayItems = useMemo(() => {
    return dailyMasterData[selectedDay] || INITIAL_MASTER_ITEMS;
  }, [dailyMasterData, selectedDay]);

  // ---------------- GOOGLE SHEETS AUTHENTICATION & PUSH STATE ----------------
  const [authConfig, setAuthConfig] = useState<GoogleSheetsAuthConfig>(() => {
    try {
      const saved = localStorage.getItem('freshstock_google_auth');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [pendingPushAction, setPendingPushAction] = useState<(() => Promise<void>) | null>(null);
  const [pendingPushDescription, setPendingPushDescription] = useState<string>('');
  const [isPushingMod1, setIsPushingMod1] = useState(false);
  const [isPushingMod2, setIsPushingMod2] = useState(false);
  const [isPushingMod3, setIsPushingMod3] = useState(false);

  const handleSaveAuth = (cfg: GoogleSheetsAuthConfig) => {
    setAuthConfig(cfg);
    try {
      localStorage.setItem('freshstock_google_auth', JSON.stringify(cfg));
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------- DAY-ISOLATED UPLOAD STATE ----------------
  // Each day stores its own uploaded files & parsed preview data so changing days never leaks previews!
  interface DayUploadState {
    invoiceItems: InvoiceLineItem[];
    invoiceFileName: string;
    invoiceMeta: {
      invoiceNo: string;
      orderNo: string;
      date: string;
      slot: string;
      grandTotal: number;
    } | null;
    posSales: PosSaleItem[];
    posFileName: string;
    availablePosDates: string[];
    closingMap: Record<string, number>;
    closingFileName: string;
    availableClosingDates: string[];
  }

  const [dayUploads, setDayUploads] = useState<Record<number, DayUploadState>>({});

  // Current active day's upload data
  const currentDayUpload = useMemo<DayUploadState>(() => {
    return dayUploads[selectedDay] || {
      invoiceItems: [],
      invoiceFileName: '',
      invoiceMeta: null,
      posSales: [],
      posFileName: '',
      availablePosDates: [],
      closingMap: {},
      closingFileName: '',
      availableClosingDates: []
    };
  }, [dayUploads, selectedDay]);

  const stagedInvoiceItems = currentDayUpload.invoiceItems;
  const invoiceFileName = currentDayUpload.invoiceFileName;
  const invoiceMeta = currentDayUpload.invoiceMeta;
  const stagedPosSales = currentDayUpload.posSales;
  const posFileName = currentDayUpload.posFileName;
  const availablePosDates = currentDayUpload.availablePosDates;
  const stagedClosingMap = currentDayUpload.closingMap;
  const closingFileName = currentDayUpload.closingFileName;
  const availableClosingDates = currentDayUpload.availableClosingDates;

  // ---------------- MODULE 1: FreshToHome PDF State ----------------
  const [deliveryPeriod, setDeliveryPeriod] = useState<'Morning' | 'Afternoon'>('Morning');
  const [invoiceNotification, setInvoiceNotification] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const fileInputRefPdf = useRef<HTMLInputElement>(null);

  // ---------------- MODULE 2: POS EOD Sales State ----------------
  const [salesNotification, setSalesNotification] = useState<string | null>(null);
  const [isUploadingPos, setIsUploadingPos] = useState(false);
  const fileInputRefPos = useRef<HTMLInputElement>(null);

  // ---------------- MODULE 3: Closing Stock State ----------------
  const [closingDateStr, setClosingDateStr] = useState<string>('10-11');
  const [closingNotification, setClosingNotification] = useState<string | null>(null);
  const [isUploadingClosing, setIsUploadingClosing] = useState(false);
  const fileInputRefClosing = useRef<HTMLInputElement>(null);

  // ---------------- Code viewer state ----------------
  const [selectedCodeFile, setSelectedCodeFile] = useState<PythonFileDoc>(PYTHON_FILES[0]);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // ---------------- INVENTORY TRACKER FILE PATH / SHEET INPUT PER MODULE ----------------
  const [trackerFilePathMod1, setTrackerFilePathMod1] = useState<string>(MONTH_SHEET_PRESETS[0].sheetId);
  const [trackerFilePathMod2, setTrackerFilePathMod2] = useState<string>(MONTH_SHEET_PRESETS[0].sheetId);
  const [trackerFilePathMod3, setTrackerFilePathMod3] = useState<string>(MONTH_SHEET_PRESETS[0].sheetId);

  // Clear preview handlers (strictly resets active day's uploaded file for this module)
  const handleClearMod1Preview = () => {
    setDayUploads(prev => {
      const curr = prev[selectedDay] || {
        invoiceItems: [],
        invoiceFileName: '',
        invoiceMeta: null,
        posSales: [],
        posFileName: '',
        availablePosDates: [],
        closingMap: {},
        closingFileName: '',
        availableClosingDates: []
      };
      return {
        ...prev,
        [selectedDay]: {
          ...curr,
          invoiceItems: [],
          invoiceFileName: '',
          invoiceMeta: null
        }
      };
    });
    setInvoiceNotification(`🧹 Cleared FreshToHome preview data for Day ${selectedDay}. Ready for next file upload.`);
    setTimeout(() => setInvoiceNotification(null), 4000);
  };

  const handleClearMod2Preview = () => {
    setDayUploads(prev => {
      const curr = prev[selectedDay] || {
        invoiceItems: [],
        invoiceFileName: '',
        invoiceMeta: null,
        posSales: [],
        posFileName: '',
        availablePosDates: [],
        closingMap: {},
        closingFileName: '',
        availableClosingDates: []
      };
      return {
        ...prev,
        [selectedDay]: {
          ...curr,
          posSales: [],
          posFileName: ''
        }
      };
    });
    setSalesNotification(`🧹 Cleared POS sales preview data for Day ${selectedDay}. Ready for next file upload.`);
    setTimeout(() => setSalesNotification(null), 4000);
  };

  const handleClearMod3Preview = () => {
    setDayUploads(prev => {
      const curr = prev[selectedDay] || {
        invoiceItems: [],
        invoiceFileName: '',
        invoiceMeta: null,
        posSales: [],
        posFileName: '',
        availablePosDates: [],
        closingMap: {},
        closingFileName: '',
        availableClosingDates: []
      };
      return {
        ...prev,
        [selectedDay]: {
          ...curr,
          closingMap: {},
          closingFileName: ''
        }
      };
    });
    setClosingNotification(`🧹 Cleared closing stock preview data for Day ${selectedDay}. Ready for next file upload.`);
    setTimeout(() => setClosingNotification(null), 4000);
  };

  // ---------------- MASTER CLEAR FOR THE DAY ----------------
  // Clears all data for the day: resets Master Tracker table numbers and wipes all 3 preview modules
  const handleMasterClearDay = () => {
    // 1. Reset Master Tracker entries for selectedDay
    setDailyMasterData(prev => {
      const existing = prev[selectedDay] || INITIAL_MASTER_ITEMS;
      const cleared = existing.map(item => ({
        ...item,
        morningStock: 0,
        afternoonStock: 0,
        returnWastage: 0,
        totalSales: 0,
        closingStock: 0,
        totalInventory: item.openingStock,
        shrinkage: -item.openingStock,
        variance: -item.openingStock,
        varianceLoss: 0,
        status: 'Shortage / Shrinkage' as const
      }));
      return {
        ...prev,
        [selectedDay]: cleared
      };
    });

    // 2. Wipe preview uploads for selectedDay
    setDayUploads(prev => ({
      ...prev,
      [selectedDay]: {
        invoiceItems: [],
        invoiceFileName: '',
        invoiceMeta: null,
        posSales: [],
        posFileName: '',
        availablePosDates: [],
        closingMap: {},
        closingFileName: '',
        availableClosingDates: []
      }
    }));

    // 3. Clear all module notifications and show master toast
    setInvoiceNotification(`🧹 Master Clear executed: All numbers in Master Tracker (Tab "${selectedDay}") and all uploaded preview data for Day ${selectedDay} have been reset.`);
    setSalesNotification(null);
    setClosingNotification(null);
    setTimeout(() => setInvoiceNotification(null), 6000);
  };


  // Categories
  const categories = useMemo(() => {
    const set = new Set(currentDayItems.map(i => i.category));
    return ['All', ...Array.from(set)];
  }, [currentDayItems]);

  // Recalculated items preserving formulas
  const calculatedItems = useMemo(() => {
    return currentDayItems.map(item => {
      // Total Inventory Col J = Opening (F) + Morning (G) + Afternoon (H) - Wastage (I)
      const totInv = Number((item.openingStock + item.morningStock + item.afternoonStock - item.returnWastage).toFixed(3));
      // Expected Closing = Total Inventory (J) - Total Sales (K)
      const expClosing = Number((totInv - item.totalSales).toFixed(3));
      // Variance = Actual Closing (L) - Expected Closing
      const variance = Number((item.closingStock - expClosing).toFixed(3));
      // Variance Loss = |Variance| * Unit Cost (if variance < 0)
      const varianceLoss = variance < -0.01 ? Number((Math.abs(variance) * item.unitCost).toFixed(2)) : 0;

      let status: 'Exact Match' | 'Shortage / Shrinkage' | 'Surplus' = 'Exact Match';
      if (variance < -0.01) status = 'Shortage / Shrinkage';
      else if (variance > 0.01) status = 'Surplus';

      return {
        ...item,
        totalInventory: totInv,
        expectedClosing: expClosing,
        variance,
        varianceLoss,
        status
      };
    });
  }, [currentDayItems]);

  // Filtered master items
  const filteredItems = useMemo(() => {
    return calculatedItems.filter(item => {
      const matchCat = categoryFilter === 'All' || item.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [calculatedItems, categoryFilter, searchQuery]);

  // High-level KPI aggregations
  const stats = useMemo(() => {
    let exactCount = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let totalShrinkageLoss = 0;
    let totalOpeningKg = 0;
    let totalSalesKg = 0;
    let totalCogs = 0;

    calculatedItems.forEach(i => {
      if (i.status === 'Exact Match') exactCount++;
      else if (i.status === 'Shortage / Shrinkage') shortageCount++;
      else surplusCount++;

      totalShrinkageLoss += i.varianceLoss;
      totalOpeningKg += i.openingStock;
      totalSalesKg += i.totalSales;
      totalCogs += (i.totalSales * i.unitCost);
    });

    const approvedPosRev = stagedPosSales.reduce((acc, curr) => acc + (curr.approved ? curr.totalPrice : 0), 0);
    const totalSalesRev = approvedPosRev > 0
      ? approvedPosRev
      : calculatedItems.reduce((acc, curr) => acc + (curr.totalSales * (curr.unitCost > 0 ? curr.unitCost * 1.35 : 0)), 0);
    const grossProfit = totalSalesRev - totalCogs;
    const netProfit = grossProfit - totalShrinkageLoss;
    const netMarginPct = totalSalesRev > 0 ? (netProfit / totalSalesRev) * 100 : 0;

    return {
      exactCount,
      shortageCount,
      surplusCount,
      totalShrinkageLoss,
      totalOpeningKg,
      totalSalesKg,
      totalSalesRev,
      totalCogs,
      grossProfit,
      netProfit,
      netMarginPct
    };
  }, [calculatedItems, stagedPosSales]);

  // Helper when changing date
  const handleDateChange = (newIsoDate: string) => {
    setSelectedDateIso(newIsoDate);
    try {
      const parsed = new Date(newIsoDate);
      if (!isNaN(parsed.getDate())) {
        const day = parsed.getDate();
        setSelectedDay(day);

        // Update corresponding closing date string e.g. "10-11"
        const monthNum = parsed.getMonth() + 1;
        setClosingDateStr(`${day}-${monthNum}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // keep month 11 (Nov 2026) in sync
    const padDay = day < 10 ? `0${day}` : `${day}`;
    setSelectedDateIso(`2026-11-${padDay}`);
    setClosingDateStr(`${day}-11`);
  };

  // ---------------- HANDLERS FOR MODULE 1 (FreshToHome PDF) ----------------
  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);

    try {
      const masterNames = currentDayItems.map(m => m.name);
      const parsed = await parseFreshToHomePdf(file, masterNames);

      if (parsed.deliveryPeriod) {
        setDeliveryPeriod(parsed.deliveryPeriod);
      }

      const mappedItems: InvoiceLineItem[] = parsed.items.map((it, idx) => ({
        id: it.id || `inv_${idx + 1}`,
        description: it.itemDescription,
        hsn: '02071300',
        unitPrice: it.unitPrice,
        qty: it.qty,
        uom: it.uom,
        discount: 0,
        subtotal: it.subtotal,
        mappedMasterName: it.mappedMasterName
      }));

      // Strictly save file and parsed items to selectedDay ONLY
      setDayUploads(prev => {
        const curr = prev[selectedDay] || {
          invoiceItems: [],
          invoiceFileName: '',
          invoiceMeta: null,
          posSales: [],
          posFileName: '',
          availablePosDates: [],
          closingMap: {},
          closingFileName: '',
          availableClosingDates: []
        };
        return {
          ...prev,
          [selectedDay]: {
            ...curr,
            invoiceFileName: file.name,
            invoiceMeta: {
              invoiceNo: parsed.invoiceNo,
              orderNo: parsed.orderNo,
              date: parsed.date,
              slot: parsed.slot,
              grandTotal: parsed.grandTotal
            },
            invoiceItems: mappedItems
          }
        };
      });

      setInvoiceNotification(`🎉 Uploaded & parsed "${file.name}". Displaying exactly ${mappedItems.length} items for Day ${selectedDay}.`);
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      setInvoiceNotification(`⚠️ Error parsing PDF: ${err.message || 'Could not extract items'}`);
    } finally {
      setIsUploadingPdf(false);
      if (e.target) e.target.value = '';
    }
  };

  const executePushInvoice = async (sheetTarget: string) => {
    setIsPushingMod1(true);
    try {
      // 1. Update local Master Tracker tab
      const targetDayItems = JSON.parse(JSON.stringify(dailyMasterData[selectedDay] || INITIAL_MASTER_ITEMS));
      let matchedCount = 0;

      stagedInvoiceItems.forEach(invItem => {
        const target = targetDayItems.find((m: MasterItem) => m.name.toLowerCase() === invItem.mappedMasterName.toLowerCase());
        if (target) {
          if (deliveryPeriod === 'Morning') {
            target.morningStock = invItem.qty;
          } else {
            target.afternoonStock = invItem.qty;
          }
          target.unitCost = invItem.unitPrice;
          matchedCount++;
        }
      });

      setDailyMasterData(prev => ({
        ...prev,
        [selectedDay]: targetDayItems
      }));

      // 2. Real Google Sheets API Push
      const colLetter = deliveryPeriod === 'Morning' ? 'G' : 'H';
      const itemsToPush = stagedInvoiceItems.map(it => ({
        itemName: it.mappedMasterName,
        value: it.qty,
        unitCost: it.unitPrice
      }));

      const result = await pushToGoogleSheetTab(
        sheetTarget,
        selectedDay,
        deliveryPeriod === 'Morning' ? 'morning' : 'afternoon',
        itemsToPush,
        authConfig
      );

      setInvoiceNotification(`🚀 GOOGLE SHEET UPDATED: ${result.message}`);
      setTimeout(() => setInvoiceNotification(null), 8000);
    } catch (err: any) {
      console.error('Google Sheet push error:', err);
      if (err.message === 'AUTH_REQUIRED' || err.message.includes('authorization') || err.message.includes('401')) {
        setPendingPushDescription(`Pushing ${stagedInvoiceItems.length} FreshToHome items to Tab "${selectedDay}" (Column ${deliveryPeriod === 'Morning' ? 'G: Morning' : 'H: Afternoon'})`);
        setPendingPushAction(() => () => executePushInvoice(sheetTarget));
        setShowConnectModal(true);
      } else {
        setInvoiceNotification(`⚠️ Push Failed: ${err.message}`);
      }
    } finally {
      setIsPushingMod1(false);
    }
  };

  const handlePushInvoiceToTracker = async () => {
    if (stagedInvoiceItems.length === 0) {
      setInvoiceNotification('⚠️ No preview items to push. Please upload a FreshToHome PDF first.');
      return;
    }
    const sheetTarget = trackerFilePathMod1.trim() || selectedMonthSheet.sheetId;

    if (!authConfig.accessToken && !authConfig.webhookUrl) {
      setPendingPushDescription(`Pushing ${stagedInvoiceItems.length} items to Tab "${selectedDay}" (Column ${deliveryPeriod === 'Morning' ? 'G: Morning' : 'H: Afternoon'})`);
      setPendingPushAction(() => () => executePushInvoice(sheetTarget));
      setShowConnectModal(true);
      return;
    }

    await executePushInvoice(sheetTarget);
  };

  // ---------------- HANDLERS FOR MODULE 2 (POS Sales Excel/CSV) ----------------
  const handlePosFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPos(true);

    try {
      const data = await file.arrayBuffer();
      const masterNames = currentDayItems.map(m => m.name);
      const res = parsePosSalesWorkbook(data, selectedDay, masterNames);

      // Strictly save file and parsed sales items to selectedDay ONLY
      setDayUploads(prev => {
        const curr = prev[selectedDay] || {
          invoiceItems: [],
          invoiceFileName: '',
          invoiceMeta: null,
          posSales: [],
          posFileName: '',
          availablePosDates: [],
          closingMap: {},
          closingFileName: '',
          availableClosingDates: []
        };
        return {
          ...prev,
          [selectedDay]: {
            ...curr,
            posFileName: file.name,
            availablePosDates: res.dates,
            posSales: res.items
          }
        };
      });

      setSalesNotification(`🎉 Successfully parsed "${file.name}". Displaying ${res.items.length} items sold for Day ${selectedDay}.`);
    } catch (err: any) {
      console.error(err);
      setSalesNotification(`⚠️ Error reading POS file: ${err.message || 'Invalid format'}`);
    } finally {
      setIsUploadingPos(false);
      if (e.target) e.target.value = '';
    }
  };

  const executePushSales = async (sheetTarget: string) => {
    setIsPushingMod2(true);
    try {
      const approvedItems = stagedPosSales.filter(s => s.approved);
      // 1. Update local Master Tracker tab
      const targetDayItems = JSON.parse(JSON.stringify(dailyMasterData[selectedDay] || INITIAL_MASTER_ITEMS));
      let count = 0;

      approvedItems.forEach(s => {
        const target = targetDayItems.find((m: MasterItem) => m.name.toLowerCase() === s.mappedMasterName.toLowerCase());
        if (target) {
          target.totalSales = s.quantitySold;
          count++;
        }
      });

      setDailyMasterData(prev => ({
        ...prev,
        [selectedDay]: targetDayItems
      }));

      // 2. Real Google Sheets API Push
      const itemsToPush = approvedItems.map(s => ({
        itemName: s.mappedMasterName,
        value: s.quantitySold
      }));

      const result = await pushToGoogleSheetTab(
        sheetTarget,
        selectedDay,
        'pos_sales',
        itemsToPush,
        authConfig
      );

      setSalesNotification(`🚀 GOOGLE SHEET UPDATED: ${result.message}`);
      setTimeout(() => setSalesNotification(null), 8000);
    } catch (err: any) {
      console.error('Google Sheet push error:', err);
      if (err.message === 'AUTH_REQUIRED' || err.message.includes('authorization') || err.message.includes('401')) {
        setPendingPushDescription(`Pushing approved POS sales to Tab "${selectedDay}" (Column K: Total Sales)`);
        setPendingPushAction(() => () => executePushSales(sheetTarget));
        setShowConnectModal(true);
      } else {
        setSalesNotification(`⚠️ Push Failed: ${err.message}`);
      }
    } finally {
      setIsPushingMod2(false);
    }
  };

  const handlePushSalesToTracker = async () => {
    const approvedItems = stagedPosSales.filter(s => s.approved);
    if (approvedItems.length === 0) {
      setSalesNotification('⚠️ Please approve at least one POS sales row before pushing.');
      return;
    }
    const sheetTarget = trackerFilePathMod2.trim() || selectedMonthSheet.sheetId;

    if (!authConfig.accessToken && !authConfig.webhookUrl) {
      setPendingPushDescription(`Pushing ${approvedItems.length} approved sales rows to Tab "${selectedDay}" (Column K: Total Sales)`);
      setPendingPushAction(() => () => executePushSales(sheetTarget));
      setShowConnectModal(true);
      return;
    }

    await executePushSales(sheetTarget);
  };

  // ---------------- HANDLERS FOR MODULE 3 (Closing Stock) ----------------
  const handleClosingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingClosing(true);

    try {
      const data = await file.arrayBuffer();
      const res = parseClosingStockWorkbook(data, closingDateStr || `${selectedDay}-11`);

      // Strictly save file and parsed closing stock to selectedDay ONLY
      setDayUploads(prev => {
        const curr = prev[selectedDay] || {
          invoiceItems: [],
          invoiceFileName: '',
          invoiceMeta: null,
          posSales: [],
          posFileName: '',
          availablePosDates: [],
          closingMap: {},
          closingFileName: '',
          availableClosingDates: []
        };
        return {
          ...prev,
          [selectedDay]: {
            ...curr,
            closingFileName: file.name,
            availableClosingDates: res.dateHeaders,
            closingMap: res.closingMap
          }
        };
      });

      setClosingNotification(`🎉 Loaded Closing Stock for ${Object.keys(res.closingMap).length} items from "${file.name}" for Day ${selectedDay}.`);
    } catch (err: any) {
      console.error(err);
      setClosingNotification(`⚠️ Error reading Closing Stock file: ${err.message || 'Invalid format'}`);
    } finally {
      setIsUploadingClosing(false);
      if (e.target) e.target.value = '';
    }
  };

  const executePushClosing = async (sheetTarget: string) => {
    setIsPushingMod3(true);
    try {
      const items = Object.entries(stagedClosingMap);
      // 1. Update local Master Tracker tab
      const targetDayItems = JSON.parse(JSON.stringify(dailyMasterData[selectedDay] || INITIAL_MASTER_ITEMS));
      let count = 0;

      items.forEach(([itemName, closingQty]) => {
        const target = targetDayItems.find((m: MasterItem) => m.name.toLowerCase() === itemName.toLowerCase());
        if (target) {
          target.closingStock = closingQty;
          count++;
        }
      });

      setDailyMasterData(prev => ({
        ...prev,
        [selectedDay]: targetDayItems
      }));

      // 2. Real Google Sheets API Push
      const itemsToPush = items.map(([name, qty]) => ({
        itemName: name,
        value: qty
      }));

      const result = await pushToGoogleSheetTab(
        sheetTarget,
        selectedDay,
        'closing_stock',
        itemsToPush,
        authConfig
      );

      setClosingNotification(`🚀 GOOGLE SHEET UPDATED: ${result.message}`);
      setTimeout(() => setClosingNotification(null), 8000);
    } catch (err: any) {
      console.error('Google Sheet push error:', err);
      if (err.message === 'AUTH_REQUIRED' || err.message.includes('authorization') || err.message.includes('401')) {
        setPendingPushDescription(`Pushing closing stock to Tab "${selectedDay}" (Column L: Closing Stock)`);
        setPendingPushAction(() => () => executePushClosing(sheetTarget));
        setShowConnectModal(true);
      } else {
        setClosingNotification(`⚠️ Push Failed: ${err.message}`);
      }
    } finally {
      setIsPushingMod3(false);
    }
  };

  const handlePushClosingToTracker = async () => {
    const items = Object.entries(stagedClosingMap);
    if (items.length === 0) {
      setClosingNotification('⚠️ No closing stock data to push. Please upload a closing stock file first.');
      return;
    }
    const sheetTarget = trackerFilePathMod3.trim() || selectedMonthSheet.sheetId;

    if (!authConfig.accessToken && !authConfig.webhookUrl) {
      setPendingPushDescription(`Pushing ${items.length} closing stock items to Tab "${selectedDay}" (Column L: Closing Stock)`);
      setPendingPushAction(() => () => executePushClosing(sheetTarget));
      setShowConnectModal(true);
      return;
    }

    await executePushClosing(sheetTarget);
  };

  // Add Custom Month Sheet
  const handleAddNewMonthSheet = () => {
    if (!newSheetName.trim() || !newSheetId.trim()) return;
    const newSheet: TrackerMonthSheet = {
      id: `custom_${Date.now()}`,
      name: newSheetName.trim(),
      monthYear: 'Custom Month',
      sheetId: newSheetId.trim()
    };
    setMonthSheets(prev => [...prev, newSheet]);
    setSelectedMonthSheet(newSheet);
    setShowAddSheetModal(false);
    setNewSheetName('');
    setNewSheetId('');
  };

  // Download ZIP
  const handleDownloadAllZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();
      const folder = zip.folder('freshstock_desktop_app');

      PYTHON_FILES.forEach(file => {
        folder?.file(file.filename, file.code);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'freshstock_python_desktop_app.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedCodeFile.code);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* -------------------- SIDEBAR -------------------- */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Logo */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Scale className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                FreshStock <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">PRO</span>
              </h1>
              <p className="text-xs text-slate-400">Daily Stock Reconciliation</p>
            </div>
          </div>

          {/* Active Target Configuration Badge */}
          <div className="p-3 mx-3 my-2 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Active Target Tab:</span>
              <span className="font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Tab "{selectedDay}"
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-medium truncate" title={selectedMonthSheet.name}>
              {selectedMonthSheet.name}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Master Daily Tracker
            </div>

            <button
              onClick={() => setActiveTab('reconcile')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reconcile'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4 shrink-0" />
              <span>Master Tracker (Tab "{selectedDay}")</span>
            </button>

            <div className="pt-3 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Daily Upload &amp; Push Modules
            </div>

            <button
              onClick={() => setActiveTab('mod1')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'mod1'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4 shrink-0" />
                <span>1. FreshToHome PDF</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">Col G/H</span>
            </button>

            <button
              onClick={() => setActiveTab('mod2')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'mod2'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>2. POS Sales Report</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 border border-slate-700">Col K</span>
            </button>

            <button
              onClick={() => setActiveTab('mod3')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'mod3'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>3. Closing Stock File</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">Col L</span>
            </button>

            <div className="pt-3 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Financials &amp; Tools
            </div>

            <button
              onClick={() => setActiveTab('profit')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profit'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Profit Margin Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('mapper')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'mapper'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Link2 className="w-4 h-4 shrink-0" />
              <span>Cross-Source Mapper</span>
            </button>

            <button
              onClick={() => setActiveTab('python_code')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'python_code'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Python Desktop App</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Formula Protection</span>
            <span className="flex items-center text-emerald-400 gap-1 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" /> Enforced
            </span>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            Cols J (Inventory) &amp; M (Shrinkage) formulas are strictly protected from overwrite.
          </div>
        </div>
      </aside>

      {/* -------------------- MAIN WORKSPACE -------------------- */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Global Control Header: Month Sheet Selector + Date Picker */}
        {/* Global Control Header: Cleanly Aligned & Responsive */}
        <header className="border-b border-slate-800/80 px-4 sm:px-6 py-2.5 bg-slate-900/70 backdrop-blur shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left Cluster: Monthly Sheet & Google Connection Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Monthly Google Sheet Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Sheet:</span>
                <select
                  value={selectedMonthSheet.id}
                  onChange={e => {
                    const found = monthSheets.find(s => s.id === e.target.value);
                    if (found) setSelectedMonthSheet(found);
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none font-medium max-w-[170px] sm:max-w-[220px] md:max-w-[280px] truncate cursor-pointer"
                  title={selectedMonthSheet.name}
                >
                  {monthSheets.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddSheetModal(true)}
                  title="Add New Month Google Sheet"
                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>

              {/* Google Sheets Connection Status Button */}
              <button
                onClick={() => setShowConnectModal(true)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 shadow-sm ${
                  authConfig.accessToken || authConfig.webhookUrl
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                }`}
                title="Configure Google Sheets real-time connection credentials (OAuth Token or Apps Script Webhook)"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">
                  {authConfig.accessToken || authConfig.webhookUrl ? '🟢 Sheet Connected' : '⚪ Connect Google Sheet'}
                </span>
              </button>
            </div>

            {/* Right Cluster: Date Picker, Target Tab & Daily Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Picker & Target Tab Badge */}
              <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 shadow-sm">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-400 whitespace-nowrap">Date:</span>
                <input
                  type="date"
                  value={selectedDateIso}
                  onChange={e => handleDateChange(e.target.value)}
                  className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
                />
                <span className="text-slate-600">|</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">Target Tab:</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">
                  "{selectedDay}"
                </span>
              </div>

              {/* Master Clear Button for the Selected Day */}
              <button
                onClick={handleMasterClearDay}
                title={`Master Clear: Reset all numbers in Master Tracker (Tab "${selectedDay}") and wipe all uploaded preview files for Day ${selectedDay}`}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all shadow-sm shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Master Clear (Day {selectedDay})</span>
              </button>

              {/* Quick Python Desktop App Link */}
              <button
                onClick={() => setActiveTab('python_code')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors shrink-0 whitespace-nowrap"
                title="View & Download Python Desktop Application Codebase"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Python App</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: MASTER DAILY TRACKER & RECONCILIATION                              */}
          {/* ========================================================================= */}
          {activeTab === 'reconcile' && (
            <div className="space-y-6">
              {/* Day Tabs Bar (1 .. 30) */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold text-slate-300">Select Day of Month (Worksheet Tab in Google Sheet):</span>
                  <span className="text-[11px] font-mono text-emerald-400">Current Tab: Sheet "{selectedDay}"</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(dayNum => (
                    <button
                      key={dayNum}
                      onClick={() => handleDayClick(dayNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                        selectedDay === dayNum
                          ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30'
                          : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {dayNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric Cards Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Exact Matches</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.exactCount}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Variance == 0 kg/units</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Stock Shortage / Shrinkage</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-400">{stats.shortageCount}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Actual &lt; Expected Closing</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Surplus Items</span>
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-blue-400">{stats.surplusCount}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Actual &gt; Expected Closing</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Total Shrinkage Loss</span>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-400">₹{stats.totalShrinkageLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Deducted from Net Profit</p>
                </div>
              </div>

              {/* Table Controls (Filters & Search) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-400 shrink-0">Category:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                          categoryFilter === cat
                            ? 'bg-emerald-500 text-white font-medium'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search item or ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Master Daily Inventory Tracker Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                  <div className="flex items-center space-x-2">
                    <span>Tracker Worksheet Tab: <strong className="text-emerald-400 font-mono">"{selectedDay}"</strong></span>
                    <span className="text-slate-400">in {selectedMonthSheet.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Formula Cells: <span className="text-slate-300 font-mono">Col J: Total Inv</span> | <span className="text-slate-300 font-mono">Col M: Shrinkage</span>
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-3">SL</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Product Name (Col D)</th>
                        <th className="py-3 px-3">UOM</th>
                        <th className="py-3 px-3 text-right">Opening (F)</th>
                        <th className="py-3 px-3 text-right bg-emerald-950/20 text-emerald-400">Morning (G)</th>
                        <th className="py-3 px-3 text-right bg-emerald-950/20 text-emerald-400">Evening (H)</th>
                        <th className="py-3 px-3 text-right">Wastage (I)</th>
                        <th className="py-3 px-3 text-right bg-slate-800/40 font-bold">Total Inv (J)</th>
                        <th className="py-3 px-3 text-right bg-blue-950/20 text-blue-400">Sales (K)</th>
                        <th className="py-3 px-3 text-right bg-indigo-950/20 text-indigo-400">Closing (L)</th>
                        <th className="py-3 px-3 text-right bg-slate-800/40 font-bold">Shrinkage (M)</th>
                        <th className="py-3 px-3 text-right">Shrinkage ₹</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredItems.map(item => (
                        <tr key={item.id + item.name} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400">{item.slNo}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-300">{item.category}</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-white">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{item.uom}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{item.openingStock}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold bg-emerald-950/10">{item.morningStock}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold bg-emerald-950/10">{item.afternoonStock}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">{item.returnWastage}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300 bg-slate-800/20 font-bold">{item.totalInventory}</td>
                          <td className="py-2.5 px-3 text-right text-blue-400 font-semibold bg-blue-950/10">{item.totalSales}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-400 font-semibold bg-indigo-950/10">{item.closingStock}</td>
                          <td className={`py-2.5 px-3 text-right font-bold bg-slate-800/20 ${
                            item.variance < -0.01 ? 'text-rose-400' : item.variance > 0.01 ? 'text-blue-400' : 'text-emerald-400'
                          }`}>
                            {item.variance > 0 ? `+${item.variance}` : item.variance}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-400">
                            {item.varianceLoss > 0 ? `₹${item.varianceLoss.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-sans font-medium border ${
                              item.status === 'Exact Match'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : item.status === 'Shortage / Shrinkage'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MODULE 1 (FreshToHome Inward PDF)                                  */}
          {/* ========================================================================= */}
          {activeTab === 'mod1' && (
            <div className="space-y-6">
              {invoiceNotification && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span>{invoiceNotification}</span>
                  <button onClick={() => setInvoiceNotification(null)} className="text-emerald-400 hover:underline">Dismiss</button>
                </div>
              )}

              {/* Step 1: Date & Target Tab Banner */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Step 1: Select Date &amp; Target Sheet</span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Push Target:</span>
                    <span className="text-emerald-400 font-mono">Worksheet Tab "{selectedDay}"</span>
                    <span className="text-slate-400">in</span>
                    <span className="text-slate-300 truncate">{selectedMonthSheet.name}</span>
                  </h3>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <input
                      type="date"
                      value={selectedDateIso}
                      onChange={e => handleDateChange(e.target.value)}
                      className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Morning vs Afternoon toggle */}
                  <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setDeliveryPeriod('Morning')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        deliveryPeriod === 'Morning'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Morning (Col G)</span>
                    </button>
                    <button
                      onClick={() => setDeliveryPeriod('Afternoon')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        deliveryPeriod === 'Afternoon'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sunset className="w-3.5 h-3.5" />
                      <span>Afternoon (Col H)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload Area */}
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Step 2: Upload FreshToHome PDF Invoice / Challan
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Invoice Date: {invoiceMeta?.date || selectedDateIso}</span>
                </div>

                <div
                  onClick={() => fileInputRefPdf.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-950/50 hover:bg-slate-900/50 cursor-pointer transition-all space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRefPdf}
                    onChange={handlePdfFileUpload}
                    accept=".pdf"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isUploadingPdf ? 'Extracting via Gemini 2.5 Flash...' : 'Click to Upload FreshToHome PDF (or drag & drop)'}
                    </p>
                    {invoiceFileName ? (
                      <p className="text-xs text-slate-400 mt-1">
                        Uploaded file: <span className="text-emerald-400 font-mono font-semibold">{invoiceFileName}</span> ({stagedInvoiceItems.length} items extracted)
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">No file loaded yet for Day {selectedDay}. Click to select invoice PDF.</p>
                    )}
                  </div>
                  <div className="pt-1">
                    <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                      {invoiceMeta ? `Invoice #${invoiceMeta.invoiceNo} | ${invoiceMeta.date} | Grand Total: ₹${invoiceMeta.grandTotal.toLocaleString('en-IN')}` : 'Accepts FreshToHome Bill of Supply PDF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Preview Data & Push */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        Step 3: Preview Extracted Items ({stagedInvoiceItems.length} items)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Verify items, unit purchase costs, and weights before writing to Google Sheet.
                      </p>
                    </div>

                    {stagedInvoiceItems.length > 0 && (
                      <button
                        onClick={handleClearMod1Preview}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors shrink-0"
                      >
                        <span>🧹 Clear Preview Data</span>
                      </button>
                    )}
                  </div>

                  {/* Option to add file path of inventory tracker before push */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        Target Inventory Tracker File Path / Google Sheet ID or URL:
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={trackerFilePathMod1}
                          onChange={e => setTrackerFilePathMod1(e.target.value)}
                          placeholder="e.g. C:\Inventory\Inventory_Tracker_Nov_2026.xlsx or Sheet ID"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => setTrackerFilePathMod1(selectedMonthSheet.sheetId)}
                          className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 whitespace-nowrap"
                        >
                          Use Active Sheet
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 pt-1 md:pt-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] text-slate-400">Target Destination:</div>
                        <div className="text-xs font-mono font-bold text-emerald-400">Tab "{selectedDay}" : Col {deliveryPeriod === 'Morning' ? 'G (Morning)' : 'H (Afternoon)'}</div>
                      </div>

                      <button
                        onClick={handlePushInvoiceToTracker}
                        disabled={stagedInvoiceItems.length === 0 || isPushingMod1}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all shrink-0"
                      >
                        {isPushingMod1 ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Pushing to Google Sheet Tab "{selectedDay}"...</span>
                          </>
                        ) : (
                          <>
                            <span>Push to Tab "{selectedDay}" (Col {deliveryPeriod === 'Morning' ? 'G' : 'H'})</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {stagedInvoiceItems.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-300">No Invoice Data for Day {selectedDay}</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click the upload box above to select your FreshToHome PDF invoice. The preview table will display only the items extracted from your uploaded file for Day {selectedDay}.
                    </p>
                  </div>
                ) : (

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-3">#</th>
                        <th className="py-3 px-3">Invoice Item Description</th>
                        <th className="py-3 px-3">HSN</th>
                        <th className="py-3 px-3 text-right">Unit Price (₹)</th>
                        <th className="py-3 px-3 text-right">Qty / Weight</th>
                        <th className="py-3 px-3">UOM</th>
                        <th className="py-3 px-3 text-right">Subtotal (₹)</th>
                        <th className="py-3 px-3">Mapped Tracker Item</th>
                        <th className="py-3 px-3 text-center">Target Sheet &amp; Tab</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {stagedInvoiceItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-200 max-w-xs truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{item.hsn}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                            ₹{item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.qty}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setDayUploads(prev => {
                                  const curr = prev[selectedDay];
                                  if (!curr) return prev;
                                  return {
                                    ...prev,
                                    [selectedDay]: {
                                      ...curr,
                                      invoiceItems: curr.invoiceItems.map(p => p.id === item.id ? { ...p, qty: val, subtotal: val * p.unitPrice } : p)
                                    }
                                  };
                                });
                              }}
                              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{item.uom}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">
                            ₹{item.subtotal.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-emerald-400 font-medium">
                            {item.mappedMasterName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 border border-slate-700">
                              Tab "{selectedDay}" : Col {deliveryPeriod === 'Morning' ? 'G' : 'H'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MODULE 2 (POS Sales Excel/CSV -> Col K)                             */}
          {/* ========================================================================= */}
          {activeTab === 'mod2' && (
            <div className="space-y-6">
              {salesNotification && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span>{salesNotification}</span>
                  <button onClick={() => setSalesNotification(null)} className="text-emerald-400 hover:underline">Dismiss</button>
                </div>
              )}

              {/* Step 1: Date & Target Tab Banner */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-blue-400 uppercase tracking-wider font-semibold">Step 1: Select Date &amp; Target Sheet</span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Sales Target:</span>
                    <span className="text-blue-400 font-mono">Worksheet Tab "{selectedDay}" (Column K)</span>
                    <span className="text-slate-400">in</span>
                    <span className="text-slate-300 truncate">{selectedMonthSheet.name}</span>
                  </h3>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <input
                      type="date"
                      value={selectedDateIso}
                      onChange={e => handleDateChange(e.target.value)}
                      className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Upload POS File */}
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Step 2: Upload POS End-of-Day Sales Report (.csv / .xlsx)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Target: Col K of Tab "{selectedDay}"</span>
                </div>

                <div
                  onClick={() => fileInputRefPos.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center bg-slate-950/50 hover:bg-slate-900/50 cursor-pointer transition-all space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRefPos}
                    onChange={handlePosFileUpload}
                    accept=".csv, .xlsx, .xls"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isUploadingPos ? 'Parsing POS Report...' : 'Click to Upload POS Excel or CSV (or drag & drop)'}
                    </p>
                    {posFileName ? (
                      <p className="text-xs text-slate-400 mt-1">
                        Uploaded file: <span className="text-blue-400 font-mono font-semibold">{posFileName}</span> ({stagedPosSales.length} items sold)
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">No POS file loaded yet for Day {selectedDay}. Click to select POS file.</p>
                    )}
                  </div>
                  <div className="pt-1">
                    <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                      {availablePosDates.length > 0 ? `${availablePosDates.length} sales dates detected in report` : 'Accepts POS End-of-Day Sales Report (.xlsx / .csv)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Preview Sales Data & Push */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-400" />
                        Step 3: Preview &amp; Approve Sales Quantities ({stagedPosSales.length} items for Day {selectedDay})
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Verify mapped items, adjust weights if needed, and push approved rows to Column K.
                      </p>
                    </div>

                    {stagedPosSales.length > 0 && (
                      <button
                        onClick={handleClearMod2Preview}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors shrink-0"
                      >
                        <span>🧹 Clear Preview Data</span>
                      </button>
                    )}
                  </div>

                  {/* Option to add file path of inventory tracker before push */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                        Target Inventory Tracker File Path / Google Sheet ID or URL:
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={trackerFilePathMod2}
                          onChange={e => setTrackerFilePathMod2(e.target.value)}
                          placeholder="e.g. C:\Inventory\Inventory_Tracker_Nov_2026.xlsx or Sheet ID"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => setTrackerFilePathMod2(selectedMonthSheet.sheetId)}
                          className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 whitespace-nowrap"
                        >
                          Use Active Sheet
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 pt-1 md:pt-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] text-slate-400">Target Destination:</div>
                        <div className="text-xs font-mono font-bold text-blue-400">Tab "{selectedDay}" : Col K (Total Sales)</div>
                      </div>

                      <button
                        onClick={handlePushSalesToTracker}
                        disabled={stagedPosSales.length === 0 || isPushingMod2}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all shrink-0"
                      >
                        {isPushingMod2 ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Pushing to Google Sheet Tab "{selectedDay}"...</span>
                          </>
                        ) : (
                          <>
                            <span>Push to Tab "{selectedDay}" (Column K)</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {stagedPosSales.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-300">No Sales Data for Day {selectedDay}</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click the upload box above to select your POS Excel or CSV sales report. The preview will display only the items sold on Day {selectedDay}.
                    </p>
                  </div>
                ) : (

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-3 text-center">Approve</th>
                        <th className="py-3 px-3">POS SKU</th>
                        <th className="py-3 px-3">POS Product Description</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Sales Qty / Kgs</th>
                        <th className="py-3 px-3 text-right">Revenue (₹)</th>
                        <th className="py-3 px-3">Mapped Tracker Item</th>
                        <th className="py-3 px-3 text-center">Target Sheet &amp; Tab</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {stagedPosSales.map(item => (
                        <tr key={item.sku} className={`hover:bg-slate-800/40 transition-colors ${!item.approved ? 'opacity-40' : ''}`}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.approved}
                              onChange={e => {
                                const checked = e.target.checked;
                                setDayUploads(prev => {
                                  const curr = prev[selectedDay];
                                  if (!curr) return prev;
                                  return {
                                    ...prev,
                                    [selectedDay]: {
                                      ...curr,
                                      posSales: curr.posSales.map(p => p.sku === item.sku ? { ...p, approved: checked } : p)
                                    }
                                  };
                                });
                              }}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">[{item.sku}]</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-white">{item.posName}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">{item.category}</td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.quantitySold}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setDayUploads(prev => {
                                  const curr = prev[selectedDay];
                                  if (!curr) return prev;
                                  return {
                                    ...prev,
                                    [selectedDay]: {
                                      ...curr,
                                      posSales: curr.posSales.map(p => p.sku === item.sku ? { ...p, quantitySold: val } : p)
                                    }
                                  };
                                });
                              }}
                              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-400 font-semibold">
                            ₹{item.totalPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-emerald-400 font-medium">
                            {item.mappedMasterName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-blue-400 border border-slate-700">
                              Tab "{selectedDay}" : Col K
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MODULE 3 (Daily Closing Stock -> Col L)                             */}
          {/* ========================================================================= */}
          {activeTab === 'mod3' && (
            <div className="space-y-6">
              {closingNotification && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span>{closingNotification}</span>
                  <button onClick={() => setClosingNotification(null)} className="text-emerald-400 hover:underline">Dismiss</button>
                </div>
              )}

              {/* Step 1: Date & Target Tab Banner */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider font-semibold">Step 1: Select Date &amp; Target Sheet</span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Closing Stock Target:</span>
                    <span className="text-indigo-400 font-mono">Worksheet Tab "{selectedDay}" (Column L)</span>
                    <span className="text-slate-400">in</span>
                    <span className="text-slate-300 truncate">{selectedMonthSheet.name}</span>
                  </h3>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <input
                      type="date"
                      value={selectedDateIso}
                      onChange={e => handleDateChange(e.target.value)}
                      className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Upload Closing File */}
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-400" />
                    Step 2: Upload Physical Closing Stock File (.csv / .xlsx)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Column Header in File: "{closingDateStr}"</span>
                </div>

                <div
                  onClick={() => fileInputRefClosing.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-950/50 hover:bg-slate-900/50 cursor-pointer transition-all space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRefClosing}
                    onChange={handleClosingFileUpload}
                    accept=".csv, .xlsx, .xls"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isUploadingClosing ? 'Parsing Closing Stock...' : 'Click to Upload Closing Stock File (or drag & drop)'}
                    </p>
                    {closingFileName ? (
                      <p className="text-xs text-slate-400 mt-1">
                        Uploaded file: <span className="text-indigo-400 font-mono font-semibold">{closingFileName}</span> ({Object.keys(stagedClosingMap).length} items found)
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">No Closing Stock file loaded yet for Day {selectedDay}. Click to select file.</p>
                    )}
                  </div>
                  <div className="pt-1">
                    <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                      {availableClosingDates.length > 0 ? `${availableClosingDates.length} date columns detected` : 'Accepts Closing Stock Sheet (.csv / .xlsx)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Preview Closing Counts & Push */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-indigo-400" />
                        Step 3: Preview Closing Counts ({Object.keys(stagedClosingMap).length} items for Day {selectedDay})
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Verify physical closing counts before writing into Column L.
                      </p>
                    </div>

                    {Object.keys(stagedClosingMap).length > 0 && (
                      <button
                        onClick={handleClearMod3Preview}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors shrink-0"
                      >
                        <span>🧹 Clear Preview Data</span>
                      </button>
                    )}
                  </div>

                  {/* Option to add file path of inventory tracker before push */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                        Target Inventory Tracker File Path / Google Sheet ID or URL:
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={trackerFilePathMod3}
                          onChange={e => setTrackerFilePathMod3(e.target.value)}
                          placeholder="e.g. C:\Inventory\Inventory_Tracker_Nov_2026.xlsx or Sheet ID"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => setTrackerFilePathMod3(selectedMonthSheet.sheetId)}
                          className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 whitespace-nowrap"
                        >
                          Use Active Sheet
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 pt-1 md:pt-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] text-slate-400">Target Destination:</div>
                        <div className="text-xs font-mono font-bold text-indigo-400">Tab "{selectedDay}" : Col L (Closing Stock)</div>
                      </div>

                      <button
                        onClick={handlePushClosingToTracker}
                        disabled={Object.keys(stagedClosingMap).length === 0 || isPushingMod3}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all shrink-0"
                      >
                        {isPushingMod3 ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Pushing to Google Sheet Tab "{selectedDay}"...</span>
                          </>
                        ) : (
                          <>
                            <span>Push to Tab "{selectedDay}" (Column L)</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {Object.keys(stagedClosingMap).length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-300">No Closing Stock Data for Day {selectedDay}</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click the upload box above to select your Closing Stock file (.csv / .xlsx) or fetch from Google Sheet. The preview will display physical counts for Day {selectedDay}.
                    </p>
                  </div>
                ) : (

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Item Name (Closing File)</th>
                        <th className="py-3 px-4 text-right">Physical Closing Count (kg/pack)</th>
                        <th className="py-3 px-4">Current Value in Tab "{selectedDay}"</th>
                        <th className="py-3 px-4 text-center">Target Sheet &amp; Tab</th>
                        <th className="py-3 px-4 text-center">Sync Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {Object.entries(stagedClosingMap).map(([name, count]) => {
                        const target = currentDayItems.find(m => m.name.toLowerCase() === name.toLowerCase());
                        return (
                          <tr key={name} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-4 font-sans font-medium text-white">{name}</td>
                            <td className="py-2.5 px-4 text-right text-indigo-400 font-bold">{count}</td>
                            <td className="py-2.5 px-4 text-slate-400">
                              {target ? `${target.closingStock} ${target.uom}` : 'Not mapped'}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-400 border border-slate-700">
                                Tab "{selectedDay}" : Col L
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="text-emerald-400 flex items-center justify-center gap-1 text-[11px]">
                                <Check className="w-3.5 h-3.5" /> Ready to Push
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PROFIT MARGIN ANALYTICS                                            */}
          {/* ========================================================================= */}
          {activeTab === 'profit' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500 text-white">
                      Day {selectedDay} ({selectedDateIso})
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Target Sheet Tab "{selectedDay}"
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Daily Profit Margin &amp; Shrinkage Impact calculated strictly for Day {selectedDay}.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," +
                        "Item Name,Category,Sales Qty,Revenue,Unit Cost,COGS,Shrinkage Loss,Net Profit,Net Margin %\n" +
                        calculatedItems.map(i => {
                          const cogs = i.totalSales * i.unitCost;
                          const rev = (i.totalSales * (i.unitCost > 0 ? i.unitCost * 1.35 : 0));
                          const net = rev - cogs - i.varianceLoss;
                          const margin = rev > 0 ? (net / rev) * 100 : 0;
                          return `"${i.name}","${i.category}",${i.totalSales},${rev.toFixed(2)},${i.unitCost},${cogs.toFixed(2)},${i.varianceLoss},${net.toFixed(2)},${margin.toFixed(2)}%`;
                        }).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `Profit_Margin_Report_Day_${selectedDay}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Day {selectedDay} Report to CSV</span>
                  </button>
                </div>
              </div>

              {/* Profit Formula Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">POS Sales Revenue</span>
                  <div className="text-xl font-bold text-sky-400">₹{stats.totalSalesRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <span className="text-[11px] text-slate-400">Day {selectedDay} collections</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Cost of Goods Sold (COGS)</span>
                  <div className="text-xl font-bold text-slate-300">₹{stats.totalCogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <span className="text-[11px] text-slate-400">Sales Qty × FreshToHome Cost</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Shrinkage Loss (₹)</span>
                  <div className="text-xl font-bold text-rose-400">₹{stats.totalShrinkageLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <span className="text-[11px] text-slate-400">Unaccounted missing stock</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Net Profit</span>
                  <div className="text-xl font-bold text-emerald-400">₹{stats.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <span className="text-[11px] text-slate-400">Gross Profit - Shrinkage</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Net Profit Margin %</span>
                  <div className="text-xl font-bold text-amber-400">{stats.netMarginPct.toFixed(1)}%</div>
                  <span className="text-[11px] text-slate-400">Net Profit / Revenue × 100</span>
                </div>
              </div>

              {/* Item-wise Profit Performance Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  Item-wise Profit Margin &amp; Shrinkage Burden for Day {selectedDay}
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Sales Qty</th>
                        <th className="py-3 px-4 text-right">Unit Purchase Cost (₹)</th>
                        <th className="py-3 px-4 text-right">Est. COGS (₹)</th>
                        <th className="py-3 px-4 text-right">Shrinkage Loss (₹)</th>
                        <th className="py-3 px-4 text-right">Net Contribution (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {calculatedItems.filter(i => i.totalSales > 0 || i.varianceLoss > 0).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                            No sales or stock shrinkage recorded for Day {selectedDay} yet. Push POS sales in Module 2 to view item contributions.
                          </td>
                        </tr>
                      ) : (
                        calculatedItems.filter(i => i.totalSales > 0 || i.varianceLoss > 0).map(item => {
                          const cogs = item.totalSales * item.unitCost;
                          const estRev = item.totalSales * (item.unitCost * 1.32);
                          const netContribution = estRev - cogs - item.varianceLoss;
                          return (
                            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-4 font-sans font-medium text-white">{item.name}</td>
                              <td className="py-2.5 px-4 font-sans text-slate-300">{item.category}</td>
                              <td className="py-2.5 px-4 text-right text-slate-200">{item.totalSales} {item.uom}</td>
                              <td className="py-2.5 px-4 text-right text-slate-400">₹{item.unitCost.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right text-slate-300 font-semibold">₹{cogs.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right text-rose-400 font-semibold">
                                {item.varianceLoss > 0 ? `₹${item.varianceLoss.toFixed(2)}` : '—'}
                              </td>
                              <td className={`py-2.5 px-4 text-right font-bold ${netContribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ₹{netContribution.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans ${
                                  item.varianceLoss > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {item.varianceLoss > 0 ? 'Shortage Impact' : 'Profitable'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: CROSS-SOURCE ITEM MAPPER                                          */}
          {/* ========================================================================= */}
          {activeTab === 'mapper' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Cross-Source Item Name Mapping Manager</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Item descriptions in FreshToHome PDFs, POS reports, and Closing Sheets are automatically matched via fuzzy algorithms and remembered in SQLite.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-slate-400 block mb-1">Source Name (e.g. from POS or PDF)</label>
                    <input
                      type="text"
                      placeholder="e.g. [MP001179] Chicken Boneless Breast"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Target Master Tracker Item</label>
                    <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs">
                      {currentDayItems.map(m => (
                        <option key={m.id} value={m.name}>{m.name} ({m.category})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg text-xs transition-colors">
                      Save Permanent Link
                    </button>
                  </div>
                </div>
              </div>

              {/* Mapping table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Active Cross-Source Item Name Links</span>
                  <span className="text-[11px] text-slate-400 font-normal">Fuzzy Confidence &ge; 75% Auto-Accepted</span>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Source System</th>
                        <th className="py-3 px-4">Raw Description in Source</th>
                        <th className="py-3 px-4">Mapped Master Tracker Item</th>
                        <th className="py-3 px-4 text-center">Fuzzy Match Score</th>
                        <th className="py-3 px-4 text-center">Persistence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {[
                        { src: 'FreshToHome PDF', raw: 'Premium Antibiotic-residue-free Chicken - Boneless Breast Fillet', master: 'Chicken Breast boneless', score: '92%' },
                        { src: 'FreshToHome PDF', raw: 'Premium Tender and Antibiotic-residue-free Chicken - Whole Uncut (Skinless)', master: 'Chicken Without skin', score: '88%' },
                        { src: 'FreshToHome PDF', raw: 'Catla / ಕಾಟ್ಲಾ (1kg to 2kg) - Whole (Not Descaled,Not Cleaned)', master: 'Catla', score: '95%' },
                        { src: 'FreshToHome PDF', raw: 'Rohu / Rui / ರೋಹು (1kg to 1.5kg) - Whole', master: 'Rohu', score: '97%' },
                        { src: 'FreshToHome PDF', raw: 'Premium Chicken Drumsticks (Free from growth hormones) - Skinless', master: 'Chicken Drumstick', score: '91%' },
                        { src: 'POS Excel', raw: '[MP001179] Chicken Boneless Breast', master: 'Chicken Breast boneless', score: '96%' },
                        { src: 'POS Excel', raw: '[MP002614] Chicken Whole (Skinless)', master: 'Chicken Without skin', score: '94%' },
                        { src: 'POS Excel', raw: '[MP001501] Mackerel Whole (L)', master: 'Mackerel / Ayala / Bangda', score: '85%' },
                        { src: 'POS Excel', raw: '[MP009798] Goat Carcass Curry Cut', master: 'Goat Curry Cut', score: '90%' },
                        { src: 'POS Excel', raw: '[MP004091] White Eggs (6pc)', master: 'Fresh White Chicken Eggs - Pack of 6', score: '89%' },
                        { src: 'Closing Sheet', raw: 'Chicken Breast boneless', master: 'Chicken Breast boneless', score: '100%' },
                        { src: 'Closing Sheet', raw: 'Nati Koli', master: 'Country Chicken / Nati Koli', score: '93%' }
                      ].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 font-sans text-slate-400">{item.src}</td>
                          <td className="py-2.5 px-4 font-sans text-white">{item.raw}</td>
                          <td className="py-2.5 px-4 font-sans text-emerald-400 font-semibold">{item.master}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {item.score}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-400">
                            SQLite (Permanent)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: PYTHON DESKTOP APP SOURCE & SETUP                                  */}
          {/* ========================================================================= */}
          {activeTab === 'python_code' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    Python CustomTkinter Desktop Application
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Production Python desktop application configured with monthly workbook selector, day-of-month worksheet tabs (Tab "1", "2", ..., "30"), Gemini 2.5 Flash extractor, and Google Sheets Service Account targeted cell batch updates.
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={handleDownloadAllZip}
                    disabled={isZipping}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isZipping ? 'Creating ZIP...' : 'Download Complete Codebase (.ZIP)'}</span>
                  </button>
                </div>
              </div>

              {/* Code Files Tab Browser */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PYTHON_FILES.map(file => (
                      <button
                        key={file.filename}
                        onClick={() => setSelectedCodeFile(file)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                          selectedCodeFile.filename === file.filename
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {file.filename}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors"
                  >
                    {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFile ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                  <span>{selectedCodeFile.description}</span>
                  <span className="font-mono text-[11px] text-slate-400">{selectedCodeFile.category.toUpperCase()}</span>
                </div>

                <div className="p-4 bg-slate-950 overflow-x-auto max-h-[500px]">
                  <pre className="text-xs font-mono text-emerald-300 leading-relaxed">
                    <code>{selectedCodeFile.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Add New Monthly Google Sheet */}
        {showAddSheetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Add New Month Tracker Google Sheet
                </h3>
                <button
                  onClick={() => setShowAddSheetModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your new monthly Google Sheet name and its Google Sheet ID or URL (e.g. for December 2026, January 2027, etc.).
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Sheet Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Inventory Tracker - Dec 2026 (Isiri Hub)"
                    value={newSheetName}
                    onChange={e => setNewSheetName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Google Sheet ID or Full URL</label>
                  <input
                    type="text"
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={newSheetId}
                    onChange={e => setNewSheetId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowAddSheetModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewMonthSheet}
                  disabled={!newSheetName.trim() || !newSheetId.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                >
                  Save &amp; Select Monthly Sheet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Google Sheets Connection */}
        <GoogleSheetsConnectModal
          isOpen={showConnectModal}
          onClose={() => {
            setShowConnectModal(false);
            setPendingPushAction(null);
          }}
          authConfig={authConfig}
          onSaveAuth={handleSaveAuth}
          targetSheetId={extractSpreadsheetId(trackerFilePathMod1.trim() || selectedMonthSheet.sheetId)}
          targetTab={selectedDay}
          onConfirmPush={() => {
            if (pendingPushAction) {
              pendingPushAction();
            }
          }}
          pendingPushDescription={pendingPushDescription}
        />
      </main>
    </div>
  );
}
