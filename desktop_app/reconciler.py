"""
Reconciliation & Profit Engine.
Performs cross-source item fuzzy mapping, stock variance calculations,
shrinkage loss attribution, and daily/monthly profit margin calculations.
"""

from typing import List, Dict, Any, Optional, Tuple
import re

try:
    from rapidfuzz import fuzz, process
    HAS_RAPIDFUZZ = True
except ImportError:
    import difflib
    HAS_RAPIDFUZZ = False

from database import (
    get_mapping, save_mapping, get_latest_cost, save_cost_price,
    save_sales_entry, save_reconciliation_row
)

def clean_item_string(name: str) -> str:
    """Removes non-ascii scripts (Kannada/Bengali), SKU prefixes, and noise phrases."""
    # Remove SKU like [MP004091]
    name = re.sub(r'\[.*?\]', '', name)
    # Remove non-latin characters
    name = re.sub(r'[^\x00-\x7F]+', ' ', name)
    # Remove common filler words
    noise = [
        "premium", "antibiotic-residue-free", "fresh", "uncut", "whole",
        "dressed with skin", "cut pieces", "curry cut", "janatha chicken",
        "for broth / stock", "free from all growth hormones and antibiotics",
        "pack of 2 pcs", "pack of 6", "pack of 12", "box of 30 eggs", "pack's",
        "without cleaning and cutting", "soft fish belly might openup due to healthy oil",
        "not descaled not cleaned not cut in pieces", "not cleaned not gutted",
        "not cleaned not peeled", "60+ count/kg", "5 to 9 count/kg", "1kg to 1.5kg",
        "1kg to 2kg", "large", "medium", "small", "super large", "extra large 4kg+", "xl", "l", "m", "s"
    ]
    name_clean = name.lower()
    for n in noise:
        name_clean = name_clean.replace(n, " ")
    name_clean = re.sub(r'\s+', ' ', name_clean).strip()
    return name_clean or name.strip()

def compute_similarity(s1: str, s2: str) -> float:
    """Computes string similarity score between 0.0 and 1.0."""
    c1 = clean_item_string(s1).lower()
    c2 = clean_item_string(s2).lower()
    if c1 == c2:
        return 1.0
    if HAS_RAPIDFUZZ:
        score = fuzz.token_sort_ratio(c1, c2) / 100.0
    else:
        score = difflib.SequenceMatcher(None, c1, c2).ratio()
    return score

def match_item_to_master(source_name: str, master_items: List[Dict[str, Any]], source_type: str = "general", threshold: float = 0.65) -> Tuple[Optional[str], float]:
    """
    Finds the best matching master item name for a source item name.
    1. Checks persistent SQLite mappings first.
    2. Runs fuzzy similarity matching across master list.
    """
    # 1. Check persistent DB mapping
    persisted = get_mapping(source_type, source_name)
    if persisted:
        return persisted, 1.0

    # 2. Check exact string match
    s_clean = clean_item_string(source_name)
    best_match = None
    best_score = 0.0

    for m in master_items:
        m_name = m.get("name") or m.get("Product's Name") or ""
        if not m_name:
            continue
        score = compute_similarity(source_name, m_name)
        if score > best_score:
            best_score = score
            best_match = m_name

    if best_score >= threshold:
        return best_match, best_score

    return None, best_score

def calculate_reconciliation(
    master_inventory: List[Dict[str, Any]],
    pdf_incomings: Optional[List[Dict[str, Any]]] = None,
    pos_sales: Optional[List[Dict[str, Any]]] = None,
    closing_stock: Optional[Dict[str, float]] = None,
    delivery_period: str = "Morning"  # "Morning" or "Afternoon"
) -> List[Dict[str, Any]]:
    """
    Computes live stock reconciliation:
    Expected Closing = Opening + Morning (Col G) + Afternoon (Col H) - Return/Wastage - POS Sales (Col K)
    Variance = Actual Closing (Col L) - Expected Closing
    Variance Loss = |Variance| * Cost Price (if variance < 0)
    """
    # Build fast lookup for master inventory rows
    reconciled_rows = []

    # Map incoming PDF items by master item name
    incoming_map = {}
    if pdf_incomings:
        for p in pdf_incomings:
            m_name = p.get("master_item_name")
            if m_name:
                incoming_map[m_name] = p

    # Map POS sales by master item name
    sales_map = {}
    if pos_sales:
        for s in pos_sales:
            m_name = s.get("master_item_name")
            if m_name:
                sales_map[m_name] = s

    for row in master_inventory:
        item_name = row.get("Product's Name") or row.get("name") or ""
        if not item_name or "total" in item_name.lower():
            continue

        category = row.get("Category", "")
        item_id = row.get("ID", "")
        uom = row.get("UOM", "Kg")

        # Existing stock numbers in Tracker
        opening = float(row.get("Opening Stock", 0.0) or 0.0)
        morning_in = float(row.get("Receivied Stock (M)", 0.0) or 0.0)
        afternoon_in = float(row.get("Received stock (E)", 0.0) or 0.0)
        wastage = float(row.get("Return/Wastage", 0.0) or 0.0)
        sales_qty = float(row.get("Total Sales", 0.0) or 0.0)
        actual_closing = float(row.get("Closing Stock", 0.0) or 0.0)

        # Overlay staged PDF incoming if present
        if item_name in incoming_map:
            p_data = incoming_map[item_name]
            p_qty = float(p_data.get("quantity", 0.0))
            p_cost = float(p_data.get("unit_price", 0.0))
            if delivery_period == "Morning":
                morning_in = p_qty
            else:
                afternoon_in = p_qty
            # Update latest cost
            save_cost_price(item_name, p_cost, p_data.get("invoice_no", ""), uom=uom)

        # Overlay staged POS sales if present
        if item_name in sales_map:
            s_data = sales_map[item_name]
            sales_qty = float(s_data.get("quantity_sold", 0.0))

        # Overlay staged Closing Stock if present
        if closing_stock and item_name in closing_stock:
            actual_closing = float(closing_stock[item_name])

        # Mathematical formulas
        total_inventory = opening + morning_in + afternoon_in - wastage
        expected_closing = total_inventory - sales_qty
        variance = actual_closing - expected_closing

        unit_cost = get_latest_cost(item_name)
        # If variance is negative, it's shrinkage/shortage
        variance_loss = abs(variance) * unit_cost if variance < -0.001 else 0.0

        if abs(variance) < 0.01:
            status = "Exact Match"
            status_color = "green"
        elif variance < -0.01:
            status = "Shortage / Shrinkage"
            status_color = "red"
        else:
            status = "Surplus"
            status_color = "blue"

        reconciled_rows.append({
            "id": item_id,
            "category": category,
            "item_name": item_name,
            "uom": uom,
            "opening_stock": opening,
            "morning_in": morning_in,
            "afternoon_in": afternoon_in,
            "wastage": wastage,
            "total_inventory": total_inventory,
            "pos_sales": sales_qty,
            "expected_closing": round(expected_closing, 3),
            "actual_closing": round(actual_closing, 3),
            "variance": round(variance, 3),
            "unit_cost": unit_cost,
            "variance_loss": round(variance_loss, 2),
            "status": status,
            "status_color": status_color
        })

    return reconciled_rows
