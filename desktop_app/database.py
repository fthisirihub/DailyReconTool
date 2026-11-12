"""
SQLite Database Layer for Stock Reconciliation & Profit Margin Tracking.
Maintains persistent cross-source item name mappings, unit purchase cost histories,
daily sales logs, and reconciliation snapshots.
"""

import sqlite3
import datetime
import os
from typing import List, Dict, Optional, Tuple, Any

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inventory_reconciliation.db")

def get_connection(db_path: str = DB_FILE) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = DB_FILE):
    """Initializes tables for mappings, cost histories, sales, and reconciliation logs."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # 1. Cross-Source Item Name Mappings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS item_mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL,  -- 'freshtohome_pdf', 'pos_excel', 'closing_stock_sheet'
            source_name TEXT NOT NULL,
            master_item_name TEXT NOT NULL,
            master_item_id TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source_type, source_name)
        )
    """)

    # 2. Historical Unit Purchase Costs (from FreshToHome Invoices)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cost_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            master_item_name TEXT NOT NULL,
            invoice_no TEXT,
            invoice_date TEXT,
            unit_cost REAL NOT NULL,
            uom TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. Daily Sales & Revenue Log (from POS)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_sales_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_str TEXT NOT NULL,
            master_item_name TEXT NOT NULL,
            pos_sku TEXT,
            quantity_sold REAL NOT NULL,
            total_revenue REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date_str, master_item_name)
        )
    """)

    # 4. Reconciliation Snapshots
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reconciliation_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_str TEXT NOT NULL,
            master_item_name TEXT NOT NULL,
            category TEXT,
            opening_stock REAL DEFAULT 0,
            morning_in REAL DEFAULT 0,
            afternoon_in REAL DEFAULT 0,
            wastage REAL DEFAULT 0,
            pos_sales REAL DEFAULT 0,
            expected_closing REAL DEFAULT 0,
            actual_closing REAL DEFAULT 0,
            variance REAL DEFAULT 0,
            unit_cost REAL DEFAULT 0,
            variance_loss REAL DEFAULT 0,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date_str, master_item_name)
        )
    """)

    conn.commit()
    conn.close()

# ----------------- Mapping Functions -----------------

def save_mapping(source_type: str, source_name: str, master_item_name: str, master_item_id: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO item_mappings (source_type, source_name, master_item_name, master_item_id, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(source_type, source_name) DO UPDATE SET
            master_item_name=excluded.master_item_name,
            master_item_id=excluded.master_item_id,
            updated_at=CURRENT_TIMESTAMP
    """, (source_type, source_name.strip(), master_item_name.strip(), str(master_item_id).strip()))
    conn.commit()
    conn.close()

def get_mapping(source_type: str, source_name: str) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT master_item_name FROM item_mappings
        WHERE source_type = ? AND source_name = ?
    """, (source_type, source_name.strip()))
    row = cursor.fetchone()
    conn.close()
    return row["master_item_name"] if row else None

def get_all_mappings() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM item_mappings ORDER BY updated_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

# ----------------- Cost History Functions -----------------

def save_cost_price(master_item_name: str, unit_cost: float, invoice_no: str = "", invoice_date: str = "", uom: str = "Kg"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO cost_history (master_item_name, invoice_no, invoice_date, unit_cost, uom)
        VALUES (?, ?, ?, ?, ?)
    """, (master_item_name.strip(), invoice_no, invoice_date, float(unit_cost), uom))
    conn.commit()
    conn.close()

def get_latest_cost(master_item_name: str) -> float:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT unit_cost FROM cost_history
        WHERE master_item_name = ?
        ORDER BY id DESC LIMIT 1
    """, (master_item_name.strip(),))
    row = cursor.fetchone()
    conn.close()
    return float(row["unit_cost"]) if row else 0.0

# ----------------- Sales Log Functions -----------------

def save_sales_entry(date_str: str, master_item_name: str, quantity_sold: float, total_revenue: float, pos_sku: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO daily_sales_log (date_str, master_item_name, pos_sku, quantity_sold, total_revenue)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date_str, master_item_name) DO UPDATE SET
            quantity_sold=excluded.quantity_sold,
            total_revenue=excluded.total_revenue,
            pos_sku=excluded.pos_sku
    """, (date_str, master_item_name.strip(), pos_sku, float(quantity_sold), float(total_revenue)))
    conn.commit()
    conn.close()

# ----------------- Snapshot & Profit Analytics -----------------

def save_reconciliation_row(data: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reconciliation_snapshots (
            date_str, master_item_name, category, opening_stock, morning_in,
            afternoon_in, wastage, pos_sales, expected_closing, actual_closing,
            variance, unit_cost, variance_loss, status
        ) VALUES (
            :date_str, :master_item_name, :category, :opening_stock, :morning_in,
            :afternoon_in, :wastage, :pos_sales, :expected_closing, :actual_closing,
            :variance, :unit_cost, :variance_loss, :status
        )
        ON CONFLICT(date_str, master_item_name) DO UPDATE SET
            category=excluded.category,
            opening_stock=excluded.opening_stock,
            morning_in=excluded.morning_in,
            afternoon_in=excluded.afternoon_in,
            wastage=excluded.wastage,
            pos_sales=excluded.pos_sales,
            expected_closing=excluded.expected_closing,
            actual_closing=excluded.actual_closing,
            variance=excluded.variance,
            unit_cost=excluded.unit_cost,
            variance_loss=excluded.variance_loss,
            status=excluded.status
    """, data)
    conn.commit()
    conn.close()

