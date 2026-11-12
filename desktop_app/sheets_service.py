"""
Google Sheets Integration Service.
Reads End-of-Day Closing Stock Google Sheet and pushes targeted updates
to specific columns (G, H, K, L) in the Master Daily Inventory Tracker Google Sheet
WITHOUT overwriting formulas or unrelated columns.
"""

import os
from typing import List, Dict, Any, Optional, Tuple
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

class SheetsService:
    def __init__(self, service_account_json_path: str):
        if not os.path.exists(service_account_json_path):
            raise FileNotFoundError(f"Service account file not found: {service_account_json_path}")

        self.creds = Credentials.from_service_account_file(service_account_json_path, scopes=SCOPES)
        self.client = gspread.authorize(self.creds)

    # ------------------ Closing Stock Sheet ------------------

    def fetch_closing_stock(self, sheet_url_or_id: str, date_header: str) -> Dict[str, float]:
        """
        Reads closing stock numbers from the End-of-Day Closing Stock Google Sheet.
        Row 1 contains date headers (e.g. '1-11', '2-11', '10-11').
        Column A contains Item Names.
        """
        try:
            if sheet_url_or_id.startswith("http"):
                sh = self.client.open_by_url(sheet_url_or_id)
            else:
                sh = self.client.open_by_key(sheet_url_or_id)

            worksheet = sh.get_worksheet(0)
            all_values = worksheet.get_all_values()

            if not all_values:
                return {}

            header_row = all_values[0]

            # Find matching date column index
            target_col_idx = -1
            clean_date = date_header.strip().lower()
            for idx, col in enumerate(header_row):
                col_val = str(col).strip().lower()
                if clean_date == col_val or clean_date in col_val:
                    target_col_idx = idx
                    break

            if target_col_idx == -1:
                # Try formatting variations e.g. '10-11' vs '10-Nov'
                for idx, col in enumerate(header_row):
                    col_val = str(col).strip()
                    if clean_date.split("-")[0] in col_val:
                        target_col_idx = idx
                        break

            if target_col_idx == -1:
                raise ValueError(f"Date column '{date_header}' not found in Closing Stock sheet.")

            closing_data = {}
            for row in all_values[1:]:
                if not row or not row[0]:
                    continue
                item_name = str(row[0]).strip()
                # Skip category headers like 'MEAT', 'FISH', 'EGGS'
                if item_name in ['MEAT', 'FISH', 'EGGS', 'Marinates', 'Total']:
                    continue

                val_str = str(row[target_col_idx]).replace(',', '').strip() if target_col_idx < len(row) else "0"
                try:
                    val = float(val_str) if val_str else 0.0
                except ValueError:
                    val = 0.0

                closing_data[item_name] = val

            return closing_data

        except Exception as e:
            raise RuntimeError(f"Error fetching closing stock: {e}")

    # ------------------ Master Daily Inventory Tracker Sheet ------------------

    def get_tracker_worksheet(self, tracker_sheet_id: str, tab_name: Optional[str] = None) -> gspread.Worksheet:
        if tracker_sheet_id.startswith("http"):
            sh = self.client.open_by_url(tracker_sheet_id)
        else:
            sh = self.client.open_by_key(tracker_sheet_id)

        if tab_name:
            target = str(tab_name).strip()
            # 1. Exact worksheet name (e.g. "10", "1", "30")
            try:
                return sh.worksheet(target)
            except gspread.WorksheetNotFound:
                pass

            # 2. Search all worksheet titles for matching day number
            for ws in sh.worksheets():
                title = ws.title.strip()
                if title == target or title == f"{target}-" or title.startswith(f"{target}-"):
                    return ws

            # 3. Fallback to first worksheet
            return sh.get_worksheet(0)
        return sh.get_worksheet(0)

    def fetch_master_inventory(self, tracker_sheet_id: str, tab_name: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        Reads master tracker table.
        Returns:
        1. List of item dictionaries
        2. Lookup map: item_name -> sheet_row_index (1-indexed)
        """
        ws = self.get_tracker_worksheet(tracker_sheet_id, tab_name)
        all_values = ws.get_all_values()

        if not all_values:
            return [], {}

        # Look for header row containing 'Product's Name'
        header_row_idx = 0
        for idx, row in enumerate(all_values[:5]):
            row_str = " ".join([str(c).lower() for c in row])
            if "product" in row_str or "opening stock" in row_str:
                header_row_idx = idx
                break

        headers = all_values[header_row_idx]
        items = []
        name_to_row_map = {}

        for r_idx in range(header_row_idx + 1, len(all_values)):
            row = all_values[r_idx]
            sheet_row_num = r_idx + 1 # 1-indexed for gspread cell coordinates

            if not row or len(row) < 4:
                continue

            # Column D (index 3) is Product's Name
            product_name = str(row[3]).strip() if len(row) > 3 else ""
            if not product_name or "total" in product_name.lower():
                continue

            item_dict = {
                "sheet_row": sheet_row_num,
                "SL NO": row[0] if len(row) > 0 else "",
                "Category": row[1] if len(row) > 1 else "",
                "ID": row[2] if len(row) > 2 else "",
                "Product's Name": product_name,
                "UOM": row[4] if len(row) > 4 else "Kg",
                "Opening Stock": row[5] if len(row) > 5 else "0",
                "Receivied Stock (M)": row[6] if len(row) > 6 else "0",
                "Received stock (E)": row[7] if len(row) > 7 else "0",
                "Return/Wastage": row[8] if len(row) > 8 else "0",
                "Total Inventory": row[9] if len(row) > 9 else "0",
                "Total Sales": row[10] if len(row) > 10 else "0",
                "Closing Stock": row[11] if len(row) > 11 else "0",
                "Shrinkage": row[12] if len(row) > 12 else "0"
            }
            items.append(item_dict)
            name_to_row_map[product_name] = sheet_row_num

        return items, name_to_row_map

    # ------------------ SAFE TARGETED CELL UPDATES ------------------

    def update_incoming_stock(
        self,
        tracker_sheet_id: str,
        tab_name: Optional[str],
        items_to_update: List[Dict[str, Any]],
        delivery_period: str = "Morning"
    ) -> int:
        """
        Updates ONLY Column G (Morning) or Column H (Afternoon).
        Preserves all formulas in Col J, M, and O:Q.
        """
        ws = self.get_tracker_worksheet(tracker_sheet_id, tab_name)
        _, name_to_row = self.fetch_master_inventory(tracker_sheet_id, tab_name)

        target_col_letter = "G" if delivery_period == "Morning" else "H"
        cell_updates = []

        for it in items_to_update:
            master_name = it.get("master_item_name")
            qty = it.get("quantity", 0.0)
            if master_name in name_to_row:
                row_idx = name_to_row[master_name]
                cell_range = f"{target_col_letter}{row_idx}"
                cell_updates.append({
                    "range": cell_range,
                    "values": [[qty]]
                })

        if cell_updates:
            ws.batch_update(cell_updates, value_input_option="USER_ENTERED")

        return len(cell_updates)

    def update_pos_sales(
        self,
        tracker_sheet_id: str,
        tab_name: Optional[str],
        sales_to_update: List[Dict[str, Any]]
    ) -> int:
        """
        Updates ONLY Column K (Total Sales).
        Preserves all formulas and unrelated columns.
        """
        ws = self.get_tracker_worksheet(tracker_sheet_id, tab_name)
        _, name_to_row = self.fetch_master_inventory(tracker_sheet_id, tab_name)

        cell_updates = []
        for s in sales_to_update:
            if not s.get("approved", True):
                continue
            master_name = s.get("master_item_name")
            qty = s.get("quantity_sold", 0.0)
            if master_name in name_to_row:
                row_idx = name_to_row[master_name]
                cell_updates.append({
                    "range": f"K{row_idx}",
                    "values": [[qty]]
                })

        if cell_updates:
            ws.batch_update(cell_updates, value_input_option="USER_ENTERED")

        return len(cell_updates)

    def update_closing_stock(
        self,
        tracker_sheet_id: str,
        tab_name: Optional[str],
        closing_counts: Dict[str, float]
    ) -> int:
        """
        Updates ONLY Column L (Closing Stock).
        Preserves formulas in Col J, M, and summary blocks.
        """
        ws = self.get_tracker_worksheet(tracker_sheet_id, tab_name)
        _, name_to_row = self.fetch_master_inventory(tracker_sheet_id, tab_name)

        cell_updates = []
        for item_name, count_val in closing_counts.items():
            if item_name in name_to_row:
                row_idx = name_to_row[item_name]
                cell_updates.append({
                    "range": f"L{row_idx}",
                    "values": [[count_val]]
                })

        if cell_updates:
            ws.batch_update(cell_updates, value_input_option="USER_ENTERED")

        return len(cell_updates)
