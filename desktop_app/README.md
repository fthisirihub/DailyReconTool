# Fish & Meat Store Stock Reconciliation and Profit Margin Tracker
### Production-Grade Python CustomTkinter Desktop Application

---

## 📋 Overview
This Python desktop application automates inventory reconciliation, incoming stock logging, POS sales reviews, closing stock sync, and profit margin analysis for fish and meat retail stores.

### Core Modules & Exact Google Sheet Targets:
1. **Module 1: FreshToHome Incoming Inventory (PDF)**
   - Smart extraction via `@google/genai` (`gemini-2.5-flash`) with structured schema.
   - User toggle: **Morning Delivery -> Column G** or **Afternoon Delivery -> Column H**.
   - Logs unit purchase cost to local SQLite database.
2. **Module 2: POS End-of-Day Sales Report (Excel/CSV)**
   - Multi-date hierarchical parsing (`DD MMM YYYY`).
   - Interactive staging table to adjust/approve quantities.
   - Pushes sales quantities to **Column K** and logs daily sales revenue to SQLite.
3. **Module 3: Closing Stock Sync (Google Sheet)**
   - Fetches physical closing counts for the selected date.
   - Pushes to **Column L**.
4. **Formula Protection Guarantee:**
   - Column J (`Total Inventory`), Column M (`Shrinkage`), Category subtotals, and Columns O:Q (`INVENTORY SUMMARY`) are **never overwritten**.
5. **Reconciliation & Mismatch Engine:**
   - Expected Closing = $(Opening + Morning [G] + Afternoon [H]) - Wastage - Sales [K]$
   - Variance = $Actual [L] - Expected$
   - Shrinkage Loss = $|Variance| \times Cost Price$
6. **Profit Margin Analytics:**
   - Gross Profit = $Total Revenue - COGS$
   - Net Profit = $Gross Profit - Shrinkage Loss$
   - Net Margin % = $\frac{Net Profit}{Revenue} \times 100$

---

## 🚀 Quickstart Installation

### 1. Requirements & Virtual Environment
Ensure you have Python 3.10+ installed.

```bash
cd desktop_app
python3 -m venv venv

# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# Install required dependencies
pip install -r requirements.txt
```

### 2. Setting Up Google Cloud Service Account JSON Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Fish-Meat-Reconciliation`).
3. Enable both:
   - **Google Sheets API**
   - **Google Drive API**
4. Navigate to **IAM & Admin > Service Accounts** and click **Create Service Account**.
5. Assign the role **Editor**.
6. Under the **Keys** tab, click **Add Key > Create new key > JSON**.
7. Download the JSON file and save it as `credentials.json` inside the `desktop_app` folder.
8. **CRITICAL STEP:** Open your Google Sheets:
   - *Master Daily Inventory Tracker* Google Sheet
   - *Closing Stock* Google Sheet
   Click **Share** and add your Service Account email (e.g. `your-service-account@project-id.iam.gserviceaccount.com`) as **Editor**.

### 3. Setting Up Gemini API Key
Obtain a free or standard API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
Set it as an environment variable:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```
Or enter it directly inside the app's **Settings & Keys** view.

### 4. Running the Application
```bash
python main.py
```

---

## 🗄️ SQLite Database Structure
The app creates `inventory_reconciliation.db` automatically:
- `item_mappings`: Stores cross-source name mappings between FreshToHome descriptions, POS names, and Tracker item names.
- `cost_history`: Stores date-wise unit purchase prices from invoices.
- `daily_sales_log`: Records daily item-wise sales volume and revenue.
- `reconciliation_snapshots`: Records daily variances, shrinkage loss, and status badges.
