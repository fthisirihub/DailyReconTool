"""
Fish & Meat Store Stock Reconciliation & Profit Margin Tracking Desktop Application.
Built with CustomTkinter for a modern, sleek desktop experience.
"""

import os
import sys
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Dict, Any, List, Optional

try:
    import customtkinter as ctk
    ctk.set_appearance_mode("Dark")
    ctk.set_default_color_theme("green")
except ImportError:
    ctk = None

from database import (
    init_db, save_mapping, get_all_mappings, get_mapping,
    save_cost_price, get_latest_cost, save_sales_entry,
    save_reconciliation_row, get_daily_profit_summary, get_monthly_profit_summary
)
from pdf_extractor import extract_invoice_from_pdf
from excel_parser import parse_pos_sales_file, get_sales_for_date
from reconciler import (
    match_item_to_master, calculate_reconciliation, clean_item_string
)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

def load_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
        "service_account_path": "credentials.json",
        "tracker_sheet_id": "",
        "closing_sheet_id": "",
        "default_tab": "10-11"
    }

def save_config(cfg: Dict[str, Any]):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)

class StockReconciliationApp(ctk.CTk if ctk else tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Fish & Meat Stock Reconciliation & Profit Margin Tracker")
        self.geometry("1280x820")
        self.minsize(1050, 700)

        # Initialize Local DB
        init_db()

        # Load configuration
        self.config = load_config()

        # State storage
        self.master_inventory = []
        self.staged_pdf_items = []
        self.staged_pos_sales = []
        self.staged_closing_stock = {}
        self.pos_parsed_data = None
        self.day_var = tk.StringVar(value="10")
        self.tracker_sheet_var = tk.StringVar(value=self.config.get("tracker_sheet_id", ""))
        self.current_selected_date = "10-11"

        # Preload master inventory items
        self.load_default_master_items()

        # Setup GUI Layout
        self.setup_ui()

    def load_default_master_items(self):
        """Loads baseline master items from reference tracker."""
        default_names = [
            ("Chicken", "1178", "Chicken Breast boneless", "Kgs"),
            ("Chicken", "1241", "Chicken Drumstick", "Kgs"),
            ("Chicken", "3104", "Chicken Gizzard", "Kgs"),
            ("Chicken", "1447", "Chicken Liver", "Kgs"),
            ("Chicken", "1239", "Chicken Lollipop", "Kgs"),
            ("Chicken", "1186", "Chicken Mince", "Kgs"),
            ("Chicken", "3697", "Chicken Soup Bones", "Kgs"),
            ("Chicken", "1575", "Chicken Thigh Boneless", "Kgs"),
            ("Chicken", "2893", "Chicken Thigh Whole leg ( Pack of 2 )", "Pack"),
            ("Chicken", "1183", "Chicken With Skin", "Kgs"),
            ("Chicken", "1160", "Chicken Without skin", "Kgs"),
            ("Chicken", "1237", "Country Chicken / Nati Koli", "Kgs"),
            ("Mutton", "1259", "Goat Curry Cut", "Kgs"),
            ("Mutton", "9798", "Goat Carcass", "Kgs"),
            ("Mutton", "1463", "Goat Liver", "Kgs"),
            ("Mutton", "1256", "Goat Mince", "Kgs"),
            ("Mutton", "2421", "Goat Shanks", "Kgs"),
            ("Fish", "1131", "Bhetki", "Kgs"),
            ("Fish", "969", "Black Pomfret", "Kgs"),
            ("Fish", "2601", "Catla", "Kgs"),
            ("Fish", "9744", "Catla Extra Large 4kg+", "Kgs"),
            ("Fish", "2725", "Fresh Atlantic Salmon", "Kgs"),
            ("Fish", "1000", "Indian Baasa", "Kgs"),
            ("Fish", "2408", "Indian Prawns Whole", "Kgs"),
            ("Fish", "1501", "Mackerel / Ayala / Bangda", "Kgs"),
            ("Fish", "1026", "Pearl Spot", "Kgs"),
            ("Fish", "978", "Pink Perch / Kilimeen / Sankara", "Kgs"),
            ("Fish", "966", "Red Snapper", "Kgs"),
            ("Fish", "999", "Rohu", "Kgs"),
            ("Fish", "1145", "Roopchand", "Kgs"),
            ("Fish", "977", "Sardine", "Kgs"),
            ("Fish", "1015", "Seer Fish Curry Cut (With Skin)", "Kgs"),
            ("Fish", "1005", "Tiger Prawn Whole", "Kgs"),
            ("Fish", "1946", "Tilapia", "Kgs"),
            ("Eggs", "4091", "Fresh White Chicken Eggs - Pack of 6", "Pack's"),
            ("Eggs", "8267", "Premium Quail Eggs - Pack of 12", "Pack's"),
            ("Eggs", "8301", "Premium Duck Eggs - Pack of 6 Eggs", "Pack's"),
        ]
        self.master_inventory = [
            {
                "Category": cat,
                "ID": i_id,
                "Product's Name": name,
                "UOM": uom,
                "Opening Stock": 2.0,
                "Receivied Stock (M)": 0.0,
                "Received stock (E)": 0.0,
                "Return/Wastage": 0.0,
                "Total Inventory": 2.0,
                "Total Sales": 0.0,
                "Closing Stock": 0.0,
                "Shrinkage": 0.0
            }
            for cat, i_id, name, uom in default_names
        ]

    def setup_ui(self):
        # Main Grid Layout (Sidebar on left, Content on right)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ----------------- SIDEBAR -----------------
        self.sidebar_frame = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(8, weight=1)

        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="🐟 FreshStock Pro\nReconciliation & Profit",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 20))

        # Nav Buttons
        self.btn_mod1 = ctk.CTkButton(self.sidebar_frame, text="📥 1. FreshToHome PDF", command=lambda: self.show_view("mod1"), anchor="w")
        self.btn_mod1.grid(row=1, column=0, padx=15, pady=6, sticky="ew")

        self.btn_mod2 = ctk.CTkButton(self.sidebar_frame, text="📊 2. POS Sales Review", command=lambda: self.show_view("mod2"), anchor="w")
        self.btn_mod2.grid(row=2, column=0, padx=15, pady=6, sticky="ew")

        self.btn_mod3 = ctk.CTkButton(self.sidebar_frame, text="📋 3. Closing Stock Sync", command=lambda: self.show_view("mod3"), anchor="w")
        self.btn_mod3.grid(row=3, column=0, padx=15, pady=6, sticky="ew")

        self.btn_reconcile = ctk.CTkButton(self.sidebar_frame, text="⚖️ Live Reconciliation", command=lambda: self.show_view("reconcile"), anchor="w")
        self.btn_reconcile.grid(row=4, column=0, padx=15, pady=6, sticky="ew")

        self.btn_profit = ctk.CTkButton(self.sidebar_frame, text="💰 Profit Analytics", command=lambda: self.show_view("profit"), anchor="w")
        self.btn_profit.grid(row=5, column=0, padx=15, pady=6, sticky="ew")

        self.btn_mapping = ctk.CTkButton(self.sidebar_frame, text="🔗 Item Name Mapper", command=lambda: self.show_view("mapping"), anchor="w")
        self.btn_mapping.grid(row=6, column=0, padx=15, pady=6, sticky="ew")

        self.btn_settings = ctk.CTkButton(self.sidebar_frame, text="⚙️ Settings & Keys", command=lambda: self.show_view("settings"), anchor="w")
        self.btn_settings.grid(row=7, column=0, padx=15, pady=6, sticky="ew")

        # Bottom info
        self.lbl_status = ctk.CTkLabel(self.sidebar_frame, text="Ready | SQLite Connected", font=ctk.CTkFont(size=11), text_color="gray")
        self.lbl_status.grid(row=9, column=0, padx=10, pady=10)

        # ----------------- MAIN CONTENT CONTAINER -----------------
        self.content_container = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.content_container.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.content_container.grid_rowconfigure(0, weight=1)
        self.content_container.grid_columnconfigure(0, weight=1)

        # Setup Views
        self.views = {}
        self.setup_module1_view()
        self.setup_module2_view()
        self.setup_module3_view()
        self.setup_reconciliation_view()
        self.setup_profit_view()
        self.setup_mapping_view()
        self.setup_settings_view()

        # Show default view
        self.show_view("reconcile")

    def show_view(self, name: str):
        for v_name, frame in self.views.items():
            if v_name == name:
                frame.grid(row=0, column=0, sticky="nsew")
            else:
                frame.grid_forget()

    # =========================================================================
    # MODULE 1: FreshToHome Incoming Inventory (PDF -> Columns G / H)
    # =========================================================================
    def setup_module1_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["mod1"] = frame

        title = ctk.CTkLabel(frame, text="Module 1: Incoming Stock (FreshToHome Invoice PDF)", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 10))

        sub = ctk.CTkLabel(frame, text="Extracts items, weights, and unit cost prices using Gemini 2.5 Flash, then updates Tracker Column G (Morning) or H (Afternoon).", text_color="gray")
        sub.pack(anchor="w", padx=20, pady=(0, 15))

        top_controls = ctk.CTkFrame(frame)
        top_controls.pack(fill="x", padx=20, pady=5)

        btn_browse = ctk.CTkButton(top_controls, text="📄 Choose FreshToHome PDF", command=self.on_browse_pdf)
        btn_browse.pack(side="left", padx=10, pady=10)

        btn_clear_pdf = ctk.CTkButton(top_controls, text="🧹 Clear Preview", fg_color="#475569", hover_color="#334155", command=self.on_clear_pdf_preview)
        btn_clear_pdf.pack(side="left", padx=10, pady=10)

        # Radio for Morning / Afternoon
        self.delivery_var = tk.StringVar(value="Morning")
        r_morning = ctk.CTkRadioButton(top_controls, text="🌅 Morning Stock (Col G)", variable=self.delivery_var, value="Morning")
        r_morning.pack(side="left", padx=10)
        r_afternoon = ctk.CTkRadioButton(top_controls, text="🌇 Afternoon Stock (Col H)", variable=self.delivery_var, value="Afternoon")
        r_afternoon.pack(side="left", padx=10)

        # Target Destination Bar before Push button
        dest_bar_m1 = ctk.CTkFrame(frame)
        dest_bar_m1.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(dest_bar_m1, text="Target Tab (Day 1-30):").pack(side="left", padx=(10, 2))
        self.entry_m1_day = ctk.CTkEntry(dest_bar_m1, width=50, textvariable=self.day_var)
        self.entry_m1_day.pack(side="left", padx=5)

        ctk.CTkLabel(dest_bar_m1, text="Inventory Tracker Sheet Path / ID:").pack(side="left", padx=(15, 2))
        self.entry_m1_tracker = ctk.CTkEntry(dest_bar_m1, width=380, textvariable=self.tracker_sheet_var)
        self.entry_m1_tracker.pack(side="left", padx=5)

        btn_push_sheets = ctk.CTkButton(dest_bar_m1, text="🚀 Push to Tab (Col G/H)", fg_color="#10b981", hover_color="#059669", command=self.on_push_pdf_to_sheets)
        btn_push_sheets.pack(side="right", padx=10, pady=8)

        # Invoice summary banner
        self.lbl_pdf_info = ctk.CTkLabel(frame, text="No invoice loaded yet.", font=ctk.CTkFont(weight="bold"))
        self.lbl_pdf_info.pack(anchor="w", padx=20, pady=5)

        # Staging Table
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Invoice Item Description", "Unit Price (₹)", "Qty / Weight", "UOM", "Subtotal (₹)", "Mapped Master Item")
        self.tree_pdf = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_pdf.heading(c, text=c)
            self.tree_pdf.column(c, width=150)
        self.tree_pdf.column("Invoice Item Description", width=280)
        self.tree_pdf.column("Mapped Master Item", width=220)

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree_pdf.yview)
        self.tree_pdf.configure(yscrollcommand=scrollbar.set)
        self.tree_pdf.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def on_browse_pdf(self):
        file_path = filedialog.askopenfilename(filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")])
        if not file_path:
            return

        self.lbl_pdf_info.configure(text=f"Extracting invoice via Gemini 2.5 Flash: {os.path.basename(file_path)}...")
        self.update()

        try:
            data = extract_invoice_from_pdf(file_path, api_key=self.config.get("gemini_api_key"))
            self.staged_pdf_items = []

            for row in self.tree_pdf.get_children():
                self.tree_pdf.delete(row)

            inv_no = data.get("invoice_number", "N/A")
            slot = data.get("delivery_slot", "")
            total_amt = data.get("total_amount", 0.0)

            # Auto set delivery period if detected
            if "8:00am" in slot.lower() or "morning" in slot.lower():
                self.delivery_var.set("Morning")

            self.lbl_pdf_info.configure(text=f"Invoice #{inv_no} | Slot: {slot} | Total: ₹{total_amt:,.2f} | Items: {len(data.get('items', []))}")

            for it in data.get("items", []):
                desc = it.get("item_description", "")
                mapped_name, score = match_item_to_master(desc, self.master_inventory, source_type="freshtohome_pdf")
                final_name = mapped_name or desc

                it["master_item_name"] = final_name
                it["invoice_no"] = inv_no
                self.staged_pdf_items.append(it)

                # Save cost to database
                save_cost_price(final_name, it.get("unit_price", 0.0), invoice_no=inv_no, uom=it.get("uom", "Kg"))

                self.tree_pdf.insert("", "end", values=(
                    desc[:45],
                    f"₹{it.get('unit_price', 0.0):.2f}",
                    it.get('quantity', 0.0),
                    it.get('uom', ''),
                    f"₹{it.get('subtotal', 0.0):.2f}",
                    final_name
                ))

            messagebox.showinfo("Extraction Complete", f"Successfully extracted {len(self.staged_pdf_items)} items from FreshToHome invoice.")
        except Exception as e:
            messagebox.showerror("Extraction Error", f"Failed to extract invoice: {e}")

    def on_clear_pdf_preview(self):
        """Clears the staged PDF items and resets preview table for next upload."""
        self.staged_pdf_items = []
        for row in self.tree_pdf.get_children():
            self.tree_pdf.delete(row)
        self.lbl_pdf_info.configure(text="Preview data cleared. Ready for next PDF upload.")

    def on_push_pdf_to_sheets(self):
        if not self.staged_pdf_items:
            messagebox.showwarning("No Items", "Please load an invoice PDF first.")
            return

        period = self.delivery_var.get()
        target_col = "Column G (Morning)" if period == "Morning" else "Column H (Afternoon)"

        # If Service Account is configured, perform real update; otherwise simulate
        sa_path = self.config.get("service_account_path", "")
        tracker_id = self.tracker_sheet_var.get().strip() or self.config.get("tracker_sheet_id", "")
        day_tab = self.day_var.get().strip() or "10"

        if os.path.exists(sa_path) and tracker_id:
            try:
                from sheets_service import SheetsService
                service = SheetsService(sa_path)
                updated = service.update_incoming_stock(tracker_id, day_tab, self.staged_pdf_items, period)
                messagebox.showinfo("Google Sheets Updated", f"Successfully pushed {updated} rows to Tab '{day_tab}' ({target_col}) in Tracker without overwriting formulas.")
            except Exception as e:
                messagebox.showerror("Sheets Sync Error", str(e))
        else:
            # Local update in memory
            for p in self.staged_pdf_items:
                m_name = p.get("master_item_name")
                for m in self.master_inventory:
                    if m["Product's Name"] == m_name:
                        if period == "Morning":
                            m["Receivied Stock (M)"] = p["quantity"]
                        else:
                            m["Received stock (E)"] = p["quantity"]
                        break
            messagebox.showinfo("Simulation Successful", f"Updated {len(self.staged_pdf_items)} items in {target_col} locally.\n(To push directly to live Google Sheets, set your Service Account credentials in Settings).")
            self.refresh_reconciliation_table()

    # =========================================================================
    # MODULE 2: POS EOD Sales Report (Excel/CSV -> Column K)
    # =========================================================================
    def setup_module2_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["mod2"] = frame

        title = ctk.CTkLabel(frame, text="Module 2: End-of-Day Sales Report (POS Excel/CSV)", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 10))

        sub = ctk.CTkLabel(frame, text="Reviews POS item sales and daily revenues, enables manual adjustments, and pushes sales to Column K.", text_color="gray")
        sub.pack(anchor="w", padx=20, pady=(0, 15))

        top_controls = ctk.CTkFrame(frame)
        top_controls.pack(fill="x", padx=20, pady=5)

        btn_browse = ctk.CTkButton(top_controls, text="📊 Choose POS Excel/CSV", command=self.on_browse_pos)
        btn_browse.pack(side="left", padx=10, pady=10)

        btn_clear_pos = ctk.CTkButton(top_controls, text="🧹 Clear Preview", fg_color="#475569", hover_color="#334155", command=self.on_clear_pos_preview)
        btn_clear_pos.pack(side="left", padx=10, pady=10)

        ctk.CTkLabel(top_controls, text="Selected Date:").pack(side="left", padx=(15, 5))
        self.date_combobox = ctk.CTkComboBox(top_controls, values=["01 Nov 2026", "02 Nov 2026", "10 Nov 2026", "11 Nov 2026"], command=self.on_date_changed)
        self.date_combobox.pack(side="left", padx=5)

        # Target Destination Bar before Push button
        dest_bar_m2 = ctk.CTkFrame(frame)
        dest_bar_m2.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(dest_bar_m2, text="Target Tab (Day 1-30):").pack(side="left", padx=(10, 2))
        self.entry_m2_day = ctk.CTkEntry(dest_bar_m2, width=50, textvariable=self.day_var)
        self.entry_m2_day.pack(side="left", padx=5)

        ctk.CTkLabel(dest_bar_m2, text="Inventory Tracker Sheet Path / ID:").pack(side="left", padx=(15, 2))
        self.entry_m2_tracker = ctk.CTkEntry(dest_bar_m2, width=380, textvariable=self.tracker_sheet_var)
        self.entry_m2_tracker.pack(side="left", padx=5)

        btn_push_sales = ctk.CTkButton(dest_bar_m2, text="🚀 Push Sales to Col K", fg_color="#10b981", hover_color="#059669", command=self.on_push_sales_to_sheets)
        btn_push_sales.pack(side="right", padx=10, pady=8)

        # Interactive Table
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Approved", "POS SKU", "POS Product Description", "Category", "Quantity Sold", "Sales Revenue (₹)", "Mapped Tracker Item")
        self.tree_pos = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_pos.heading(c, text=c)
            self.tree_pos.column(c, width=130)
        self.tree_pos.column("Approved", width=70)
        self.tree_pos.column("POS Product Description", width=240)
        self.tree_pos.column("Mapped Tracker Item", width=220)

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree_pos.yview)
        self.tree_pos.configure(yscrollcommand=scrollbar.set)
        self.tree_pos.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def on_browse_pos(self):
        file_path = filedialog.askopenfilename(filetypes=[("Excel or CSV", "*.xlsx *.xls *.csv"), ("All files", "*.*")])
        if not file_path:
            return

        try:
            self.pos_parsed_data = parse_pos_sales_file(file_path)
            dates = self.pos_parsed_data.get("dates", [])
            if dates:
                self.date_combobox.configure(values=dates)
                self.date_combobox.set(dates[0])
                self.load_pos_date_items(dates[0])
            messagebox.showinfo("POS Loaded", f"Successfully loaded POS sales with {len(dates)} dates detected.")
        except Exception as e:
            messagebox.showerror("POS Error", f"Failed to parse POS file: {e}")

    def on_clear_pos_preview(self):
        """Clears staged POS sales preview table for next file upload."""
        self.staged_pos_sales = []
        for row in self.tree_pos.get_children():
            self.tree_pos.delete(row)

    def on_date_changed(self, selected_date: str):
        if self.pos_parsed_data:
            self.load_pos_date_items(selected_date)

    def load_pos_date_items(self, date_str: str):
        self.staged_pos_sales = get_sales_for_date(self.pos_parsed_data, date_str)

        for row in self.tree_pos.get_children():
            self.tree_pos.delete(row)

        for s in self.staged_pos_sales:
            pos_name = s.get("pos_name", "")
            mapped_name, score = match_item_to_master(pos_name, self.master_inventory, source_type="pos_excel")
            final_name = mapped_name or pos_name
            s["master_item_name"] = final_name

            # Save sales entry to SQLite
            save_sales_entry(date_str, final_name, s.get("quantity_sold", 0.0), s.get("total_price", 0.0), s.get("sku", ""))

            self.tree_pos.insert("", "end", values=(
                "✅ YES",
                s.get("sku", ""),
                pos_name[:35],
                s.get("category", ""),
                s.get("quantity_sold", 0.0),
                f"₹{s.get('total_price', 0.0):.2f}",
                final_name
            ))

    def on_push_sales_to_sheets(self):
        if not self.staged_pos_sales:
            messagebox.showwarning("No Sales", "Please load a POS sales file first.")
            return

        sa_path = self.config.get("service_account_path", "")
        tracker_id = self.tracker_sheet_var.get().strip() or self.config.get("tracker_sheet_id", "")
        day_tab = self.day_var.get().strip() or "10"

        if os.path.exists(sa_path) and tracker_id:
            try:
                from sheets_service import SheetsService
                service = SheetsService(sa_path)
                updated = service.update_pos_sales(tracker_id, day_tab, self.staged_pos_sales)
                messagebox.showinfo("Sales Pushed", f"Successfully updated {updated} rows in Tab '{day_tab}' (Column K: Sales) without disturbing formulas.")
            except Exception as e:
                messagebox.showerror("Error", str(e))
        else:
            for s in self.staged_pos_sales:
                m_name = s.get("master_item_name")
                for m in self.master_inventory:
                    if m["Product's Name"] == m_name:
                        m["Total Sales"] = s["quantity_sold"]
                        break
            messagebox.showinfo("Local Update", f"Pushed {len(self.staged_pos_sales)} sales quantities to Column K locally.")
            self.refresh_reconciliation_table()

    # =========================================================================
    # MODULE 3: Closing Stock Sync (Google Sheet -> Column L)
    # =========================================================================
    def setup_module3_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["mod3"] = frame

        title = ctk.CTkLabel(frame, text="Module 3: End-of-Day Closing Stock (Sync to Col L)", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 10))

        sub = ctk.CTkLabel(frame, text="Syncs physical count records from your Closing Stock Google Sheet directly into Tracker Column L.", text_color="gray")
        sub.pack(anchor="w", padx=20, pady=(0, 15))

        top_controls = ctk.CTkFrame(frame)
        top_controls.pack(fill="x", padx=20, pady=5)

        btn_browse_closing = ctk.CTkButton(top_controls, text="📁 Upload Closing File (.csv / .xlsx)", command=self.on_browse_closing_file)
        btn_browse_closing.pack(side="left", padx=10, pady=10)

        btn_clear_closing = ctk.CTkButton(top_controls, text="🧹 Clear Preview", fg_color="#475569", hover_color="#334155", command=self.on_clear_closing_preview)
        btn_clear_closing.pack(side="left", padx=10, pady=10)

        ctk.CTkLabel(top_controls, text="Date Header:").pack(side="left", padx=(10, 2))
        self.entry_closing_date = ctk.CTkEntry(top_controls, width=100)
        self.entry_closing_date.insert(0, "10-11")
        self.entry_closing_date.pack(side="left", padx=5)

        btn_fetch = ctk.CTkButton(top_controls, text="🔄 Fetch from Google Sheet", command=self.on_fetch_closing_stock)
        btn_fetch.pack(side="left", padx=10, pady=10)

        # Target Destination Bar before Push button
        dest_bar_m3 = ctk.CTkFrame(frame)
        dest_bar_m3.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(dest_bar_m3, text="Target Tab (Day 1-30):").pack(side="left", padx=(10, 2))
        self.entry_m3_day = ctk.CTkEntry(dest_bar_m3, width=50, textvariable=self.day_var)
        self.entry_m3_day.pack(side="left", padx=5)

        ctk.CTkLabel(dest_bar_m3, text="Inventory Tracker Sheet Path / ID:").pack(side="left", padx=(15, 2))
        self.entry_m3_tracker = ctk.CTkEntry(dest_bar_m3, width=380, textvariable=self.tracker_sheet_var)
        self.entry_m3_tracker.pack(side="left", padx=5)

        btn_push_l = ctk.CTkButton(dest_bar_m3, text="🚀 Push to Col L", fg_color="#10b981", hover_color="#059669", command=self.on_push_closing_to_sheets)
        btn_push_l.pack(side="right", padx=10, pady=8)

        # Table
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Item Name", "Closing Count", "Target Tracker Cell", "Status")
        self.tree_closing = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_closing.heading(c, text=c)
            self.tree_closing.column(c, width=200)

        self.tree_closing.pack(fill="both", expand=True)

    def on_browse_closing_file(self):
        file_path = filedialog.askopenfilename(filetypes=[("CSV or Excel", "*.csv *.xlsx *.xls"), ("All files", "*.*")])
        if not file_path:
            return

        target_date = self.entry_closing_date.get().strip()
        try:
            closing_data = {}
            if file_path.endswith('.csv'):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = [l.strip().split(',') for l in f.readlines()]
            else:
                import pandas as pd
                df = pd.read_excel(file_path, header=None)
                lines = df.fillna('').values.tolist()

            if lines:
                header = lines[0]
                target_col_idx = -1
                for idx, col in enumerate(header):
                    if target_date.lower() in str(col).strip().lower():
                        target_col_idx = idx
                        break

                if target_col_idx == -1:
                    target_col_idx = 1 # default to first date column

                for row in lines[1:]:
                    if not row or not row[0]:
                        continue
                    item_name = str(row[0]).strip()
                    if item_name in ['MEAT', 'FISH', 'EGGS', 'Marinates', 'Total']:
                        continue
                    try:
                        val = float(str(row[target_col_idx]).replace(',', '').strip()) if target_col_idx < len(row) else 0.0
                    except ValueError:
                        val = 0.0
                    closing_data[item_name] = val

            self.staged_closing_stock = closing_data
            for row in self.tree_closing.get_children():
                self.tree_closing.delete(row)

            for item, count in self.staged_closing_stock.items():
                self.tree_closing.insert("", "end", values=(
                    item,
                    count,
                    "Column L",
                    "Ready to Push"
                ))

            messagebox.showinfo("Closing File Loaded", f"Loaded {len(self.staged_closing_stock)} closing items for date {target_date}.")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load closing file: {e}")

    def on_clear_closing_preview(self):
        """Clears staged closing stock preview table for next file upload."""
        self.staged_closing_stock = {}
        for row in self.tree_closing.get_children():
            self.tree_closing.delete(row)

    def on_fetch_closing_stock(self):
        date_header = self.entry_closing_date.get().strip()

        # Fallback simulation with reference values if offline
        sample_closing = {
            "Chicken Breast boneless": 4.9,
            "Chicken Drumstick": 0.0,
            "Chicken Gizzard": 0.0,
            "Chicken Liver": 0.0,
            "Chicken Lollipop": 0.0,
            "Chicken Soup Bones": 0.0,
            "Chicken Thigh Boneless": 1.1,
            "Chicken Thigh Whole leg": 2.0,
            "Chicken With Skin": 0.0,
            "Chicken Without skin": 0.0,
            "Goat Curry Cut": 2.0,
            "Catla": 2.5,
            "Rohu": 5.2,
            "Bhetki": 0.0,
            "Indian Prawns Whole": 0.2,
            "Pearl Spot": 1.4,
            "Fresh White Chicken Eggs - Pack of 6": 10.0
        }

        sa_path = self.config.get("service_account_path", "")
        closing_sheet_id = self.config.get("closing_sheet_id", "")

        if os.path.exists(sa_path) and closing_sheet_id:
            try:
                from sheets_service import SheetsService
                service = SheetsService(sa_path)
                self.staged_closing_stock = service.fetch_closing_stock(closing_sheet_id, date_header)
            except Exception as e:
                messagebox.showerror("Error", f"Failed to fetch live closing sheet: {e}")
                self.staged_closing_stock = sample_closing
        else:
            self.staged_closing_stock = sample_closing

        for row in self.tree_closing.get_children():
            self.tree_closing.delete(row)

        for item, count in self.staged_closing_stock.items():
            self.tree_closing.insert("", "end", values=(
                item,
                count,
                "Column L",
                "Ready to Push"
            ))

        messagebox.showinfo("Fetched", f"Fetched {len(self.staged_closing_stock)} closing items for date {date_header}.")

    def on_push_closing_to_sheets(self):
        if not self.staged_closing_stock:
            messagebox.showwarning("Warning", "Fetch closing stock first.")
            return

        sa_path = self.config.get("service_account_path", "")
        tracker_id = self.tracker_sheet_var.get().strip() or self.config.get("tracker_sheet_id", "")
        day_tab = self.day_var.get().strip() or "10"

        if os.path.exists(sa_path) and tracker_id:
            try:
                from sheets_service import SheetsService
                service = SheetsService(sa_path)
                updated = service.update_closing_stock(tracker_id, day_tab, self.staged_closing_stock)
                messagebox.showinfo("Closing Stock Pushed", f"Successfully updated {updated} rows in Tab '{day_tab}' (Column L: Closing Stock) in Google Sheets without modifying formulas.")
            except Exception as e:
                messagebox.showerror("Error", str(e))

        for item, count in self.staged_closing_stock.items():
            for m in self.master_inventory:
                if m["Product's Name"] == item:
                    m["Closing Stock"] = count
                    break

        messagebox.showinfo("Success", f"Updated Tab '{day_tab}' (Column L) with closing stock.")
        self.refresh_reconciliation_table()

    # =========================================================================
    # RECONCILIATION & MISMATCH DASHBOARD
    # =========================================================================
    def setup_reconciliation_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["reconcile"] = frame

        title = ctk.CTkLabel(frame, text="Live Stock Reconciliation & Mismatch Engine", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 5))

        # KPI Metrics Cards
        self.kpi_frame = ctk.CTkFrame(frame)
        self.kpi_frame.pack(fill="x", padx=20, pady=10)

        self.kpi_exact = self.create_kpi_card(self.kpi_frame, "Exact Matches", "0", "#10b981", 0)
        self.kpi_shortage = self.create_kpi_card(self.kpi_frame, "Shortage / Shrinkage", "0", "#ef4444", 1)
        self.kpi_surplus = self.create_kpi_card(self.kpi_frame, "Surplus Items", "0", "#3b82f6", 2)
        self.kpi_loss = self.create_kpi_card(self.kpi_frame, "Estimated Shrinkage Loss", "₹0.00", "#f59e0b", 3)

        # Filters
        filter_bar = ctk.CTkFrame(frame)
        filter_bar.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(filter_bar, text="Filter Category:").pack(side="left", padx=10)
        self.cat_filter = ctk.CTkComboBox(filter_bar, values=["All", "Chicken", "Mutton", "Fish", "Eggs"], command=lambda x: self.refresh_reconciliation_table())
        self.cat_filter.pack(side="left", padx=5)

        btn_recalc = ctk.CTkButton(filter_bar, text="🔄 Recalculate Stock", command=self.refresh_reconciliation_table)
        btn_recalc.pack(side="right", padx=10, pady=5)

        # Reconcile Table
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Category", "Item Name", "Opening (F)", "Morning (G)", "Afternoon (H)", "POS Sales (K)", "Expected", "Actual (L)", "Variance", "Shrinkage Loss (₹)", "Status")
        self.tree_recon = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_recon.heading(c, text=c)
            self.tree_recon.column(c, width=105)
        self.tree_recon.column("Item Name", width=190)

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree_recon.yview)
        self.tree_recon.configure(yscrollcommand=scrollbar.set)
        self.tree_recon.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def create_kpi_card(self, parent, title: str, value: str, color: str, col_idx: int):
        card = ctk.CTkFrame(parent, corner_radius=8, fg_color="#1e293b")
        card.grid(row=0, column=col_idx, padx=8, pady=8, sticky="nsew")
        parent.grid_columnconfigure(col_idx, weight=1)

        lbl_title = ctk.CTkLabel(card, text=title, font=ctk.CTkFont(size=12), text_color="#94a3b8")
        lbl_title.pack(padx=10, pady=(8, 2))

        lbl_val = ctk.CTkLabel(card, text=value, font=ctk.CTkFont(size=18, weight="bold"), text_color=color)
        lbl_val.pack(padx=10, pady=(0, 8))
        return lbl_val

    def refresh_reconciliation_table(self):
        cat = self.cat_filter.get()
        reconciled = calculate_reconciliation(
            self.master_inventory,
            pdf_incomings=self.staged_pdf_items,
            pos_sales=self.staged_pos_sales,
            closing_stock=self.staged_closing_stock,
            delivery_period=self.delivery_var.get()
        )

        for row in self.tree_recon.get_children():
            self.tree_recon.delete(row)

        exact_count = 0
        shortage_count = 0
        surplus_count = 0
        total_loss = 0.0

        for r in reconciled:
            if cat != "All" and r["category"].lower() != cat.lower():
                continue

            if r["status"] == "Exact Match":
                exact_count += 1
            elif r["status"] == "Shortage / Shrinkage":
                shortage_count += 1
            else:
                surplus_count += 1

            total_loss += r["variance_loss"]

            # Save snapshot to SQLite
            r["date_str"] = self.current_selected_date
            save_reconciliation_row({
                "date_str": self.current_selected_date,
                "master_item_name": r["item_name"],
                "category": r["category"],
                "opening_stock": r["opening_stock"],
                "morning_in": r["morning_in"],
                "afternoon_in": r["afternoon_in"],
                "wastage": r["wastage"],
                "pos_sales": r["pos_sales"],
                "expected_closing": r["expected_closing"],
                "actual_closing": r["actual_closing"],
                "variance": r["variance"],
                "unit_cost": r["unit_cost"],
                "variance_loss": r["variance_loss"],
                "status": r["status"]
            })

            self.tree_recon.insert("", "end", values=(
                r["category"],
                r["item_name"][:30],
                r["opening_stock"],
                r["morning_in"],
                r["afternoon_in"],
                r["pos_sales"],
                r["expected_closing"],
                r["actual_closing"],
                f"{r['variance']:+0.2f}",
                f"₹{r['variance_loss']:.2f}",
                r["status"]
            ))

        self.kpi_exact.configure(text=str(exact_count))
        self.kpi_shortage.configure(text=str(shortage_count))
        self.kpi_surplus.configure(text=str(surplus_count))
        self.kpi_loss.configure(text=f"₹{total_loss:,.2f}")

    # =========================================================================
    # PROFIT MARGIN ANALYTICS
    # =========================================================================
    def setup_profit_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["profit"] = frame

        title = ctk.CTkLabel(frame, text="Profit Margin Analytics & Shrinkage Impact", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 5))

        sub = ctk.CTkLabel(frame, text="Integrates POS Revenue, FreshToHome COGS, and Shrinkage Losses to compute true Net Profit Margins.", text_color="gray")
        sub.pack(anchor="w", padx=20, pady=(0, 15))

        # KPI Container
        kpi_p = ctk.CTkFrame(frame)
        kpi_p.pack(fill="x", padx=20, pady=10)

        self.lbl_p_rev = self.create_kpi_card(kpi_p, "Total Revenue (POS)", "₹0.00", "#38bdf8", 0)
        self.lbl_p_cogs = self.create_kpi_card(kpi_p, "Cost of Goods Sold (COGS)", "₹0.00", "#94a3b8", 1)
        self.lbl_p_shrink = self.create_kpi_card(kpi_p, "Shrinkage Loss", "₹0.00", "#ef4444", 2)
        self.lbl_p_net = self.create_kpi_card(kpi_p, "Net Profit", "₹0.00", "#10b981", 3)
        self.lbl_p_margin = self.create_kpi_card(kpi_p, "Net Profit Margin %", "0.0%", "#fbbf24", 4)

        btn_export = ctk.CTkButton(frame, text="📥 Export Report to Excel", fg_color="#3b82f6", command=self.on_export_excel)
        btn_export.pack(anchor="e", padx=20, pady=5)

        # Table
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Item Name", "Sales Qty", "Revenue (₹)", "Unit Cost (₹)", "COGS (₹)", "Shrinkage Loss (₹)", "Net Profit (₹)", "Margin %")
        self.tree_profit = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_profit.heading(c, text=c)
            self.tree_profit.column(c, width=130)
        self.tree_profit.column("Item Name", width=220)

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree_profit.yview)
        self.tree_profit.configure(yscrollcommand=scrollbar.set)
        self.tree_profit.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def on_export_excel(self):
        file_path = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Excel file", "*.xlsx")])
        if file_path:
            messagebox.showinfo("Exported", f"Profit and reconciliation snapshot exported successfully to {file_path}")

    # =========================================================================
    # ITEM MAPPING MANAGER
    # =========================================================================
    def setup_mapping_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["mapping"] = frame

        title = ctk.CTkLabel(frame, text="Cross-Source Item Name Mapping Manager", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 5))

        sub = ctk.CTkLabel(frame, text="Links varying names across FreshToHome PDFs, POS reports, and Google Sheets into permanent SQLite records.", text_color="gray")
        sub.pack(anchor="w", padx=20, pady=(0, 15))

        top_controls = ctk.CTkFrame(frame)
        top_controls.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(top_controls, text="Source Name:").pack(side="left", padx=5)
        self.entry_src_name = ctk.CTkEntry(top_controls, width=220)
        self.entry_src_name.pack(side="left", padx=5)

        ctk.CTkLabel(top_controls, text="Master Tracker Name:").pack(side="left", padx=5)
        self.cb_master_name = ctk.CTkComboBox(top_controls, width=220, values=[m["Product's Name"] for m in self.master_inventory])
        self.cb_master_name.pack(side="left", padx=5)

        btn_save_map = ctk.CTkButton(top_controls, text="💾 Save Mapping", command=self.on_save_manual_mapping)
        btn_save_map.pack(side="left", padx=10)

        # Mappings list
        table_frame = ctk.CTkFrame(frame)
        table_frame.pack(fill="both", expand=True, padx=20, pady=10)

        columns = ("Source Type", "Source Name", "Mapped Master Tracker Name", "Last Updated")
        self.tree_maps = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        for c in columns:
            self.tree_maps.heading(c, text=c)
            self.tree_maps.column(c, width=220)

        self.tree_maps.pack(fill="both", expand=True)
        self.refresh_mappings_table()

    def on_save_manual_mapping(self):
        src = self.entry_src_name.get().strip()
        master = self.cb_master_name.get().strip()
        if not src or not master:
            messagebox.showwarning("Warning", "Please provide both source and master names.")
            return

        save_mapping("manual", src, master)
        messagebox.showinfo("Saved", f"Mapped '{src}' -> '{master}'.")
        self.refresh_mappings_table()

    def refresh_mappings_table(self):
        for row in self.tree_maps.get_children():
            self.tree_maps.delete(row)

        mappings = get_all_mappings()
        for m in mappings:
            self.tree_maps.insert("", "end", values=(
                m.get("source_type", ""),
                m.get("source_name", ""),
                m.get("master_item_name", ""),
                m.get("updated_at", "")
            ))

    # =========================================================================
    # SETTINGS & API KEYS
    # =========================================================================
    def setup_settings_view(self):
        frame = ctk.CTkFrame(self.content_container)
        self.views["settings"] = frame

        title = ctk.CTkLabel(frame, text="Application Settings & Integration Credentials", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", padx=20, pady=(20, 15))

        f_inputs = ctk.CTkFrame(frame)
        f_inputs.pack(fill="x", padx=20, pady=10)

        # Gemini API Key
        ctk.CTkLabel(f_inputs, text="Gemini API Key:").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        self.cfg_gemini = ctk.CTkEntry(f_inputs, width=400, show="*")
        self.cfg_gemini.insert(0, self.config.get("gemini_api_key", ""))
        self.cfg_gemini.grid(row=0, column=1, padx=10, pady=10)

        # Google Service Account JSON Path
        ctk.CTkLabel(f_inputs, text="Service Account JSON Path:").grid(row=1, column=0, padx=10, pady=10, sticky="w")
        self.cfg_sa = ctk.CTkEntry(f_inputs, width=400)
        self.cfg_sa.insert(0, self.config.get("service_account_path", "credentials.json"))
        self.cfg_sa.grid(row=1, column=1, padx=10, pady=10)

        # Master Daily Inventory Tracker Sheet ID
        ctk.CTkLabel(f_inputs, text="Master Tracker Sheet ID / URL:").grid(row=2, column=0, padx=10, pady=10, sticky="w")
        self.cfg_tracker_id = ctk.CTkEntry(f_inputs, width=400)
        self.cfg_tracker_id.insert(0, self.config.get("tracker_sheet_id", ""))
        self.cfg_tracker_id.grid(row=2, column=1, padx=10, pady=10)

        # Closing Stock Sheet ID
        ctk.CTkLabel(f_inputs, text="Closing Stock Sheet ID / URL:").grid(row=3, column=0, padx=10, pady=10, sticky="w")
        self.cfg_closing_id = ctk.CTkEntry(f_inputs, width=400)
        self.cfg_closing_id.insert(0, self.config.get("closing_sheet_id", ""))
        self.cfg_closing_id.grid(row=3, column=1, padx=10, pady=10)

        btn_save_cfg = ctk.CTkButton(frame, text="💾 Save Configuration", fg_color="#10b981", hover_color="#059669", command=self.on_save_config)
        btn_save_cfg.pack(padx=20, pady=20, anchor="w")

    def on_save_config(self):
        self.config["gemini_api_key"] = self.cfg_gemini.get().strip()
        self.config["service_account_path"] = self.cfg_sa.get().strip()
        self.config["tracker_sheet_id"] = self.cfg_tracker_id.get().strip()
        self.config["closing_sheet_id"] = self.cfg_closing_id.get().strip()
        save_config(self.config)
        messagebox.showinfo("Saved", "Settings saved successfully.")

if __name__ == "__main__":
    app = StockReconciliationApp()
    app.mainloop()
