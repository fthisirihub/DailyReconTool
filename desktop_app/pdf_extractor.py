"""
FreshToHome Incoming Inventory PDF Extractor.
Uses google-genai SDK (gemini-2.5-flash) with Structured Outputs (JSON Schema)
to accurately extract item descriptions, quantities, UoMs, and unit purchase prices.
"""

import os
import json
import base64
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class InvoiceItem(BaseModel):
    item_description: str = Field(description="Full or cleaned item name from the invoice table")
    hsn_sac: Optional[str] = Field(default="", description="HSN/SAC code")
    unit_price: float = Field(description="Unit cost price in INR (before discount/tax)")
    quantity: float = Field(description="Billed quantity or weight")
    uom: str = Field(description="Unit of measurement, e.g., Kg or pack")
    discount: float = Field(default=0.0, description="Discount amount in INR")
    subtotal: float = Field(description="Row subtotal in INR")

class FreshToHomeInvoice(BaseModel):
    invoice_number: Optional[str] = Field(default="", description="Invoice number")
    order_number: Optional[str] = Field(default="", description="Order number")
    invoice_date: Optional[str] = Field(default="", description="Invoice date")
    delivery_slot: Optional[str] = Field(default="", description="Delivery slot string (e.g. 8:00am - 10:30am)")
    delivery_period: Optional[str] = Field(default="Morning", description="'Morning' or 'Afternoon'")
    total_amount: Optional[float] = Field(default=0.0, description="Grand Total in INR")
    items: List[InvoiceItem] = Field(default_factory=list, description="Extracted line items")

def extract_invoice_from_pdf(pdf_path: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts structured invoice details using Gemini 2.5 Flash.
    Falls back to a structured tabular fallback if API key is not present.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print("[pdf_extractor] No GEMINI_API_KEY provided; attempting local fallback parsing.")
        return parse_pdf_fallback(pdf_path)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        prompt = """
        You are an expert invoice data extractor for FreshToHome B2B invoices.
        Analyze this FreshToHome Bill of Supply PDF.
        Extract:
        1. Invoice Number (e.g. 29F009B005902638)
        2. Order Number (e.g. STHB20005787)
        3. Invoice Date (e.g. Oct 20, 2026)
        4. Delivery Slot (e.g. 21st Oct, Wed : 8:00am - 10:30am)
        5. Delivery Period: "Morning" if delivery slot is before 12:00 PM, otherwise "Afternoon"
        6. Total Amount / Grand Total in INR
        7. Table items: Extract every single row with exact Item name/description, HSN/SAC, Price (unit cost), Qty, UoM (Kg or pack), Discount, and Subtotal.
        Return the result adhering strictly to the JSON schema.
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf"
                ),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FreshToHomeInvoice,
                temperature=0.0
            )
        )

        result_json = json.loads(response.text)
        return result_json

    except Exception as e:
        print(f"[pdf_extractor] Gemini extraction error: {e}. Falling back to text parser.")
        return parse_pdf_fallback(pdf_path)

def parse_pdf_fallback(pdf_path: str) -> Dict[str, Any]:
    """
    Dynamic fallback parser extracting invoice table lines from PDF streams
    when Gemini API key is not present or offline.
    """
    items = []
    inv_no = "INV-UPLOADED"
    order_no = "ORD-UPLOADED"
    inv_date = "Nov 2026"
    slot_str = "8:00am - 10:30am"
    period = "Morning"

    try:
        import re
        full_text = ""
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                full_text += (page.extract_text() or "") + "\n"
        except Exception:
            with open(pdf_path, "rb") as f:
                content = f.read().decode("latin1", errors="ignore")
                full_text = content

        inv_match = re.search(r'Invoice\s*#\s*([A-Za-z0-9]+)', full_text, re.I)
        if inv_match:
            inv_no = inv_match.group(1)
        ord_match = re.search(r'Order\s*#\s*([A-Za-z0-9]+)', full_text, re.I)
        if ord_match:
            order_no = ord_match.group(1)
        slot_match = re.search(r'Delivery Slot:\s*([^|\n\r]+)', full_text, re.I)
        if slot_match:
            slot_str = slot_match.group(1).strip()
            if "pm" in slot_str.lower() or "afternoon" in slot_str.lower():
                period = "Afternoon"
        date_match = re.search(r'Invoice Date:\s*([^|\n\r]+)', full_text, re.I)
        if date_match:
            inv_date = date_match.group(1).strip()

        # Parse line by line for table rows
        for line in full_text.splitlines():
            line_str = line.strip()
            if ("₹" in line_str or re.search(r'\b\d{8}\b', line_str)) and any(u in line_str.lower() for u in ["kg", "pack"]):
                # Extract rupee prices
                prices = [float(p.replace("₹", "").replace(",", "")) for p in re.findall(r'₹\s*[\d,]+(?:\.\d+)?', line_str)]
                uom_match = re.search(r'\b(Kg|pack|packs|nos)\b', line_str, re.I)
                uom = uom_match.group(1) if uom_match else "Kg"

                # Find description before HSN or first price
                hsn_match = re.search(r'\b(\d{8})\b', line_str)
                if hsn_match:
                    desc = line_str[:hsn_match.start()].strip()
                    # extract quantity between HSN and UOM
                    after_hsn = line_str[hsn_match.end():]
                    qty_match = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:Kg|pack)', after_hsn, re.I)
                    qty = float(qty_match.group(1)) if qty_match else 1.0
                else:
                    parts = re.split(r'₹', line_str)
                    desc = parts[0].strip()
                    qty = 1.0

                desc = re.sub(r'^[^\w]+', '', desc).strip()
                if desc and not desc.lower().startswith("total") and not desc.lower().startswith("invoice"):
                    unit_p = prices[0] if prices else 100.0
                    subtot = prices[-1] if len(prices) > 1 else (unit_p * qty)
                    items.append({
                        "item_description": desc,
                        "hsn_sac": hsn_match.group(1) if hsn_match else "02071300",
                        "unit_price": unit_p,
                        "quantity": qty,
                        "uom": uom,
                        "discount": 0.0,
                        "subtotal": subtot
                    })
    except Exception as e:
        print(f"[pdf_extractor] Local parsing warning: {e}")

    return {
        "invoice_number": inv_no,
        "order_number": order_no,
        "invoice_date": inv_date,
        "delivery_slot": slot_str,
        "delivery_period": period,
        "total_amount": sum(i["subtotal"] for i in items),
        "items": items
    }
