import ExcelJS from 'exceljs';

export interface IndentReadyRow {
  slNo: number;
  category: string;
  id: string;
  productName: string;
  uom: string;
  quantity: number | '';
}

interface CategoryColorTheme {
  rowFill: string;      // ARGB hex for the full row
  badgeFill: string;    // ARGB hex for the Category cell
  badgeFont: string;    // ARGB hex for Category cell text
  rowFont: string;      // ARGB hex for product row text
}

function getCategoryTheme(category: string): CategoryColorTheme {
  const cat = category.trim().toLowerCase();

  if (cat === 'chicken') {
    return {
      rowFill: 'FFFFEDD5',   // Warm Orange tint
      badgeFill: 'FFFB923C', // Vibrant Orange
      badgeFont: 'FFFFFFFF', // White bold text
      rowFont: 'FF431407',
    };
  }
  if (cat === 'mutton') {
    return {
      rowFill: 'FFFEE2E2',   // Light Red tint
      badgeFill: 'FFF87171', // Light/Medium Red
      badgeFont: 'FFFFFFFF', // White bold text
      rowFont: 'FF7F1D1D',
    };
  }
  if (cat === 'fish' || cat === 'fishes') {
    return {
      rowFill: 'FFE0F2FE',   // Light Blue tint
      badgeFill: 'FF38BDF8', // Sky / Light Blue
      badgeFont: 'FFFFFFFF', // White bold text
      rowFont: 'FF0C4A6E',
    };
  }
  if (cat === 'batter' || cat === 'dairy') {
    return {
      rowFill: 'FFFEF9C3',   // Soft Yellow
      badgeFill: 'FFEAB308',
      badgeFont: 'FFFFFFFF',
      rowFont: 'FF713F12',
    };
  }
  if (cat === 'eggs') {
    return {
      rowFill: 'FFF3E8FF',   // Soft Purple
      badgeFill: 'FFA855F7',
      badgeFont: 'FFFFFFFF',
      rowFont: 'FF581C87',
    };
  }
  if (cat === 'marinates') {
    return {
      rowFill: 'FFD1FAE5',   // Soft Mint Green
      badgeFill: 'FF10B981',
      badgeFont: 'FFFFFFFF',
      rowFont: 'FF064E3B',
    };
  }
  if (cat === 'heat & eat') {
    return {
      rowFill: 'FFE0E7FF',   // Soft Indigo
      badgeFill: 'FF6366F1',
      badgeFont: 'FFFFFFFF',
      rowFont: 'FF312E81',
    };
  }

  return {
    rowFill: 'FFF1F5F9',
    badgeFill: 'FF64748B',
    badgeFont: 'FFFFFFFF',
    rowFont: 'FF1E293B',
  };
}

const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

/**
 * Exports IndentReady rows to a styled .xlsx workbook with:
 * - Bold colored header row
 * - Distinct category colors (Chicken = Orange, Mutton = Light Red, Fish = Light Blue, etc.)
 * - Highlighted non-blank Quantity cells
 */
export async function exportColorfulIndentReadyExcel(
  rows: IndentReadyRow[],
  sheetName: string,
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Isiri Hub Inventory Tracker';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'SL NO', key: 'slNo', width: 9 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'ID', key: 'id', width: 10 },
    { header: "Product's Name", key: 'productName', width: 52 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Quantity', key: 'quantity', width: 14 },
  ];

  // Style Header Row (Row 1) — Bold and filled with color
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Deep Teal/Emerald header fill
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF115E59' } },
      left: { style: 'thin', color: { argb: 'FF14B8A6' } },
      bottom: { style: 'medium', color: { argb: 'FF115E59' } },
      right: { style: 'thin', color: { argb: 'FF14B8A6' } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 4 ? 'left' : 'center',
    };
  });

  // Add and style data rows by Category
  rows.forEach(item => {
    const dataRow = worksheet.addRow({
      slNo: item.slNo,
      category: item.category,
      id: item.id,
      productName: item.productName,
      uom: item.uom,
      quantity: item.quantity === '' ? null : item.quantity,
    });

    dataRow.height = 21;
    const theme = getCategoryTheme(item.category);
    const hasQty = item.quantity !== '' && item.quantity !== null && item.quantity !== undefined;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = CELL_BORDER;

      if (colNumber === 2) {
        // Category Column — bold vibrant category color badge
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: theme.badgeFill },
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: theme.badgeFont },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 6 && hasQty) {
        // Quantity Column when populated from PDF — pop with bold highlight
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFBBF7D0' }, // Crisp light green highlight for active quantities
        };
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FF064E3B' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.###';
      } else {
        // Rest of the row — category color fill
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: theme.rowFill },
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colNumber === 4 && hasQty,
          color: { argb: theme.rowFont },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal:
            colNumber === 1 || colNumber === 3 || colNumber === 5
              ? 'center'
              : colNumber === 6
              ? 'right'
              : 'left',
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
