"""
POS End-of-Day Sales Report Parser.
Parses POS reports (.xlsx, .xls, .csv) with multi-row hierarchical date headers,
extracting items, quantities sold, and total sales revenue for a specific selected date.
"""

import os
import re
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple

def parse_pos_sales_file(file_path: str) -> Dict[str, Any]:
    """
    Reads the POS Sales file and detects:
    1. Available dates in the file (e.g. ['01 Nov 2026', '02 Nov 2026', ...])
    2. Header mapping triplets (Order, Product Quantity, Total Price)
    """
    if file_path.endswith('.csv'):
        # Read raw lines to handle variable headers
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [line.strip().split(',') for line in f.readlines()]
    else:
        df_raw = pd.read_excel(file_path, header=None)
        lines = df_raw.fillna('').values.tolist()

    if len(lines) < 5:
        raise ValueError("POS file does not contain enough rows to parse.")

    # Find the row containing dates (e.g. '01 Nov 2026', '02 Nov 2026')
    date_row_idx = -1
    date_col_map: Dict[str, Dict[str, int]] = {} # date_str -> {'order': col_idx, 'qty': col_idx, 'price': col_idx}

    date_pattern = re.compile(r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b', re.IGNORECASE)

    for r_idx in range(min(10, len(lines))):
        row = lines[r_idx]
        found_dates = []
        for c_idx, cell in enumerate(row):
            cell_str = str(cell).strip()
            if date_pattern.search(cell_str):
                found_dates.append((cell_str, c_idx))
        if found_dates:
            date_row_idx = r_idx
            break

    if date_row_idx == -1:
        # Fallback: scan for any date-like patterns
        for r_idx in range(min(10, len(lines))):
            row = lines[r_idx]
            for c_idx, cell in enumerate(row):
                cell_str = str(cell).strip()
                if "2026" in cell_str and ("Nov" in cell_str or "Oct" in cell_str or "-" in cell_str):
                    date_row_idx = r_idx
                    break
            if date_row_idx != -1:
                break

    if date_row_idx == -1:
        date_row_idx = 2  # Default based on reference format

    header_date_row = lines[date_row_idx]
    sub_header_row = lines[date_row_idx + 1] if len(lines) > date_row_idx + 1 else []

    current_date = ""
    for c_idx in range(len(header_date_row)):
        cell_date = str(header_date_row[c_idx]).strip()
        if cell_date:
            current_date = cell_date
            if current_date not in date_col_map:
                date_col_map[current_date] = {}

        if current_date:
            sub = str(sub_header_row[c_idx]).strip().lower() if c_idx < len(sub_header_row) else ""
            if "order" in sub:
                date_col_map[current_date]['order'] = c_idx
            elif "quantity" in sub or "qty" in sub:
                date_col_map[current_date]['qty'] = c_idx
            elif "price" in sub or "total" in sub or "amount" in sub:
                date_col_map[current_date]['price'] = c_idx

    # If subheaders didn't explicitly map triplets, assume standard order, qty, price stepping
    for d, cols in list(date_col_map.items()):
        if 'qty' not in cols:
            # Look for the primary date index
            for c_idx, val in enumerate(header_date_row):
                if str(val).strip() == d:
                    date_col_map[d] = {
                        'order': c_idx,
                        'qty': c_idx + 1,
                        'price': c_idx + 2
                    }
                    break

    # Extract all item rows
    item_rows = []
    current_category = "General"
    start_row = date_row_idx + 2

    for r_idx in range(start_row, len(lines)):
        row = lines[r_idx]
        if not row or not any(row):
            continue

        first_col = str(row[0]).strip()
        if not first_col:
            # Check column 1 if column 0 is blank
            first_col = str(row[1]).strip() if len(row) > 1 else ""

        if not first_col or first_col.lower() == 'total':
            continue

        # Check if category row (e.g. All / Saleable / Fish)
        if "all / saleable /" in first_col.lower() or first_col.endswith("Total"):
            current_category = first_col.replace("All / Saleable /", "").strip()
            continue

        # Check for SKU pattern e.g. [MP004091] White Eggs (6pc)
        sku = ""
        clean_name = first_col
        match = re.search(r'\[(.*?)\]\s*(.*)', first_col)
        if match:
            sku = match.group(1).strip()
            clean_name = match.group(2).strip()

        item_entry = {
            "raw_text": first_col,
            "sku": sku,
            "item_name": clean_name,
            "category": current_category,
            "row_index": r_idx,
            "row_data": row
        }
        item_rows.append(item_entry)

    return {
        "dates": list(date_col_map.keys()),
        "date_col_map": date_col_map,
        "items": item_rows,
        "raw_lines": lines
    }

def get_sales_for_date(pos_data: Dict[str, Any], selected_date: str) -> List[Dict[str, Any]]:
    """
    Extracts item sales and revenue for a specific date from parsed POS data.
    """
    date_col_map = pos_data.get("date_col_map", {})
    if selected_date not in date_col_map:
        # Try matching partial date
        matched_date = None
        for d in date_col_map:
            if selected_date.lower() in d.lower() or d.lower() in selected_date.lower():
                matched_date = d
                break
        if not matched_date:
            return []
        selected_date = matched_date

    cols = date_col_map[selected_date]
    qty_col = cols.get('qty')
    price_col = cols.get('price')

    results = []
    for it in pos_data.get("items", []):
        row = it["row_data"]
        qty = 0.0
        price = 0.0

        if qty_col is not None and qty_col < len(row):
            raw_qty = str(row[qty_col]).replace(',', '').strip()
            try:
                qty = float(raw_qty) if raw_qty else 0.0
            except ValueError:
                qty = 0.0

        if price_col is not None and price_col < len(row):
            raw_price = str(row[price_col]).replace(',', '').strip()
            try:
                price = float(raw_price) if raw_price else 0.0
            except ValueError:
                price = 0.0

        # Only include or highlight if quantity or price > 0 or keep full for review
        results.append({
            "sku": it["sku"],
            "pos_name": it["item_name"],
            "category": it["category"],
            "quantity_sold": qty,
            "total_price": price,
            "raw_row_idx": it["row_index"],
            "approved": True  # Default to approved, user can toggle in UI
        })

    return results
