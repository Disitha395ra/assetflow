"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Check,
  Download,
  Droplets,
  History,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LOCATION_BUILDINGS, TONER_COLORS, getAssetKeySpecChips, tonerMatchesPrinter } from "@/lib/catalog";
import type {
  Asset,
  Employee,
  TonerColor,
  TonerStock,
  TonerTransaction,
} from "@/lib/types";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

function statusClass(status: string) {
  return `status status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

export function tonerStockStatus(toner: TonerStock): "Out of stock" | "Low stock" | "In stock" {
  if (toner.quantity <= 0) return "Out of stock";
  if (toner.quantity <= toner.minStock) return "Low stock";
  return "In stock";
}

function tonerSwatchColor(color: string) {
  switch (color) {
    case "Black": return "#18181b";
    case "Cyan": return "#06b6d4";
    case "Magenta": return "#db2777";
    case "Yellow": return "#eab308";
    case "Tri-Color": return "conic-gradient(#06b6d4 0 120deg, #db2777 120deg 240deg, #eab308 240deg 360deg)";
    case "Drum Unit": return "#6366f1";
    default: return "#64748b";
  }
}

export function PrintersTonersView({
  printers,
  toners,
  transactions,
  employeeMap,
  initialSubTab = "Printers",
  onAddPrinter,
  onAsset,
  onAddToner,
  onEditToner,
  onDeleteToner,
  onStockAction,
  onExport,
}: {
  printers: Asset[];
  toners: TonerStock[];
  transactions: TonerTransaction[];
  employeeMap: Record<string, Employee>;
  initialSubTab?: "Printers" | "Toner Stock";
  onAddPrinter: () => void;
  onAsset: (asset: Asset) => void;
  onAddToner: (preset?: { model: string; brand?: string; compatibleToner?: string }) => void;
  onEditToner: (toner: TonerStock) => void;
  onDeleteToner: (toner: TonerStock) => void;
  onStockAction: (toner: TonerStock, mode: "Restock" | "Issued", presetPrinterId?: string) => void;
  onExport: () => void;
}) {
  const [subTab, setSubTab] = useState<"Printers" | "Toner Stock">(initialSubTab);
  const [printerModelFilter, setPrinterModelFilter] = useState("All");
  const [stockStatusFilter, setStockStatusFilter] = useState<"All" | "In stock" | "Low stock" | "Out of stock">("All");

  const totalTonerUnits = toners.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = toners.filter((item) => item.quantity <= item.minStock).length;
  const deptAssignedPrinters = printers.filter((item) => item.allocationType === "department").length;
  const personAssignedPrinters = printers.filter((item) => Boolean(item.employeeId)).length;

  const allPrinterModels = useMemo(() => {
    const models = new Set<string>();
    printers.forEach((p) => { if (p.model.trim()) models.add(p.model.trim()); });
    toners.forEach((t) => { if (t.printerModel.trim()) models.add(t.printerModel.trim()); });
    return Array.from(models).sort();
  }, [printers, toners]);

  const filteredToners = useMemo(() => {
    return toners.filter((item) => {
      if (printerModelFilter !== "All" && item.printerModel !== printerModelFilter) return false;
      if (stockStatusFilter !== "All" && tonerStockStatus(item) !== stockStatusFilter) return false;
      return true;
    });
  }, [toners, printerModelFilter, stockStatusFilter]);

  const groupedToners = useMemo(() => {
    const groups = new Map<string, TonerStock[]>();
    filteredToners.forEach((item) => {
      const key = item.printerModel || "General / Unspecified Model";
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredToners]);

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span>PRINTERS &amp; CONSUMABLES</span>
          <h1>Printers &amp; Toners</h1>
          <p>Manage department or person-assigned printers alongside model-based toner stock and issue history.</p>
        </div>
        <div className="page-actions">
          <button className="button button-secondary" onClick={onExport}>
            <Download size={17} />Export
          </button>
          <button className="button button-secondary" onClick={() => onAddToner()}>
            <Droplets size={17} />Add toner SKU
          </button>
          <button className="button button-primary" onClick={onAddPrinter}>
            <Plus size={17} />Add printer
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric">
          <div className="metric-icon violet"><Printer size={21} /></div>
          <p>Registered printers</p>
          <div>
            <strong>{printers.length}</strong>
            <span>{deptAssignedPrinters} dept · {personAssignedPrinters} person</span>
          </div>
        </article>
        <article className="metric">
          <div className="metric-icon blue"><Layers size={21} /></div>
          <p>Toner SKUs tracked</p>
          <div>
            <strong>{toners.length}</strong>
            <span>Across {new Set(toners.map((t) => t.printerModel)).size} printer models</span>
          </div>
        </article>
        <article className="metric">
          <div className="metric-icon green"><Droplets size={21} /></div>
          <p>Total toner units</p>
          <div>
            <strong>{totalTonerUnits}</strong>
            <span>Available in store</span>
          </div>
        </article>
        <article className="metric">
          <div className="metric-icon orange"><AlertTriangle size={21} /></div>
          <p>Low / out of stock</p>
          <div>
            <strong>{lowStockCount}</strong>
            <span>{lowStockCount ? "Reorder recommended" : "All models healthy"}</span>
          </div>
        </article>
      </div>

      <div className="filter-tabs">
        <button
          className={subTab === "Printers" ? "active" : ""}
          onClick={() => setSubTab("Printers")}
        >
          Printers<span>{printers.length}</span>
        </button>
        <button
          className={subTab === "Toner Stock" ? "active" : ""}
          onClick={() => setSubTab("Toner Stock")}
        >
          Toner stock (Subsection)<span>{toners.length}</span>
        </button>

        {subTab === "Toner Stock" && (
          <>
            <select
              className="select-filter"
              aria-label="Filter toner by printer model"
              style={{ marginLeft: "auto" }}
              value={printerModelFilter}
              onChange={(e) => setPrinterModelFilter(e.target.value)}
            >
              <option value="All">All Printer Models</option>
              {allPrinterModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <select
              className="select-filter"
              aria-label="Filter toner by stock status"
              style={{ marginLeft: "8px" }}
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as typeof stockStatusFilter)}
            >
              <option value="All">All Stock Levels</option>
              <option value="In stock">In stock</option>
              <option value="Low stock">Low stock</option>
              <option value="Out of stock">Out of stock</option>
            </select>
          </>
        )}
      </div>

      {subTab === "Printers" && (
        <section className="panel table-panel">
          <div className="table-toolbar">
            <div>
              <strong>Printer register</strong>
              <small>Assigned to specific departments or staff, linked directly to compatible toner stock</small>
            </div>
            <button className="button button-secondary" onClick={() => setSubTab("Toner Stock")}>
              <Droplets size={15} />View toner stock →
            </button>
          </div>
          {printers.length === 0 ? (
            <div className="empty-panel">
              <Printer size={22} />
              <strong>No printers recorded yet</strong>
              <span>Add a printer and assign it to a department or specific person.</span>
            </div>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Printer &amp; specifications</th>
                    <th>Serial / location</th>
                    <th>Assigned to</th>
                    <th>Compatible toner stock</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {printers.map((printer) => {
                    const matchedToners = toners.filter((t) => tonerMatchesPrinter(t, printer));
                    const totalMatchedQty = matchedToners.reduce((sum, t) => sum + t.quantity, 0);
                    const hasLowMatched = matchedToners.some((t) => t.quantity <= t.minStock);
                    const chips = getAssetKeySpecChips(printer);
                    const assignedEmp = printer.employeeId ? employeeMap[printer.employeeId] : undefined;

                    return (
                      <tr key={printer.id} onClick={() => onAsset(printer)}>
                        <td>
                          <div className="asset-cell">
                            <span><Printer size={18} /></span>
                            <div>
                              <strong>{printer.name}</strong>
                              <small>{printer.code} · {printer.brand} {printer.model}</small>
                              {chips.length > 0 && (
                                <div className="spec-chip-row">
                                  {chips.map((chip) => <span className="spec-chip" key={chip}>{chip}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <code>{printer.serial || "—"}</code>
                          {printer.location && (
                            <div className="sub-location"><MapPin size={11} />{printer.location}</div>
                          )}
                        </td>
                        <td>
                          {assignedEmp ? (
                            <div className="mini-person">
                              <span>{initials(assignedEmp.name)}</span>
                              <div>
                                <strong>{assignedEmp.name}</strong>
                                <small>{assignedEmp.department} · Person</small>
                              </div>
                            </div>
                          ) : printer.allocationType === "department" && printer.assignedDepartment ? (
                            <div className="dept-assign-badge">
                              <span><Building2 size={13} /></span>
                              <div>
                                <strong>{printer.assignedDepartment}</strong>
                                <small>Department printer</small>
                              </div>
                            </div>
                          ) : (
                            <span className="muted">Central Stock</span>
                          )}
                        </td>
                        <td>
                          {matchedToners.length > 0 ? (
                            <div className="toner-inline-summary">
                              <span className={statusClass(totalMatchedQty === 0 ? "Out of stock" : hasLowMatched ? "Low stock" : "In stock")}>
                                {totalMatchedQty} unit{totalMatchedQty === 1 ? "" : "s"} ({matchedToners.length} SKU{matchedToners.length === 1 ? "" : "s"})
                              </span>
                              <small>{matchedToners.map((t) => `${t.tonerModel} (${t.color}: ${t.quantity})`).join(" · ")}</small>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="inline-link-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToner({
                                  model: printer.model,
                                  brand: printer.brand,
                                  compatibleToner: printer.specs?.compatibleToner,
                                });
                              }}
                            >
                              + Link toner stock
                            </button>
                          )}
                        </td>
                        <td><span className={statusClass(printer.status)}>{printer.status}</span></td>
                        <td>
                          {matchedToners.length > 0 ? (
                            <button
                              type="button"
                              className="button button-secondary button-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const target = matchedToners.find((t) => t.quantity > 0) ?? matchedToners[0];
                                onStockAction(target, target.quantity > 0 ? "Issued" : "Restock", printer.id);
                              }}
                            >
                              <Droplets size={13} />{totalMatchedQty > 0 ? "Issue toner" : "Restock"}
                            </button>
                          ) : (
                            <button className="row-action" aria-label={`View ${printer.name}`}>→</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {subTab === "Toner Stock" && (
        <div className="toner-workspace">
          {groupedToners.length === 0 ? (
            <section className="panel">
              <div className="empty-panel">
                <Droplets size={24} />
                <strong>No toner stock items found</strong>
                <span>Store toner cartridges by printer model to track quantities, restocks, and issues.</span>
                <button className="button button-primary" style={{ marginTop: "8px" }} onClick={() => onAddToner()}>
                  <Plus size={16} />Add first toner SKU
                </button>
              </div>
            </section>
          ) : (
            groupedToners.map(([modelName, modelToners]) => {
              const matchingPrinters = printers.filter((p) =>
                p.model.trim().toLowerCase() === modelName.trim().toLowerCase() ||
                modelToners.some((t) => tonerMatchesPrinter(t, p)),
              );
              const modelTotalQty = modelToners.reduce((sum, item) => sum + item.quantity, 0);
              const brandLabel = modelToners[0]?.printerBrand || matchingPrinters[0]?.brand || "";

              return (
                <section className="panel toner-group-card" key={modelName}>
                  <div className="toner-group-head">
                    <div>
                      <span className="section-kicker">PRINTER MODEL</span>
                      <h3>{brandLabel ? `${brandLabel} · ` : ""}{modelName}</h3>
                      <p>
                        {matchingPrinters.length > 0
                          ? `${matchingPrinters.length} registered printer${matchingPrinters.length === 1 ? "" : "s"} (${matchingPrinters.map((p) => p.assignedDepartment || (p.employeeId ? employeeMap[p.employeeId]?.name : "Central Stock")).join(", ")})`
                          : "No printer asset registered with this exact model yet"}
                      </p>
                    </div>
                    <div className="toner-group-meta">
                      <span className="audit-badge"><Package size={13} />{modelTotalQty} total in stock</span>
                      <button
                        type="button"
                        className="button button-secondary button-sm"
                        onClick={() => onAddToner({ model: modelName, brand: brandLabel })}
                      >
                        <Plus size={14} />Add color / SKU
                      </button>
                    </div>
                  </div>
                  <div className="responsive-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Toner model / code</th>
                          <th>Color / type</th>
                          <th>In stock</th>
                          <th>Min alert</th>
                          <th>Status</th>
                          <th>Storage &amp; notes</th>
                          <th>Stock actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelToners.map((toner) => {
                          const stockStatus = tonerStockStatus(toner);
                          return (
                            <tr key={toner.id}>
                              <td>
                                <strong>{toner.tonerModel}</strong>
                                <div className="muted" style={{ fontSize: "8px", marginTop: "2px" }}>Updated {toner.updatedAt}</div>
                              </td>
                              <td>
                                <span className="toner-color-pill">
                                  <i className="toner-swatch" style={{ background: tonerSwatchColor(toner.color) }} />
                                  {toner.color}
                                </span>
                              </td>
                              <td className="toner-qty-cell"><strong>{toner.quantity}</strong></td>
                              <td>{toner.minStock}</td>
                              <td><span className={statusClass(stockStatus)}>{stockStatus}</span></td>
                              <td>
                                <span>{toner.storageLocation || "Central IT Store"}</span>
                                {toner.notes && <div className="muted" style={{ fontSize: "8px", marginTop: "2px" }}>{toner.notes}</div>}
                              </td>
                              <td>
                                <div className="toner-actions">
                                  <button
                                    type="button"
                                    className="button button-secondary button-sm"
                                    onClick={() => onStockAction(toner, "Restock")}
                                    title="Add stock"
                                  >
                                    <ArrowDownToLine size={13} />Restock
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-primary button-sm"
                                    disabled={toner.quantity <= 0}
                                    onClick={() => onStockAction(toner, "Issued")}
                                    title="Issue toner to a printer or department"
                                  >
                                    <ArrowUpFromLine size={13} />Issue
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={`Edit ${toner.tonerModel}`}
                                    onClick={() => onEditToner(toner)}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-button danger-icon"
                                    aria-label={`Delete ${toner.tonerModel}`}
                                    onClick={() => {
                                      if (window.confirm(`Delete toner ${toner.tonerModel} (${toner.color}) for ${toner.printerModel}?`)) {
                                        onDeleteToner(toner);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
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
              );
            })
          )}

          <section className="panel table-panel" style={{ marginTop: "18px" }}>
            <div className="table-toolbar">
              <div>
                <strong>Toner stock movement history</strong>
                <small>Complete log of restocks and toner issues by printer model and department</small>
              </div>
              <span className="audit-badge"><History size={14} />{sortedTransactions.length} records</span>
            </div>
            {sortedTransactions.length === 0 ? (
              <div className="empty-panel">
                <History size={20} />
                <strong>No toner movements recorded yet</strong>
                <span>Restocks and toner issues will appear here automatically.</span>
              </div>
            ) : (
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action</th>
                      <th>Printer model</th>
                      <th>Toner</th>
                      <th>Qty</th>
                      <th>Balance</th>
                      <th>Issued to / destination</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.slice(0, 30).map((tx) => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>
                          <span className={statusClass(tx.type === "Restock" ? "Available" : tx.type === "Issued" ? "Assigned" : "Pending")}>
                            {tx.type}
                          </span>
                        </td>
                        <td><strong>{tx.printerModel}</strong></td>
                        <td>{tx.tonerModel} <span className="muted">({tx.color})</span></td>
                        <td>
                          <strong style={{ color: tx.type === "Restock" ? "#14844e" : "#3c64c9" }}>
                            {tx.type === "Restock" ? `+${tx.quantity}` : `-${tx.quantity}`}
                          </strong>
                        </td>
                        <td><code>{tx.resultingStock}</code></td>
                        <td>
                          {tx.type === "Issued" ? (
                            <div>
                              <strong>{tx.department || "—"}</strong>
                              {(tx.printerName || tx.recipientName) && (
                                <div className="muted" style={{ fontSize: "8px" }}>
                                  {[tx.printerName, tx.recipientName].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="muted">Central IT Store</span>
                          )}
                        </td>
                        <td>{tx.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function TonerForm({
  printers,
  initial,
  preset,
  onSave,
}: {
  printers: Asset[];
  initial?: TonerStock;
  preset?: { model: string; brand?: string; compatibleToner?: string } | null;
  onSave: (toner: TonerStock) => Promise<void> | void;
}) {
  const knownPrinterModels = useMemo(() => {
    const map = new Map<string, { brand: string; compatibleToner?: string }>();
    printers.forEach((p) => {
      if (p.model.trim()) {
        map.set(p.model.trim(), { brand: p.brand, compatibleToner: p.specs?.compatibleToner });
      }
    });
    return map;
  }, [printers]);

  const [form, setForm] = useState({
    printerModel: initial?.printerModel ?? preset?.model ?? "",
    printerBrand: initial?.printerBrand ?? preset?.brand ?? "",
    tonerModel: initial?.tonerModel ?? preset?.compatibleToner ?? "",
    color: (initial?.color ?? "Black") as TonerColor,
    quantity: String(initial?.quantity ?? 1),
    minStock: String(initial?.minStock ?? 2),
    storageLocation: initial?.storageLocation ?? "Central IT Store",
    notes: initial?.notes ?? "",
  });

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          id: initial?.id ?? crypto.randomUUID(),
          printerModel: form.printerModel.trim(),
          printerBrand: form.printerBrand.trim(),
          tonerModel: form.tonerModel.trim(),
          color: form.color,
          quantity: Math.max(0, Number(form.quantity) || 0),
          minStock: Math.max(0, Number(form.minStock) || 0),
          storageLocation: form.storageLocation.trim() || "Central IT Store",
          notes: form.notes.trim(),
          updatedAt: new Date().toISOString().slice(0, 10),
        });
      }}
    >
      <label className="full">
        Printer model
        <input
          required
          list="registered-printer-models"
          placeholder="e.g. HP LaserJet Pro M404dn or Canon LBP6030"
          value={form.printerModel}
          onChange={(event) => {
            const val = event.target.value;
            const match = knownPrinterModels.get(val.trim());
            setForm({
              ...form,
              printerModel: val,
              printerBrand: match?.brand ?? form.printerBrand,
              tonerModel: !form.tonerModel && match?.compatibleToner ? match.compatibleToner : form.tonerModel,
            });
          }}
        />
        <datalist id="registered-printer-models">
          {Array.from(knownPrinterModels.keys()).map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </label>

      <label>
        Printer brand
        <input
          placeholder="e.g. HP, Canon, Brother, Epson"
          value={form.printerBrand}
          onChange={(e) => setForm({ ...form, printerBrand: e.target.value })}
        />
      </label>

      <label>
        Toner model / cartridge code
        <input
          required
          placeholder="e.g. HP 58A (CF258A) / Canon 057"
          value={form.tonerModel}
          onChange={(e) => setForm({ ...form, tonerModel: e.target.value })}
        />
      </label>

      <label>
        Color / consumable type
        <select
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value as TonerColor })}
        >
          {TONER_COLORS.map((color) => (
            <option key={color} value={color}>{color}</option>
          ))}
        </select>
      </label>

      <label>
        Storage location
        <input
          placeholder="e.g. Central IT Store, Cabinet B"
          value={form.storageLocation}
          onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
        />
      </label>

      <label>
        Current stock quantity
        <input
          required
          type="number"
          min="0"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </label>

      <label>
        Low stock alert threshold
        <input
          required
          type="number"
          min="0"
          value={form.minStock}
          onChange={(e) => setForm({ ...form, minStock: e.target.value })}
        />
      </label>

      <label className="full">
        Notes / page yield / supplier (optional)
        <textarea
          placeholder="e.g. Standard yield 3,000 pages, original OEM cartridge…"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>

      <div className="form-actions full">
        <p>Toner SKUs automatically link with printers matching this printer model.</p>
        <button className="button button-primary" type="submit">
          <Check size={17} />{initial ? "Update toner SKU" : "Save toner SKU"}
        </button>
      </div>
    </form>
  );
}

export function TonerStockActionForm({
  toner,
  mode,
  printers,
  departments,
  employees,
  presetPrinterId,
  onSave,
}: {
  toner: TonerStock;
  mode: "Restock" | "Issued";
  printers: Asset[];
  departments: string[];
  employees: Employee[];
  presetPrinterId?: string;
  onSave: (payload: {
    quantity: number;
    printerAssetId?: string;
    printerName?: string;
    department?: string;
    recipientName?: string;
    note: string;
  }) => Promise<void> | void;
}) {
  const matchedPrinters = printers.filter((p) => tonerMatchesPrinter(toner, p));
  const printerChoices = matchedPrinters.length ? matchedPrinters : printers;
  const initialPrinter = printers.find((p) => p.id === presetPrinterId) ?? matchedPrinters[0];
  const initialEmployee = initialPrinter?.employeeId
    ? employees.find((e) => e.id === initialPrinter.employeeId)
    : undefined;

  const [quantity, setQuantity] = useState("1");
  const [printerAssetId, setPrinterAssetId] = useState(initialPrinter?.id ?? "");
  const [department, setDepartment] = useState(
    initialPrinter?.assignedDepartment ||
      initialEmployee?.department ||
      departments[0] ||
      "",
  );
  const [recipientName, setRecipientName] = useState(initialEmployee?.name ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qtyNum = Math.max(1, Number(quantity) || 1);
  const exceedsStock = mode === "Issued" && qtyNum > toner.quantity;

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (exceedsStock || submitting) return;
        setSubmitting(true);
        try {
          const selectedPrinter = printers.find((p) => p.id === printerAssetId);
          await onSave({
            quantity: qtyNum,
            printerAssetId: mode === "Issued" ? selectedPrinter?.id : undefined,
            printerName: mode === "Issued" ? selectedPrinter?.name : undefined,
            department: mode === "Issued" ? department : undefined,
            recipientName: mode === "Issued" ? recipientName.trim() : undefined,
            note: note.trim() || (mode === "Restock" ? "Stock replenished" : "Toner issued for printer"),
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="asset-spec-heading full">
        <strong>{toner.tonerModel} ({toner.color}) — {toner.printerModel}</strong>
        <span>Current stock: {toner.quantity} unit{toner.quantity === 1 ? "" : "s"} · Min alert: {toner.minStock}</span>
      </div>

      <label>
        {mode === "Restock" ? "Quantity to add" : "Quantity to issue"}
        <input
          required
          type="number"
          min="1"
          max={mode === "Issued" ? Math.max(1, toner.quantity) : 500}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>

      <label>
        Resulting stock balance
        <input
          readOnly
          value={
            mode === "Restock"
              ? `${toner.quantity + qtyNum} units`
              : `${Math.max(0, toner.quantity - qtyNum)} units`
          }
        />
      </label>

      {mode === "Issued" && (
        <>
          <label className="full">
            Target printer (optional)
            <select
              value={printerAssetId}
              onChange={(e) => {
                const nextId = e.target.value;
                setPrinterAssetId(nextId);
                const chosen = printers.find((p) => p.id === nextId);
                if (chosen) {
                  const emp = chosen.employeeId ? employees.find((item) => item.id === chosen.employeeId) : undefined;
                  if (chosen.assignedDepartment) setDepartment(chosen.assignedDepartment);
                  else if (emp?.department) setDepartment(emp.department);
                  if (emp?.name) setRecipientName(emp.name);
                }
              }}
            >
              <option value="">Select printer (optional)</option>
              {printerChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.code} ({p.assignedDepartment || p.custodianName || p.location || "Stock"})
                </option>
              ))}
            </select>
          </label>

          <label>
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </label>

          <label>
            Collected / installed by
            <input
              list="toner-recipient-employees"
              placeholder="Employee name (optional)"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <datalist id="toner-recipient-employees">
              {employees.filter((e) => e.status === "Active").map((emp) => (
                <option key={emp.id} value={emp.name} />
              ))}
            </datalist>
          </label>
        </>
      )}

      <label className="full">
        {mode === "Restock" ? "Supplier / PO / Restock note" : "Issue remarks"}
        <input
          placeholder={
            mode === "Restock"
              ? "e.g. Invoice #4521, Supplier delivery"
              : "e.g. Empty black cartridge replaced"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="form-actions full">
        <p>{exceedsStock ? "Issue quantity cannot exceed available stock." : "Stock balance and audit log update immediately."}</p>
        <button className="button button-primary" disabled={exceedsStock || submitting} type="submit">
          <Check size={17} />
          {mode === "Restock" ? `Add +${qtyNum} to stock` : `Issue ${qtyNum} unit${qtyNum === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}

export function LocationManager({
  locations,
  assets,
  onSave,
}: {
  locations: string[];
  assets: Asset[];
  onSave: (items: string[]) => void;
}) {
  const [items, setItems] = useState(locations);
  const [selectedBuilding, setSelectedBuilding] = useState<string>(LOCATION_BUILDINGS[0]);
  const [newLocation, setNewLocation] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(items.map((item) => item.trim()).filter(Boolean));
      }}
    >
      <div className="department-add" style={{ flexWrap: "wrap" }}>
        <label style={{ minWidth: "170px", flex: "0 0 180px" }}>
          Building
          <select
            style={{ display: "block", width: "100%", height: "39px", padding: "0 10px", marginTop: "6px", fontSize: "10px" }}
            value={selectedBuilding}
            onChange={(event) => setSelectedBuilding(event.target.value)}
          >
            {LOCATION_BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
            <option value="">Other / Standalone</option>
          </select>
        </label>
        <label>
          New room / classroom
          <input
            value={newLocation}
            placeholder="e.g. Classroom 104, Robotics Lab"
            onChange={(event) => setNewLocation(event.target.value)}
          />
        </label>
        <button
          className="button button-secondary"
          type="button"
          disabled={!newLocation.trim()}
          onClick={() => {
            const room = newLocation.trim();
            const next = selectedBuilding ? `${selectedBuilding} - ${room}` : room;
            if (room && !items.some((item) => item.toLowerCase() === next.toLowerCase())) {
              setItems([...items, next]);
            }
            setNewLocation("");
          }}
        >
          <Plus size={16} />Add location
        </button>
      </div>

      <div className="department-editor">
        {items.map((loc, index) => {
          const assetCount = assets.filter((asset) => asset.location === loc).length;
          return (
            <div key={`${loc}-${index}`}>
              <input
                aria-label={`Location ${index + 1}`}
                value={loc}
                onChange={(event) =>
                  setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))
                }
              />
              <span>{assetCount} asset{assetCount === 1 ? "" : "s"}</span>
              <button
                type="button"
                disabled={assetCount > 0 || items.length === 1}
                onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <p className="department-note">
        Classrooms and locations are used for Classroom / Location Monitors, Google Chromecasts, and printer placement.
      </p>

      <div className="form-actions full">
        <p>All changes are saved to your AssetFlow workspace.</p>
        <button
          className="button button-primary"
          disabled={!items.length || items.some((item) => !item.trim())}
          type="submit"
        >
          <Check size={17} />Save locations
        </button>
      </div>
    </form>
  );
}
