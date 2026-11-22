import { effectiveAssetStatus, getAssetKeySpecChips, isLocationOnlyAssetType, tonerMatchesPrinter } from "@/lib/catalog";
import type { Asset, Employee, TonerStock, TonerTransaction } from "@/lib/types";

export type StyledColumn = {
  header: string;
  align?: "left" | "center";
  minWidth?: number;
  maxWidth?: number;
};

export type StyledCell = {
  value: string | number;
  tone?: "green" | "blue" | "amber" | "red";
  align?: "left" | "center";
  isNumber?: boolean;
};

export type StyledSheet = {
  name: string;
  title: string;
  subtitle: string;
  columns: StyledColumn[];
  rows: StyledCell[][];
  footerRow?: (string | number)[];
};

function escapeXml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    // Strip illegal XML 1.0 control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";
}

function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="9">
    <font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="9.5"/><color rgb="FF3730A3"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E1B4B"/><name val="Calibri"/></font>
    <font><b/><sz val="9.5"/><color rgb="FF166534"/><name val="Calibri"/></font>
    <font><b/><sz val="9.5"/><color rgb="FF1D4ED8"/><name val="Calibri"/></font>
    <font><b/><sz val="9.5"/><color rgb="FFB45309"/><name val="Calibri"/></font>
    <font><b/><sz val="9.5"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E1B4B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF818CF8"/></left>
      <right style="thin"><color rgb="FF818CF8"/></right>
      <top style="thin"><color rgb="FF818CF8"/></top>
      <bottom style="medium"><color rgb="FF312E81"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;
}

function buildWorksheetXml(sheet: StyledSheet): string {
  const colCount = Math.max(1, sheet.columns.length);
  const lastCol = colLetter(colCount - 1);

  const widths = sheet.columns.map((col, colIdx) => {
    let maxLen = col.header.length;
    for (const row of sheet.rows) {
      const cell = row[colIdx];
      const text = String(cell?.value ?? "");
      const longestLine = text.split("\n").reduce((m, line) => Math.max(m, line.length), 0);
      if (longestLine > maxLen) maxLen = longestLine;
    }
    if (sheet.footerRow && sheet.footerRow[colIdx] !== undefined) {
      maxLen = Math.max(maxLen, String(sheet.footerRow[colIdx]).length);
    }
    const minW = col.minWidth ?? 10;
    const maxW = col.maxWidth ?? 44;
    return Math.min(maxW, Math.max(minW, maxLen + 4));
  });

  const colsXml = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`)
    .join("");

  const renderInlineCell = (ref: string, value: string | number, styleIdx: number, isNumber = false) => {
    if (isNumber && typeof value === "number" && Number.isFinite(value)) {
      return `<c r="${ref}" s="${styleIdx}" t="n"><v>${value}</v></c>`;
    }
    return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  };

  const rowsXml: string[] = [];

  // Row 1: Title Banner
  const titleCells = [renderInlineCell("A1", sheet.title, 1)];
  for (let c = 1; c < colCount; c++) titleCells.push(`<c r="${colLetter(c)}1" s="1"/>`);
  rowsXml.push(`<row r="1" ht="30" customHeight="1">${titleCells.join("")}</row>`);

  // Row 2: Subtitle Banner
  const subCells = [renderInlineCell("A2", sheet.subtitle, 2)];
  for (let c = 1; c < colCount; c++) subCells.push(`<c r="${colLetter(c)}2" s="2"/>`);
  rowsXml.push(`<row r="2" ht="20" customHeight="1">${subCells.join("")}</row>`);

  // Row 3: Spacer
  rowsXml.push(`<row r="3" ht="8" customHeight="1"/>`);

  // Row 4: Table Headers
  const headerCells = sheet.columns.map((col, idx) =>
    renderInlineCell(`${colLetter(idx)}4`, col.header, col.align === "center" ? 4 : 3),
  );
  rowsXml.push(`<row r="4" ht="26" customHeight="1">${headerCells.join("")}</row>`);

  // Data Rows (starting at Row 5)
  sheet.rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 5;
    const isZebra = rowIndex % 2 === 1;
    const cells = sheet.columns.map((col, colIdx) => {
      const cell = row[colIdx] ?? { value: "" };
      const align = cell.align ?? col.align ?? "left";
      let styleIdx = align === "center" ? (isZebra ? 8 : 7) : (isZebra ? 6 : 5);
      if (cell.tone === "green") styleIdx = 9;
      else if (cell.tone === "blue") styleIdx = 10;
      else if (cell.tone === "amber") styleIdx = 11;
      else if (cell.tone === "red") styleIdx = 12;
      return renderInlineCell(`${colLetter(colIdx)}${excelRow}`, cell.value, styleIdx, Boolean(cell.isNumber));
    });
    rowsXml.push(`<row r="${excelRow}" ht="22" customHeight="1">${cells.join("")}</row>`);
  });

  // Optional Footer Row
  const lastDataRow = Math.max(4, sheet.rows.length + 4);
  if (sheet.footerRow && sheet.footerRow.length) {
    const footerExcelRow = lastDataRow + 1;
    const footerCells = sheet.columns.map((col, colIdx) => {
      const val = sheet.footerRow?.[colIdx] ?? "";
      const isNum = typeof val === "number";
      const styleIdx = col.align === "center" || isNum ? 14 : 13;
      return renderInlineCell(`${colLetter(colIdx)}${footerExcelRow}`, val, styleIdx, isNum);
    });
    rowsXml.push(`<row r="${footerExcelRow}" ht="24" customHeight="1">${footerCells.join("")}</row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml.join("")}</sheetData>
  <autoFilter ref="A4:${lastCol}${lastDataRow}"/>
  <mergeCells count="2">
    <mergeCell ref="A1:${lastCol}1"/>
    <mergeCell ref="A2:${lastCol}2"/>
  </mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export function buildStyledWorkbookFiles(sheets: StyledSheet[]): Record<string, string> {
  const safeSheets = sheets.map((sheet, idx) => ({
    ...sheet,
    name: sanitizeSheetName(sheet.name || `Sheet ${idx + 1}`),
  }));

  const files: Record<string, string> = {};

  files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`;

  files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}
  </sheets>
</workbook>`;

  files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  files["xl/styles.xml"] = buildStylesXml();

  safeSheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = buildWorksheetXml(sheet);
  });

  return files;
}

