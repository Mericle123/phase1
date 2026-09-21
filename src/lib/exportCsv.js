const csvValue = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeRows = (rows = []) => rows.map((row) => Array.isArray(row) ? row : Object.values(row || {}));

const safeSheetName = (name = "NZ Britannia Export") =>
  String(name || "NZ Britannia Export").replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

const withExtension = (filename, extension) =>
  filename.replace(/\.(csv|xls|xlsx)$/i, "") + extension;

const estimateColumnWidths = (rows, maxColumns) =>
  Array.from({ length: maxColumns }, (_, columnIndex) => {
    const longest = rows.reduce((max, row) => Math.max(max, String(row[columnIndex] ?? "").length), 8);
    return Math.min(340, Math.max(96, longest * 8 + 28));
  });

export const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const buildFormattedExcelHtml = (rows, options = {}) => {
  const normalizedRows = normalizeRows(rows);
  const maxColumns = Math.max(1, ...normalizedRows.map((row) => row.length));
  const columnWidths = estimateColumnWidths(normalizedRows, maxColumns);
  const title = options.title || "NZ Britannia Export";
  const subtitle = options.subtitle || "Formatted workbook generated from NZ Britannia records.";
  const generatedAt = new Date().toLocaleString();
  const recordCount = Math.max(0, normalizedRows.length - 1);

  const tableRows = normalizedRows.map((row, rowIndex) => {
    const visibleCells = row.filter((cell) => String(cell ?? "").trim() !== "");
    const isBlank = visibleCells.length === 0;
    const isHeader = rowIndex === 0;
    const isSection = !isHeader && visibleCells.length === 1 && String(visibleCells[0]).trim() === String(visibleCells[0]).trim().toUpperCase();

    if (isBlank) {
      return `<tr class="spacer-row"><td colspan="${maxColumns}">&nbsp;</td></tr>`;
    }

    if (isSection) {
      return `<tr class="section-row"><td colspan="${maxColumns}">${escapeHtml(visibleCells[0])}</td></tr>`;
    }

    const tag = isHeader ? "th" : "td";
    const cells = Array.from({ length: maxColumns }, (_, cellIndex) => {
      const value = row[cellIndex] ?? "";
      return `<${tag} class="text-cell">${escapeHtml(value)}</${tag}>`;
    }).join("");
    return `<tr class="${isHeader ? "header-row" : ""}">${cells}</tr>`;
  }).join("");

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(safeSheetName(options.sheetName || title))}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <style>
    body { font-family: Montserrat, Arial, Helvetica, sans-serif; color: #151923; background: #ffffff; }
    .report-wrap { padding: 24px; }
    .kicker { color: #0a5f4a; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    h1 { margin: 6px 0 4px; color: #001a70; font-family: "Playfair Display", Georgia, serif; font-size: 24px; font-weight: 700; }
    .subtitle { margin: 0 0 16px; color: #596274; font-size: 13px; }
    .meta { margin: 0 0 20px; color: #596274; font-size: 12px; border-left: 3px solid #e1261b; padding-left: 10px; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; background: #ffffff; }
    col { mso-width-source: userset; }
    th {
      background: #001a70;
      color: #ffffff;
      border: 1px solid #001a70;
      padding: 11px 12px;
      font-size: 11px;
      font-weight: 800;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 1px;
      vertical-align: middle;
    }
    td {
      border: 1px solid #e4e7ed;
      padding: 10px 12px;
      font-size: 12px;
      vertical-align: top;
      background: #ffffff;
      mso-number-format: "\\@";
    }
    tr:nth-child(even) td { background: #f7f8fb; }
    .section-row td {
      background: #eef7f4;
      color: #0a5f4a;
      border: 1px solid rgba(10,95,74,.2);
      padding: 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }
    .spacer-row td {
      height: 14px;
      padding: 0;
      border: 0;
      background: #ffffff;
    }
    .footer-note { margin-top: 16px; color: #6b7a76; font-size: 11px; }
  </style>
</head>
<body>
  <div class="report-wrap">
    <div class="kicker">NZ Britannia · Retire Better</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
    <p class="meta">Generated: ${escapeHtml(generatedAt)} &nbsp; | &nbsp; Rows: ${recordCount.toLocaleString()}</p>
    <table>
      <colgroup>${columnWidths.map((width) => `<col style="width:${width}px" />`).join("")}</colgroup>
      <tbody>${tableRows || `<tr><td>No records available</td></tr>`}</tbody>
    </table>
    <p class="footer-note">Retire better. Exported from NZ Britannia with formatted columns, table borders, spacing, and readable headings.</p>
  </div>
</body>
</html>`;
};

export const downloadFormattedExcel = (filename, rows, options = {}) => {
  const html = buildFormattedExcelHtml(rows, options);
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = withExtension(filename, ".xls");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const objectsToRows = (records) => {
  if (!records.length) return [];
  const headers = Object.keys(records[0]);
  return [headers, ...records.map((record) => headers.map((header) => record[header]))];
};
