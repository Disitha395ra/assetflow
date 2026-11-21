"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Asset, Employee } from "@/lib/types";
import {
  OFFICIAL_WARRANTY_PORTALS,
  addYearsToDate,
  getWarrantyPortalForAsset,
  getWarrantyStatus,
  parseWarrantyImportRows,
  type WarrantyImportPreview,
  type WarrantyState,
} from "@/lib/warranty";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function extractSheetObjectsWithAutoHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!matrix.length) return [];

  // Find the actual header row (supports both raw CSV/Lenovo exports AND styled AssetFlow reports with title banners)
  const headerKeywords = ["asset code", "serial number", "serial no", "serial", "service tag", "s/n", "snid"];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const rowCells = (matrix[i] ?? []).map((cell) => String(cell ?? "").trim().toLowerCase());
    if (rowCells.some((cell) => headerKeywords.some((kw) => cell === kw || cell.includes(kw)))) {
      headerIdx = i;
      break;
    }
  }

  const headers = (matrix[headerIdx] ?? []).map((h, colIdx) => String(h ?? "").trim() || `Column_${colIdx + 1}`);
  const rows: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const rawRow = matrix[r] ?? [];
    const hasAnyValue = rawRow.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasAnyValue) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((header, c) => {
      obj[header] = rawRow[c] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

export function WarrantyHubView({
  assets,
  employeeMap,
  onAsset,
  onBulkUpdateWarranties,
  onDownloadWarrantyReport,
  onFlash,
}: {
  assets: Asset[];
  employeeMap: Record<string, Employee>;
  onAsset: (asset: Asset) => void;
  onBulkUpdateWarranties: (updatedAssets: Asset[], summary: string) => Promise<void>;
  onDownloadWarrantyReport: (filtered?: Asset[], label?: string) => Promise<void>;
  onFlash: (message: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"All" | WarrantyState>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [brandFilter, setBrandFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingSingle, setEditingSingle] = useState<Asset | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [importPreview, setImportPreview] = useState<WarrantyImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [applyingImport, setApplyingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itAssets = useMemo(
    () => assets.filter((asset) => asset.category === "IT Asset" && asset.status !== "Retired"),
    [assets],
  );

  const statusCounts = useMemo(() => {
    const counts = { "Under Warranty": 0, "Expiring Soon": 0, Expired: 0, "Not Recorded": 0 };
    for (const asset of itAssets) {
      counts[getWarrantyStatus(asset).state] += 1;
    }
    return counts;
  }, [itAssets]);

  const availableTypes = useMemo(
    () => Array.from(new Set(itAssets.map((a) => a.type).filter(Boolean))).sort(),
    [itAssets],
  );

  const availableBrands = useMemo(
    () => Array.from(new Set(itAssets.map((a) => (a.brand || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [itAssets],
  );

  const filteredAssets = useMemo(() => {
    return itAssets.filter((asset) => {
      const info = getWarrantyStatus(asset);
      if (statusFilter !== "All" && info.state !== statusFilter) return false;
      if (typeFilter !== "All" && asset.type !== typeFilter) return false;
      if (brandFilter !== "All" && (asset.brand || "").trim().toLowerCase() !== brandFilter.toLowerCase()) return false;
      return true;
    });
  }, [itAssets, statusFilter, typeFilter, brandFilter]);

  const portalStats = useMemo(() => {
    return OFFICIAL_WARRANTY_PORTALS.map((portal) => {
      const matched = itAssets.filter((asset) => {
        const text = `${asset.brand} ${asset.model}`.toLowerCase();
        return portal.keywords.some((kw) => text.includes(kw));
      });
      const missingCount = matched.filter((asset) => getWarrantyStatus(asset).state === "Not Recorded").length;
      return { portal, count: matched.length, missingCount, matchedAssets: matched };
    }).filter((entry) => entry.count > 0 || ["asus", "dell", "hp", "lenovo"].includes(entry.portal.id));
  }, [itAssets]);

  const visibleIds = filteredAssets.map((a) => a.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  async function handleCopyAndOpenPortal(asset: Asset) {
    const { portal, lookupUrl } = getWarrantyPortalForAsset(asset.brand, asset.model, asset.serial);
    if (asset.serial?.trim()) {
      try {
        await navigator.clipboard.writeText(asset.serial.trim());
        onFlash(`Serial "${asset.serial.trim()}" copied — paste it into ${portal?.label || "the manufacturer warranty portal"}`);
      } catch {
        onFlash(`Opening ${portal?.label || "warranty lookup"} for serial ${asset.serial.trim()}`);
      }
    } else {
      onFlash(`Opening ${portal?.label || "warranty portal"} (no serial number recorded on this asset)`);
    }
    window.open(lookupUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyBrandSerials(brandLabel: string, matchedAssets: Asset[], batchUrl?: string) {
    const serials = matchedAssets
      .filter((a) => a.serial?.trim())
      .map((a) => a.serial.trim());
    if (!serials.length) {
      onFlash(`No serial numbers recorded for ${brandLabel} assets yet.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(serials.join("\n"));
      onFlash(`Copied ${serials.length} ${brandLabel} serial number(s) to clipboard`);
    } catch {
      onFlash(`${serials.length} ${brandLabel} serials ready — export Excel to copy them.`);
    }
    if (batchUrl) {
      window.open(batchUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = extractSheetObjectsWithAutoHeader(sheet);
      const preview = parseWarrantyImportRows(rows, assets);
      setImportFileName(file.name);
      setImportPreview(preview);
    } catch (err) {
      console.error("Warranty import failed:", err);
      onFlash("Could not read that Excel/CSV file. Please upload a valid .xlsx or .csv file.");
    } finally {
      event.target.value = "";
    }
  }

  async function commitImportPreview() {
    if (!importPreview || !importPreview.matched.length || applyingImport) return;
    setApplyingImport(true);
    try {
      const nowDate = todayIso();
      const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));
      const updatedAssets: Asset[] = importPreview.matched
        .map((match) => {
          const current = assetMap[match.assetId];
          if (!current) return null;
          return {
            ...current,
            warrantyStartDate: match.warrantyStartDate || current.warrantyStartDate,
            warrantyEndDate: match.warrantyEndDate || current.warrantyEndDate,
            warrantyVendor: match.warrantyVendor || current.warrantyVendor,
            warrantyInvoiceNo: match.warrantyInvoiceNo || current.warrantyInvoiceNo,
            warrantyProofUrl: match.warrantyProofUrl || current.warrantyProofUrl,
            warrantyCheckedAt: nowDate,
            updatedAt: nowDate,
          } as Asset;
        })
        .filter((item): item is Asset => Boolean(item));

      await onBulkUpdateWarranties(
        updatedAssets,
        `Imported warranty records for ${updatedAssets.length} asset(s) from ${importFileName}`,
      );
      setImportPreview(null);
      setImportFileName("");
    } finally {
      setApplyingImport(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">WARRANTY &amp; COVERAGE</span>
          <h1>Warranty Tracker &amp; Bulk Lookup</h1>
          <p>
            Track warranty start/end dates, proof references, and repair eligibility across all laptops, monitors, headsets, mice, and printers.
          </p>
        </div>
        <div className="page-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleFileImport}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onDownloadWarrantyReport(filteredAssets, statusFilter === "All" && typeFilter === "All" && brandFilter === "All" ? "All-IT-Assets" : `${brandFilter}-${typeFilter}-${statusFilter}`)}
          >
            <Download size={16} />Export Warranty Excel / Template
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />Import Excel / Batch Results
          </button>
        </div>
      </div>

      <div className="metrics">
        <button
          type="button"
          className={`metric-card warranty-kpi-btn${statusFilter === "Under Warranty" ? " selected-kpi" : ""}`}
          onClick={() => setStatusFilter((cur) => (cur === "Under Warranty" ? "All" : "Under Warranty"))}
        >
          <span className="metric-icon green"><ShieldCheck size={20} /></span>
          <div><p>Under Warranty</p><strong>{statusCounts["Under Warranty"]}</strong><small>Eligible for free vendor claim</small></div>
        </button>
        <button
          type="button"
          className={`metric-card warranty-kpi-btn${statusCounts["Expiring Soon"] > 0 ? " metric-zero-highlight" : ""}${statusFilter === "Expiring Soon" ? " selected-kpi" : ""}`}
          onClick={() => setStatusFilter((cur) => (cur === "Expiring Soon" ? "All" : "Expiring Soon"))}
        >
          <span className="metric-icon orange"><Clock3 size={20} /></span>
          <div><p>Expiring Soon (≤ 60d)</p><strong>{statusCounts["Expiring Soon"]}</strong><small>Inspect before coverage ends</small></div>
        </button>
        <button
          type="button"
          className={`metric-card warranty-kpi-btn${statusFilter === "Expired" ? " selected-kpi" : ""}`}
          onClick={() => setStatusFilter((cur) => (cur === "Expired" ? "All" : "Expired"))}
        >
          <span className="metric-icon red"><ShieldAlert size={20} /></span>
          <div><p>Warranty Expired</p><strong>{statusCounts.Expired}</strong><small>Paid or internal repair only</small></div>
        </button>
        <button
          type="button"
          className={`metric-card warranty-kpi-btn${statusFilter === "Not Recorded" ? " selected-kpi" : ""}`}
          onClick={() => setStatusFilter((cur) => (cur === "Not Recorded" ? "All" : "Not Recorded"))}
        >
          <span className="metric-icon violet"><Calendar size={20} /></span>
          <div><p>Not Recorded Yet</p><strong>{statusCounts["Not Recorded"]}</strong><small>Select &amp; bulk-fill or import</small></div>
        </button>
      </div>

      {importPreview && (
        <section className="panel warranty-import-preview">
          <div className="warranty-preview-head">
            <div>
              <span className="section-kicker">EXCEL / CSV IMPORT PREVIEW</span>
              <h3>{importFileName}</h3>
              <p>
                Read {importPreview.totalRowsRead} row(s): <strong>{importPreview.matched.length} matched</strong> to existing assets
                {importPreview.unmatchedRows.length > 0 ? ` · ${importPreview.unmatchedRows.length} skipped/unmatched` : ""}.
              </p>
            </div>
            <div className="page-actions">
              <button type="button" className="button button-secondary button-sm" onClick={() => setImportPreview(null)}>
                <X size={14} />Cancel
              </button>
              <button
                type="button"
                className="button button-primary button-sm"
                disabled={!importPreview.matched.length || applyingImport}
                onClick={commitImportPreview}
              >
                <Check size={14} />{applyingImport ? "Saving…" : `Apply ${importPreview.matched.length} Warranty Updates`}
              </button>
            </div>
          </div>
          {importPreview.matched.length > 0 && (
            <div className="responsive-table" style={{ maxHeight: "240px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Matched By</th>
                    <th>Asset</th>
                    <th>Serial</th>
                    <th>Warranty Start</th>
                    <th>Warranty End</th>
                    <th>Vendor / Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.matched.slice(0, 25).map((row) => (
                    <tr key={row.assetId}>
                      <td><span className="audit-badge">{row.matchedBy}</span></td>
                      <td><strong>{row.assetName}</strong> <small className="muted">{row.assetCode}</small></td>
                      <td><code>{row.serial || "—"}</code></td>
                      <td>{row.warrantyStartDate || "—"}</td>
                      <td><strong>{row.warrantyEndDate || "—"}</strong></td>
                      <td>{[row.warrantyVendor, row.warrantyInvoiceNo].filter(Boolean).join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.matched.length > 25 && (
                <p className="muted" style={{ padding: "8px 12px", fontSize: "8.5px" }}>
                  Showing first 25 of {importPreview.matched.length} matched records…
                </p>
              )}
            </div>
          )}
          {importPreview.unmatchedRows.length > 0 && (
            <div className="warranty-unmatched-note">
              <AlertTriangle size={14} />
              <span>
                Skipped {importPreview.unmatchedRows.length} row(s):{" "}
                {importPreview.unmatchedRows.slice(0, 4).map((r) => `Row ${r.rowNumber} (${r.identifier}: ${r.reason})`).join(" | ")}
                {importPreview.unmatchedRows.length > 4 ? ` +${importPreview.unmatchedRows.length - 4} more` : ""}
              </span>
            </div>
          )}
        </section>
      )}

      <section className="panel warranty-portals-panel">
        <div className="warranty-portals-head">
          <div>
            <span className="section-kicker">OFFICIAL MANUFACTURER WARRANTY PORTALS</span>
            <h3>Verify serials directly on official brand sites</h3>
            <p>
              Tip: For <strong>Lenovo</strong> (up to 1,000 serials) and <strong>HP</strong> (20 serials), copy serials in 1 click, run their official batch tool, and upload the exported Excel right back via <strong>Import Excel / Batch Results</strong>. For <strong>ASUS</strong> &amp; accessories (Mice/Headsets), check via serial or select a purchase batch below to fill 20+ items at once.
            </p>
          </div>
        </div>
        <div className="warranty-portal-grid">
          {portalStats.map(({ portal, count, missingCount, matchedAssets }) => (
            <div className="warranty-portal-card" key={portal.id}>
              <div className="warranty-portal-top">
                <strong>{portal.brand}</strong>
                <span className={missingCount > 0 ? "warranty-pill warranty-expiring" : "warranty-pill warranty-active"}>
                  {count} asset{count === 1 ? "" : "s"}{missingCount > 0 ? ` · ${missingCount} missing` : ""}
                </span>
              </div>
              <small>{portal.note}</small>
              <div className="warranty-portal-actions">
                <a href={portal.url} target="_blank" rel="noreferrer" className="button button-secondary button-sm">
                  <ExternalLink size={12} />Official Site
                </a>
                {portal.batchUrl && (
                  <button
                    type="button"
                    className="button button-primary button-sm"
                    onClick={() => handleCopyBrandSerials(portal.brand, matchedAssets, portal.batchUrl)}
                    title={portal.batchLabel}
                  >
                    <ClipboardCopy size={12} />Copy Serials &amp; Batch
                  </button>
                )}
                {!portal.batchUrl && count > 0 && (
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => {
                      const firstBrand = matchedAssets[0]?.brand?.trim();
                      if (firstBrand) setBrandFilter(firstBrand);
                      setStatusFilter("Not Recorded");
                    }}
                  >
                    Filter missing
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="filter-bar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div className="tabs">
          {(["All", "Under Warranty", "Expiring Soon", "Expired", "Not Recorded"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={statusFilter === tab ? "active" : ""}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === "All" ? `All IT (${itAssets.length})` : `${tab} (${statusCounts[tab]})`}
            </button>
          ))}
        </div>

        <select
          className="select-filter"
          style={{ marginLeft: "auto" }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All IT Types</option>
          {availableTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <select
          className="select-filter"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="All">All Brands</option>
          {availableBrands.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div className="warranty-bulk-bar">
          <div>
            <Layers size={18} />
            <div>
              <strong>{selectedIds.length} asset{selectedIds.length === 1 ? "" : "s"} selected for batch warranty update</strong>
              <span>Apply a shared purchase/warranty start date, duration (1–3 yrs), vendor, invoice no., and proof URL in one step.</span>
            </div>
          </div>
          <div className="page-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
            <button type="button" className="button button-primary button-sm" onClick={() => setShowBulkModal(true)}>
              <BadgeCheck size={15} />Set Warranty for {selectedIds.length} Selected
            </button>
          </div>
        </div>
      )}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <strong>IT Asset Warranty Register</strong>
            <small>{filteredAssets.length} matching IT asset{filteredAssets.length === 1 ? "" : "s"}</small>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-secondary button-sm"
              disabled={filteredAssets.length === 0}
              onClick={() => {
                if (allVisibleSelected) {
                  setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                } else {
                  setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                }
              }}
            >
              {allVisibleSelected ? "Unselect visible" : `Select all ${filteredAssets.length} visible`}
            </button>
            <span className="audit-badge"><FileSpreadsheet size={14} />Auto-calculated from End Date</span>
          </div>
        </div>

        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: "36px" }}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible IT assets"
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (allVisibleSelected) {
                        setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                      } else {
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                      }
                    }}
                  />
                </th>
                <th>Asset &amp; Model</th>
                <th>Type</th>
                <th>Serial No.</th>
                <th>Custodian / Dept</th>
                <th>Warranty Period</th>
                <th>Warranty State</th>
                <th>Vendor / Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-panel">
                      <ShieldCheck size={22} />
                      <strong>No IT assets match the current warranty filter</strong>
                      <span>Try switching status, brand, or asset type filters above.</span>
                    </div>
                  </td>
                </tr>
              )}
              {filteredAssets.map((asset) => {
                const info = getWarrantyStatus(asset);
                const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
                const { portal } = getWarrantyPortalForAsset(asset.brand, asset.model, asset.serial);
                const checked = selectedIds.includes(asset.id);
                return (
                  <tr
                    key={asset.id}
                    className={info.state === "Expiring Soon" ? "toner-row-zero" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`Select ${asset.name}`}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id],
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="warranty-asset-link"
                        onClick={() => onAsset(asset)}
                      >
                        <strong>{asset.name}</strong>
                        <small>{asset.code} · {[asset.brand, asset.model].filter(Boolean).join(" ") || "No brand/model"}</small>
                      </button>
                    </td>
                    <td><span className="category-label">{asset.type}</span></td>
                    <td><code>{asset.serial || "—"}</code></td>
                    <td>
                      {emp ? (
                        <div>
                          <strong style={{ fontSize: "9.5px" }}>{emp.name}</strong>
                          <div className="muted" style={{ fontSize: "8px" }}>{emp.department}</div>
                        </div>
                      ) : asset.assignedDepartment ? (
                        <div>
                          <strong style={{ fontSize: "9.5px" }}>{asset.assignedDepartment}</strong>
                          <div className="muted" style={{ fontSize: "8px" }}>Department</div>
                        </div>
                      ) : (
                        <span className="muted">{asset.location || "Central Stock"}</span>
                      )}
                    </td>
                    <td>
                      {asset.warrantyStartDate || asset.warrantyEndDate ? (
                        <div className="warranty-dates-cell">
                          <span>{asset.warrantyStartDate || "—"} → <strong>{asset.warrantyEndDate || "—"}</strong></span>
                          {asset.warrantyCheckedAt && <small className="muted">Verified {asset.warrantyCheckedAt}</small>}
                        </div>
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>
                      <span className={info.badgeClass} title={info.detail}>{info.label}</span>
                    </td>
                    <td>
                      <div className="warranty-proof-cell">
                        {asset.warrantyVendor && <strong>{asset.warrantyVendor}</strong>}
                        {asset.warrantyInvoiceNo && <small className="muted">Inv/PO: {asset.warrantyInvoiceNo}</small>}
                        {asset.warrantyProofUrl && (
                          <a href={asset.warrantyProofUrl} target="_blank" rel="noreferrer" className="inline-link-btn">
                            View proof <ExternalLink size={10} />
                          </a>
                        )}
                        {!asset.warrantyVendor && !asset.warrantyInvoiceNo && !asset.warrantyProofUrl && (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="toner-actions">
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => handleCopyAndOpenPortal(asset)}
                          title={portal ? `Copy serial & open ${portal.label}` : "Copy serial & search vendor warranty"}
                        >
                          <ExternalLink size={12} />Check Online
                        </button>
                        <button
                          type="button"
                          className="button button-primary button-sm"
                          onClick={() => setEditingSingle(asset)}
                        >
                          <Calendar size={12} />{asset.warrantyEndDate ? "Edit" : "Set"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingSingle && (
        <WarrantyEditModal
          title={`Set Warranty · ${editingSingle.name}`}
          subtitle={`${editingSingle.code} · ${[editingSingle.brand, editingSingle.model].filter(Boolean).join(" ")} · S/N: ${editingSingle.serial || "Not recorded"}`}
          initial={{
            warrantyStartDate: editingSingle.warrantyStartDate ?? "",
            warrantyEndDate: editingSingle.warrantyEndDate ?? "",
            warrantyVendor: editingSingle.warrantyVendor ?? "",
            warrantyInvoiceNo: editingSingle.warrantyInvoiceNo ?? "",
            warrantyProofUrl: editingSingle.warrantyProofUrl ?? "",
          }}
          onCheckOnline={() => handleCopyAndOpenPortal(editingSingle)}
          onClose={() => setEditingSingle(null)}
          onSave={async (values) => {
            const nowDate = todayIso();
            const updated: Asset = {
              ...editingSingle,
              ...values,
              warrantyCheckedAt: nowDate,
              updatedAt: nowDate,
            };
            await onBulkUpdateWarranties([updated], `Warranty updated for ${editingSingle.name} (${editingSingle.code})`);
            setEditingSingle(null);
          }}
        />
      )}

      {showBulkModal && selectedIds.length > 0 && (
        <WarrantyEditModal
          title={`Bulk Set Warranty (${selectedIds.length} Assets)`}
          subtitle={`Updates ${selectedIds.length} selected IT asset(s) at once with shared warranty start/end dates, vendor & invoice proof.`}
          initial={{
            warrantyStartDate: "",
            warrantyEndDate: "",
            warrantyVendor: "",
            warrantyInvoiceNo: "",
            warrantyProofUrl: "",
          }}
          onClose={() => setShowBulkModal(false)}
          onSave={async (values) => {
            const nowDate = todayIso();
            const selectedSet = new Set(selectedIds);
            const updatedAssets: Asset[] = assets
              .filter((asset) => selectedSet.has(asset.id))
              .map((asset) => ({
                ...asset,
                warrantyStartDate: values.warrantyStartDate || asset.warrantyStartDate,
                warrantyEndDate: values.warrantyEndDate || asset.warrantyEndDate,
                warrantyVendor: values.warrantyVendor || asset.warrantyVendor,
                warrantyInvoiceNo: values.warrantyInvoiceNo || asset.warrantyInvoiceNo,
                warrantyProofUrl: values.warrantyProofUrl || asset.warrantyProofUrl,
                warrantyCheckedAt: nowDate,
                updatedAt: nowDate,
              }));
            await onBulkUpdateWarranties(
              updatedAssets,
              `Updated warranty dates for ${updatedAssets.length} selected IT asset(s)`,
            );
            setShowBulkModal(false);
            setSelectedIds([]);
          }}
        />
      )}
    </>
  );
}

function WarrantyEditModal({
  title,
  subtitle,
  initial,
  onCheckOnline,
  onClose,
  onSave,
}: {
  title: string;
  subtitle: string;
  initial: {
    warrantyStartDate: string;
    warrantyEndDate: string;
    warrantyVendor: string;
    warrantyInvoiceNo: string;
    warrantyProofUrl: string;
  };
  onCheckOnline?: () => void;
  onClose: () => void;
  onSave: (values: {
    warrantyStartDate?: string;
    warrantyEndDate?: string;
    warrantyVendor?: string;
    warrantyInvoiceNo?: string;
    warrantyProofUrl?: string;
  }) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(initial.warrantyStartDate);
  const [endDate, setEndDate] = useState(initial.warrantyEndDate);
  const [vendor, setVendor] = useState(initial.warrantyVendor);
  const [invoiceNo, setInvoiceNo] = useState(initial.warrantyInvoiceNo);
  const [proofUrl, setProofUrl] = useState(initial.warrantyProofUrl);
  const [saving, setSaving] = useState(false);

  const previewInfo = getWarrantyStatus({ warrantyStartDate: startDate, warrantyEndDate: endDate });

  function applyDuration(years: number) {
    const base = startDate || todayIso();
    if (!startDate) setStartDate(base);
    setEndDate(addYearsToDate(base, years));
  }

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="modal-head">
          <div>
            <span>WARRANTY COVERAGE</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0, marginBottom: "14px", fontSize: "9.5px" }}>{subtitle}</p>
          {onCheckOnline && (
            <div style={{ marginBottom: "14px" }}>
              <button type="button" className="button button-secondary button-sm" onClick={onCheckOnline}>
                <ExternalLink size={13} />Copy Serial &amp; Check on Official Brand Website
              </button>
            </div>
          )}
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              setSaving(true);
              try {
                await onSave({
                  warrantyStartDate: startDate.trim() || undefined,
                  warrantyEndDate: endDate.trim() || undefined,
                  warrantyVendor: vendor.trim() || undefined,
                  warrantyInvoiceNo: invoiceNo.trim() || undefined,
                  warrantyProofUrl: proofUrl.trim() || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              Warranty start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              Warranty end date
              <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <div className="full warranty-quick-durations">
              <span>Quick set duration from start date:</span>
              {[
                { label: "6 Months", years: 0.5 },
                { label: "1 Year", years: 1 },
                { label: "2 Years", years: 2 },
                { label: "3 Years", years: 3 },
                { label: "5 Years", years: 5 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => applyDuration(preset.years)}
                >
                  +{preset.label}
                </button>
              ))}
            </div>
            {endDate && (
              <div className="full warranty-live-preview">
                <CheckCircle2 size={15} />
                <span>Calculated status:</span>
                <span className={previewInfo.badgeClass}>{previewInfo.label}</span>
                <small className="muted">{previewInfo.detail}</small>
              </div>
            )}
            <label>
              Vendor / Supplier / Brand Support
              <input
                placeholder="e.g. ASUS Sri Lanka / Metropolitan / Singer / Dell"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </label>
            <label>
              Invoice / PO reference
              <input
                placeholder="e.g. INV-2025-0412 / PO-088"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
              />
            </label>
            <label className="full">
              Warranty proof URL / Lookup link (optional)
              <input
                type="url"
                placeholder="https://... (official portal screenshot / Google Drive invoice link)"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
            </label>
            <div className="form-actions full">
              <button className="button button-primary" type="submit" disabled={!endDate || saving}>
                <Check size={17} />{saving ? "Saving…" : "Save warranty details"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