export async function downloadStyledWorkbook(sheets: StyledSheet[], filename: string): Promise<void> {
  const { strToU8, zipSync } = await import("fflate");
  const xmlFiles = buildStyledWorkbookFiles(sheets);
  const archive: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(xmlFiles)) {
    archive[path] = strToU8(content);
  }
  const zipped = zipSync(archive, { level: 6 });
  const buffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Sorting & Formatting Helpers ---

function statusTone(status: string): StyledCell["tone"] {
  const s = status.toLowerCase();
  if (s === "available" || s === "in stock" || s === "yes" || s === "active" || s === "restock") return "green";
  if (s === "assigned" || s === "issued") return "blue";
  if (s === "in repair" || s === "repair" || s === "low stock" || s === "pending") return "amber";
  if (s === "damage" || s === "damaged" || s === "retired" || s === "out of stock" || s === "no" || s === "resigned") return "red";
  return undefined;
}

function verifiedCell(verified?: boolean): StyledCell {
  const label = verified ? "Yes" : "No";
  return { value: label, align: "center", tone: verified ? "green" : "amber" };
}

function getDepartmentForSort(asset: Asset, employeeMap: Record<string, Employee>): string {
  const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
  return (emp?.department || asset.assignedDepartment || asset.custodianDepartment || "").trim();
}

export function sortAssetsByDepartmentAZ(assets: Asset[], employeeMap: Record<string, Employee>): Asset[] {
  return [...assets].sort((a, b) => {
    const deptA = getDepartmentForSort(a, employeeMap);
    const deptB = getDepartmentForSort(b, employeeMap);
    // Put assigned departments A–Z first, unassigned/Central Stock at bottom
    if (deptA && !deptB) return -1;
    if (!deptA && deptB) return 1;
    const deptCmp = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
    if (deptCmp !== 0) return deptCmp;

    const nameA = (a.employeeId ? employeeMap[a.employeeId]?.name : a.location) || "";
    const nameB = (b.employeeId ? employeeMap[b.employeeId]?.name : b.location) || "";
    const nameCmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    if (nameCmp !== 0) return nameCmp;

    return a.code.localeCompare(b.code);
  });
}