def get_daily_profit_summary(date_str: str) -> Dict[str, Any]:
    """Calculates Revenue, COGS, Shrinkage Loss, Gross Profit, and Net Profit Margin % for a date."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT r.*, s.total_revenue
        FROM reconciliation_snapshots r
        LEFT JOIN daily_sales_log s ON r.date_str = s.date_str AND r.master_item_name = s.master_item_name
        WHERE r.date_str = ?
    """, (date_str,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total_revenue = 0.0
    total_cogs = 0.0
    total_shrinkage_loss = 0.0

    item_breakdown = []
    for r in rows:
        rev = r.get("total_revenue") or 0.0
        sales_qty = r.get("pos_sales") or 0.0
        cost_price = r.get("unit_cost") or 0.0
        cogs = sales_qty * cost_price
        shrinkage_loss = r.get("variance_loss") or 0.0

        total_revenue += rev
        total_cogs += cogs
        total_shrinkage_loss += shrinkage_loss

        gross_profit = rev - cogs
        net_profit = gross_profit - shrinkage_loss
        margin = (net_profit / rev * 100) if rev > 0 else 0.0

        item_breakdown.append({
            "item_name": r["master_item_name"],
            "category": r.get("category", ""),
            "sales_qty": sales_qty,
            "revenue": rev,
            "unit_cost": cost_price,
            "cogs": cogs,
            "variance": r.get("variance", 0.0),
            "shrinkage_loss": shrinkage_loss,
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "margin_pct": margin
        })

    gross_profit = total_revenue - total_cogs
    net_profit = gross_profit - total_shrinkage_loss
    net_margin_pct = (net_profit / total_revenue * 100) if total_revenue > 0 else 0.0

    return {
        "date_str": date_str,
        "total_revenue": total_revenue,
        "total_cogs": total_cogs,
        "total_shrinkage_loss": total_shrinkage_loss,
        "gross_profit": gross_profit,
        "net_profit": net_profit,
        "net_margin_pct": net_margin_pct,
        "items": item_breakdown
    }

def get_monthly_profit_summary(year_month_prefix: str) -> Dict[str, Any]:
    """Aggregates monthly performance across all daily records starting with year_month_prefix."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT date_str FROM reconciliation_snapshots
        WHERE date_str LIKE ? ORDER BY date_str ASC
    """, (f"%{year_month_prefix}%",))
    dates = [r["date_str"] for r in cursor.fetchall()]
    conn.close()

    total_revenue = 0.0
    total_cogs = 0.0
    total_shrinkage_loss = 0.0
    daily_summaries = []

    for d in dates:
        summary = get_daily_profit_summary(d)
        total_revenue += summary["total_revenue"]
        total_cogs += summary["total_cogs"]
        total_shrinkage_loss += summary["total_shrinkage_loss"]
        daily_summaries.append({
            "date": d,
            "revenue": summary["total_revenue"],
            "cogs": summary["total_cogs"],
            "shrinkage_loss": summary["total_shrinkage_loss"],
            "net_profit": summary["net_profit"],
            "margin_pct": summary["net_margin_pct"]
        })

    gross_profit = total_revenue - total_cogs
    net_profit = gross_profit - total_shrinkage_loss
    net_margin_pct = (net_profit / total_revenue * 100) if total_revenue > 0 else 0.0

    return {
        "month": year_month_prefix,
        "total_revenue": total_revenue,
        "total_cogs": total_cogs,
        "total_shrinkage_loss": total_shrinkage_loss,
        "gross_profit": gross_profit,
        "net_profit": net_profit,
        "net_margin_pct": net_margin_pct,
        "days": daily_summaries
    }

# Initialize tables when imported
init_db()