function buildDepartmentSummarySheet(
  reportLabel: string,
  items: Asset[],
  employeeMap: Record<string, Employee>,
  generatedDate: string,
): StyledSheet {
  const map = new Map<string, { assigned: number; available: number; repair: number; verified: number; total: number }>();
  for (const asset of items) {
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    const cur = map.get(dept) ?? { assigned: 0, available: 0, repair: 0, verified: 0, total: 0 };
    const status = effectiveAssetStatus(asset);
    cur.total += 1;
    if (status === "Assigned") cur.assigned += 1;
    else if (status === "Available") cur.available += 1;
    else if (status === "In repair") cur.repair += 1;
    if (asset.verified) cur.verified += 1;
    map.set(dept, cur);
  }

  const sortedEntries = Array.from(map.entries()).sort(([a], [b]) => {
    if (a.startsWith("Unassigned")) return 1;
    if (b.startsWith("Unassigned")) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });

  const rows: StyledCell[][] = sortedEntries.map(([dept, stats], idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: dept },
    { value: stats.assigned, align: "center", isNumber: true },
    { value: stats.available, align: "center", isNumber: true },
    { value: stats.repair, align: "center", isNumber: true },
    { value: stats.verified, align: "center", isNumber: true },
    { value: stats.total, align: "center", isNumber: true },
  ]);

  return {
    name: "Department Summary",
    title: `ASSETFLOW — ${reportLabel.toUpperCase()} BY DEPARTMENT`,
    subtitle: `Generated on ${generatedDate} · Sorted A–Z by Department · Total items: ${items.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Department", minWidth: 26 },
      { header: "Assigned", align: "center", minWidth: 12 },
      { header: "Available", align: "center", minWidth: 12 },
      { header: "In Repair", align: "center", minWidth: 12 },
      { header: "Verified", align: "center", minWidth: 12 },
      { header: "Total", align: "center", minWidth: 12 },
    ],
    rows,
    footerRow: [
      "",
      "TOTAL",
      items.filter((a) => effectiveAssetStatus(a) === "Assigned").length,
      items.filter((a) => effectiveAssetStatus(a) === "Available").length,
      items.filter((a) => effectiveAssetStatus(a) === "In repair").length,
      items.filter((a) => a.verified).length,
      items.length,
    ],
  };
}

function formattedDateLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// REPORT 1: ALL STAFF LAPTOPS
// ============================================================
export function buildStaffLaptopsReport(
  assets: Asset[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const laptops = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Laptop"),
    employeeMap,
  );

  const rows: StyledCell[][] = laptops.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    const storage = [asset.specs?.storageSize, asset.specs?.storageType].filter(Boolean).join(" ") || "—";
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "Unassigned" },
      { value: dept },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.processor || "—" },
      { value: asset.specs?.pCores || "—", align: "center" },
      { value: asset.specs?.eCores || "—", align: "center" },
      { value: asset.specs?.ram || "—", align: "center" },
      { value: storage, align: "center" },
      { value: effectiveAssetStatus(asset), align: "center", tone: statusTone(effectiveAssetStatus(asset)) },
      verifiedCell(asset.verified),
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Staff Laptops",
    title: "ASSETFLOW — ALL STAFF LAPTOPS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Laptops: ${laptops.length} · Verified: ${laptops.filter((a) => a.verified).length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 20 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Laptop Processor", minWidth: 22 },
      { header: "No. of P-Cores", align: "center", minWidth: 14 },
      { header: "No. of E-Cores", align: "center", minWidth: 14 },
      { header: "RAM", align: "center", minWidth: 10 },
      { header: "Storage", align: "center", minWidth: 16 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows,
    footerRow: ["", "", `Total Laptops: ${laptops.length}`, "", "", "", "", "", "", "", "", "", "", "", "", `Verified: ${laptops.filter((a) => a.verified).length}/${laptops.length}`],
  };

  return {
    sheets: [mainSheet, buildDepartmentSummarySheet("Staff Laptops", laptops, employeeMap, generated)],
    filename: `AssetFlow-Report-1-Staff-Laptops-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 2: ALL STAFF MONITORS (+ Classroom/Location Monitors)
// ============================================================
export function buildStaffMonitorsReport(
  assets: Asset[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const staffMonitors = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Monitor"),
    employeeMap,
  );
  const locationMonitors = [...assets.filter((a) => a.type === "Classroom / Location Monitor")].sort((a, b) =>
    (a.location || "ZZZ").localeCompare(b.location || "ZZZ", undefined, { sensitivity: "base" }),
  );

  const staffRows: StyledCell[][] = staffMonitors.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "Unassigned" },
      { value: dept },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.screenSize || "—", align: "center" },
      { value: asset.specs?.resolution || "—", align: "center" },
      { value: asset.specs?.connector || "—", align: "center" },
      { value: effectiveAssetStatus(asset), align: "center", tone: statusTone(effectiveAssetStatus(asset)) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
    ];
  });

  const locRows: StyledCell[][] = locationMonitors.map((asset, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: asset.location || "Central Stock" },
    { value: asset.code, align: "center" },
    { value: asset.name },
    { value: asset.brand || "—" },
    { value: asset.model || "—" },
    { value: asset.serial || "—" },
    { value: asset.specs?.screenSize || "—", align: "center" },
    { value: asset.specs?.resolution || "—", align: "center" },
    { value: asset.specs?.connector || "—", align: "center" },
    { value: asset.specs?.mountType || "—", align: "center" },
    { value: asset.status, align: "center", tone: statusTone(asset.status) },
    verifiedCell(asset.verified),
  ]);

  const staffSheet: StyledSheet = {
    name: "All Staff Monitors",
    title: "ASSETFLOW — ALL STAFF MONITORS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Staff Monitors: ${staffMonitors.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Screen Size", align: "center", minWidth: 12 },
      { header: "Resolution", align: "center", minWidth: 14 },
      { header: "Connection", align: "center", minWidth: 14 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: staffRows,
    footerRow: ["", "", `Total Staff Monitors: ${staffMonitors.length}`, "", "", "", "", "", "", "", "", "", "", "", `Verified: ${staffMonitors.filter((a) => a.verified).length}/${staffMonitors.length}`],
  };

  const locSheet: StyledSheet = {
    name: "Classroom & Location Monitors",
    title: "ASSETFLOW — CLASSROOM & LOCATION MONITORS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Building / Location · Total Location Monitors: ${locationMonitors.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Building / Classroom Location", minWidth: 30 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Screen Size", align: "center", minWidth: 12 },
      { header: "Resolution", align: "center", minWidth: 14 },
      { header: "Connection", align: "center", minWidth: 14 },
      { header: "Mount / Placement", align: "center", minWidth: 16 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: locRows,
    footerRow: ["", `Total Classroom / Location Monitors: ${locationMonitors.length}`, "", "", "", "", "", "", "", "", "", "", `Verified: ${locationMonitors.filter((a) => a.verified).length}/${locationMonitors.length}`],
  };

  return {
    sheets: [staffSheet, locSheet, buildDepartmentSummarySheet("Staff Monitors", staffMonitors, employeeMap, generated)],
    filename: `AssetFlow-Report-2-Staff-Monitors-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 3: ALL STAFF HEADSETS
// ============================================================
export function buildStaffHeadsetsReport(
  assets: Asset[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const headsets = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Headset"),
    employeeMap,
  );

  const rows: StyledCell[][] = headsets.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "Unassigned" },
      { value: dept },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.connectivity || "—", align: "center" },
      { value: effectiveAssetStatus(asset), align: "center", tone: statusTone(effectiveAssetStatus(asset)) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Staff Headsets",
    title: "ASSETFLOW — ALL STAFF HEADSETS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Headsets: ${headsets.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 14 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Connection Type", align: "center", minWidth: 16 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows,
    footerRow: ["", "", `Total Headsets: ${headsets.length}`, "", "", "", "", "", "", "", "", "", `Verified: ${headsets.filter((a) => a.verified).length}/${headsets.length}`],
  };

  return {
    sheets: [mainSheet, buildDepartmentSummarySheet("Staff Headsets", headsets, employeeMap, generated)],
    filename: `AssetFlow-Report-3-Staff-Headsets-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 4: ALL STAFF MOUSES
// ============================================================
export function buildStaffMousesReport(
  assets: Asset[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const mouses = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Mouse"),
    employeeMap,
  );

  const rows: StyledCell[][] = mouses.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "Unassigned" },
      { value: dept },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.connectivity || "—", align: "center" },
      { value: effectiveAssetStatus(asset), align: "center", tone: statusTone(effectiveAssetStatus(asset)) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Staff Mouses",
    title: "ASSETFLOW — ALL STAFF MOUSES REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Mouses: ${mouses.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 14 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Connection Type", align: "center", minWidth: 16 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows,
    footerRow: ["", "", `Total Mouses: ${mouses.length}`, "", "", "", "", "", "", "", "", "", `Verified: ${mouses.filter((a) => a.verified).length}/${mouses.length}`],
  };

  return {
    sheets: [mainSheet, buildDepartmentSummarySheet("Staff Mouses", mouses, employeeMap, generated)],
    filename: `AssetFlow-Report-4-Staff-Mouses-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 5: EMPLOYEE IT ASSETS DETAILS
// ============================================================
export function buildEmployeeItAssetsReport(
  assets: Asset[],
  employees: Employee[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const itAssets = assets.filter((a) => a.category === "IT Asset");

  const sortedEmployees = [...employees].sort((a, b) => {
    const deptCmp = a.department.localeCompare(b.department, undefined, { sensitivity: "base" });
    if (deptCmp !== 0) return deptCmp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const summaryRows: StyledCell[][] = sortedEmployees.map((emp, idx) => {
    const owned = itAssets.filter((a) => a.employeeId === emp.id);
    const laptops = owned.filter((a) => a.type === "Laptop");
    const monitors = owned.filter((a) => a.type === "Monitor");
    const mouses = owned.filter((a) => a.type === "Mouse");
    const headsets = owned.filter((a) => a.type === "Headset");
    const others = owned.filter((a) => !["Laptop", "Monitor", "Mouse", "Headset"].includes(a.type));

    const laptopLabel = laptops.length
      ? laptops.map((l) => `${l.name} (${l.serial || l.code})`).join("; ")
      : "—";
    const laptopSpecLabel = laptops.length
      ? laptops.map((l) => getAssetKeySpecChips(l).join(" · ") || "—").join("; ")
      : "—";
    const allVerified = owned.length > 0 && owned.every((a) => Boolean(a.verified));

    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp.empNo, align: "center" },
      { value: emp.name },
      { value: emp.department },
      { value: emp.designation },
      { value: emp.status, align: "center", tone: statusTone(emp.status) },
      { value: owned.length, align: "center", isNumber: true },
      { value: laptopLabel },
      { value: laptopSpecLabel },
      { value: monitors.length ? monitors.map((m) => `${m.model || m.name} (${m.serial || m.code})`).join("; ") : "—" },
      { value: mouses.length ? mouses.map((m) => `${m.brand} ${m.model}`.trim() || m.name).join("; ") : "—" },
      { value: headsets.length ? headsets.map((h) => `${h.brand} ${h.model}`.trim() || h.name).join("; ") : "—" },
      { value: others.length ? others.map((o) => `${o.type}: ${o.name}`).join("; ") : "—" },
      owned.length === 0 ? { value: "N/A", align: "center" } : verifiedCell(allVerified),
    ];
  });

  const assignedItAssets = sortAssetsByDepartmentAZ(
    itAssets.filter((a) => Boolean(a.employeeId)),
    employeeMap,
  );

  const itemizedRows: StyledCell[][] = assignedItAssets.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const chips = getAssetKeySpecChips(asset);
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "—" },
      { value: emp?.department || "—" },
      { value: asset.type },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: chips.join(" · ") || "—" },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
    ];
  });

  const locationItAssets = [...itAssets.filter((a) => isLocationOnlyAssetType(a.type))].sort((a, b) =>
    (a.location || "ZZZ").localeCompare(b.location || "ZZZ", undefined, { sensitivity: "base" }),
  );

  const locationRows: StyledCell[][] = locationItAssets.map((asset, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: asset.location || "Central Stock" },
    { value: asset.type },
    { value: asset.code, align: "center" },
    { value: asset.name },
    { value: asset.brand || "—" },
    { value: asset.model || "—" },
    { value: asset.serial || "—" },
    { value: getAssetKeySpecChips(asset).join(" · ") || "—" },
    { value: asset.status, align: "center", tone: statusTone(asset.status) },
    verifiedCell(asset.verified),
  ]);

  const summarySheet: StyledSheet = {
    name: "Employee IT Summary",
    title: "ASSETFLOW — EMPLOYEE IT ASSETS SUMMARY REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department & Employee · Employees: ${sortedEmployees.length} · Assigned IT Assets: ${assignedItAssets.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Designation", minWidth: 20 },
      { header: "Emp Status", align: "center", minWidth: 12 },
      { header: "IT Items", align: "center", minWidth: 10 },
      { header: "Laptop (Name & Serial)", minWidth: 28, maxWidth: 42 },
      { header: "Laptop Specs (CPU / P-E Cores / RAM)", minWidth: 28, maxWidth: 42 },
      { header: "Monitor", minWidth: 24, maxWidth: 36 },
      { header: "Mouse", minWidth: 18 },
      { header: "Headset", minWidth: 18 },
      { header: "Other IT Assets", minWidth: 22, maxWidth: 38 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: summaryRows,
    footerRow: ["", "", `Total Employees: ${sortedEmployees.length}`, "", "", "", assignedItAssets.length, "", "", "", "", "", "", ""],
  };

  const itemizedSheet: StyledSheet = {
    name: "Itemized Employee IT Assets",
    title: "ASSETFLOW — ITEMIZED EMPLOYEE IT ASSETS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department & Employee · Total Assigned IT Items: ${assignedItAssets.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Type", minWidth: 16 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Key Specifications", minWidth: 28, maxWidth: 44 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: itemizedRows,
    footerRow: ["", "", `Total Assigned IT Assets: ${assignedItAssets.length}`, "", "", "", "", "", "", "", "", "", `Verified: ${assignedItAssets.filter((a) => a.verified).length}/${assignedItAssets.length}`],
  };

  const locationSheet: StyledSheet = {
    name: "Classroom & Location IT",
    title: "ASSETFLOW — CLASSROOM & LOCATION IT ASSETS (MONITORS & CHROMECASTS)",
    subtitle: `Generated on ${generated} · Sorted A–Z by Building / Location · Total Location IT Items: ${locationItAssets.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Building / Classroom Location", minWidth: 30 },
      { header: "Asset Type", minWidth: 24 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Specifications", minWidth: 26 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: locationRows,
    footerRow: ["", `Total Location IT Assets: ${locationItAssets.length}`, "", "", "", "", "", "", "", "", `Verified: ${locationItAssets.filter((a) => a.verified).length}/${locationItAssets.length}`],
  };

  return {
    sheets: [summarySheet, itemizedSheet, locationSheet],
    filename: `AssetFlow-Report-5-Employee-IT-Assets-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 6: PRINTER AND TONER DETAILS
// ============================================================
export function buildPrinterAndTonerReport(
  assets: Asset[],
  toners: TonerStock[],
  transactions: TonerTransaction[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const printers = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Printer"),
    employeeMap,
  );

  const printerRows: StyledCell[][] = printers.map((printer, idx) => {
    const emp = printer.employeeId ? employeeMap[printer.employeeId] : undefined;
    const dept = getDepartmentForSort(printer, employeeMap) || "Unassigned (Central Stock)";
    const assignedLabel = emp
      ? `${emp.name} (Person)`
      : printer.allocationType === "department" && printer.assignedDepartment
        ? `${printer.assignedDepartment} (Department)`
        : "Central Stock";
    const matchedToners = toners.filter((t) => tonerMatchesPrinter(t, printer));
    const totalStock = matchedToners.reduce((sum, t) => sum + t.quantity, 0);
    const tonerSummary = matchedToners.length
      ? `${totalStock} unit${totalStock === 1 ? "" : "s"} (${matchedToners.map((t) => `${t.tonerModel} ${t.color}:${t.quantity}`).join(", ")})`
      : "No toner linked";

    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: dept },
      { value: assignedLabel },
      { value: emp?.empNo || "—", align: "center" },
      { value: printer.location || "—" },
      { value: printer.code, align: "center" },
      { value: printer.name },
      { value: printer.brand || "—" },
      { value: printer.model || "—" },
      { value: printer.serial || "—" },
      { value: printer.specs?.printerType || "—" },
      { value: printer.specs?.printColor || "—", align: "center" },
      { value: printer.specs?.connectivity || "—", align: "center" },
      { value: printer.specs?.compatibleToner || "—" },
      { value: printer.specs?.ipAddress || "—", align: "center" },
      { value: tonerSummary, tone: matchedToners.length === 0 ? undefined : totalStock === 0 ? "red" : matchedToners.some((t) => t.quantity <= t.minStock) ? "amber" : "green" },
      { value: printer.status, align: "center", tone: statusTone(printer.status) },
      verifiedCell(printer.verified),
    ];
  });

  const sortedToners = [...toners].sort((a, b) => {
    const mCmp = a.printerModel.localeCompare(b.printerModel, undefined, { sensitivity: "base" });
    if (mCmp !== 0) return mCmp;
    return a.color.localeCompare(b.color);
  });

  const tonerRows: StyledCell[][] = sortedToners.map((toner, idx) => {
    const stockState = toner.quantity <= 0 ? "Out of stock" : toner.quantity <= toner.minStock ? "Low stock" : "In stock";
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: toner.printerBrand || "—" },
      { value: toner.printerModel },
      { value: toner.tonerModel },
      { value: toner.color, align: "center" },
      { value: toner.quantity, align: "center", isNumber: true },
      { value: toner.minStock, align: "center", isNumber: true },
      { value: stockState, align: "center", tone: statusTone(stockState) },
      { value: toner.storageLocation || "Central IT Store" },
      { value: toner.notes || "—" },
      { value: toner.updatedAt, align: "center" },
    ];
  });

  const sortedTx = [...transactions].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  const txRows: StyledCell[][] = sortedTx.map((tx, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: tx.date, align: "center" },
    { value: tx.type, align: "center", tone: statusTone(tx.type) },
    { value: tx.printerModel },
    { value: tx.tonerModel },
    { value: tx.color, align: "center" },
    { value: tx.type === "Restock" ? `+${tx.quantity}` : `-${tx.quantity}`, align: "center", tone: tx.type === "Restock" ? "green" : "blue" },
    { value: tx.resultingStock, align: "center", isNumber: true },
    { value: tx.department || "Central IT Store" },
    { value: tx.printerName ? `${tx.printerName}${tx.printerCode ? ` (${tx.printerCode})` : ""}` : "—" },
    { value: tx.performedBy || "IT Administration" },
    { value: tx.recipientName || "—" },
    { value: tx.note || "—" },
  ]);

  const printersSheet: StyledSheet = {
    name: "Printers Register",
    title: "ASSETFLOW — PRINTERS REGISTER REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Printers: ${printers.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Department", minWidth: 22 },
      { header: "Assigned To (Dept / Person)", minWidth: 24 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Room / Location", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Printer Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 20 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Printer Type", minWidth: 18 },
      { header: "Color Mode", align: "center", minWidth: 16 },
      { header: "Connectivity", align: "center", minWidth: 16 },
      { header: "Compatible Toner", minWidth: 18 },
      { header: "Network IP", align: "center", minWidth: 14 },
      { header: "Toner Stock Status", minWidth: 26, maxWidth: 40 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
    ],
    rows: printerRows,
    footerRow: ["", `Total Printers: ${printers.length}`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", `Verified: ${printers.filter((a) => a.verified).length}/${printers.length}`],
  };

  const totalTonerUnits = sortedToners.reduce((sum, t) => sum + t.quantity, 0);
  const tonerStockSheet: StyledSheet = {
    name: "Toner Stock by Model",
    title: "ASSETFLOW — TONER STOCK INVENTORY BY PRINTER MODEL",
    subtitle: `Generated on ${generated} · Sorted A–Z by Printer Model · Total SKUs: ${sortedToners.length} · Total Units: ${totalTonerUnits}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Printer Brand", minWidth: 14 },
      { header: "Printer Model", minWidth: 24 },
      { header: "Toner Model / Code", minWidth: 22 },
      { header: "Color / Type", align: "center", minWidth: 14 },
      { header: "Current Stock", align: "center", minWidth: 14 },
      { header: "Min Stock Alert", align: "center", minWidth: 15 },
      { header: "Stock Status", align: "center", minWidth: 14 },
      { header: "Storage Location", minWidth: 20 },
      { header: "Notes", minWidth: 24 },
      { header: "Last Updated", align: "center", minWidth: 14 },
    ],
    rows: tonerRows,
    footerRow: ["", "", `Total Toner SKUs: ${sortedToners.length}`, "", "", totalTonerUnits, "", "", "", "", ""],
  };

  const txSheet: StyledSheet = {
    name: "Toner Stock History",
    title: "ASSETFLOW — TONER RESTOCK & ISSUE HISTORY",
    subtitle: `Generated on ${generated} · Newest movements first · Total Transactions: ${sortedTx.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Date", align: "center", minWidth: 13 },
      { header: "Action", align: "center", minWidth: 12 },
      { header: "Printer Model", minWidth: 22 },
      { header: "Toner Model", minWidth: 20 },
      { header: "Color", align: "center", minWidth: 12 },
      { header: "Qty Moved", align: "center", minWidth: 12 },
      { header: "Balance After", align: "center", minWidth: 14 },
      { header: "Department", minWidth: 22 },
      { header: "Printer Name & Code", minWidth: 24 },
      { header: "Replaced / Handled By", minWidth: 22 },
      { header: "Requested / Collected By", minWidth: 20 },
      { header: "Note", minWidth: 26 },
    ],
    rows: txRows,
    footerRow: ["", "", `Total Logs: ${sortedTx.length}`, "", "", "", "", "", "", "", "", "", ""],
  };

  return {
    sheets: [printersSheet, tonerStockSheet, txSheet],
    filename: `AssetFlow-Report-6-Printers-and-Toners-${isoDate()}.xlsx`,
  };
}

// ============================================================
// ADMIN DEPT REQUISITION: ZERO-STOCK (0 BUFFER) TONER REPORT
// ============================================================
export function buildZeroStockTonerRequisitionReport(
  assets: Asset[],
  toners: TonerStock[],
  transactions: TonerTransaction[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const printers = assets.filter((a) => a.type === "Printer");
  const zeroToners = [...toners.filter((t) => t.quantity <= 0)].sort((a, b) =>
    a.printerModel.localeCompare(b.printerModel, undefined, { sensitivity: "base" }) || a.color.localeCompare(b.color),
  );
  const lowToners = [...toners.filter((t) => t.quantity > 0 && t.quantity <= t.minStock)].sort((a, b) =>
    a.printerModel.localeCompare(b.printerModel, undefined, { sensitivity: "base" }) || a.color.localeCompare(b.color),
  );
  const sortedTx = [...transactions].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));

  const formatAffectedPrinters = (toner: TonerStock) => {
    const matched = printers.filter((p) => tonerMatchesPrinter(toner, p));
    if (!matched.length) return "No printer currently mapped";
    return matched
      .map((p) => {
        const owner = p.employeeId ? `${employeeMap[p.employeeId]?.name} (${employeeMap[p.employeeId]?.department})` : p.assignedDepartment || p.location || "Central Stock";
        return `${p.name} [${owner}]`;
      })
      .join("; ");
  };

  const formatLastIssue = (toner: TonerStock) => {
    const last = sortedTx.find((tx) => tx.tonerId === toner.id && tx.type === "Issued");
    if (!last) return "—";
    return `${last.date} · By ${last.performedBy || "IT"} (${last.department || last.printerName || "—"})`;
  };

  let totalSuggestedOrder = 0;
  const zeroRows: StyledCell[][] = zeroToners.map((toner, idx) => {
    const suggestedOrder = Math.max(toner.minStock * 2, 2);
    totalSuggestedOrder += suggestedOrder;
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: toner.printerBrand || "—" },
      { value: toner.printerModel },
      { value: toner.tonerModel },
      { value: toner.color, align: "center" },
      { value: toner.quantity, align: "center", tone: "red", isNumber: true },
      { value: toner.minStock, align: "center", isNumber: true },
      { value: suggestedOrder, align: "center", tone: "amber", isNumber: true },
      { value: "URGENT — 0 STOCK", align: "center", tone: "red" },
      { value: formatAffectedPrinters(toner) },
      { value: formatLastIssue(toner) },
      { value: toner.storageLocation || "Central IT Store" },
      { value: toner.notes || "Immediate procurement requested from Admin Dept" },
    ];
  });

  const zeroSheet: StyledSheet = {
    name: "Zero-Stock Requisition",
    title: "ADMIN DEPT — URGENT ZERO-STOCK TONER REQUISITION",
    subtitle: `Generated on ${generated} · Submitted by IT Asset Management · SKUs at 0 Buffer: ${zeroToners.length} · Suggested Total Order: ${totalSuggestedOrder} units`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Printer Brand", minWidth: 14 },
      { header: "Printer Model", minWidth: 24 },
      { header: "Toner Model / Code", minWidth: 22 },
      { header: "Color / Type", align: "center", minWidth: 14 },
      { header: "Current Stock", align: "center", minWidth: 14 },
      { header: "Min Buffer", align: "center", minWidth: 12 },
      { header: "Suggested Order Qty", align: "center", minWidth: 18 },
      { header: "Priority", align: "center", minWidth: 18 },
      { header: "Affected Printers & Departments", minWidth: 32, maxWidth: 46 },
      { header: "Last Replacement (Date & By Whom)", minWidth: 28, maxWidth: 42 },
      { header: "Store Location", minWidth: 18 },
      { header: "Notes", minWidth: 24 },
    ],
    rows: zeroRows,
    footerRow: ["", "", `Zero-Stock Toner SKUs: ${zeroToners.length}`, "", "", 0, "", totalSuggestedOrder, "SEND TO ADMIN DEPT", "", "", "", ""],
  };

  const lowRows: StyledCell[][] = lowToners.map((toner, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: toner.printerBrand || "—" },
    { value: toner.printerModel },
    { value: toner.tonerModel },
    { value: toner.color, align: "center" },
    { value: toner.quantity, align: "center", tone: "amber", isNumber: true },
    { value: toner.minStock, align: "center", isNumber: true },
    { value: Math.max(toner.minStock * 2 - toner.quantity, 1), align: "center", isNumber: true },
    { value: formatAffectedPrinters(toner) },
    { value: formatLastIssue(toner) },
  ]);

  const lowSheet: StyledSheet = {
    name: "Low Buffer Watchlist",
    title: "ADMIN DEPT — LOW BUFFER TONER WATCHLIST",
    subtitle: `Generated on ${generated} · Toners at or below minimum buffer (still > 0) · Count: ${lowToners.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Printer Brand", minWidth: 14 },
      { header: "Printer Model", minWidth: 24 },
      { header: "Toner Model / Code", minWidth: 22 },
      { header: "Color / Type", align: "center", minWidth: 14 },
      { header: "Current Stock", align: "center", minWidth: 14 },
      { header: "Min Buffer", align: "center", minWidth: 12 },
      { header: "Recommended Top-Up", align: "center", minWidth: 18 },
      { header: "Affected Printers & Departments", minWidth: 32, maxWidth: 46 },
      { header: "Last Replacement", minWidth: 28, maxWidth: 42 },
    ],
    rows: lowRows,
    footerRow: ["", "", `Low Buffer SKUs: ${lowToners.length}`, "", "", "", "", "", "", ""],
  };

  const zeroIds = new Set(zeroToners.map((t) => t.id));
  const recentZeroTx = sortedTx.filter((tx) => zeroIds.has(tx.tonerId) || zeroToners.length === 0).slice(0, 50);
  const historyRows: StyledCell[][] = recentZeroTx.map((tx, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: tx.date, align: "center" },
    { value: tx.type, align: "center", tone: statusTone(tx.type) },
    { value: tx.printerModel },
    { value: tx.tonerModel },
    { value: tx.color, align: "center" },
    { value: tx.type === "Restock" ? `+${tx.quantity}` : `-${tx.quantity}`, align: "center" },
    { value: tx.resultingStock, align: "center", isNumber: true },
    { value: tx.department || "—" },
    { value: tx.printerName || "—" },
    { value: tx.performedBy || "IT Administration" },
    { value: tx.recipientName || "—" },
    { value: tx.note || "—" },
  ]);

  const historySheet: StyledSheet = {
    name: "Replacement Audit Log",
    title: "TONER REPLACEMENT & USAGE PROOF (FOR ADMIN DEPT)",
    subtitle: `Generated on ${generated} · Showing usage history for depleted toners · Records: ${recentZeroTx.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Date", align: "center", minWidth: 13 },
      { header: "Action", align: "center", minWidth: 12 },
      { header: "Printer Model", minWidth: 22 },
      { header: "Toner Model", minWidth: 20 },
      { header: "Color", align: "center", minWidth: 12 },
      { header: "Qty", align: "center", minWidth: 10 },
      { header: "Balance After", align: "center", minWidth: 14 },
      { header: "Department", minWidth: 22 },
      { header: "Printer", minWidth: 22 },
      { header: "Replaced By", minWidth: 20 },
      { header: "Requested / Collected By", minWidth: 20 },
      { header: "Remarks", minWidth: 24 },
    ],
    rows: historyRows,
    footerRow: ["", "", `Total Logs: ${recentZeroTx.length}`, "", "", "", "", "", "", "", "", "", ""],
  };

  return {
    sheets: [zeroSheet, lowSheet, historySheet],
    filename: `AssetFlow-Zero-Stock-Toner-Requisition-Admin-${isoDate()}.xlsx`,
  };
}

function splitBuildingAndRoom(location?: string): { building: string; room: string } {
  const clean = (location || "").trim();
  if (!clean || clean === "Central Stock") {
    return { building: "Central Stock", room: "Central Stock" };
  }
  const sep = clean.indexOf(" - ");
  if (sep > 0) {
    return {
      building: clean.slice(0, sep).trim(),
      room: clean.slice(sep + 3).trim() || clean,
    };
  }
  return { building: "Other Locations", room: clean };
}

function sortLocationAssetsAZ(items: Asset[]): Asset[] {
  return [...items].sort((a, b) => {
    const locA = (a.location || "").trim();
    const locB = (b.location || "").trim();
    const isStockA = !locA || locA === "Central Stock";
    const isStockB = !locB || locB === "Central Stock";
    if (!isStockA && isStockB) return -1;
    if (isStockA && !isStockB) return 1;
    const locCmp = locA.localeCompare(locB, undefined, { sensitivity: "base" });
    if (locCmp !== 0) return locCmp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function buildLocationSummarySheet(
  reportLabel: string,
  items: Asset[],
  generatedDate: string,
): StyledSheet {
  const byLoc = new Map<string, { building: string; room: string; allocated: number; available: number; repair: number; damage: number; verified: number; total: number }>();
  for (const asset of items) {
    const { building, room } = splitBuildingAndRoom(asset.location);
    const key = `${building}|||${room}`;
    const cur = byLoc.get(key) ?? { building, room, allocated: 0, available: 0, repair: 0, damage: 0, verified: 0, total: 0 };
    const status = effectiveAssetStatus(asset);
    cur.total += 1;
    if (status === "Assigned") cur.allocated += 1;
    else if (status === "Available") cur.available += 1;
    else if (status === "In repair") cur.repair += 1;
    else if (status === "Damage") cur.damage += 1;
    if (asset.verified) cur.verified += 1;
    byLoc.set(key, cur);
  }

  const sorted = Array.from(byLoc.values()).sort((a, b) => {
    if (a.building === "Central Stock" && b.building !== "Central Stock") return 1;
    if (a.building !== "Central Stock" && b.building === "Central Stock") return -1;
    const bCmp = a.building.localeCompare(b.building, undefined, { sensitivity: "base" });
    return bCmp !== 0 ? bCmp : a.room.localeCompare(b.room, undefined, { sensitivity: "base" });
  });

  const rows: StyledCell[][] = sorted.map((entry, idx) => [
    { value: idx + 1, align: "center", isNumber: true },
    { value: entry.building },
    { value: entry.room },
    { value: entry.allocated, align: "center", isNumber: true },
    { value: entry.available, align: "center", isNumber: true },
    { value: entry.repair, align: "center", tone: entry.repair > 0 ? "amber" : undefined, isNumber: true },
    { value: entry.damage, align: "center", tone: entry.damage > 0 ? "red" : undefined, isNumber: true },
    { value: entry.verified, align: "center", isNumber: true },
    { value: entry.total, align: "center", isNumber: true },
  ]);

  return {
    name: "Location Summary",
    title: `ASSETFLOW — ${reportLabel.toUpperCase()} BY BUILDING & LOCATION`,
    subtitle: `Generated on ${generatedDate} · Sorted A–Z by Building & Room · Total items: ${items.length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Building", minWidth: 22 },
      { header: "Classroom / Location", minWidth: 24 },
      { header: "Allocated", align: "center", minWidth: 12 },
      { header: "Available", align: "center", minWidth: 12 },
      { header: "In Repair", align: "center", minWidth: 12 },
      { header: "Damage", align: "center", minWidth: 11 },
      { header: "Verified", align: "center", minWidth: 12 },
      { header: "Total", align: "center", minWidth: 11 },
    ],
    rows,
    footerRow: [
      "",
      "TOTAL",
      `${sorted.length} location(s)`,
      items.filter((a) => effectiveAssetStatus(a) === "Assigned").length,
      items.filter((a) => effectiveAssetStatus(a) === "Available").length,
      items.filter((a) => effectiveAssetStatus(a) === "In repair").length,
      items.filter((a) => effectiveAssetStatus(a) === "Damage").length,
      items.filter((a) => a.verified).length,
      items.length,
    ],
  };
}

// ============================================================
// REPORT 7: ALL PROJECTORS
// ============================================================
export function buildProjectorsReport(
  assets: Asset[],
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const projectors = sortLocationAssetsAZ(assets.filter((a) => a.type === "Projector"));

  const rows: StyledCell[][] = projectors.map((asset, idx) => {
    const { building, room } = splitBuildingAndRoom(asset.location);
    const status = effectiveAssetStatus(asset);
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: building },
      { value: room },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.mountType || "—", align: "center" },
      { value: asset.specs?.connector || "—", align: "center" },
      { value: asset.specs?.resolution || "—", align: "center" },
      { value: asset.specs?.remoteIncluded || "—", align: "center" },
      { value: status, align: "center", tone: statusTone(status) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
      { value: asset.details || "—" },
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Projectors",
    title: "ASSETFLOW — ALL PROJECTORS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Building & Classroom · Total Projectors: ${projectors.length} · Verified: ${projectors.filter((a) => a.verified).length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Building", minWidth: 20 },
      { header: "Classroom / Location", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 14 },
      { header: "Model", minWidth: 18 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Mount / Placement", align: "center", minWidth: 18 },
      { header: "Input Connection", align: "center", minWidth: 16 },
      { header: "Resolution", align: "center", minWidth: 14 },
      { header: "Remote Included", align: "center", minWidth: 15 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
      { header: "Additional Notes", minWidth: 24 },
    ],
    rows,
    footerRow: ["", "", `Total Projectors: ${projectors.length}`, "", "", "", "", "", "", "", "", "", "", "", `Verified: ${projectors.filter((a) => a.verified).length}/${projectors.length}`, ""],
  };

  return {
    sheets: [mainSheet, buildLocationSummarySheet("Projectors", projectors, generated)],
    filename: `AssetFlow-Report-7-Projectors-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 8: ALL GOOGLE CHROMECASTS
// ============================================================
export function buildChromecastsReport(
  assets: Asset[],
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const chromecasts = sortLocationAssetsAZ(assets.filter((a) => a.type === "Google Chromecast"));

  const rows: StyledCell[][] = chromecasts.map((asset, idx) => {
    const { building, room } = splitBuildingAndRoom(asset.location);
    const status = effectiveAssetStatus(asset);
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: building },
      { value: room },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "Google" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.generation || "—" },
      { value: asset.specs?.resolution || "—", align: "center" },
      { value: asset.specs?.connectivity || "—", align: "center" },
      { value: asset.specs?.remoteIncluded || "—", align: "center" },
      { value: status, align: "center", tone: statusTone(status) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
      { value: asset.details || "—" },
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Google Chromecasts",
    title: "ASSETFLOW — ALL GOOGLE CHROMECASTS REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Building & Classroom · Total Chromecasts: ${chromecasts.length} · Verified: ${chromecasts.filter((a) => a.verified).length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Building", minWidth: 20 },
      { header: "Classroom / Location", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 20 },
      { header: "Serial Number", minWidth: 18 },
      { header: "Chromecast Generation", minWidth: 24 },
      { header: "Max Resolution", align: "center", minWidth: 16 },
      { header: "Connectivity", align: "center", minWidth: 18 },
      { header: "Remote Included", align: "center", minWidth: 16 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
      { header: "Additional Notes", minWidth: 24 },
    ],
    rows,
    footerRow: ["", "", `Total Chromecasts: ${chromecasts.length}`, "", "", "", "", "", "", "", "", "", "", "", `Verified: ${chromecasts.filter((a) => a.verified).length}/${chromecasts.length}`, ""],
  };

  return {
    sheets: [mainSheet, buildLocationSummarySheet("Google Chromecasts", chromecasts, generated)],
    filename: `AssetFlow-Report-8-Google-Chromecasts-${isoDate()}.xlsx`,
  };
}

// ============================================================
// REPORT 9: ALL MOBILE PHONES
// ============================================================
export function buildMobilePhonesReport(
  assets: Asset[],
  employeeMap: Record<string, Employee>,
): { sheets: StyledSheet[]; filename: string } {
  const generated = formattedDateLabel();
  const phones = sortAssetsByDepartmentAZ(
    assets.filter((a) => a.type === "Mobile Phone"),
    employeeMap,
  );

  const rows: StyledCell[][] = phones.map((asset, idx) => {
    const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
    const dept = getDepartmentForSort(asset, employeeMap) || "Unassigned (Central Stock)";
    const status = effectiveAssetStatus(asset);
    return [
      { value: idx + 1, align: "center", isNumber: true },
      { value: emp?.empNo || "—", align: "center" },
      { value: emp?.name || "Unassigned" },
      { value: dept },
      { value: asset.code, align: "center" },
      { value: asset.name },
      { value: asset.brand || "—" },
      { value: asset.model || "—" },
      { value: asset.serial || "—" },
      { value: asset.specs?.imei || "—", align: "center" },
      { value: asset.specs?.ram || "—", align: "center" },
      { value: asset.specs?.storageSize || "—", align: "center" },
      { value: status, align: "center", tone: statusTone(status) },
      { value: asset.condition, align: "center", tone: statusTone(asset.condition) },
      verifiedCell(asset.verified),
      { value: asset.details || "—" },
    ];
  });

  const mainSheet: StyledSheet = {
    name: "All Mobile Phones",
    title: "ASSETFLOW — ALL MOBILE PHONES REPORT",
    subtitle: `Generated on ${generated} · Sorted A–Z by Department · Total Mobile Phones: ${phones.length} · Verified: ${phones.filter((a) => a.verified).length}`,
    columns: [
      { header: "#", align: "center", minWidth: 6 },
      { header: "Emp No", align: "center", minWidth: 12 },
      { header: "Name", minWidth: 22 },
      { header: "Department", minWidth: 22 },
      { header: "Asset Code", align: "center", minWidth: 14 },
      { header: "Asset Name", minWidth: 24 },
      { header: "Brand", minWidth: 12 },
      { header: "Model", minWidth: 20 },
      { header: "Serial Number", minWidth: 18 },
      { header: "IMEI Number", align: "center", minWidth: 18 },
      { header: "RAM", align: "center", minWidth: 10 },
      { header: "Storage", align: "center", minWidth: 12 },
      { header: "Status", align: "center", minWidth: 12 },
      { header: "Condition", align: "center", minWidth: 12 },
      { header: "Asset Verified (Yes/No)", align: "center", minWidth: 20 },
      { header: "Additional Notes", minWidth: 24 },
    ],
    rows,
    footerRow: ["", "", `Total Mobile Phones: ${phones.length}`, "", "", "", "", "", "", "", "", "", "", "", `Verified: ${phones.filter((a) => a.verified).length}/${phones.length}`, ""],
  };

  return {
    sheets: [mainSheet, buildDepartmentSummarySheet("Mobile Phones", phones, employeeMap, generated)],
    filename: `AssetFlow-Report-9-Mobile-Phones-${isoDate()}.xlsx`,
  };
}
