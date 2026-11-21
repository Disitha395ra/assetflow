"use client";

/* eslint-disable @next/next/no-img-element -- QR labels use generated data URLs. */

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarClock,
  Cast,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Copy,
  Download,
  Droplets,
  ExternalLink,
  FileSpreadsheet,
  Headphones,
  History,
  Laptop,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Mouse,
  Package,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_EMAIL,
  DEFAULT_REQUIREMENT_WINDOW,
  applyTonerStockTransaction,
  commitAssetMovementsBatch,
  deleteAssetRecord,
  firebaseReady,
  getRequirementWindow,
  listRecords,
  mergeDuplicateEmployeeRecord,
  removeRecord,
  saveRecord,
  saveRequirementWindow,
  signInAsAdmin,
  signOutAdmin,
  syncEmployeeCustodianOnAssets,
  isAdminEmail,
  watchAuth,
  watchCollection,
  watchRequirementWindow,
  type RequirementWindowRecord,
} from "@/lib/firebase";
import {
  ASSET_SPEC_FIELDS,
  ASSET_TYPES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_LOCATIONS,
  FURNITURE_IMAGE_OPTIONS,
  effectiveAssetStatus,
  formatSpecLabel,
  furnitureImageForAsset,
  getAssetKeySpecChips,
  groupLocationsByBuilding,
  isLocationOnlyAssetType,
  isMonitorAssetType,
  isPrinterAssetType,
  matchesSearchQuery,
  tonerMatchesPrinter,
} from "@/lib/catalog";
import {
  LocationManager,
  PrintersTonersView,
  TonerForm,
  TonerStockActionForm,
  tonerStockStatus,
} from "@/components/PrintersTonersView";
import { WarrantyHubView } from "@/components/WarrantyHubView";
import {
  buildEmployeeItAssetsReport,
  buildPrinterAndTonerReport,
  buildStaffHeadsetsReport,
  buildStaffLaptopsReport,
  buildStaffMonitorsReport,
  buildStaffMousesReport,
  buildZeroStockTonerRequisitionReport,
  downloadStyledWorkbook,
} from "@/lib/excelReports";
import type {
  Asset,
  AssetAllocationType,
  AssetStatus,
  Employee,
  Movement,
  RequestRow,
  TonerStock,
  TonerTransaction,
} from "@/lib/types";

type View =
  | "Dashboard"
  | "Assets"
  | "Printers & Toners"
  | "Warranty"
  | "Employees"
  | "Movements"
  | "Requirements"
  | "Reports";

const nav = [
  { name: "Dashboard" as View, icon: LayoutDashboard },
  { name: "Assets" as View, icon: Package },
  { name: "Printers & Toners" as View, icon: Printer },
  { name: "Warranty" as View, icon: BadgeCheck },
  { name: "Employees" as View, icon: Users },
  { name: "Movements" as View, icon: ArrowLeftRight },
  { name: "Requirements" as View, icon: CalendarClock },
  { name: "Reports" as View, icon: FileSpreadsheet },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

function statusClass(status: string) {
  return `status status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function specLabel(key: string) {
  return formatSpecLabel(key);
}

function assetTypeIcon(type: string, size = 18) {
  if (type === "Laptop") return <Laptop size={size} />;
  if (type === "Printer") return <Printer size={size} />;
  if (type === "Google Chromecast") return <Cast size={size} />;
  if (type === "Mobile Phone") return <Smartphone size={size} />;
  return <Monitor size={size} />;
}

export default function Home() {
  const [view, setView] = useState<View>("Dashboard");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [toners, setToners] = useState<TonerStock[]>([]);
  const [tonerTransactions, setTonerTransactions] = useState<TonerTransaction[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [adminState, setAdminState] = useState<"loading" | "signed-out" | "admin" | "denied">(
    firebaseReady ? "loading" : "admin",
  );
  const [signedInEmail, setSignedInEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [requirementWindow, setRequirementWindow] = useState<RequirementWindowRecord>(DEFAULT_REQUIREMENT_WINDOW);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [assetTypeFilter, setAssetTypeFilter] = useState("All");
  const [department, setDepartment] = useState("All");
  const [printersSubTab, setPrintersSubTab] = useState<"Printers" | "Toner Stock">("Printers");
  const [presetAssetType, setPresetAssetType] = useState<string | undefined>(undefined);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingToner, setEditingToner] = useState<TonerStock | null>(null);
  const [presetTonerModel, setPresetTonerModel] = useState<{ model: string; brand?: string; compatibleToner?: string } | null>(null);
  const [tonerAction, setTonerAction] = useState<{ toner: TonerStock; mode: "Restock" | "Issued"; presetPrinterId?: string } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modal, setModal] = useState<"asset" | "employee" | "employeeEdit" | "departments" | "locations" | "toner" | "tonerStock" | "assign" | "return" | "repair" | "request" | "document" | "qrBatch" | "schedule" | null>(null);
  const [documentType, setDocumentType] = useState("Asset Handover");
  const [documentEmployeeId, setDocumentEmployeeId] = useState("");
  const [documentAssetIds, setDocumentAssetIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    return watchAuth((user) => {
      const email = user?.email?.toLowerCase() ?? "";
      setSignedInEmail(email);
      if (!user) setAdminState("signed-out");
      else setAdminState(isAdminEmail(email) ? "admin" : "denied");
    });
  }, []);

  useEffect(() => {
    if (!firebaseReady || adminState !== "admin") return;
    const handleCollectionError = (colName: string) => (err: Error) => {
      console.error(`Collection ${colName} error:`, err);
      if (err.message && err.message.toLowerCase().includes("permission")) {
        flash(`Firestore access restricted for "${colName}". Please verify firestore.rules are published.`);
      }
    };
    const applyWindowConfig = (config: RequirementWindowRecord) => {
      setRequirementWindow(config);
      if (config.departments?.length) setDepartments(config.departments);
      if (config.locations?.length) setLocations(config.locations);
    };
    const cleanups = [
      watchCollection<Asset>("assets", setAssets, handleCollectionError("assets")),
      watchCollection<Employee>("employees", setEmployees, handleCollectionError("employees")),
      watchCollection<Movement>("movements", setMovements, handleCollectionError("movements")),
      watchCollection<RequestRow>("requirements", setRequests, handleCollectionError("requirements")),
      watchCollection<TonerStock>("toners", setToners, handleCollectionError("toners")),
      watchCollection<TonerTransaction>("tonerTransactions", setTonerTransactions, handleCollectionError("tonerTransactions")),
      watchRequirementWindow(applyWindowConfig),
    ];
    getRequirementWindow().then((config) => {
      if (config) applyWindowConfig(config);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [adminState]);

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((item) => [item.id, item])),
    [employees],
  );
  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((item) => [item.id, item])),
    [assets],
  );

  const sortedAssets = useMemo(
    () => [...assets].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || a.code.localeCompare(b.code)),
    [assets],
  );

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "")),
    [movements],
  );

  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => {
      if (a.status === "Pending" && b.status !== "Pending") return -1;
      if (a.status !== "Pending" && b.status === "Pending") return 1;
      return (a.neededDate || "").localeCompare(b.neededDate || "");
    }),
    [requests],
  );

  const filteredAssets = useMemo(() => {
    return sortedAssets.filter((asset) => {
      if (category !== "All" && asset.category !== category) return false;
      const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
      return matchesSearchQuery(search, [
        asset.code,
        asset.name,
        asset.serial,
        asset.location,
        asset.brand,
        asset.model,
        asset.type,
        asset.category,
        effectiveAssetStatus(asset),
        asset.condition,
        asset.assignedDepartment,
        asset.custodianName,
        asset.custodianDepartment,
        emp?.name,
        emp?.empNo,
        emp?.department,
        ...Object.values(asset.specs ?? {}),
      ]);
    });
  }, [sortedAssets, category, search, employeeMap]);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((employee) =>
        (department === "All" || employee.department === department) &&
        matchesSearchQuery(search, [
          employee.name,
          employee.empNo,
          employee.email,
          employee.department,
          employee.designation,
          employee.status,
        ]),
      )
      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  }, [employees, department, search]);

  const filteredMovements = useMemo(() => {
    if (!search.trim()) return sortedMovements;
    return sortedMovements.filter((m) => {
      const asset = assetMap[m.assetId];
      const emp = m.employeeId ? employeeMap[m.employeeId] : undefined;
      return matchesSearchQuery(search, [
        m.type,
        m.note,
        m.date,
        m.employeeName,
        m.department,
        asset?.name,
        asset?.code,
        asset?.serial,
        emp?.name,
        emp?.department,
      ]);
    });
  }, [sortedMovements, search, assetMap, employeeMap]);

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return sortedRequests;
    return sortedRequests.filter((r) =>
      matchesSearchQuery(search, [r.department, r.item, r.reason, r.status, r.requesterName, r.requesterEmail]),
    );
  }, [sortedRequests, search]);

  const printerAssets = useMemo(() => {
    return sortedAssets.filter((asset) => {
      if (!isPrinterAssetType(asset.type)) return false;
      const emp = asset.employeeId ? employeeMap[asset.employeeId] : undefined;
      return matchesSearchQuery(search, [
        asset.code,
        asset.name,
        asset.brand,
        asset.model,
        asset.serial,
        asset.location,
        asset.assignedDepartment,
        asset.custodianName,
        emp?.name,
        emp?.department,
        ...Object.values(asset.specs ?? {}),
      ]);
    });
  }, [sortedAssets, search, employeeMap]);

  const filteredToners = useMemo(() => {
    return toners.filter((t) =>
      matchesSearchQuery(search, [t.printerModel, t.printerBrand, t.tonerModel, t.color, t.storageLocation, t.notes]),
    );
  }, [toners, search]);

  function flash(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3200);
  }

  async function saveToner(toner: TonerStock) {
    const exists = toners.some((row) => row.id === toner.id);
    setToners((rows) => exists ? rows.map((row) => (row.id === toner.id ? toner : row)) : [toner, ...rows]);
    await saveRecord("toners", toner);
    setEditingToner(null);
    setPresetTonerModel(null);
    setModal(null);
    flash(exists ? "Toner SKU updated" : `Toner ${toner.tonerModel} added for ${toner.printerModel}`);
  }

  async function deleteToner(toner: TonerStock) {
    setToners((rows) => rows.filter((row) => row.id !== toner.id));
    await removeRecord("toners", toner.id);
    flash(`${toner.tonerModel} removed from toner stock`);
  }

  async function deleteEmployee(employee: Employee) {
    const owned = assets.filter((asset) => asset.employeeId === employee.id);
    if (owned.length > 0) {
      flash(`Cannot delete ${employee.name} (${employee.empNo}) while ${owned.length} asset(s) are assigned — merge duplicate or return assets first.`);
      return;
    }
    if (!window.confirm(`Remove employee "${employee.name}" (${employee.empNo} · ${employee.department})?`)) {
      return;
    }
    setEmployees((rows) => rows.filter((row) => row.id !== employee.id));
    await removeRecord("employees", employee.id);
    if (editingEmployee?.id === employee.id) {
      setEditingEmployee(null);
      setModal(null);
    }
    flash(`Removed employee ${employee.name} (${employee.empNo})`);
  }

  async function mergeDuplicateEmployee(keep: Employee, duplicate: Employee) {
    if (keep.id === duplicate.id) return;
    const assetsToMove = assets.filter((asset) => asset.employeeId === duplicate.id);
    const movementsToMove = movements.filter((movement) => movement.employeeId === duplicate.id);
    const confirmMsg = assetsToMove.length > 0
      ? `Keep "${keep.name}" (${keep.empNo}) and remove the duplicate entry? ${assetsToMove.length} assigned asset(s) and ${movementsToMove.length} history record(s) from the duplicate will be safely transferred to the kept record.`
      : `Keep "${keep.name}" (${keep.empNo}) and permanently remove the duplicate entry (${duplicate.email || duplicate.department})?`;
    if (!window.confirm(confirmMsg)) return;

    if (assetsToMove.length > 0) {
      setAssets((rows) =>
        rows.map((row) =>
          row.employeeId === duplicate.id
            ? { ...row, employeeId: keep.id, custodianName: keep.name, custodianDepartment: keep.department }
            : row,
        ),
      );
    }
    if (movementsToMove.length > 0) {
      setMovements((rows) =>
        rows.map((row) =>
          row.employeeId === duplicate.id
            ? { ...row, employeeId: keep.id, employeeName: keep.name, department: keep.department }
            : row,
        ),
      );
    }
    setEmployees((rows) => rows.filter((row) => row.id !== duplicate.id));
    await mergeDuplicateEmployeeRecord(keep, duplicate.id, assetsToMove, movementsToMove);
    flash(
      assetsToMove.length > 0
        ? `Removed duplicate ${duplicate.name} (${duplicate.empNo}) · ${assetsToMove.length} asset(s) merged into kept record`
        : `Removed duplicate ${duplicate.name} (${duplicate.empNo})`,
    );
  }

  async function downloadZeroStockTonerReport() {
    const { sheets, filename } = buildZeroStockTonerRequisitionReport(assets, toners, tonerTransactions, employeeMap);
    await downloadStyledWorkbook(sheets, filename);
    flash(`Zero-stock toner requisition downloaded for Admin Dept`);
  }

  async function handleTonerStockAction(
    toner: TonerStock,
    mode: "Restock" | "Issued",
    payload: {
      quantity: number;
      printerAssetId?: string;
      printerCode?: string;
      printerName?: string;
      department?: string;
      recipientName?: string;
      performedBy?: string;
      note: string;
    },
  ) {
    try {
      const nowIso = new Date().toISOString();
      const txId = crypto.randomUUID();
      const actor = payload.performedBy?.trim() || signedInEmail || "IT Administrator";
      const targetPrinter = payload.printerAssetId ? assets.find((a) => a.id === payload.printerAssetId) : undefined;

      const printerMovement: Movement | undefined =
        mode === "Issued" && payload.printerAssetId
          ? {
              id: txId,
              assetId: payload.printerAssetId,
              employeeId: targetPrinter?.employeeId || "",
              type: "Toner Replacement",
              date: today(),
              createdAt: nowIso,
              employeeName: actor,
              department: payload.department || targetPrinter?.assignedDepartment || targetPrinter?.custodianDepartment || "Central Stock",
              note: `Replaced ${payload.quantity}× ${toner.tonerModel} (${toner.color}) by ${actor}${payload.recipientName ? ` · Requested by ${payload.recipientName}` : ""}${payload.note ? ` · ${payload.note}` : ""}`,
            }
          : undefined;

      const { updatedToner, transaction, movement } = await applyTonerStockTransaction(
        { ...toner, updatedAt: today() },
        mode,
        payload.quantity,
        (resultingStock): TonerTransaction => ({
          id: txId,
          tonerId: toner.id,
          printerModel: toner.printerModel,
          tonerModel: toner.tonerModel,
          color: toner.color,
          type: mode,
          quantity: payload.quantity,
          resultingStock,
          printerAssetId: payload.printerAssetId,
          printerCode: payload.printerCode || targetPrinter?.code,
          printerName: payload.printerName || targetPrinter?.name,
          department: payload.department,
          recipientName: payload.recipientName,
          performedBy: actor,
          date: today(),
          createdAt: nowIso,
          note: payload.note,
        }),
        printerMovement,
      );
      setToners((rows) => rows.map((row) => (row.id === updatedToner.id ? updatedToner : row)));
      setTonerTransactions((rows) => [transaction, ...rows]);
      if (movement) {
        setMovements((rows) => [movement, ...rows]);
      }
      setTonerAction(null);
      setModal(null);
      flash(
        mode === "Restock"
          ? `Added +${payload.quantity} ${toner.tonerModel} (${updatedToner.quantity} in stock)`
          : updatedToner.quantity === 0
            ? `Replaced ${payload.quantity}× ${toner.tonerModel} — BUFFER NOW AT 0! Download requisition for Admin Dept.`
            : `Replaced ${payload.quantity}× ${toner.tonerModel}${payload.printerName ? ` on ${payload.printerName}` : ""} (${updatedToner.quantity} left)`,
      );
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Could not update toner stock.");
    }
  }

  async function updateAsset(asset: Asset) {
    setAssets((rows) => rows.map((row) => (row.id === asset.id ? asset : row)));
    await saveRecord("assets", asset);
  }

  async function deleteAsset(asset: Asset) {
    const relatedMovements = movements.filter((movement) => movement.assetId === asset.id);
    await deleteAssetRecord(asset.id, relatedMovements.map((movement) => movement.id));
    setAssets((rows) => rows.filter((row) => row.id !== asset.id));
    setMovements((rows) => rows.filter((movement) => movement.assetId !== asset.id));
    setSelectedAsset(null);
    flash(`${asset.name} deleted from inventory`);
  }

  async function applyAssetMovementBatch(
    entries: { asset: Asset; movement: Movement }[],
  ) {
    const enrichedEntries = entries.map(({ asset, movement }) => {
      const employee = employeeMap[movement.employeeId];
      const enrichedMovement: Movement = {
        ...movement,
        createdAt: movement.createdAt ?? new Date().toISOString(),
        employeeName: movement.employeeName ?? employee?.name,
        department: movement.department ?? employee?.department,
      };
      return { asset, movement: enrichedMovement };
    });
    const updatedMap = new Map(enrichedEntries.map(({ asset }) => [asset.id, asset]));
    setAssets((rows) => rows.map((row) => updatedMap.get(row.id) ?? row));
    setMovements((rows) => [...enrichedEntries.map(({ movement }) => movement), ...rows]);
    await commitAssetMovementsBatch(enrichedEntries);
  }

  async function purgeDepartmentData(targetDepartment: string) {
    const employeeIds = new Set(employees.filter((employee) => employee.department === targetDepartment).map((employee) => employee.id));
    const assetIds = new Set(assets.filter((asset) =>
      asset.custodianDepartment === targetDepartment ||
      asset.assignedDepartment === targetDepartment ||
      asset.location === targetDepartment ||
      (targetDepartment === "IT Dept" && asset.status === "Available" && !asset.custodianDepartment && !asset.location)
    ).map((asset) => asset.id));
    const movementIds = new Set(movements.filter((movement) => movement.department === targetDepartment || employeeIds.has(movement.employeeId) || assetIds.has(movement.assetId)).map((movement) => movement.id));
    const requestIds = new Set(requests.filter((request) => request.department === targetDepartment).map((request) => request.id));

    for (const assetId of assetIds) {
      const history = await listRecords<{ id: string }>(`assets/${assetId}/history`);
      await Promise.all(history.map((event) => removeRecord(`assets/${assetId}/history`, event.id)));
    }
    await Promise.all([
      ...Array.from(movementIds, (id) => removeRecord("movements", id)),
      ...Array.from(requestIds, (id) => removeRecord("requirements", id)),
      ...Array.from(employeeIds, (id) => removeRecord("employees", id)),
      ...Array.from(assetIds, (id) => removeRecord("assets", id)),
    ]);

    const nextDepartments = departments.filter((department) => department !== targetDepartment);
    const nextWindow = { ...requirementWindow, departments: nextDepartments };
    setDepartments(nextDepartments);
    setRequirementWindow(nextWindow);
    setEmployees((rows) => rows.filter((employee) => !employeeIds.has(employee.id)));
    setAssets((rows) => rows.filter((asset) => !assetIds.has(asset.id)));
    setMovements((rows) => rows.filter((movement) => !movementIds.has(movement.id)));
    setRequests((rows) => rows.filter((request) => !requestIds.has(request.id)));
    await saveRequirementWindow(nextWindow);
    return { employees: employeeIds.size, assets: assetIds.size, movements: movementIds.size, requirements: requestIds.size };
  }

  async function exportWorkbook(exportAssets?: Asset[] | unknown) {
    const listToExport = Array.isArray(exportAssets) ? exportAssets : assets;
    const XLSX = await import("xlsx");
    const { strFromU8, strToU8, unzipSync, zipSync } = await import("fflate");
    const workbook = XLSX.utils.book_new();
    const assetRows = listToExport.map((asset) => ({
      Image: furnitureImageForAsset(asset) ? `${furnitureImageForAsset(asset)?.label} · ${furnitureImageForAsset(asset)?.model}` : "",
      "Asset Code": asset.code,
      Category: asset.category,
      Type: asset.type,
      Asset: asset.name,
      Brand: asset.brand,
      Model: asset.model,
      "Serial Number": asset.serial,
      "Allocation Mode":
        asset.employeeId ? "Employee" :
        asset.allocationType === "department" ? "Department" :
        asset.allocationType === "location" || isLocationOnlyAssetType(asset.type) ? "Classroom / Location" :
        "Stock",
      "Current Location": asset.location || asset.assignedDepartment || asset.custodianDepartment || "",
      Status: asset.status,
      "Assigned Employee": asset.employeeId ? employeeMap[asset.employeeId]?.name : "",
      Department: asset.employeeId ? employeeMap[asset.employeeId]?.department : (asset.assignedDepartment || ""),
      "No. of P-Cores": asset.specs?.pCores ?? "",
      "No. of E-Cores": asset.specs?.eCores ?? "",
      Condition: asset.condition,
      "Asset Verified (Yes/No)": asset.verified ? "Yes" : "No",
      Specifications: Object.entries(asset.specs ?? {}).filter(([, value]) => value).map(([key, value]) => `${specLabel(key)}: ${value}`).join("; "),
      Details: asset.details,
    }));
    const employeeRows = employees.map((employee) => ({
      "Employee No": employee.empNo,
      Employee: employee.name,
      Department: employee.department,
      Designation: employee.designation,
      Email: employee.email,
      Status: employee.status,
      "Assigned Items": assets.filter((asset) => asset.employeeId === employee.id).length,
    }));
    const tonerRows = toners.map((toner) => ({
      "Printer Brand": toner.printerBrand || "",
      "Printer Model": toner.printerModel,
      "Toner Model": toner.tonerModel,
      Color: toner.color,
      "Current Stock": toner.quantity,
      "Min Alert": toner.minStock,
      Status: tonerStockStatus(toner),
      "Storage Location": toner.storageLocation || "Central IT Store",
      Notes: toner.notes || "",
      "Last Updated": toner.updatedAt,
    }));
    const assetSheet = XLSX.utils.json_to_sheet(assetRows);
    assetSheet["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 18 }];
    assetSheet["!rows"] = [{ hpt: 24 }, ...listToExport.map((asset) => furnitureImageForAsset(asset) ? { hpt: 68 } : { hpt: 20 })];
    XLSX.utils.book_append_sheet(workbook, assetSheet, "Current Assets");
    if (tonerRows.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tonerRows), "Toner Stock");
    }
    if (tonerTransactions.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tonerTransactions), "Toner History");
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeRows), "Employees");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(requests), "Requirements");
    const imageRows = listToExport.map((asset, index) => ({ index, option: furnitureImageForAsset(asset) })).filter((item): item is { index: number; option: NonNullable<ReturnType<typeof furnitureImageForAsset>> } => Boolean(item.option));
    if (!imageRows.length) {
      XLSX.writeFile(workbook, `AssetFlow-current-report-${today()}.xlsx`);
      flash("Excel report downloaded");
      return;
    }

    const archive = unzipSync(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })));
    const uniqueImages = [...new Map(imageRows.map((item) => [item.option.src, item.option])).values()];
    await Promise.all(uniqueImages.map(async (option, index) => {
      const response = await fetch(option.src);
      if (!response.ok) throw new Error(`Could not load ${option.label} image for Excel.`);
      archive[`xl/media/image${index + 1}.png`] = new Uint8Array(await response.arrayBuffer());
    }));
    const relationshipByPath = new Map(uniqueImages.map((option, index) => [option.src, index + 1]));
    const anchors = imageRows.map(({ index, option }) => {
      const relationshipId = relationshipByPath.get(option.src)!;
      return `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${index + 1}</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from><xdr:ext cx="1238250" cy="809625"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="${option.key}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1238250" cy="809625"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
    }).join("");
    archive["xl/drawings/drawing1.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);
    archive["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${uniqueImages.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.png"/>`).join("")}</Relationships>`);
    archive["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    let worksheetXml = strFromU8(archive["xl/worksheets/sheet1.xml"]);
    if (!worksheetXml.includes("xmlns:r=")) worksheetXml = worksheetXml.replace("<worksheet ", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    archive["xl/worksheets/sheet1.xml"] = strToU8(worksheetXml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>'));
    let contentTypes = strFromU8(archive["[Content_Types].xml"]);
    if (!contentTypes.includes('Extension="png"')) contentTypes = contentTypes.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>');
    contentTypes = contentTypes.replace("</Types>", '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    archive["[Content_Types].xml"] = strToU8(contentTypes);
    const zippedWorkbook = zipSync(archive, { level: 6 });
    const workbookBuffer = zippedWorkbook.buffer.slice(zippedWorkbook.byteOffset, zippedWorkbook.byteOffset + zippedWorkbook.byteLength) as ArrayBuffer;
    const downloadUrl = URL.createObjectURL(new Blob([workbookBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `AssetFlow-current-report-${today()}.xlsx`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    flash("Excel report with asset images downloaded");
  }

  function openDocument(type: string, employeeId = "", assetIds: string[] = []) {
    setDocumentType(type);
    setDocumentEmployeeId(employeeId);
    setDocumentAssetIds(assetIds);
    setModal("document");
  }

  const pendingRequirements = requests.filter((request) => request.status === "Pending").length;
  const lowStockToners = toners.filter((toner) => toner.quantity <= toner.minStock).length;
  const repairAssetsCount = assets.filter((asset) => effectiveAssetStatus(asset) === "In repair").length;
  const totalAlerts = pendingRequirements + lowStockToners + repairAssetsCount;
  const healthyAssets = assets.filter((asset) => {
    const st = effectiveAssetStatus(asset);
    return st !== "In repair" && st !== "Retired";
  }).length;
  const inventoryHealth = assets.length ? Math.round((healthyAssets / assets.length) * 100) : 100;

  if (firebaseReady && adminState !== "admin") {
    return <AdminGate state={adminState} email={signedInEmail} error={authError} onSignIn={async () => {
      setAuthError("");
      try {
        await signInAsAdmin();
      } catch (err: unknown) {
        console.error("Firebase Sign-in Error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("auth/unauthorized-domain")) {
          setAuthError(`This domain (${typeof window !== "undefined" ? window.location.hostname : "Vercel"}) is not added in Firebase Console -> Authentication -> Settings -> Authorized domains.`);
        } else {
          setAuthError(errMsg);
        }
        setAdminState("signed-out");
      }
    }} onSignOut={() => { setAuthError(""); void signOutAdmin(); }} />;
  }

  return (
    <main className="app-shell">
      <aside className={sidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={23} /></div>
          <div><strong>AssetFlow</strong><span>Company assets</span></div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav>
          <p className="nav-label">WORKSPACE</p>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(name);
                if (name === "Assets") {
                  setCategory("All");
                  setAssetTypeFilter("All");
                }
                setSearch("");
                setSidebarOpen(false);
              }}
            >
              <Icon size={19} />{name}
              {name === "Requirements" && pendingRequirements > 0 && <span className="nav-count">{pendingRequirements}</span>}
              {name === "Printers & Toners" && lowStockToners > 0 && <span className="nav-count">{lowStockToners}</span>}
              {name === "Warranty" && <span className="nav-dev-tag">Dev</span>}
            </button>
          ))}
          <p className="nav-label second">MANAGEMENT</p>
          <button className="nav-item" onClick={() => setModal("departments")}><Building2 size={19} />Manage departments</button>
          <button className="nav-item" onClick={() => setModal("locations")}><MapPin size={19} />Manage locations</button>
          <button className="nav-item" onClick={() => { setView("Requirements"); setModal("schedule"); }}><Settings size={19} />Requirement settings</button>
        </nav>
        <div className="sidebar-foot">
          <div className="storage-row"><span>Inventory health</span><strong>{inventoryHealth}%</strong></div>
          <div className="progress"><span style={{ width: `${inventoryHealth}%` }} /></div>
          <small>{assets.filter((a) => a.status !== "Retired").length} active assets tracked</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="global-search">
            <Search size={19} />
            <input
              ref={searchInputRef}
              aria-label="Search assets and employees"
              placeholder="Search assets, people, locations or toners…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button type="button" className="search-clear-btn" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </div>
          <div className="top-actions">
            <span className={firebaseReady ? "sync-pill live" : "sync-pill"}><CircleDot size={13} />{firebaseReady ? "Firebase live" : "Demo workspace"}</span>
            <button
              className="icon-button"
              aria-label={totalAlerts > 0 ? `${totalAlerts} active alerts` : "No active alerts"}
              title={
                totalAlerts > 0
                  ? `${lowStockToners} low toners · ${pendingRequirements} pending requirements · ${repairAssetsCount} items in repair`
                  : "All inventory levels and requests are up to date"
              }
              onClick={() => {
                if (lowStockToners > 0) {
                  setPrintersSubTab("Toner Stock");
                  setView("Printers & Toners");
                } else if (pendingRequirements > 0) {
                  setView("Requirements");
                } else if (repairAssetsCount > 0) {
                  setCategory("All");
                  setAssetTypeFilter("All");
                  setSearch("In repair");
                  setView("Assets");
                } else {
                  flash("All inventory levels, repairs and requirements are healthy");
                }
              }}
            >
              <Bell size={19} />
              {totalAlerts > 0 && <i />}
            </button>
            <div className="profile-wrapper">
              <button
                type="button"
                className="profile profile-trigger"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span>AA</span>
                <div><strong>Asset Administrator</strong><small>{signedInEmail || ADMIN_EMAIL}</small></div>
                <ChevronDown size={16} />
              </button>
              {profileMenuOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <strong>{signedInEmail || ADMIN_EMAIL}</strong>
                    <small>{firebaseReady ? "Signed in via Firebase Auth" : "Local workspace mode"}</small>
                  </div>
                  {firebaseReady && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void signOutAdmin();
                      }}
                    >
                      <LogOut size={14} />Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {view === "Dashboard" && (
            <Dashboard
              assets={sortedAssets}
              employees={employees}
              departments={departments}
              locations={locations}
              requests={sortedRequests}
              movements={sortedMovements}
              toners={toners}
              employeeMap={employeeMap}
              assetMap={assetMap}
              onView={setView}
              onOpenPrinters={(tab) => {
                setPrintersSubTab(tab);
                setView("Printers & Toners");
              }}
              onDownloadZeroStockReport={downloadZeroStockTonerReport}
              onAddAsset={() => {
                setEditingAsset(null);
                setPresetAssetType(undefined);
                setModal("asset");
              }}
              onAssign={() => setModal("assign")}
              onReturn={() => setModal("return")}
              onRequest={() => setModal("request")}
              onAsset={setSelectedAsset}
            />
          )}
          {view === "Assets" && (
            <AssetsView
              assets={filteredAssets}
              toners={toners}
              employeeMap={employeeMap}
              category={category}
              setCategory={setCategory}
              typeFilter={assetTypeFilter}
              setTypeFilter={setAssetTypeFilter}
              departments={departments}
              locations={locations}
              onAdd={(defaultType) => { setEditingAsset(null); setPresetAssetType(defaultType); setModal("asset"); }}
              onAsset={setSelectedAsset}
              onExport={exportWorkbook}
              onQrBatch={() => setModal("qrBatch")}
              onOpenToners={() => { setPrintersSubTab("Toner Stock"); setView("Printers & Toners"); }}
              onAddToner={(preset) => { setEditingToner(null); setPresetTonerModel(preset ?? null); setModal("toner"); }}
              onTonerStockAction={(toner, mode, printerId) => { setTonerAction({ toner, mode, presetPrinterId: printerId }); setModal("tonerStock"); }}
            />
          )}
          {view === "Printers & Toners" && (
            <PrintersTonersView
              printers={printerAssets}
              toners={filteredToners}
              transactions={tonerTransactions}
              employeeMap={employeeMap}
              subTab={printersSubTab}
              onSubTabChange={setPrintersSubTab}
              onAddPrinter={() => { setEditingAsset(null); setPresetAssetType("Printer"); setModal("asset"); }}
              onAsset={setSelectedAsset}
              onAddToner={(preset) => { setEditingToner(null); setPresetTonerModel(preset ?? null); setModal("toner"); }}
              onEditToner={(toner) => { setEditingToner(toner); setPresetTonerModel(null); setModal("toner"); }}
              onDeleteToner={deleteToner}
              onStockAction={(toner, mode, presetPrinterId) => { setTonerAction({ toner, mode, presetPrinterId }); setModal("tonerStock"); }}
              onExport={() => exportWorkbook(printerAssets)}
              onDownloadZeroStockReport={downloadZeroStockTonerReport}
            />
          )}
          {view === "Warranty" && (
            <WarrantyHubView
              onBackToDashboard={() => setView("Dashboard")}
              onViewAssets={() => {
                setCategory("IT Asset");
                setAssetTypeFilter("All");
                setView("Assets");
              }}
            />
          )}
          {view === "Employees" && (
            <EmployeesView
              employees={filteredEmployees}
              allEmployees={employees}
              assets={assets}
              department={department}
              setDepartment={setDepartment}
              departments={departments}
              onAdd={() => setModal("employee")}
              onEdit={(employee) => { setEditingEmployee(employee); setModal("employeeEdit"); }}
              onDelete={deleteEmployee}
              onMergeDuplicate={mergeDuplicateEmployee}
              onDocument={openDocument}
            />
          )}
          {view === "Movements" && (
            <MovementsView movements={filteredMovements} assetMap={assetMap} employeeMap={employeeMap} onAssign={() => setModal("assign")} onReturn={() => setModal("return")} onRepair={() => setModal("repair")} />
          )}
          {view === "Requirements" && (
            <RequirementsView requests={filteredRequests} setRequests={setRequests} windowConfig={requirementWindow} setWindowConfig={setRequirementWindow} onSchedule={() => setModal("schedule")} onAdd={() => setModal("request")} onExport={exportWorkbook} onFlash={flash} />
          )}
          {view === "Reports" && (
            <ReportsView
              assets={assets}
              employees={employees}
              employeeMap={employeeMap}
              toners={toners}
              tonerTransactions={tonerTransactions}
              requests={requests}
              onExport={exportWorkbook}
              onDocument={openDocument}
              onDownloadZeroStockReport={downloadZeroStockTonerReport}
              onDownloadStructuredReport={async (reportId) => {
                const reportMap = {
                  laptops: () => buildStaffLaptopsReport(assets, employeeMap),
                  monitors: () => buildStaffMonitorsReport(assets, employeeMap),
                  headsets: () => buildStaffHeadsetsReport(assets, employeeMap),
                  mouses: () => buildStaffMousesReport(assets, employeeMap),
                  employeeIt: () => buildEmployeeItAssetsReport(assets, employees, employeeMap),
                  printersToners: () => buildPrinterAndTonerReport(assets, toners, tonerTransactions, employeeMap),
                } as const;
                const { sheets, filename } = reportMap[reportId]();
                await downloadStyledWorkbook(sheets, filename);
                flash(`${filename} downloaded`);
              }}
            />
          )}
        </div>
      </section>

      {selectedAsset && (
        <AssetDrawer
          asset={selectedAsset}
          employee={selectedAsset.employeeId ? employeeMap[selectedAsset.employeeId] : undefined}
          movements={sortedMovements.filter((row) => row.assetId === selectedAsset.id)}
          employeeMap={employeeMap}
          toners={toners}
          onClose={() => setSelectedAsset(null)}
          onEdit={() => { setEditingAsset(selectedAsset); setPresetAssetType(undefined); setSelectedAsset(null); setModal("asset"); }}
          onToggleVerified={async () => {
            const nextAsset: Asset = { ...selectedAsset, verified: !selectedAsset.verified, updatedAt: today() };
            setSelectedAsset(nextAsset);
            await updateAsset(nextAsset);
            flash(nextAsset.verified ? `${nextAsset.name} marked as Verified (Yes)` : `${nextAsset.name} marked as Not Verified (No)`);
          }}
          onDelete={() => { if (window.confirm(`Delete ${selectedAsset.name} (${selectedAsset.code}) and its lifecycle history? This cannot be undone.`)) void deleteAsset(selectedAsset); }}
          onAddToner={(preset) => { setSelectedAsset(null); setEditingToner(null); setPresetTonerModel(preset); setModal("toner"); }}
          onTonerStockAction={(toner, mode, printerId) => { setSelectedAsset(null); setTonerAction({ toner, mode, presetPrinterId: printerId }); setModal("tonerStock"); }}
        />
      )}
      {modal && (
        <Modal
          title={modal === "asset" && editingAsset ? "Edit asset" : modal === "toner" && editingToner ? "Edit toner SKU" : modal === "tonerStock" && tonerAction ? (tonerAction.mode === "Restock" ? "Restock toner" : "Issue toner") : modalTitle(modal)}
          wide={modal === "document"}
          onClose={() => { setModal(null); setEditingAsset(null); setEditingToner(null); setPresetAssetType(undefined); setPresetTonerModel(null); setTonerAction(null); }}
        >
          {modal === "asset" && (
            <AssetForm
              departments={departments}
              locations={locations}
              employees={employees}
              toners={toners}
              initial={editingAsset ?? undefined}
              defaultType={presetAssetType}
              onSave={async (asset) => {
                setAssets((rows) => editingAsset ? rows.map((row) => row.id === asset.id ? asset : row) : [asset, ...rows]);
                await saveRecord("assets", asset);
                if (asset.location && asset.location !== "Central Stock" && !locations.includes(asset.location) && !departments.includes(asset.location)) {
                  const nextLocations = [...locations, asset.location];
                  const nextWindow = { ...requirementWindow, locations: nextLocations };
                  setLocations(nextLocations);
                  setRequirementWindow(nextWindow);
                  await saveRequirementWindow(nextWindow);
                }
                setEditingAsset(null);
                setPresetAssetType(undefined);
                setModal(null);
                flash(editingAsset ? "Asset details updated" : "Asset added to inventory");
              }}
            />
          )}
          {modal === "employee" && <EmployeeForm departments={departments} existingEmployees={employees} onSave={async (employee) => { setEmployees((rows) => [employee, ...rows]); await saveRecord("employees", employee); setModal(null); flash("Employee added"); }} />}
          {modal === "employeeEdit" && editingEmployee && (
            <EmployeeForm
              departments={departments}
              existingEmployees={employees}
              initial={editingEmployee}
              onSave={async (employee) => {
                setEmployees((rows) => rows.map((row) => row.id === employee.id ? employee : row));
                await saveRecord("employees", employee);
                const assignedToEmp = assets.filter((a) => a.employeeId === employee.id);
                if (assignedToEmp.length && (employee.name !== editingEmployee.name || employee.department !== editingEmployee.department)) {
                  setAssets((rows) =>
                    rows.map((row) =>
                      row.employeeId === employee.id
                        ? { ...row, custodianName: employee.name, custodianDepartment: employee.department }
                        : row,
                    ),
                  );
                  await syncEmployeeCustodianOnAssets(employee, assignedToEmp);
                }
                setEditingEmployee(null);
                setModal(null);
                flash("Employee details updated");
              }}
            />
          )}
          {modal === "departments" && <DepartmentManager departments={departments} employees={employees} onSave={async (items) => { const nextWindow = { ...requirementWindow, departments: items }; setDepartments(items); setRequirementWindow(nextWindow); await saveRequirementWindow(nextWindow); setModal(null); flash("Department list updated"); }} onPurge={async (department) => { const deleted = await purgeDepartmentData(department); setModal(null); flash(`${department} removed · ${deleted.assets} assets, ${deleted.employees} employees, ${deleted.movements} movements and ${deleted.requirements} requirements deleted`); }} />}
          {modal === "locations" && <LocationManager locations={locations} assets={assets} onSave={async (items) => { const nextWindow = { ...requirementWindow, locations: items }; setLocations(items); setRequirementWindow(nextWindow); await saveRequirementWindow(nextWindow); setModal(null); flash("Classroom / location list updated"); }} />}
          {modal === "toner" && <TonerForm printers={assets.filter((a) => isPrinterAssetType(a.type))} initial={editingToner ?? undefined} preset={presetTonerModel} onSave={saveToner} />}
          {modal === "tonerStock" && tonerAction && (
            <TonerStockActionForm
              toner={tonerAction.toner}
              mode={tonerAction.mode}
              printers={assets.filter((a) => isPrinterAssetType(a.type))}
              departments={departments}
              employees={employees}
              presetPrinterId={tonerAction.presetPrinterId}
              defaultPerformedBy={signedInEmail || ADMIN_EMAIL}
              onSave={(payload) => handleTonerStockAction(tonerAction.toner, tonerAction.mode, payload)}
            />
          )}
          {modal === "assign" && <AssignForm assets={assets} employees={employees} onSave={async (assetIds, employeeId, email, shouldSendEmail, note) => {
            const employee = employeeMap[employeeId];
            const movementNote = note || "Asset issued through AssetFlow";
            const nowIso = new Date().toISOString();
            const batchEntries = assetIds
              .map((assetId) => assets.find((row) => row.id === assetId))
              .filter((row): row is Asset => Boolean(row))
              .map((asset) => {
                const updatedAsset: Asset = {
                  ...asset,
                  status: "Assigned",
                  employeeId,
                  allocationType: "person",
                  assignedDepartment: undefined,
                  location: asset.category === "Non-IT Asset" ? employee?.department : asset.location,
                  custodianName: employee?.name,
                  custodianDepartment: employee?.department,
                  updatedAt: today(),
                };
                const movement: Movement = {
                  id: crypto.randomUUID(),
                  assetId: asset.id,
                  employeeId,
                  type: "Assigned",
                  date: today(),
                  createdAt: nowIso,
                  note: movementNote,
                };
                return { asset: updatedAsset, movement };
              });
            const assignedAssets = batchEntries.map((entry) => entry.asset);
            await applyAssetMovementBatch(batchEntries);

            if (shouldSendEmail && email) {
              try {
                const res = await fetch("/api/send-assignment-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    employeeName: employee?.name || "Employee",
                    employeeEmail: email,
                    employeeDepartment: employee?.department || "Central Stock",
                    employeeEmpNo: employee?.empNo || "",
                    assignedDate: today(),
                    note: movementNote,
                    assets: assignedAssets.map((item) => ({
                      id: item.id,
                      name: item.name,
                      code: item.code,
                      category: item.category,
                      type: item.type,
                      brand: item.brand,
                      model: item.model,
                      serial: item.serial,
                      location: item.location,
                      condition: item.condition,
                    })),
                  }),
                });
                const emailData = await res.json();
                if (emailData.success) {
                  flash(`✓ ${assetIds.length} item${assetIds.length > 1 ? "s" : ""} assigned & email sent to ${email} (CC: admin@scot.lk, it@scot.lk, hr@scot.lk)`);
                } else if (emailData.notConfigured) {
                  flash(`⚠️ Assets assigned, but email not sent: SMTP or RESEND_API_KEY is not configured in Vercel env.`);
                  window.alert(
                    `Assets assigned successfully!\n\n⚠️ However, confirmation email was NOT sent because Email Settings (SMTP or Resend) are not configured in Vercel Environment Variables yet.\n\nTo deliver real emails, please add SMTP_HOST, SMTP_USER, SMTP_PASS or RESEND_API_KEY in your Vercel Project Settings and redeploy.`,
                  );
                } else {
                  flash(`⚠️ Assets assigned, but email error: ${emailData.error || "delivery failed"}`);
                }
              } catch (emailErr) {
                console.error("Assignment email error:", emailErr);
                flash("⚠️ Assets assigned, but email API call failed.");
              }
            } else {
              flash(`${assetIds.length} item${assetIds.length > 1 ? "s" : ""} assigned — handover document ready`);
            }

            openDocument("Asset Handover", employeeId, assetIds);
          }} />}
          {modal === "return" && <ReturnForm assets={assets} employees={employees} onSave={async (assetIds, employeeId, email, shouldSendEmail, clearance, note) => {
            const employee = employeeMap[employeeId];
            const returnNote = note || (clearance ? "Returned during employee clearance" : "Returned to central stock");
            const nowIso = new Date().toISOString();
            const batchEntries = assetIds
              .map((assetId) => assets.find((row) => row.id === assetId))
              .filter((row): row is Asset => Boolean(row))
              .map((asset) => {
                const updatedAsset: Asset = {
                  ...asset,
                  status: "Available",
                  employeeId: undefined,
                  allocationType: undefined,
                  assignedDepartment: undefined,
                  location: asset.category === "Non-IT Asset" ? "Central Stock" : asset.location,
                  custodianName: undefined,
                  custodianDepartment: undefined,
                  condition: "Good",
                  updatedAt: today(),
                };
                const movement: Movement = {
                  id: crypto.randomUUID(),
                  assetId: asset.id,
                  employeeId,
                  type: clearance ? "Cleared" : "Returned",
                  date: today(),
                  createdAt: nowIso,
                  note: returnNote,
                };
                return { asset: updatedAsset, movement };
              });
            const returnedAssets = batchEntries.map((entry) => entry.asset);
            await applyAssetMovementBatch(batchEntries);

            if (shouldSendEmail && email) {
              try {
                const res = await fetch("/api/send-return-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    employeeName: employee?.name || "Employee",
                    employeeEmail: email,
                    employeeDepartment: employee?.department || "Central Stock",
                    employeeEmpNo: employee?.empNo || "",
                    returnDate: today(),
                    isClearance: clearance,
                    note: returnNote,
                    assets: returnedAssets.map((item) => ({
                      id: item.id,
                      name: item.name,
                      code: item.code,
                      category: item.category,
                      type: item.type,
                      brand: item.brand,
                      model: item.model,
                      serial: item.serial,
                      location: item.location,
                      condition: item.condition,
                    })),
                  }),
                });
                const emailData = await res.json();
                if (emailData.success) {
                  flash(`✓ ${assetIds.length} item${assetIds.length > 1 ? "s" : ""} returned & email sent to ${email} (CC: admin@scot.lk, it@scot.lk, hr@scot.lk)`);
                } else if (emailData.notConfigured) {
                  flash(`⚠️ Assets returned, but email not sent: SMTP or RESEND_API_KEY is not configured in Vercel env.`);
                  window.alert(
                    `Assets returned successfully!\n\n⚠️ However, return confirmation email was NOT sent because Email Settings (SMTP or Resend) are not configured in Vercel Environment Variables yet.\n\nTo deliver real emails, please add SMTP_HOST, SMTP_USER, SMTP_PASS or RESEND_API_KEY in your Vercel Project Settings and redeploy.`,
                  );
                } else {
                  flash(`⚠️ Assets returned, but email error: ${emailData.error || "delivery failed"}`);
                }
              } catch (emailErr) {
                console.error("Return email error:", emailErr);
                flash("⚠️ Assets returned, but email API call failed.");
              }
            } else {
              flash(clearance ? "Clearance report ready" : "Return document ready");
            }

            openDocument(clearance ? "Employee Clearance" : "Asset Return", employeeId, assetIds);
          }} />}
          {modal === "repair" && (
            <RepairForm
              assets={assets}
              onSave={async (assetId, action, note) => {
                const asset = assets.find((row) => row.id === assetId);
                if (!asset) return;
                const isAllocated = Boolean(asset.employeeId || asset.allocationType === "department" || asset.allocationType === "location");
                const nextStatus: AssetStatus = action === "start" ? "In repair" : isAllocated ? "Assigned" : "Available";
                const updatedAsset: Asset = { ...asset, status: nextStatus, condition: action === "start" ? "Repair" : "Good", updatedAt: today() };
                const movement: Movement = {
                  id: crypto.randomUUID(),
                  assetId,
                  employeeId: asset.employeeId || "",
                  type: "Repair",
                  date: today(),
                  createdAt: new Date().toISOString(),
                  note: `${action === "start" ? "Sent for repair" : "Repair completed"}: ${note}`,
                };
                await applyAssetMovementBatch([{ asset: updatedAsset, movement }]);
                setModal(null);
                flash(action === "start" ? "Repair record started" : "Repair completion recorded");
              }}
            />
          )}
          {modal === "request" && <RequestForm departments={departments} onSave={async (request) => { setRequests((rows) => [request, ...rows]); await saveRecord("requirements", request); setModal(null); flash("Requirement submitted"); }} />}
          {modal === "document" && <PrintableDocument type={documentType} employees={employees} assets={assets} movements={sortedMovements} assetMap={assetMap} initialEmployeeId={documentEmployeeId} initialAssetIds={documentAssetIds} />}
          {modal === "qrBatch" && <QrBatch assets={assets} employees={employees} departments={departments} locations={locations} employeeMap={employeeMap} />}
          {modal === "schedule" && <ScheduleForm value={requirementWindow} onSave={async (next) => { setRequirementWindow(next); await saveRequirementWindow(next); setModal(null); flash(next.isOpen ? "Requirement form opened" : "Requirement form closed"); }} />}
        </Modal>
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function Dashboard({
  assets,
  employees,
  departments,
  locations,
  requests,
  movements,
  toners,
  employeeMap,
  assetMap,
  onView,
  onOpenPrinters,
  onDownloadZeroStockReport,
  onAddAsset,
  onAssign,
  onReturn,
  onRequest,
  onAsset,
}: {
  assets: Asset[];
  employees: Employee[];
  departments: string[];
  locations: string[];
  requests: RequestRow[];
  movements: Movement[];
  toners: TonerStock[];
  employeeMap: Record<string, Employee>;
  assetMap: Record<string, Asset>;
  onView: (view: View) => void;
  onOpenPrinters: (tab: "Printers" | "Toner Stock") => void;
  onDownloadZeroStockReport: () => void;
  onAddAsset: () => void;
  onAssign: () => void;
  onReturn: () => void;
  onRequest: () => void;
  onAsset: (asset: Asset) => void;
}) {
  const assigned = assets.filter((asset) => effectiveAssetStatus(asset) === "Assigned").length;
  const available = assets.filter((asset) => effectiveAssetStatus(asset) === "Available").length;
  const repairCount = assets.filter((asset) => effectiveAssetStatus(asset) === "In repair").length;
  const zeroToners = toners.filter((toner) => toner.quantity <= 0);
  const lowToners = toners.filter((toner) => toner.quantity <= toner.minStock);

  return (
    <>
      <PageHead eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()} title="Welcome to AssetFlow" description="Your live company asset register is ready. Add employees and assets to begin.">
        <button className="button button-secondary" onClick={onAssign}><ArrowLeftRight size={17} />Assign assets</button>
        <button className="button button-primary" onClick={onAddAsset}><Plus size={17} />Add asset</button>
      </PageHead>
      <div className="metric-grid">
        <Metric icon={Package} label="Total assets" value={assets.length.toString()} change="Live asset register" tone="violet" />
        <Metric icon={Users} label="Assigned" value={assigned.toString()} change={`${assets.length ? Math.round((assigned / assets.length) * 100) : 0}% utilisation`} tone="blue" />
        <Metric icon={ClipboardCheck} label="Available stock" value={available.toString()} change="Ready to assign" tone="green" />
        <Metric icon={Wrench} label="Needs attention" value={repairCount.toString()} change="Items currently in repair" tone="orange" />
      </div>
      {zeroToners.length > 0 ? (
        <div className="zero-stock-banner">
          <div>
            <AlertTriangle size={20} />
            <div>
              <strong>{zeroToners.length} printer toner SKU{zeroToners.length === 1 ? "" : "s"} reached 0 buffer — send requisition to Admin Dept</strong>
              <span>{zeroToners.slice(0, 3).map((t) => `${t.tonerModel} (${t.printerModel} · ${t.color}: 0 left)`).join(" · ")}</span>
            </div>
          </div>
          <div className="page-actions">
            <button className="button button-secondary button-sm" onClick={() => onOpenPrinters("Toner Stock")}><Droplets size={14} />View toners</button>
            <button className="button button-orange button-sm" onClick={onDownloadZeroStockReport}><Download size={14} />Download 0-Stock Report (Admin Dept)</button>
          </div>
        </div>
      ) : lowToners.length > 0 && (
        <div className="toner-alert-banner">
          <div>
            <AlertTriangle size={20} />
            <div>
              <strong>{lowToners.length} printer toner SKU{lowToners.length === 1 ? "" : "s"} running low on buffer stock</strong>
              <span>{lowToners.slice(0, 3).map((t) => `${t.tonerModel} (${t.printerModel}: ${t.quantity} left)`).join(" · ")}</span>
            </div>
          </div>
          <button className="button button-secondary button-sm" onClick={() => onOpenPrinters("Toner Stock")}><Droplets size={14} />Manage toner stock →</button>
        </div>
      )}
      <DepartmentAvailability
        assets={assets}
        employees={employees}
        departments={departments}
        locations={locations}
        toners={toners}
        onViewAssets={() => onView("Assets")}
        onOpenToners={() => onOpenPrinters("Toner Stock")}
        onDownloadZeroStockReport={onDownloadZeroStockReport}
        onAsset={onAsset}
      />
      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <PanelHead title="Recent activity" subtitle="Latest asset movements across the company" action="View all" onClick={() => onView("Movements")} />
          <div className="activity-list">
            {movements.length === 0 && <div className="empty-panel"><History size={20} /><strong>No movements yet</strong><span>Assignments and returns will appear here.</span></div>}
            {movements.slice(0, 5).map((movement) => (
              <div className="activity-row" key={movement.id}>
                <div className={`activity-icon activity-${movement.type.toLowerCase().replaceAll(" ", "-")}`}>{movement.type === "Assigned" ? <ArrowLeftRight size={17} /> : movement.type === "Repair" ? <Wrench size={17} /> : movement.type === "Toner Replacement" ? <Droplets size={17} /> : <RotateCcw size={17} />}</div>
                <div><strong>{assetMap[movement.assetId]?.name}</strong><p>{movement.type} {(movement.employeeName || (movement.employeeId && employeeMap[movement.employeeId]?.name)) && <>· {movement.employeeName || employeeMap[movement.employeeId]?.name}</>}</p></div>
                <time>{new Date(movement.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <PanelHead title="Quick actions" subtitle="Common asset operations" />
          <div className="quick-grid">
            <button onClick={onAssign}><span><ArrowLeftRight size={20} /></span><strong>Assign</strong><small>Issue assets</small></button>
            <button onClick={onReturn}><span><RotateCcw size={20} /></span><strong>Return</strong><small>Receive items</small></button>
            <button onClick={onRequest}><span><CalendarClock size={20} /></span><strong>Request</strong><small>Add requirement</small></button>
            <button onClick={() => onView("Reports")}><span><Download size={20} /></span><strong>Report</strong><small>Export records</small></button>
          </div>
        </section>
      </div>
      <div className="dashboard-grid lower">
        <section className="panel asset-panel">
          <PanelHead title="Recently updated assets" subtitle="Inventory changes from the last 14 days" action="All assets" onClick={() => onView("Assets")} />
          <AssetTable assets={assets.slice(0, 5)} employeeMap={employeeMap} onAsset={onAsset} compact />
        </section>
        <section className="panel request-panel">
          <PanelHead title="Upcoming requirements" subtitle="Department planning submissions" action={`${requests.filter((r) => r.status === "Pending").length} pending`} onClick={() => onView("Requirements")} />
          <div className="request-list">
            {requests.length === 0 && <div className="empty-panel"><CalendarClock size={20} /><strong>No requirements yet</strong><span>Open a collection window when you are ready.</span></div>}
            {requests.slice(0, 4).map((request) => <div key={request.id}><span className="dept-badge">{request.department.split(" ")[0]}</span><div><strong>{request.quantity} × {request.item}</strong><small>{request.department} · Need by {new Date(request.neededDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></div><span className={statusClass(request.status)}>{request.status}</span></div>)}
          </div>
        </section>
      </div>
    </>
  );
}

function DepartmentAvailability({
  assets,
  employees,
  departments,
  locations,
  toners,
  onViewAssets,
  onOpenToners,
  onDownloadZeroStockReport,
  onAsset,
}: {
  assets: Asset[];
  employees: Employee[];
  departments: string[];
  locations: string[];
  toners: TonerStock[];
  onViewAssets: () => void;
  onOpenToners: () => void;
  onDownloadZeroStockReport: () => void;
  onAsset: (asset: Asset) => void;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState("All departments");
  const [selectedType, setSelectedType] = useState("");
  const departmentAssets = assets.filter((asset) => {
    if (selectedDepartment === "All departments") return true;
    const currentDepartment = asset.assignedDepartment || asset.custodianDepartment || asset.location || (asset.status === "Available" ? "Central Stock" : "");
    return currentDepartment === selectedDepartment || asset.location === selectedDepartment;
  });
  const activeEmployees = employees.filter((employee) => employee.status === "Active" && (selectedDepartment === "All departments" || employee.department === selectedDepartment));
  const availableAssets = departmentAssets.filter((asset) => effectiveAssetStatus(asset) === "Available");
  const assignedAssets = departmentAssets.filter((asset) => effectiveAssetStatus(asset) === "Assigned");

  const baseSummary: Record<string, { total: number; available: number }> =
    selectedDepartment === "All departments" || selectedDepartment === "Central Stock"
      ? {
          "Classroom / Location Monitor": { total: 0, available: 0 },
          "Google Chromecast": { total: 0, available: 0 },
          Printer: { total: 0, available: 0 },
        }
      : {};

  const typeSummary = Object.entries(departmentAssets.reduce<Record<string, { total: number; available: number }>>((summary, asset) => {
    const current = summary[asset.type] ?? { total: 0, available: 0 };
    summary[asset.type] = { total: current.total + 1, available: current.available + (effectiveAssetStatus(asset) === "Available" ? 1 : 0) };
    return summary;
  }, baseSummary)).sort(([typeLeft, left], [typeRight, right]) => right.total - left.total || typeLeft.localeCompare(typeRight));

  const departmentPrinters = departmentAssets.filter((asset) => isPrinterAssetType(asset.type));
  const relevantToners =
    selectedDepartment === "All departments" || selectedDepartment === "Central Stock"
      ? toners
      : toners.filter((toner) => departmentPrinters.some((printer) => tonerMatchesPrinter(toner, printer)));
  const totalTonerUnits = relevantToners.reduce((sum, item) => sum + item.quantity, 0);
  const zeroTonerCount = relevantToners.filter((item) => item.quantity <= 0).length;
  const showTonerCard = selectedDepartment === "All departments" || selectedDepartment === "Central Stock" || relevantToners.length > 0;
  const selectedAvailableAssets = availableAssets.filter((asset) => asset.type === selectedType);

  return <section className="panel department-availability">
    <div className="department-availability-head">
      <div><span className="section-kicker">DEPARTMENT &amp; LOCATION OVERVIEW</span><h2>Asset availability summary</h2><p>See employee capacity and the current Chair, Table, Monitor, Printer, Chromecast, Toner and other asset totals for each department or room.</p></div>
      <label>Department / Location<select aria-label="Availability department" value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedType(""); }}><option>All departments</option><option>Central Stock</option><optgroup label="Departments">{departments.map((department) => <option key={department}>{department}</option>)}</optgroup>{groupLocationsByBuilding(locations).map(([building, rooms]) => <optgroup key={building} label={building}>{rooms.map((room) => <option key={room.value} value={room.value}>{room.label}</option>)}</optgroup>)}</select></label>
    </div>
    <div className="department-summary-metrics">
      <div><span><Users size={17} /></span><p>Active employees<strong>{activeEmployees.length}</strong></p></div>
      <div><span><Package size={17} /></span><p>Assets in department<strong>{departmentAssets.length}</strong></p></div>
      <div><span><ClipboardCheck size={17} /></span><p>Available stock<strong>{availableAssets.length}</strong></p></div>
      <div><span><ArrowLeftRight size={17} /></span><p>Currently assigned<strong>{assignedAssets.length}</strong></p></div>
    </div>
    {(typeSummary.length > 0 || showTonerCard) ? (
      <div className="asset-type-summary">
        {typeSummary.map(([type, totals]) => {
          const previewAsset = departmentAssets.find((asset) => asset.type === type && asset.status === "Available") ?? departmentAssets.find((asset) => asset.type === type);
          const preview = previewAsset ? furnitureImageForAsset(previewAsset) : undefined;
          return (
            <button
              type="button"
              className={`${selectedType === type ? "active" : ""}${preview ? " has-preview" : ""}`}
              key={type}
              aria-expanded={selectedType === type}
              aria-controls="available-asset-details"
              onClick={() => setSelectedType((current) => current === type ? "" : type)}
            >
              {preview && <img className="asset-type-preview" src={preview.src} alt="" />}
              <div><strong>{type}</strong><span>{totals.available} available</span></div>
              <b>{totals.total}</b>
              <small>{selectedType === type ? "Hide details" : "View available items"}</small>
            </button>
          );
        })}
        {showTonerCard && (
          <button
            type="button"
            className={`${selectedType === "Toner" ? "active" : ""}${zeroTonerCount > 0 ? " card-zero-highlight" : ""}`}
            key="Toner"
            aria-expanded={selectedType === "Toner"}
            aria-controls="available-asset-details"
            onClick={() => setSelectedType((current) => current === "Toner" ? "" : "Toner")}
          >
            <div>
              <strong>Toner</strong>
              <span>{zeroTonerCount > 0 ? `${zeroTonerCount} at 0 buffer — Reorder!` : `${relevantToners.length} SKU${relevantToners.length === 1 ? "" : "s"} in stock`}</span>
            </div>
            <b>{totalTonerUnits}</b>
            <small>{selectedType === "Toner" ? "Hide details" : zeroTonerCount > 0 ? "0 stock alert — View" : "View toner stock"}</small>
          </button>
        )}
      </div>
    ) : (
      <div className="department-summary-empty"><Package size={20} /><span>No assets are currently recorded for this department.</span></div>
    )}
    {selectedType === "Toner" ? (
      <div className="available-asset-details" id="available-asset-details">
        <div className="available-asset-details-head">
          <div><span>TONER STOCK</span><h3>Toner · {selectedDepartment}</h3></div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {zeroTonerCount > 0 && (
              <button type="button" className="button button-orange button-sm" onClick={onDownloadZeroStockReport}>
                <Download size={13} />Download 0-Stock Report (Admin Dept)
              </button>
            )}
            <strong>{totalTonerUnits} unit{totalTonerUnits === 1 ? "" : "s"}</strong>
          </div>
        </div>
        {relevantToners.length ? (
          <div className="available-asset-list">
            {relevantToners.map((toner) => {
              const st = tonerStockStatus(toner);
              return (
                <button type="button" className={toner.quantity <= 0 ? "toner-row-zero" : ""} key={toner.id} onClick={onOpenToners}>
                  <span className="available-asset-icon"><Droplets size={18} /></span>
                  <span className="available-asset-main">
                    <strong>{toner.tonerModel} ({toner.color})</strong>
                    <small>{toner.printerBrand ? `${toner.printerBrand} · ` : ""}{toner.printerModel}</small>
                  </span>
                  <span className="available-asset-spec">
                    <strong>{toner.quantity} in stock (min {toner.minStock})</strong>
                    <small>{toner.storageLocation || "Central IT Store"}</small>
                  </span>
                  <span className={st === "In stock" ? "available-asset-condition" : "available-asset-condition condition-repair"}>{st}</span>
                  <ExternalLink size={15} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="available-asset-empty">
            <Droplets size={19} />
            <div>
              <strong>No toner stock recorded yet</strong>
              <span>Add toner SKUs by printer model in Printers &amp; Toners to track stock here.</span>
            </div>
          </div>
        )}
      </div>
    ) : selectedType && (
      <div className="available-asset-details" id="available-asset-details">
        <div className="available-asset-details-head"><div><span>AVAILABLE ASSETS</span><h3>{selectedType} · {selectedDepartment}</h3></div><strong>{selectedAvailableAssets.length} item{selectedAvailableAssets.length === 1 ? "" : "s"}</strong></div>
        {selectedAvailableAssets.length ? <div className="available-asset-list">{selectedAvailableAssets.map((asset) => { const furniture = furnitureImageForAsset(asset); const keySpecs = getAssetKeySpecChips(asset); return <button type="button" key={asset.id} onClick={() => onAsset(asset)}><span className={furniture ? "available-asset-icon has-image" : "available-asset-icon"}>{furniture ? <img src={furniture.src} alt="" /> : assetTypeIcon(asset.type, 18)}</span><span className="available-asset-main"><strong>{asset.name}</strong><small>{asset.code} · {asset.category}</small></span><span className="available-asset-spec"><strong>{[asset.brand, asset.model].filter(Boolean).join(" · ") || "Brand / model not recorded"}</strong><small>{keySpecs.length ? keySpecs.join(" · ") : (asset.serial || asset.location || "No serial or location")}</small></span><span className={asset.condition.toLowerCase() === "repair" ? "available-asset-condition condition-repair" : "available-asset-condition"}>{asset.condition}</span><ExternalLink size={15} /></button>; })}</div> : <div className="available-asset-empty"><ClipboardCheck size={19} /><div><strong>No available {selectedType.toLowerCase()} items</strong><span>This department has {typeSummary.find(([type]) => type === selectedType)?.[1].total ?? 0} recorded, but all are currently assigned or otherwise unavailable.</span></div></div>}
      </div>
    )}
    <button className="department-summary-link" onClick={onViewAssets}>Open full asset register →</button>
  </section>;
}

function AssetsView({
  assets,
  toners,
  employeeMap,
  category,
  setCategory,
  typeFilter,
  setTypeFilter,
  departments,
  locations,
  onAdd,
  onAsset,
  onExport,
  onQrBatch,
  onOpenToners,
  onAddToner,
  onTonerStockAction,
}: {
  assets: Asset[];
  toners: TonerStock[];
  employeeMap: Record<string, Employee>;
  category: string;
  setCategory: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  departments: string[];
  locations: string[];
  onAdd: (defaultType?: string) => void;
  onAsset: (asset: Asset) => void;
  onExport: (filtered: Asset[]) => void;
  onQrBatch: () => void;
  onOpenToners: () => void;
  onAddToner: (preset?: { model: string; brand?: string; compatibleToner?: string }) => void;
  onTonerStockAction: (toner: TonerStock, mode: "Restock" | "Issued", printerId?: string) => void;
}) {
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const filtered = assets.filter((asset) => {
    if (typeFilter !== "All" && asset.type !== typeFilter) return false;
    if (departmentFilter !== "All") {
      const dep = asset.employeeId
        ? employeeMap[asset.employeeId]?.department
        : (asset.assignedDepartment || asset.custodianDepartment || asset.location);
      if (dep !== departmentFilter && asset.location !== departmentFilter) return false;
    }
    return true;
  });

  const quickItTypes = [
    { value: "All", label: "All items" },
    { value: "Laptop", label: "Laptops" },
    { value: "Monitor", label: "Staff Monitors" },
    { value: "Classroom / Location Monitor", label: "Classroom / Location Monitors" },
    { value: "Google Chromecast", label: "Google Chromecast" },
    { value: "Printer", label: "Printers" },
  ];

  const allFilterOptions = useMemo(() => {
    const typeSet = new Set<string>(assets.map((a) => a.type));
    ASSET_TYPES["IT Asset"].forEach((t) => typeSet.add(t));
    ASSET_TYPES["Non-IT Asset"].forEach((t) => typeSet.add(t));
    return Array.from(typeSet).sort();
  }, [assets]);

  return (
    <>
      <PageHead eyebrow="INVENTORY" title="Assets" description="Track every IT and non-IT item, laptop cores, location allocations, printers, and complete history.">
        <button className="button button-secondary" onClick={onQrBatch}><QrCode size={17} />Print QR labels</button>
        <button className="button button-secondary" onClick={() => onExport(filtered)}><Download size={17} />Export</button>
        <button className="button button-primary" onClick={() => onAdd(typeFilter !== "All" ? typeFilter : undefined)}><Plus size={17} />Add asset</button>
      </PageHead>
      <div className="filter-tabs">
        {["All", "IT Asset", "Non-IT Asset"].map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => { setCategory(item); setTypeFilter("All"); }}>{item}<span>{item === "All" ? assets.length : assets.filter((asset) => asset.category === item).length}</span></button>)}

        <select
          className="select-filter"
          style={{ marginLeft: "auto" }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All Types</option>
          {allFilterOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          className="select-filter"
          style={{ marginLeft: "8px" }}
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="All">All Departments &amp; Locations</option>
          <optgroup label="Departments">
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </optgroup>
          {groupLocationsByBuilding(locations).map(([building, rooms]) => (
            <optgroup key={building} label={building}>
              {rooms.map((room) => <option key={room.value} value={room.value}>{room.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {category !== "Non-IT Asset" && (
        <div className="quick-filter-pills">
          {quickItTypes.map((pill) => {
            const count = pill.value === "All" ? assets.length : assets.filter((a) => a.type === pill.value).length;
            return (
              <button
                key={pill.value}
                type="button"
                className={typeFilter === pill.value ? "active" : ""}
                onClick={() => setTypeFilter(pill.value)}
              >
                {pill.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <section className="panel table-panel">
        <div className="table-toolbar"><div><strong>Asset register</strong><small>{filtered.length} matching records</small></div><div className="legend"><span><i className="dot green" />Available</span><span><i className="dot blue" />Assigned / Allocated</span><span><i className="dot orange" />Repair</span></div></div>
        <AssetTable assets={filtered} employeeMap={employeeMap} onAsset={onAsset} />
      </section>

      {typeFilter === "Printer" && (
        <section className="panel printer-toner-subsection">
          <div className="printer-toner-subsection-head">
            <div>
              <span className="section-kicker">PRINTER SUBSECTION</span>
              <h3>Toner Stock by Printer Model</h3>
              <p>Maintain compatible toner inventory for your registered printers.</p>
            </div>
            <div className="page-actions">
              <button className="button button-secondary button-sm" onClick={() => onAddToner()}>
                <Plus size={14} />Add toner SKU
              </button>
              <button className="button button-primary button-sm" onClick={onOpenToners}>
                <Droplets size={14} />Open full Toner Manager →
              </button>
            </div>
          </div>
          {toners.length === 0 ? (
            <div className="empty-panel">
              <Droplets size={20} />
              <strong>No toner stock items recorded yet</strong>
              <span>Add toner SKUs mapped to your printer models to track stock and issue cartridges.</span>
            </div>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Printer model</th>
                    <th>Toner model</th>
                    <th>Color</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {toners.map((toner) => {
                    const st = tonerStockStatus(toner);
                    return (
                      <tr key={toner.id}>
                        <td><strong>{toner.printerBrand ? `${toner.printerBrand} ` : ""}{toner.printerModel}</strong></td>
                        <td>{toner.tonerModel}</td>
                        <td>{toner.color}</td>
                        <td><strong>{toner.quantity}</strong> <span className="muted">(min {toner.minStock})</span></td>
                        <td><span className={statusClass(st)}>{st}</span></td>
                        <td>
                          <div className="toner-actions">
                            <button type="button" className="button button-secondary button-sm" onClick={() => onTonerStockAction(toner, "Restock")}>+ Restock</button>
                            <button type="button" className="button button-primary button-sm" disabled={toner.quantity <= 0} onClick={() => onTonerStockAction(toner, "Issued")}>Issue</button>
                          </div>
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
    </>
  );
}

function EmployeesView({
  employees,
  allEmployees,
  assets,
  department,
  setDepartment,
  departments,
  onAdd,
  onEdit,
  onDelete,
  onMergeDuplicate,
  onDocument,
}: {
  employees: Employee[];
  allEmployees: Employee[];
  assets: Asset[];
  department: string;
  setDepartment: (value: string) => void;
  departments: string[];
  onAdd: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onMergeDuplicate: (keep: Employee, duplicate: Employee) => void;
  onDocument: (type: string, employeeId?: string, assetIds?: string[]) => void;
}) {
  const duplicateGroups = useMemo(() => {
    const byEmpNo = new Map<string, Employee[]>();
    for (const emp of allEmployees) {
      const normalizedNo = emp.empNo.trim().toLowerCase().replace(/^emp[-_\s]*/i, "").replace(/^0+(?=\d)/, "");
      const key = normalizedNo ? `empno:${normalizedNo}` : `name:${emp.name.trim().toLowerCase()}|${emp.department.trim().toLowerCase()}`;
      const list = byEmpNo.get(key) ?? [];
      list.push(emp);
      byEmpNo.set(key, list);
    }
    return Array.from(byEmpNo.values())
      .filter((group) => group.length > 1)
      .map((group) => {
        const sorted = [...group].sort((a, b) => {
          const aCount = assets.filter((asset) => asset.employeeId === a.id).length;
          const bCount = assets.filter((asset) => asset.employeeId === b.id).length;
          if (bCount !== aCount) return bCount - aCount;
          if (a.status === "Active" && b.status !== "Active") return -1;
          if (b.status === "Active" && a.status !== "Active") return 1;
          return a.id.localeCompare(b.id);
        });
        return sorted;
      });
  }, [allEmployees, assets]);

  const duplicateEmployeeIds = useMemo(
    () => new Set(duplicateGroups.flat().map((emp) => emp.id)),
    [duplicateGroups],
  );

  return (
    <>
      <PageHead eyebrow="PEOPLE" title="Employees" description="See every employee and the full set of assets under their responsibility.">
        <button className="button button-secondary" onClick={() => onDocument("Employee Asset Summary")}><Printer size={17} />Print summary</button>
        <button className="button button-primary" onClick={onAdd}><Plus size={17} />Add employee</button>
      </PageHead>

      {duplicateGroups.length > 0 && (
        <section className="duplicate-employees-banner" role="alert">
          <div className="duplicate-banner-head">
            <AlertTriangle size={20} />
            <div>
              <strong>Duplicate employees detected ({duplicateGroups.length} duplicate Emp No{duplicateGroups.length === 1 ? "" : "s"})</strong>
              <span>Keep one primary record and safely merge any assigned assets &amp; history before removing the duplicate.</span>
            </div>
          </div>
          <div className="duplicate-groups-list">
            {duplicateGroups.map((group) => {
              const primary = group[0];
              const duplicates = group.slice(1);
              return (
                <div className="duplicate-group-row" key={group.map((g) => g.id).join("-")}>
                  <div className="duplicate-group-meta">
                    <div>
                      <strong>{primary.name} · Emp No {primary.empNo} ({primary.department})</strong>
                      <div><small>{group.length} matching records found</small></div>
                    </div>
                    <button
                      type="button"
                      className="button button-orange button-sm"
                      onClick={() => onMergeDuplicate(primary, duplicates[0])}
                    >
                      <Trash2 size={14} />Keep &amp; remove duplicate
                    </button>
                  </div>
                  <div className="duplicate-records-grid">
                    {group.map((entry, idx) => {
                      const entryOwned = assets.filter((asset) => asset.employeeId === entry.id).length;
                      return (
                        <div className="duplicate-record-chip" key={entry.id}>
                          <div>
                            <strong>{entry.name} {idx === 0 ? "(Primary)" : "(Duplicate)"}</strong>
                            <small>{entry.empNo} · {entry.department} · {entry.email || "No email"} · {entryOwned} asset{entryOwned === 1 ? "" : "s"}</small>
                          </div>
                          {idx > 0 && (
                            <button
                              type="button"
                              className="button button-secondary button-sm"
                              onClick={() => onMergeDuplicate(primary, entry)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="select-row"><label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><span>{employees.length} employee{employees.length === 1 ? "" : "s"} shown</span></div>
      <div className="employee-grid">
        {employees.map((employee) => {
          const owned = assets.filter((asset) => asset.employeeId === employee.id);
          const isDuplicate = duplicateEmployeeIds.has(employee.id);
          return (
            <article className={isDuplicate ? "employee-card employee-card-duplicate" : "employee-card"} key={employee.id}>
              <div className="employee-head">
                <span className="avatar">{initials(employee.name)}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isDuplicate && <span className="duplicate-pill"><AlertTriangle size={11} />Duplicate</span>}
                  <span className={statusClass(employee.status)}>{employee.status}</span>
                </div>
              </div>
              <h3>{employee.name}</h3>
              <p>{employee.designation}</p>
              <small>{employee.empNo} · {employee.department}</small>
              <div className="asset-chip-row">{owned.length ? owned.slice(0, 3).map((asset) => <span key={asset.id}>{asset.type}</span>) : <em>No assets assigned</em>}{owned.length > 3 && <span>+{owned.length - 3}</span>}</div>
              <div className="employee-foot">
                <strong>{owned.length} asset{owned.length !== 1 ? "s" : ""}</strong>
                <div>
                  <button type="button" onClick={() => onEdit(employee)}><Pencil size={13} /> Edit</button>
                  <button
                    type="button"
                    className="employee-delete-btn"
                    disabled={owned.length > 0}
                    title={owned.length > 0 ? "Return assigned assets or use Merge Duplicate above first" : "Remove employee"}
                    onClick={() => onDelete(employee)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                  <button type="button" onClick={() => onDocument("Asset Handover", employee.id, owned.map((asset) => asset.id))}>Document →</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function MovementsView({ movements, assetMap, employeeMap, onAssign, onReturn, onRepair }: { movements: Movement[]; assetMap: Record<string, Asset>; employeeMap: Record<string, Employee>; onAssign: () => void; onReturn: () => void; onRepair: () => void }) {
  return (
    <>
      <PageHead eyebrow="AUDIT TRAIL" title="Asset movements" description="Every assignment, return, clearance and repair is permanently recorded.">
        <button className="button button-secondary" onClick={onRepair}><Wrench size={17} />Record repair</button><button className="button button-secondary" onClick={onReturn}><RotateCcw size={17} />Record return</button><button className="button button-primary" onClick={onAssign}><ArrowLeftRight size={17} />New assignment</button>
      </PageHead>
      <section className="panel timeline-panel">
        <div className="table-toolbar"><div><strong>Complete history</strong><small>Newest activity first</small></div><span className="audit-badge"><ShieldCheck size={15} />Audit-ready records</span></div>
        <div className="timeline">{movements.length === 0 && <div className="empty-panel"><History size={20} /><strong>No lifecycle records yet</strong><span>Assignments, returns, clearance, repairs and toner replacements will appear here.</span></div>}{movements.map((movement) => <div key={movement.id} className="timeline-row"><div className={`timeline-mark activity-${movement.type.toLowerCase().replaceAll(" ", "-")}`}>{movement.type === "Assigned" ? <ArrowLeftRight size={17} /> : movement.type === "Repair" ? <Wrench size={17} /> : movement.type === "Toner Replacement" ? <Droplets size={17} /> : <RotateCcw size={17} />}</div><div><div className="timeline-title"><strong>{movement.type}</strong><span>{new Date(movement.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div><h3>{assetMap[movement.assetId]?.name} <small>{assetMap[movement.assetId]?.code}</small></h3><p>{movement.note}</p><span className="person-pill">{initials(movement.employeeName || employeeMap[movement.employeeId]?.name || "AA")} {movement.employeeName || employeeMap[movement.employeeId]?.name || "Asset Administration"}</span></div></div>)}</div>
      </section>
    </>
  );
}

function RequirementsView({ requests, setRequests, windowConfig, setWindowConfig, onSchedule, onAdd, onExport, onFlash }: { requests: RequestRow[]; setRequests: React.Dispatch<React.SetStateAction<RequestRow[]>>; windowConfig: RequirementWindowRecord; setWindowConfig: (value: RequirementWindowRecord) => void; onSchedule: () => void; onAdd: () => void; onExport: () => void; onFlash: (msg: string) => void }) {
  const formUrl = typeof window === "undefined" ? "" : `${window.location.origin}/requirements/${windowConfig.slug}`;
  async function copyFormLink() {
    try {
      await navigator.clipboard.writeText(formUrl);
      onFlash("Requirement form link copied to clipboard");
    } catch {
      onFlash(`Shareable URL: ${formUrl}`);
    }
  }
  return (
    <>
      <PageHead eyebrow="PLANNING WINDOW" title="Department requirements" description="Collect upcoming two-month needs in one controlled submission window.">
        <button className="button button-secondary" onClick={onExport}><Download size={17} />Export summary</button><button className="button button-primary" onClick={onSchedule}><CalendarClock size={17} />Manage window</button>
      </PageHead>
      <div className={windowConfig.isOpen ? "window-banner" : "window-banner window-closed"}><div className="window-icon"><CalendarClock size={24} /></div><div><span>{windowConfig.isOpen ? "SUBMISSION WINDOW OPEN" : "SUBMISSIONS CLOSED"}</span><h3>{windowConfig.title}</h3><p>{windowConfig.periodLabel} · {new Date(windowConfig.opensAt).toLocaleDateString("en-GB")} to {new Date(windowConfig.closesAt).toLocaleString("en-GB")}</p></div><div className="window-actions"><button onClick={copyFormLink}><Copy size={15} />Copy form link</button><a href={`mailto:?subject=${encodeURIComponent(windowConfig.title)}&body=${encodeURIComponent(`Please submit your department requirements using this link:\n\n${formUrl}\n\nDeadline: ${new Date(windowConfig.closesAt).toLocaleString("en-GB")}`)}`}><Mail size={15} />Email link</a><a href={formUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Preview</a></div></div>
      <div className="requirement-admin-actions"><button className="button button-secondary" onClick={onAdd}><Plus size={16} />Add on behalf of department</button><button className="button button-secondary" onClick={async () => { const next = { ...windowConfig, isOpen: !windowConfig.isOpen }; setWindowConfig(next); await saveRequirementWindow(next); }}>{windowConfig.isOpen ? <X size={16} /> : <Check size={16} />}{windowConfig.isOpen ? "Close form now" : "Open form now"}</button><span>Shareable URL: <code>{formUrl}</code></span></div>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><strong>Submitted requirements</strong><small>{requests.reduce((sum, row) => sum + row.quantity, 0)} total items requested</small></div><span className="audit-badge">{requests.length} submissions</span></div>
        <div className="responsive-table"><table><thead><tr><th>Department</th><th>Requirement</th><th>Qty</th><th>Needed by</th><th>Reason</th><th>Status</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.department}</strong></td><td>{request.item}</td><td><span className="qty">{request.quantity}</span></td><td>{new Date(request.neededDate).toLocaleDateString("en-GB")}</td><td className="reason-cell">{request.reason}</td><td><select className={statusClass(request.status)} value={request.status} onChange={async (event) => { const next = { ...request, status: event.target.value as RequestRow["status"] }; setRequests((rows) => rows.map((row) => row.id === request.id ? next : row)); await saveRecord("requirements", next); }}><option>Pending</option><option>Approved</option><option>Declined</option></select></td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}

type StructuredReportId = "laptops" | "monitors" | "headsets" | "mouses" | "employeeIt" | "printersToners";

function ReportsView({
  assets,
  employees,
  employeeMap,
  toners,
  tonerTransactions,
  requests,
  onExport,
  onDocument,
  onDownloadZeroStockReport,
  onDownloadStructuredReport,
}: {
  assets: Asset[];
  employees: Employee[];
  employeeMap: Record<string, Employee>;
  toners: TonerStock[];
  tonerTransactions: TonerTransaction[];
  requests: RequestRow[];
  onExport: () => void;
  onDocument: (type: string) => void;
  onDownloadZeroStockReport: () => void;
  onDownloadStructuredReport: (id: StructuredReportId) => Promise<void>;
}) {
  const [downloading, setDownloading] = useState<string>("");
  const zeroTonerCount = toners.filter((t) => t.quantity <= 0).length;

  const laptopCount = assets.filter((a) => a.type === "Laptop").length;
  const staffMonitorCount = assets.filter((a) => a.type === "Monitor").length;
  const locationMonitorCount = assets.filter((a) => a.type === "Classroom / Location Monitor").length;
  const headsetCount = assets.filter((a) => a.type === "Headset").length;
  const mouseCount = assets.filter((a) => a.type === "Mouse").length;
  const itAssignedCount = assets.filter((a) => a.category === "IT Asset" && Boolean(a.employeeId && employeeMap[a.employeeId])).length;
  const printerCount = assets.filter((a) => a.type === "Printer").length;
  const tonerUnits = toners.reduce((sum, t) => sum + t.quantity, 0);

  const structuredReports: {
    id: StructuredReportId;
    badge: string;
    icon: typeof Laptop;
    title: string;
    count: string;
    copy: string;
    columns: string;
    tone: string;
  }[] = [
    {
      id: "laptops",
      badge: "REPORT 01",
      icon: Laptop,
      title: "All Staff Laptops",
      count: `${laptopCount} laptop${laptopCount === 1 ? "" : "s"}`,
      copy: "Sorted A–Z by Department with processor, P-Cores, E-Cores, RAM, storage & verification status.",
      columns: "Emp No · Name · Department · Asset Name · Model · Serial · Processor · P-Cores · E-Cores · Verified (Yes/No)",
      tone: "violet",
    },
    {
      id: "monitors",
      badge: "REPORT 02",
      icon: Monitor,
      title: "All Staff Monitors",
      count: `${staffMonitorCount} staff · ${locationMonitorCount} classroom`,
      copy: "Sorted A–Z by Department, plus a separate sheet for Classroom & Location Monitors by Building.",
      columns: "Emp No · Name · Department · Asset Name · Model · Serial · Screen Size · Resolution · Connection · Verified",
      tone: "blue",
    },
    {
      id: "headsets",
      badge: "REPORT 03",
      icon: Headphones,
      title: "All Staff Headsets",
      count: `${headsetCount} headset${headsetCount === 1 ? "" : "s"}`,
      copy: "Sorted A–Z by Department with brand, model, serial, connection type, and Department Summary sheet.",
      columns: "Emp No · Name · Department · Asset Name · Brand · Model · Serial · Connection Type · Status · Verified",
      tone: "pink",
    },
    {
      id: "mouses",
      badge: "REPORT 04",
      icon: Mouse,
      title: "All Staff Mouses",
      count: `${mouseCount} mouse${mouseCount === 1 ? "" : "s"}`,
      copy: "Sorted A–Z by Department with brand, model, serial, connection type, and Department Summary sheet.",
      columns: "Emp No · Name · Department · Asset Name · Brand · Model · Serial · Connection Type · Status · Verified",
      tone: "green",
    },
    {
      id: "employeeIt",
      badge: "REPORT 05",
      icon: Users,
      title: "Employee IT Assets Details",
      count: `${employees.length} staff · ${itAssignedCount} assigned IT`,
      copy: "Complete staff-by-staff IT summary + itemized IT list (A–Z by Department) + Classroom/Chromecast sheet.",
      columns: "Emp No · Name · Department · Laptop & Specs · Monitor · Mouse · Headset · Other IT · Verified",
      tone: "orange",
    },
    {
      id: "printersToners",
      badge: "REPORT 06",
      icon: Printer,
      title: "Printer & Toner Details",
      count: `${printerCount} printers · ${toners.length} toner SKUs (${tonerUnits} units · ${tonerTransactions.length} logs)`,
      copy: "3 formatted sheets: Printers Register (A–Z Dept), Toner Stock by Printer Model, and Issue/Restock History.",
      columns: "Department · Assigned To · Printer Model · Serial · Compatible Toner · Stock Balance · History",
      tone: "slate",
    },
  ];

  const cards = [
    { icon: FileSpreadsheet, title: "Current asset register", copy: `${assets.length} assets with current owners, departments and condition`, action: "Export Excel", click: onExport, tone: "green" },
    { icon: Users, title: "Employee asset summary", copy: `${employees.length} employees with every item currently assigned`, action: "Generate PDF", click: () => onDocument("Employee Asset Summary"), tone: "blue" },
    { icon: ArrowLeftRight, title: "Handover document", copy: "Formal issue sheet with item details and signature spaces", action: "Create document", click: () => onDocument("Asset Handover"), tone: "violet" },
    { icon: ClipboardCheck, title: "Clearance report", copy: "Selected returned items and final employee clearance statement", action: "Create clearance", click: () => onDocument("Employee Clearance"), tone: "orange" },
    { icon: CalendarClock, title: "Requirement forecast", copy: `${requests.length} requests grouped by department and needed date`, action: "Export forecast", click: onExport, tone: "pink" },
    { icon: History, title: "Asset movement history", copy: "Auditable assignment, return and repair trail", action: "Generate PDF", click: () => onDocument("Movement History"), tone: "slate" },
  ];

  return (
    <>
      <PageHead eyebrow="DOCUMENT CENTRE" title="Reports & documents" description="Download cleanly formatted Excel reports sorted A–Z by Department, or generate official PDF handover and clearance documents.">
        <button className={zeroTonerCount > 0 ? "button button-orange" : "button button-secondary"} onClick={onDownloadZeroStockReport}>
          <AlertTriangle size={16} />0-Stock Toner Requisition ({zeroTonerCount})
        </button>
        <button className="button button-secondary" onClick={onExport}><Download size={17} />Export master register</button>
      </PageHead>

      <section className="report-section-block">
        <div className="report-section-head">
          <div>
            <span className="section-kicker">FORMATTED EXCEL REPORTS (A–Z BY DEPARTMENT)</span>
            <h2>Structured IT &amp; Inventory Reports</h2>
            <p>Each report downloads as a styled Excel workbook with titled headers, borders, auto-fitted columns, status highlights, frozen header rows, and department summaries.</p>
          </div>
        </div>
        <div className="report-grid">
          {structuredReports.map(({ id, badge, icon: Icon, title, count, copy, columns, tone }) => (
            <article className="report-card structured-report-card" key={id}>
              <div className="structured-report-top">
                <span className={`report-icon ${tone}`}><Icon size={22} /></span>
                <div className="structured-report-meta">
                  <span className="report-badge-tag">{badge}</span>
                  <small>{count}</small>
                </div>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <div className="report-columns-preview">
                <strong>Columns included:</strong>
                <span>{columns}</span>
              </div>
              <button
                type="button"
                className="structured-download-btn"
                disabled={downloading === id}
                onClick={async () => {
                  setDownloading(id);
                  try {
                    await onDownloadStructuredReport(id);
                  } finally {
                    setDownloading("");
                  }
                }}
              >
                {downloading === id ? "Preparing Excel…" : "Download styled Excel"}
                <ArrowDownToLine size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="report-section-block" style={{ marginTop: "26px" }}>
        <div className="report-section-head">
          <div>
            <span className="section-kicker">OFFICIAL FORMS &amp; MASTER EXPORTS</span>
            <h2>Handover, Clearance &amp; General Documents</h2>
            <p>Printable handover receipts, clearance certificates, and full multi-sheet register backups.</p>
          </div>
        </div>
        <div className="report-grid">
          {cards.map(({ icon: Icon, title, copy, action, click, tone }) => (
            <article className="report-card" key={title}>
              <span className={`report-icon ${tone}`}><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <button onClick={click}>{action}<ArrowDownToLine size={16} /></button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function AssetTable({ assets, employeeMap, onAsset, compact = false }: { assets: Asset[]; employeeMap: Record<string, Employee>; onAsset: (asset: Asset) => void; compact?: boolean }) {
  return (
    <div className="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Category / Type</th>
            {!compact && <th>Serial / location</th>}
            <th>Assigned to</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const furniture = furnitureImageForAsset(asset);
            const specChips = getAssetKeySpecChips(asset);
            const isLocationAlloc = (asset.allocationType === "location" || isLocationOnlyAssetType(asset.type)) && Boolean(asset.location) && asset.location !== "Central Stock";
            const isDeptAlloc = asset.allocationType === "department" && Boolean(asset.assignedDepartment);
            return (
              <tr key={asset.id} onClick={() => onAsset(asset)}>
                <td>
                  <div className="asset-cell">
                    <span className={furniture ? "asset-list-image" : ""}>
                      {furniture ? <img src={furniture.src} alt="" /> : assetTypeIcon(asset.type, 18)}
                    </span>
                    <div>
                      <strong>{asset.name}</strong>
                      <small>{asset.code}{asset.model ? ` · ${asset.model}` : ""}</small>
                      {specChips.length > 0 && (
                        <div className="spec-chip-row">
                          {specChips.slice(0, compact ? 2 : 4).map((chip) => (
                            <span className="spec-chip" key={chip}>{chip}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="category-label">{asset.type}</span>
                  <div className="muted" style={{ fontSize: "7.5px", marginTop: "2px" }}>{asset.category}</div>
                </td>
                {!compact && (
                  <td>
                    <code>{asset.serial || asset.location || "—"}</code>
                    {asset.serial && asset.location && (
                      <div className="sub-location"><MapPin size={11} />{asset.location}</div>
                    )}
                  </td>
                )}
                <td>
                  {asset.employeeId ? (
                    <div className="mini-person">
                      <span>{initials(employeeMap[asset.employeeId]?.name || "")}</span>
                      <div>
                        <strong>{employeeMap[asset.employeeId]?.name}</strong>
                        <small>{employeeMap[asset.employeeId]?.department}</small>
                      </div>
                    </div>
                  ) : isDeptAlloc ? (
                    <div className="dept-assign-badge">
                      <span><Building2 size={13} /></span>
                      <div>
                        <strong>{asset.assignedDepartment}</strong>
                        <small>Department assigned</small>
                      </div>
                    </div>
                  ) : isLocationAlloc ? (
                    <div className="location-badge">
                      <span><MapPin size={13} /></span>
                      <div>
                        <strong>{asset.location}</strong>
                        <small>Classroom / Location</small>
                      </div>
                    </div>
                  ) : (
                    <span className="muted">{asset.category === "Non-IT Asset" ? asset.location || "—" : "—"}</span>
                  )}
                </td>
                <td>
                  <span className={statusClass(effectiveAssetStatus(asset))}>
                    {effectiveAssetStatus(asset)}
                  </span>
                </td>
                <td><button className="row-action" aria-label={`View ${asset.name}`}>→</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssetDrawer({
  asset,
  employee,
  movements,
  employeeMap,
  toners,
  onClose,
  onEdit,
  onToggleVerified,
  onDelete,
  onAddToner,
  onTonerStockAction,
}: {
  asset: Asset;
  employee?: Employee;
  movements: Movement[];
  employeeMap: Record<string, Employee>;
  toners: TonerStock[];
  onClose: () => void;
  onEdit: () => void;
  onToggleVerified: () => void;
  onDelete: () => void;
  onAddToner: (preset: { model: string; brand?: string; compatibleToner?: string }) => void;
  onTonerStockAction: (toner: TonerStock, mode: "Restock" | "Issued", printerId?: string) => void;
}) {
  const [qr, setQr] = useState("");
  const furniture = furnitureImageForAsset(asset);
  const isLocationAlloc = (asset.allocationType === "location" || isLocationOnlyAssetType(asset.type)) && Boolean(asset.location) && asset.location !== "Central Stock";
  const isDeptAlloc = asset.allocationType === "department" && Boolean(asset.assignedDepartment);
  const matchedToners = isPrinterAssetType(asset.type)
    ? toners.filter((t) => tonerMatchesPrinter(t, asset))
    : [];

  useEffect(() => { QRCode.toDataURL(`${window.location.origin}/asset/${asset.id}`, { width: 240, margin: 1, color: { dark: "#111827", light: "#ffffff" } }).then(setQr); }, [asset.id]);
  return (
    <>
      <button className="drawer-backdrop" aria-label="Close asset details" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div><span>{asset.code}</span><h2>{asset.name}</h2></div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="drawer-body">
          <div className="drawer-actions">
            <button className="button button-secondary" onClick={onEdit}><Pencil size={15} />Edit asset</button>
            <button
              className={asset.verified ? "button button-verified" : "button button-secondary"}
              onClick={onToggleVerified}
              title="Toggle physical asset verification status for audit reports"
            >
              <CheckCircle2 size={15} />{asset.verified ? "Verified: Yes" : "Verify asset"}
            </button>
            <button className="button button-danger" onClick={onDelete}><X size={15} />Delete asset</button>
          </div>
          <div className={furniture ? "asset-hero furniture-hero" : "asset-hero"}>
            {furniture ? <img src={furniture.src} alt={`${furniture.label} ${furniture.model}`} /> : <span className="asset-big-icon">{assetTypeIcon(asset.type, 34)}</span>}
            <div>
              <span className={statusClass(effectiveAssetStatus(asset))}>
                {effectiveAssetStatus(asset)}
              </span>
              <p>{asset.brand} · {asset.model}</p>
            </div>
          </div>
          <section className="detail-section">
            <h3>Asset details</h3>
            <div className="detail-grid">
              {asset.category === "IT Asset" ? <label>Serial number<strong>{asset.serial || "Not recorded"}</strong></label> : <label>Current location<strong>{asset.location || asset.custodianDepartment || "Not recorded"}</strong></label>}
              {asset.category === "IT Asset" && asset.location && <label>Classroom / Location<strong>{asset.location}</strong></label>}
              {asset.assignedDepartment && <label>Assigned department<strong>{asset.assignedDepartment}</strong></label>}
              <label>Condition<strong>{asset.condition}</strong></label>
              <label>Asset verified<strong>{asset.verified ? "Yes" : "No"}</strong></label>
              <label>Category<strong>{asset.category}</strong></label>
              <label>Type<strong>{asset.type}</strong></label>
              {Object.entries(asset.specs ?? {}).filter(([, value]) => value).map(([key, value]) => (
                <label key={key}>{specLabel(key)}<strong>{value}</strong></label>
              ))}
            </div>
            <p className="spec-box">{asset.details || "No additional notes recorded."}</p>
          </section>
          <section className="detail-section">
            <h3>Current custodian / allocation</h3>
            {employee ? (
              <div className="owner-card">
                <span>{initials(employee.name)}</span>
                <div>
                  <strong>{employee.name}</strong>
                  <small>{employee.empNo} · {employee.department}</small>
                  <a href={`mailto:${employee.email}`}>{employee.email}</a>
                </div>
              </div>
            ) : isDeptAlloc ? (
              <div className="owner-card">
                <span><Building2 size={18} /></span>
                <div>
                  <strong>{asset.assignedDepartment}</strong>
                  <small>Department-assigned printer{asset.location ? ` · ${asset.location}` : ""}</small>
                </div>
              </div>
            ) : isLocationAlloc ? (
              <div className="owner-card">
                <span><MapPin size={18} /></span>
                <div>
                  <strong>{asset.location}</strong>
                  <small>Allocated to classroom / location (not assigned to a person)</small>
                </div>
              </div>
            ) : (
              <div className="empty-owner"><Package size={21} />Available at {asset.location || "central stock"}</div>
            )}
          </section>

          {isPrinterAssetType(asset.type) && (
            <section className="detail-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "11px" }}>
                <h3 style={{ margin: 0 }}>Compatible toner stock (Subsection)</h3>
                <button
                  type="button"
                  className="inline-link-btn"
                  onClick={() => onAddToner({ model: asset.model, brand: asset.brand, compatibleToner: asset.specs?.compatibleToner })}
                >
                  + Add toner
                </button>
              </div>
              {matchedToners.length > 0 ? (
                <div className="toner-drawer-list">
                  {matchedToners.map((toner) => {
                    const st = tonerStockStatus(toner);
                    return (
                      <div className={toner.quantity <= 0 ? "toner-drawer-row toner-drawer-row-zero" : "toner-drawer-row"} key={toner.id}>
                        <div>
                          <strong>{toner.tonerModel} ({toner.color})</strong>
                          <small>{toner.quantity} in stock · min {toner.minStock}{toner.quantity <= 0 ? " · 0 BUFFER" : ""}</small>
                        </div>
                        <div>
                          <span className={statusClass(st)}>{st}</span>
                          <button
                            type="button"
                            className="button button-secondary button-sm"
                            onClick={() => onTonerStockAction(toner, toner.quantity > 0 ? "Issued" : "Restock", asset.id)}
                          >
                            {toner.quantity > 0 ? "Replace / Issue" : "Restock"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-owner">
                  <Droplets size={18} />
                  <span>No toner stock linked to {asset.model || "this printer model"} yet.</span>
                </div>
              )}
            </section>
          )}

          <section className="detail-section qr-section">
            <div><h3>Live QR label</h3><p>Print and attach this code. Scanning always opens the latest asset record.</p><button className="button button-secondary" onClick={() => window.print()}><Printer size={16} />Print label</button></div>
            {qr && <img src={qr} alt={`QR code for ${asset.code}`} />}
          </section>
          <section className="detail-section">
            <h3>History</h3>
            <div className="mini-history">{movements.length ? movements.map((movement) => <div key={movement.id}><i /><div><strong>{movement.type}</strong><p>{movement.employeeName || employeeMap[movement.employeeId]?.name || "Asset Administration"} · {movement.note}</p><small>{new Date(movement.date).toLocaleDateString("en-GB")}</small></div></div>) : <p className="muted">No previous movements.</p>}</div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop"><section className={wide ? "modal modal-wide" : "modal"}><div className="modal-head"><div><span>ASSETFLOW</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="modal-body">{children}</div></section></div>;
}

function AssetForm({
  departments,
  locations,
  employees,
  toners = [],
  onSave,
  initial,
  defaultType,
}: {
  departments: string[];
  locations: string[];
  employees: Employee[];
  toners?: TonerStock[];
  onSave: (asset: Asset) => void;
  initial?: Asset;
  defaultType?: string;
}) {
  const initialType = initial?.type ?? defaultType ?? "Laptop";
  const initialCategory: "IT Asset" | "Non-IT Asset" = initial?.category ?? (
    (ASSET_TYPES["Non-IT Asset"] as readonly string[]).includes(initialType) && !(ASSET_TYPES["IT Asset"] as readonly string[]).includes(initialType)
      ? "Non-IT Asset"
      : "IT Asset"
  );
  const initialLocationList = Array.from(new Set([...locations, ...departments]));
  const initialIsCustomLocation = Boolean(
    initial?.location &&
    initial.location !== "Central Stock" &&
    !initialLocationList.includes(initial.location),
  );

  const [form, setForm] = useState({
    category: initialCategory,
    type: initialType,
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    serial: initial?.serial ?? "",
    location: initialIsCustomLocation ? "__custom__" : (initial?.location ?? (initialCategory === "Non-IT Asset" ? (departments[0] ?? "Central Stock") : "Central Stock")),
    customLocation: initialIsCustomLocation ? (initial?.location ?? "") : "",
    condition: initial?.condition ?? "Excellent",
    verified: initial?.verified ? "Yes" : "No",
    details: initial?.details ?? "",
    imageKey: initial?.imageKey ?? "",
  });

  const activeEmployees = employees.filter((employee) => employee.status === "Active");
  const initialPrinterMode: "stock" | "department" | "person" =
    initial?.allocationType === "department" || initial?.assignedDepartment
      ? "department"
      : initial?.employeeId
        ? "person"
        : "stock";

  const [printerAssignMode, setPrinterAssignMode] = useState<"stock" | "department" | "person">(initialPrinterMode);
  const [printerDepartment, setPrinterDepartment] = useState(initial?.assignedDepartment ?? departments[0] ?? "");
  const [printerEmployeeId, setPrinterEmployeeId] = useState(initial?.employeeId ?? activeEmployees[0]?.id ?? "");
  const [printerRoom, setPrinterRoom] = useState(initial?.type === "Printer" ? (initial?.location ?? "") : "");
  const [specs, setSpecs] = useState<Record<string, string>>(initial?.specs ?? {});

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  const category = form.category as keyof typeof ASSET_TYPES;
  const dynamicFields = ASSET_SPEC_FIELDS[form.type] ?? [];
  const isNonIt = form.category === "Non-IT Asset";
  const isLocationOnly = isLocationOnlyAssetType(form.type);
  const isMonitor = isMonitorAssetType(form.type);
  const isPrinter = isPrinterAssetType(form.type);
  const furnitureOptions = FURNITURE_IMAGE_OPTIONS.filter((option) => option.type === form.type);
  const isFurniture = furnitureOptions.length > 0;

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const prefix = form.category === "IT Asset" ? "IT" : "NIT";
        const resolvedLocation =
          form.location === "__custom__" ? form.customLocation.trim() : form.location.trim();

        let nextLocation: string | undefined = isNonIt ? (resolvedLocation || "Central Stock") : undefined;
        let nextAllocationType: AssetAllocationType | undefined = initial?.allocationType;
        let nextAssignedDepartment: string | undefined = initial?.assignedDepartment;
        let nextEmployeeId: string | undefined = initial?.employeeId;
        let nextCustodianName: string | undefined = initial?.custodianName;
        let nextCustodianDepartment: string | undefined = initial?.custodianDepartment;
        let nextStatus: AssetStatus = initial?.status ?? "Available";

        if (isLocationOnly) {
          const finalLoc = resolvedLocation || "Central Stock";
          nextLocation = finalLoc;
          nextEmployeeId = undefined;
          nextCustodianName = undefined;
          nextCustodianDepartment = undefined;
          nextAssignedDepartment = undefined;
          nextAllocationType = finalLoc !== "Central Stock" ? "location" : undefined;
          if (nextStatus !== "In repair" && nextStatus !== "Retired") {
            nextStatus = finalLoc !== "Central Stock" ? "Assigned" : "Available";
          }
        } else if (isPrinter) {
          nextLocation = printerRoom.trim() || undefined;
          if (printerAssignMode === "department" && printerDepartment) {
            nextAllocationType = "department";
            nextAssignedDepartment = printerDepartment;
            nextCustodianDepartment = printerDepartment;
            nextEmployeeId = undefined;
            nextCustodianName = undefined;
            if (nextStatus !== "In repair" && nextStatus !== "Retired") nextStatus = "Assigned";
          } else if (printerAssignMode === "person" && printerEmployeeId) {
            const emp = employees.find((e) => e.id === printerEmployeeId);
            nextAllocationType = "person";
            nextAssignedDepartment = undefined;
            nextEmployeeId = printerEmployeeId;
            nextCustodianName = emp?.name;
            nextCustodianDepartment = emp?.department;
            if (nextStatus !== "In repair" && nextStatus !== "Retired") nextStatus = "Assigned";
          } else {
            nextAllocationType = undefined;
            nextAssignedDepartment = undefined;
            nextEmployeeId = undefined;
            nextCustodianName = undefined;
            nextCustodianDepartment = undefined;
            if (nextStatus !== "In repair" && nextStatus !== "Retired") nextStatus = "Available";
          }
        } else if (initial?.allocationType === "location" || initial?.allocationType === "department") {
          nextAllocationType = nextEmployeeId ? "person" : undefined;
          nextAssignedDepartment = undefined;
          if (!nextEmployeeId && nextStatus === "Assigned") {
            nextStatus = "Available";
          }
        }

        if (form.condition === "Repair") {
          nextStatus = "In repair";
        } else if (nextStatus === "In repair") {
          const isAllocated = Boolean(
            nextEmployeeId ||
            nextAllocationType === "department" ||
            nextAllocationType === "location",
          );
          nextStatus = isAllocated ? "Assigned" : "Available";
        }

        const typeCodePrefix =
          form.type === "Classroom / Location Monitor" ? "CLM" :
          form.type === "Google Chromecast" ? "GCC" :
          form.type === "Printer" ? "PRN" :
          form.type.slice(0, 3).toUpperCase();

        const uniqueSuffix = `${String(Date.now()).slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

        onSave({
          ...initial,
          id: initial?.id ?? crypto.randomUUID(),
          code: initial?.code ?? `${prefix}-${typeCodePrefix}-${uniqueSuffix}`,
          category: form.category as Asset["category"],
          type: form.type,
          name: form.name,
          brand: form.brand,
          model: form.model,
          serial: isNonIt ? "" : form.serial,
          location: nextLocation,
          allocationType: nextAllocationType,
          assignedDepartment: nextAssignedDepartment,
          employeeId: nextEmployeeId,
          custodianName: nextCustodianName,
          custodianDepartment: nextCustodianDepartment,
          condition: form.condition,
          verified: form.verified === "Yes",
          details: form.details,
          imageKey: form.imageKey,
          specs,
          status: nextStatus,
          updatedAt: today(),
        });
      }}
    >
      <label>
        Asset category
        <select
          value={form.category}
          onChange={(event) => {
            const nextCategory = event.target.value as keyof typeof ASSET_TYPES;
            const nextType = ASSET_TYPES[nextCategory][0];
            const furniture = FURNITURE_IMAGE_OPTIONS.find((option) => option.type === nextType);
            setForm({
              ...form,
              category: nextCategory,
              type: nextType,
              serial: nextCategory === "Non-IT Asset" ? "" : form.serial,
              location: nextCategory === "Non-IT Asset" ? (departments[0] ?? "Central Stock") : "Central Stock",
              imageKey: furniture?.key ?? "",
              model: furniture?.model ?? "",
              name: furniture ? `${furniture.label} - ${furniture.model}` : form.name,
            });
            setSpecs({});
          }}
        >
          <option>IT Asset</option>
          <option>Non-IT Asset</option>
        </select>
      </label>

      <label>
        Item type
        <select
          value={form.type}
          onChange={(event) => {
            const nextType = event.target.value;
            const furniture = FURNITURE_IMAGE_OPTIONS.find((option) => option.type === nextType);
            const wasFurniture = FURNITURE_IMAGE_OPTIONS.some((option) => option.type === form.type);
            const preserveMonitorSpecs = isMonitorAssetType(form.type) && isMonitorAssetType(nextType);
            setForm({
              ...form,
              type: nextType,
              imageKey: furniture?.key ?? "",
              model: furniture?.model ?? (preserveMonitorSpecs ? form.model : ""),
              name: furniture ? `${furniture.label} - ${furniture.model}` : (wasFurniture ? "" : form.name),
            });
            if (!preserveMonitorSpecs) setSpecs({});
          }}
        >
          {ASSET_TYPES[category].map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>

      {isMonitor && (
        <div className="allocation-panel full">
          <div className="allocation-panel-head">
            <Monitor size={17} />
            <div>
              <strong>Monitor division (2 parts)</strong>
              <span>Choose whether this monitor is assigned to an individual employee or fixed to a classroom / location.</span>
            </div>
          </div>
          <div className="allocation-mode-grid">
            <button
              type="button"
              className={form.type === "Monitor" ? "allocation-mode-btn selected" : "allocation-mode-btn"}
              onClick={() => setForm({ ...form, type: "Monitor" })}
            >
              <Users size={16} />
              <div>
                <strong>Staff / Employee Monitor</strong>
                <small>Standard monitor assignable to a specific person</small>
              </div>
            </button>
            <button
              type="button"
              className={form.type === "Classroom / Location Monitor" ? "allocation-mode-btn selected" : "allocation-mode-btn"}
              onClick={() => setForm({ ...form, type: "Classroom / Location Monitor" })}
            >
              <MapPin size={16} />
              <div>
                <strong>Classroom / Location Monitor</strong>
                <small>Allocated directly to a classroom or room — not a person</small>
              </div>
            </button>
          </div>
        </div>
      )}

      {isFurniture && (
        <fieldset className="furniture-picker full">
          <legend>Select {form.type} design</legend>
          <p>The selected image will appear throughout AssetFlow and in Excel exports.</p>
          <div>
            {furnitureOptions.map((option) => (
              <button
                type="button"
                className={form.imageKey === option.key ? "selected" : ""}
                aria-pressed={form.imageKey === option.key}
                key={option.key}
                onClick={() => setForm({ ...form, imageKey: option.key, model: option.model, name: `${option.label} - ${option.model}` })}
              >
                <img src={option.src} alt={`${option.label} ${option.model}`} />
                <span><strong>{option.label}</strong><small>{option.model}</small></span>
                {form.imageKey === option.key && <Check size={16} />}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="full">
        Display name
        <input
          required
          placeholder={
            form.type === "Google Chromecast"
              ? "e.g. Google Chromecast - Lecture Hall 01"
              : form.type === "Classroom / Location Monitor"
                ? "e.g. Samsung 55\" Display - Lecture Hall 01"
                : form.type === "Printer"
                  ? "e.g. HP LaserJet Pro M404dn - Finance"
                  : "e.g. Lenovo ThinkPad E14"
          }
          {...field("name")}
        />
      </label>
      <label>Brand<input required placeholder={form.type === "Google Chromecast" ? "Google" : form.type === "Printer" ? "HP / Canon / Brother" : "Lenovo"} {...field("brand")} /></label>
      <label>Model<input required readOnly={isFurniture} placeholder={form.type === "Printer" ? "LaserJet Pro M404dn" : form.type === "Google Chromecast" ? "Chromecast with Google TV 4K" : "ThinkPad E14 Gen 5"} {...field("model")} /></label>

      {isNonIt ? (
        <label className="full">
          Current location
          <select required {...field("location")}>
            <option>Central Stock</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </select>
        </label>
      ) : (
        <label className="full">
          Serial number
          <input required placeholder="Manufacturer or company serial number" {...field("serial")} />
        </label>
      )}

      {isLocationOnly && (
        <div className="allocation-panel full">
          <div className="location-notice-box" style={{ marginBottom: "11px" }}>
            <MapPin size={17} />
            <div>
              <strong>Location-allocated IT asset (not assigned to a person)</strong>
              <span>Allocate this {form.type} to a specific classroom, lab, or room. Choosing a location marks it as allocated to that location; choosing Central Stock keeps it available.</span>
            </div>
          </div>
          <div className="form-grid">
            <label className={form.location === "__custom__" ? "" : "full"}>
              Classroom / Location
              <select required {...field("location")}>
                <option value="Central Stock">Central Stock (Unallocated)</option>
                {groupLocationsByBuilding(locations).map(([building, rooms]) => (
                  <optgroup key={building} label={building}>
                    {rooms.map((room) => <option key={room.value} value={room.value}>{room.label}</option>)}
                  </optgroup>
                ))}
                <optgroup label="Departments">
                  {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </optgroup>
                <option value="__custom__">+ Type a custom location…</option>
              </select>
            </label>
            {form.location === "__custom__" && (
              <label>
                Custom classroom / location name
                <input
                  required
                  placeholder="e.g. Building 2 (New) - Classroom 302"
                  value={form.customLocation}
                  onChange={(e) => setForm({ ...form, customLocation: e.target.value })}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {isPrinter && (
        <div className="allocation-panel full">
          <div className="allocation-panel-head">
            <Printer size={17} />
            <div>
              <strong>Printer assignment</strong>
              <span>Assign this printer to a specific department, a specific person, or keep it in stock.</span>
            </div>
          </div>
          <div className="allocation-mode-grid three-col" style={{ marginBottom: "11px" }}>
            <button
              type="button"
              className={printerAssignMode === "department" ? "allocation-mode-btn selected" : "allocation-mode-btn"}
              onClick={() => setPrinterAssignMode("department")}
            >
              <Building2 size={15} />
              <div>
                <strong>Department</strong>
                <small>Shared department printer</small>
              </div>
            </button>
            <button
              type="button"
              className={printerAssignMode === "person" ? "allocation-mode-btn selected" : "allocation-mode-btn"}
              onClick={() => setPrinterAssignMode("person")}
            >
              <Users size={15} />
              <div>
                <strong>Specific person</strong>
                <small>Assigned to an employee</small>
              </div>
            </button>
            <button
              type="button"
              className={printerAssignMode === "stock" ? "allocation-mode-btn selected" : "allocation-mode-btn"}
              onClick={() => setPrinterAssignMode("stock")}
            >
              <Package size={15} />
              <div>
                <strong>Central stock</strong>
                <small>Available / unassigned</small>
              </div>
            </button>
          </div>
          <div className="form-grid">
            {printerAssignMode === "department" && (
              <label>
                Assigned department
                <select required value={printerDepartment} onChange={(e) => setPrinterDepartment(e.target.value)}>
                  {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </label>
            )}
            {printerAssignMode === "person" && (
              <label>
                Assigned employee
                <select required value={printerEmployeeId} onChange={(e) => setPrinterEmployeeId(e.target.value)}>
                  <option value="">Select employee</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} · {emp.department} ({emp.empNo})</option>
                  ))}
                </select>
              </label>
            )}
            <label className={printerAssignMode === "stock" ? "full" : ""}>
              Room / physical location (optional)
              <input
                list="printer-room-suggestions"
                placeholder="e.g. Ground Floor Copy Room / Reception Desk"
                value={printerRoom}
                onChange={(e) => setPrinterRoom(e.target.value)}
              />
              <datalist id="printer-room-suggestions">
                {locations.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </label>
          </div>
        </div>
      )}

      {dynamicFields.length > 0 && (
        <div className="asset-spec-heading full">
          <strong>{form.type} specifications</strong>
          <span>Fields change automatically for the selected asset type.</span>
        </div>
      )}
      {dynamicFields.map((spec) => {
        const knownTonerModels = spec.key === "compatibleToner"
          ? Array.from(new Set(toners.map((t) => t.tonerModel.trim()).filter(Boolean))).sort()
          : [];
        const isMappedTonerDropdown = spec.key === "compatibleToner" && knownTonerModels.length > 0;
        const currentCompat = specs[spec.key] ?? "";
        const isCustomCompat = isMappedTonerDropdown && Boolean(currentCompat) && !knownTonerModels.includes(currentCompat);

        return (
          <label key={spec.key}>
            {spec.label}
            {spec.options ? (
              <select
                required={spec.required !== false}
                value={spec.options.includes(specs[spec.key] ?? "") ? (specs[spec.key] ?? "") : ""}
                onChange={(event) => setSpecs({ ...specs, [spec.key]: event.target.value })}
              >
                <option value="">Select {spec.label.toLowerCase()}</option>
                {spec.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : isMappedTonerDropdown ? (
              <>
                <select
                  required={!isCustomCompat && spec.required !== false}
                  value={isCustomCompat ? "__custom__" : currentCompat}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val === "__custom__") {
                      setSpecs({ ...specs, [spec.key]: currentCompat || " " });
                    } else {
                      setSpecs({ ...specs, [spec.key]: val });
                    }
                  }}
                >
                  <option value="">Select mapped toner from stock…</option>
                  {knownTonerModels.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                  <option value="__custom__">+ Type another toner model…</option>
                </select>
                {isCustomCompat && (
                  <input
                    required={spec.required !== false}
                    style={{ marginTop: "6px" }}
                    value={currentCompat.trimStart()}
                    placeholder={spec.placeholder}
                    onChange={(event) => setSpecs({ ...specs, [spec.key]: event.target.value })}
                  />
                )}
              </>
            ) : (
              <input
                required={spec.required !== false}
                value={specs[spec.key] ?? ""}
                placeholder={spec.placeholder}
                onChange={(event) => setSpecs({ ...specs, [spec.key]: event.target.value })}
              />
            )}
          </label>
        );
      })}
      <label>Condition<select {...field("condition")}><option>Excellent</option><option>Good</option><option>Fair</option><option>Repair</option></select></label>
      <label>Asset verified (Yes/No)<select {...field("verified")}><option value="No">No</option><option value="Yes">Yes</option></select></label>
      <label className="full">Additional notes<textarea placeholder="Warranty, accessories or any other information…" {...field("details")} /></label>
      <FormActions text={initial ? "Update asset" : "Add asset"} />
    </form>
  );
}

function EmployeeForm({
  departments,
  existingEmployees,
  onSave,
  initial,
}: {
  departments: string[];
  existingEmployees: Employee[];
  onSave: (employee: Employee) => Promise<void> | void;
  initial?: Employee;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    empNo: initial?.empNo ?? "",
    email: initial?.email ?? "",
    department: initial?.department ?? departments[0] ?? "",
    designation: initial?.designation ?? "",
    status: initial?.status ?? "Active",
  });
  const [submitting, setSubmitting] = useState(false);

  const normalizeEmpNo = (val: string) => val.trim().toLowerCase().replace(/^emp[-_\s]*/i, "").replace(/^0+(?=\d)/, "");
  const normalizedEmpNo = normalizeEmpNo(form.empNo);
  const duplicateMatch = normalizedEmpNo
    ? existingEmployees.find(
        (emp) => emp.id !== initial?.id && normalizeEmpNo(emp.empNo) === normalizedEmpNo,
      )
    : undefined;

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (duplicateMatch || submitting) return;
        setSubmitting(true);
        try {
          await onSave({
            id: initial?.id ?? crypto.randomUUID(),
            name: form.name.trim(),
            empNo: form.empNo.trim(),
            email: form.email.trim(),
            department: form.department,
            designation: form.designation.trim(),
            status: form.status as Employee["status"],
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {duplicateMatch && (
        <div className="form-error-inline" role="alert">
          <AlertTriangle size={15} />
          <span>
            Employee number <strong>{form.empNo.trim()}</strong> already exists ({duplicateMatch.name} · {duplicateMatch.department}). Edit the existing employee instead of creating a duplicate.
          </span>
        </div>
      )}
      <label className="full">Full name<input required placeholder="Employee full name" {...field("name")} /></label>
      <label>Employee number<input required placeholder="EMP-0001" {...field("empNo")} /></label>
      <label>Email<input required type="email" placeholder="name@company.lk" {...field("email")} /></label>
      <label>Department<select {...field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Designation<input required placeholder="Job title" {...field("designation")} /></label>
      <label>Employment status<select {...field("status")}><option>Active</option><option>Resigned</option></select></label>
      <div className="form-actions full">
        <button className="button button-primary" type="submit" disabled={Boolean(duplicateMatch) || submitting}>
          <Check size={17} />{submitting ? "Saving…" : initial ? "Update employee" : "Add employee"}
        </button>
      </div>
    </form>
  );
}

function AssignForm({
  assets,
  employees,
  onSave,
}: {
  assets: Asset[];
  employees: Employee[];
  onSave: (
    assetIds: string[],
    employeeId: string,
    email: string,
    sendEmail: boolean,
    note: string,
  ) => Promise<void> | void;
}) {
  const activeEmployees = employees.filter((employee) => employee.status === "Active");
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || "");
  const currentEmployee = employees.find((emp) => emp.id === employeeId);
  const [email, setEmail] = useState(currentEmployee?.email || "");
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const available = assets.filter((asset) => effectiveAssetStatus(asset) === "Available" && !isLocationOnlyAssetType(asset.type));
  const locationOnlyInStock = assets.filter((asset) => effectiveAssetStatus(asset) === "Available" && isLocationOnlyAssetType(asset.type)).length;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (selected.length && !submitting) {
          setSubmitting(true);
          try {
            await onSave(selected, employeeId, email.trim(), sendEmail, note.trim());
          } finally {
            setSubmitting(false);
          }
        }
      }}
    >
      <label className="stacked-label">
        Assign to employee
        <select
          value={employeeId}
          onChange={(event) => {
            const nextId = event.target.value;
            setEmployeeId(nextId);
            const emp = employees.find((e) => e.id === nextId);
            if (emp) setEmail(emp.email || "");
          }}
        >
          {activeEmployees.map((employee) => (
            <option value={employee.id} key={employee.id}>
              {employee.name} · {employee.department} ({employee.empNo})
            </option>
          ))}
        </select>
      </label>

      <label className="stacked-label">
        Employee confirmation email
        <input
          type="email"
          required={sendEmail}
          placeholder="e.g. employee@scot.lk"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="email-toggle-check">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(event) => setSendEmail(event.target.checked)}
        />
        <span>
          <strong>Send email confirmation to employee (CC: admin@scot.lk, it@scot.lk, hr@scot.lk)</strong>
          <small>An automated confirmation email containing all item specifications, serial numbers and handover details will be dispatched to the employee and copied to admin@scot.lk, it@scot.lk, and hr@scot.lk.</small>
        </span>
      </label>

      <label className="stacked-label">
        Assignment note (optional)
        <input
          type="text"
          placeholder="e.g. Work from home equipment, Laptop renewal, Project deployment"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <p className="field-heading">Select one or more available items ({selected.length} selected)</p>
      {locationOnlyInStock > 0 && (
        <p className="department-note" style={{ marginTop: "-4px", marginBottom: "10px" }}>
          Note: {locationOnlyInStock} location-allocated item{locationOnlyInStock === 1 ? "" : "s"} (Classroom / Location Monitors or Google Chromecasts) are hidden here because they are allocated to a classroom / location rather than a person.
        </p>
      )}
      <div className="check-list">
        {available.length === 0 && (
          <div className="empty-panel" style={{ minHeight: "80px" }}>
            <strong>No available assets ready for employee assignment</strong>
            <span>Add available IT/Non-IT items first, or edit location-allocated items directly.</span>
          </div>
        )}
        {available.map((asset) => {
          const furniture = furnitureImageForAsset(asset);
          return (
            <label key={asset.id}>
              {furniture && <img className="check-list-image" src={furniture.src} alt="" />}
              <input
                type="checkbox"
                checked={selected.includes(asset.id)}
                onChange={() =>
                  setSelected((rows) =>
                    rows.includes(asset.id)
                      ? rows.filter((id) => id !== asset.id)
                      : [...rows, asset.id],
                  )
                }
              />
              <span>
                <strong>{asset.name}</strong>
                <small>
                  {asset.code} · {asset.serial || asset.location || "No serial"}
                </small>
              </span>
              <em>{asset.type}</em>
            </label>
          );
        })}
      </div>

      <FormActions
        text={
          submitting
            ? "Assigning items…"
            : `Assign ${selected.length || ""} item${selected.length === 1 ? "" : "s"}${sendEmail ? " & Send Confirmation" : ""}`
        }
        disabled={!selected.length || !employeeId || submitting}
      />
    </form>
  );
}

function ReturnForm({
  assets,
  employees,
  onSave,
}: {
  assets: Asset[];
  employees: Employee[];
  onSave: (
    assetIds: string[],
    employeeId: string,
    email: string,
    sendEmail: boolean,
    clearance: boolean,
    note: string,
  ) => Promise<void> | void;
}) {
  const assignedEmployees = employees.filter((employee) => assets.some((asset) => asset.employeeId === employee.id));
  const [employeeId, setEmployeeId] = useState(assignedEmployees[0]?.id || "");
  const currentEmployee = employees.find((emp) => emp.id === employeeId);
  const [email, setEmail] = useState(currentEmployee?.email || "");
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [clearance, setClearance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const owned = assets.filter((asset) => asset.employeeId === employeeId);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (selected.length && !submitting) {
          setSubmitting(true);
          try {
            await onSave(selected, employeeId, email.trim(), sendEmail, clearance, note.trim());
          } finally {
            setSubmitting(false);
          }
        }
      }}
    >
      <label className="stacked-label">
        Employee returning assets
        <select
          value={employeeId}
          onChange={(event) => {
            const nextId = event.target.value;
            setEmployeeId(nextId);
            setSelected([]);
            const emp = employees.find((e) => e.id === nextId);
            if (emp) setEmail(emp.email || "");
          }}
        >
          {assignedEmployees.map((employee) => (
            <option value={employee.id} key={employee.id}>
              {employee.name} · {employee.department} ({employee.empNo})
            </option>
          ))}
        </select>
      </label>

      <label className="stacked-label">
        Employee confirmation email
        <input
          type="email"
          required={sendEmail}
          placeholder="e.g. employee@scot.lk"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="email-toggle-check">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(event) => setSendEmail(event.target.checked)}
        />
        <span>
          <strong>Send return confirmation email to employee (CC: admin@scot.lk, it@scot.lk, hr@scot.lk)</strong>
          <small>
            {clearance
              ? "An official resignation clearance & return receipt will be dispatched and copied to admin@scot.lk, it@scot.lk, and hr@scot.lk."
              : "An automated return receipt with custody discharge details will be dispatched and copied to admin@scot.lk, it@scot.lk, and hr@scot.lk."}
          </small>
        </span>
      </label>

      <label className="stacked-label">
        Return remarks / condition note (optional)
        <input
          type="text"
          placeholder="e.g. Good condition, returned to IT Central Stock, accessories complete"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <p className="field-heading">Choose returned items ({selected.length} selected)</p>
      <div className="check-list">
        {owned.length === 0 && (
          <div className="empty-panel" style={{ minHeight: "80px" }}>
            <strong>No assigned assets found for this employee</strong>
            <span>Select another employee who currently holds company assets.</span>
          </div>
        )}
        {owned.map((asset) => (
          <label key={asset.id}>
            <input
              type="checkbox"
              checked={selected.includes(asset.id)}
              onChange={() =>
                setSelected((rows) =>
                  rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id],
                )
              }
            />
            <span>
              <strong>{asset.name}</strong>
              <small>{asset.code} · {asset.serial || asset.location || "No serial"}</small>
            </span>
            <em>{asset.condition}</em>
          </label>
        ))}
      </div>

      <label className="clearance-check">
        <input
          type="checkbox"
          checked={clearance}
          onChange={(event) => setClearance(event.target.checked)}
        />
        <span>
          <strong>Employee clearance return</strong>
          <small>Mark these items as part of final resignation clearance</small>
        </span>
      </label>

      <FormActions
        text={
          submitting
            ? "Processing return…"
            : clearance
              ? `Return ${selected.length || ""} & Prepare Clearance${sendEmail ? " & Send Email" : ""}`
              : `Record Return (${selected.length || ""})${sendEmail ? " & Send Confirmation" : ""}`
        }
        disabled={!selected.length || !employeeId || submitting}
      />
    </form>
  );
}

function RepairForm({ assets, onSave }: { assets: Asset[]; onSave: (assetId: string, action: "start" | "complete", note: string) => void }) {
  const repairable = assets.filter((asset) => asset.status !== "Retired");
  const [assetId, setAssetId] = useState(repairable[0]?.id || "");
  const [action, setAction] = useState<"start" | "complete">("start");
  const [note, setNote] = useState("");
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (assetId && note.trim()) onSave(assetId, action, note.trim()); }}>
    <label className="full">Asset<select value={assetId} onChange={(event) => { const nextId = event.target.value; setAssetId(nextId); setAction(assets.find((asset) => asset.id === nextId)?.status === "In repair" ? "complete" : "start"); }}>{repairable.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.code} · {asset.serial || asset.location || "No serial"}</option>)}</select></label>
    <label className="full">Repair action<select value={action} onChange={(event) => setAction(event.target.value as "start" | "complete")}><option value="start">Send for repair</option><option value="complete">Mark repair completed</option></select></label>
    <label className="full">Repair details<textarea required minLength={5} placeholder="Fault, supplier, job reference, parts replaced or completion notes…" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {selectedAsset && <p className="full audit-badge">Current status: {selectedAsset.status} · Current condition: {selectedAsset.condition}</p>}
    <FormActions text={action === "start" ? "Start repair record" : "Complete repair record"} disabled={!assetId || note.trim().length < 5} />
  </form>;
}

function DepartmentManager({ departments, employees, onSave, onPurge }: { departments: string[]; employees: Employee[]; onSave: (items: string[]) => void; onPurge: (department: string) => Promise<void> }) {
  const [items, setItems] = useState(departments);
  const [newDepartment, setNewDepartment] = useState("");
  const [purging, setPurging] = useState("");
  return <form onSubmit={(event) => { event.preventDefault(); onSave(items.map((item) => item.trim()).filter(Boolean)); }}>
    <div className="department-add"><label>New department<input value={newDepartment} placeholder="e.g. Quality Assurance Dept" onChange={(event) => setNewDepartment(event.target.value)} /></label><button className="button button-secondary" type="button" disabled={!newDepartment.trim()} onClick={() => { const next = newDepartment.trim(); if (next && !items.some((item) => item.toLowerCase() === next.toLowerCase())) setItems([...items, next]); setNewDepartment(""); }}><Plus size={16} />Add department</button></div>
    <div className="department-editor">{items.map((department, index) => { const employeeCount = employees.filter((employee) => employee.department === department).length; return <div key={index}><input aria-label={`Department ${index + 1}`} value={department} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? event.target.value : row))} /><span>{employeeCount} employee{employeeCount === 1 ? "" : "s"}</span>{department === "IT Dept" ? <button className="department-purge" type="button" disabled={Boolean(purging)} onClick={async () => { if (!window.confirm("Permanently delete IT Dept and every related employee, asset, movement, requirement, QR and history record? This cannot be undone.")) return; setPurging(department); try { await onPurge(department); } finally { setPurging(""); } }}>{purging ? "Deleting…" : "Delete all data"}</button> : <button type="button" disabled={employeeCount > 0 || items.length === 1} onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>}</div>; })}</div>
    <p className="department-note">Departments with employees cannot normally be removed until those employees are moved. The retired IT Dept has a one-time permanent purge action for its related records.</p>
    <FormActions text="Save departments" disabled={!items.length || items.some((item) => !item.trim())} />
  </form>;
}

function RequestForm({ departments, onSave }: { departments: string[]; onSave: (request: RequestRow) => void }) {
  const [form, setForm] = useState(() => ({
    department: departments[0] ?? "",
    item: "",
    quantity: "1",
    neededDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    reason: "",
  }));
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }) });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ id: crypto.randomUUID(), department: form.department, item: form.item, quantity: Number(form.quantity), neededDate: form.neededDate, reason: form.reason, status: "Pending" }); }}><label className="full">Department<select {...field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full">Required item<input required placeholder="e.g. 24” monitor or Office licence key" {...field("item")} /></label><label>Quantity<input required min="1" type="number" {...field("quantity")} /></label><label>Needed date<input required type="date" {...field("neededDate")} /></label><label className="full">Business reason<textarea required placeholder="Explain the upcoming need, new employee, replacement or project…" {...field("reason")} /></label><FormActions text="Submit requirement" /></form>;
}

function PrintableDocument({
  type,
  employees,
  assets,
  movements = [],
  assetMap = {},
  initialEmployeeId = "",
  initialAssetIds = [],
}: {
  type: string;
  employees: Employee[];
  assets: Asset[];
  movements?: Movement[];
  assetMap?: Record<string, Asset>;
  initialEmployeeId?: string;
  initialAssetIds?: string[];
}) {
  const isMovementHistory = type === "Movement History";
  const [employeeId, setEmployeeId] = useState(isMovementHistory ? "ALL" : (initialEmployeeId || employees[0]?.id || ""));
  const employee = employees.find((row) => row.id === employeeId);
  const contextualAssets = initialAssetIds.length ? assets.filter((asset) => initialAssetIds.includes(asset.id)) : assets.filter((asset) => asset.employeeId === employeeId);
  const [selected, setSelected] = useState<string[]>(() => initialAssetIds.length ? initialAssetIds : assets.filter((asset) => asset.employeeId === (initialEmployeeId || employees[0]?.id)).map((asset) => asset.id));
  const owned = initialAssetIds.length ? contextualAssets : assets.filter((asset) => asset.employeeId === employeeId);
  const included = owned.filter((asset) => selected.includes(asset.id));
  const returnDocument = type.includes("Return") || type.includes("Clearance");

  if (isMovementHistory) {
    const visibleMovements = employeeId === "ALL"
      ? movements
      : movements.filter((m) => m.employeeId === employeeId);
    return (
      <div>
        <div className="document-controls">
          <label>
            Filter by employee
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="ALL">All employees &amp; movements ({movements.length})</option>
              {employees.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.department}</option>)}
            </select>
          </label>
          <button className="button button-primary" disabled={!visibleMovements.length} onClick={() => window.print()}>
            <Printer size={17} />Print / Save PDF
          </button>
        </div>
        <article className="print-document">
          <div className="document-accent" />
          <header>
            <div><strong>ASSETFLOW</strong><span>Company Asset Management · Audit Trail</span></div>
            <p>Movement History</p>
          </header>
          <div className="document-title">
            <span>ASSET MOVEMENT HISTORY</span>
            <h1>{employee ? employee.name : "Company-Wide Asset Audit Trail"}</h1>
            <p>{employee ? `${employee.empNo} · ${employee.designation} · ${employee.department}` : "Complete assignment, return, clearance and repair log"}</p>
          </div>
          <div className="document-meta">
            <span>Generated date<strong>{new Date().toLocaleDateString("en-GB")}</strong></span>
            <span>Reference<strong>AF-AUDIT-{today()}</strong></span>
            <span>Records included<strong>{visibleMovements.length}</strong></span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Action</th>
                <th>Asset / code</th>
                <th>Employee / department</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((movement, index) => (
                <tr key={movement.id}>
                  <td>{String(index + 1).padStart(2, "0")}</td>
                  <td>{new Date(movement.date).toLocaleDateString("en-GB")}</td>
                  <td><span className={movement.type === "Repair" ? "document-condition condition-repair" : "document-condition"}>{movement.type}</span></td>
                  <td><strong>{assetMap[movement.assetId]?.name || "Removed asset"}</strong><small>{assetMap[movement.assetId]?.code || movement.assetId}</small></td>
                  <td><strong>{movement.employeeName || "Asset Administration"}</strong><small>{movement.department || "Central Stock"}</small></td>
                  <td>{movement.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer><strong>AssetFlow verified audit report</strong><span>Generated from the live company asset register · {new Date().toLocaleString("en-GB")}</span></footer>
        </article>
      </div>
    );
  }

  return <div><div className="document-controls"><label>Employee<select value={employeeId} disabled={Boolean(initialEmployeeId)} onChange={(event) => { const nextId = event.target.value; setEmployeeId(nextId); setSelected(assets.filter((asset) => asset.employeeId === nextId).map((asset) => asset.id)); }}>{employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="button button-primary" disabled={!employee || !included.length} onClick={() => window.print()}><Printer size={17} />Print / Save PDF</button></div><div className="document-item-picker"><div><strong>Select items for this document</strong><span>{selected.length} of {owned.length} included</span></div><div>{owned.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} />{asset.name}<small>{asset.code}</small></label>)}</div></div><article className="print-document"><div className="document-accent" /><header><div><strong>ASSETFLOW</strong><span>Company Asset Management · Official Record</span></div><p>{type}</p></header><div className="document-title"><span>{type.toUpperCase()}</span><h1>{employee?.name || "Select an employee"}</h1><p>{employee ? `${employee.empNo} · ${employee.designation} · ${employee.department}` : "No employee selected"}</p></div><div className="document-meta"><span>Document date<strong>{new Date().toLocaleDateString("en-GB")}</strong></span><span>Reference<strong>AF-{employee?.empNo || "UNASSIGNED"}-{type.replaceAll(" ", "-").toUpperCase()}</strong></span><span>Items covered<strong>{included.length}</strong></span></div><table><thead><tr><th>#</th><th>Asset / item</th><th>Asset code</th><th>Serial / location</th><th>Condition</th></tr></thead><tbody>{included.map((asset, index) => { const chips = getAssetKeySpecChips(asset); return <tr key={asset.id}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{asset.name}</strong><small>{[chips.join(" · "), asset.details].filter(Boolean).join(" — ")}</small></td><td>{asset.code}</td><td>{asset.serial || asset.location || "—"}</td><td><span className={asset.condition.toLowerCase() === "repair" ? "document-condition condition-repair" : "document-condition"}>{asset.condition}</span></td></tr>; })}</tbody></table><p className="document-statement">{returnDocument ? "The assets listed above have been returned to the company and verified by the responsible department. Any exception or damage must be recorded before final employee clearance is approved." : "I acknowledge receipt and responsibility for the company assets listed above. I agree to use them only for authorised company work, take reasonable care of them, and return them in good condition when requested."}</p><div className="signature-grid"><span>Employee signature<small>Name, signature & date</small></span><span>Issued / received by<small>Asset Administration</small></span><span>Authorised by<small>Department Head</small></span></div><footer><strong>AssetFlow verified document</strong><span>Generated from the live company asset register · {new Date().toLocaleString("en-GB")}</span></footer></article></div>;
}

function QrBatch({ assets, employees, departments, locations, employeeMap }: { assets: Asset[]; employees: Employee[]; departments: string[]; locations: string[]; employeeMap: Record<string, Employee> }) {
  const [category, setCategory] = useState("All");
  const [scope, setScope] = useState<"all" | "department" | "employee" | "location">("all");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [locationFilter, setLocationFilter] = useState(locations[0] ?? "");
  const departmentEmployees = employees.filter((employee) => employee.department === department);
  const [employeeId, setEmployeeId] = useState(() => employees.find((e) => e.department === (departments[0] ?? ""))?.id ?? "");
  const [labelSize, setLabelSize] = useState<"compact" | "small" | "extraSmall">("compact");
  const labelsPerPage = labelSize === "compact" ? 24 : labelSize === "small" ? 35 : 54;
  const filtered = assets.filter((asset) => {
    if (category !== "All" && asset.category !== category) return false;
    if (scope === "employee") return asset.employeeId === employeeId;
    if (scope === "location") return asset.location === locationFilter;
    if (scope === "department") {
      const assetDepartment = asset.employeeId ? employeeMap[asset.employeeId]?.department : asset.assignedDepartment || asset.custodianDepartment || asset.location;
      return assetDepartment === department;
    }
    return true;
  });
  const [selected, setSelected] = useState<string[]>(assets.map((asset) => asset.id));
  const visible = filtered.filter((asset) => selected.includes(asset.id));
  return <div className="qr-batch">
    <div className="qr-batch-toolbar qr-batch-filters">
      <label>Asset group<select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>IT Asset</option><option>Non-IT Asset</option></select></label>
      <label>Print labels for<select aria-label="QR label scope" value={scope} onChange={(event) => { const nextScope = event.target.value as "all" | "department" | "employee" | "location"; setScope(nextScope); if (nextScope === "employee" && !departmentEmployees.some((e) => e.id === employeeId)) { setEmployeeId(departmentEmployees[0]?.id ?? ""); } }}><option value="all">All assets</option><option value="department">One department</option><option value="employee">One employee</option><option value="location">One classroom / location</option></select></label>
      {(scope === "department" || scope === "employee") && <label>Department<select aria-label="QR label department" value={department} onChange={(event) => { const nextDepartment = event.target.value; setDepartment(nextDepartment); setEmployeeId(employees.find((employee) => employee.department === nextDepartment)?.id ?? ""); }}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>}
      {scope === "employee" && <label>Employee<select aria-label="QR label employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={!departmentEmployees.length}>{departmentEmployees.length ? departmentEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.designation}</option>) : <option>No employees in this department</option>}</select></label>}
      {scope === "location" && <label>Classroom / Location<select aria-label="QR label location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>{groupLocationsByBuilding(locations).map(([building, rooms]) => <optgroup key={building} label={building}>{rooms.map((room) => <option key={room.value} value={room.value}>{room.label}</option>)}</optgroup>)}</select></label>}
      <label>Label size<select aria-label="QR label size" value={labelSize} onChange={(event) => setLabelSize(event.target.value as "compact" | "small" | "extraSmall")}><option value="compact">Compact — 24 per A4</option><option value="small">Small — 35 per A4</option><option value="extraSmall">Extra small — 54 per A4</option></select></label>
      <div><button className="button button-secondary" onClick={() => setSelected((rows) => filtered.every((asset) => rows.includes(asset.id)) ? rows.filter((id) => !filtered.some((asset) => asset.id === id)) : Array.from(new Set([...rows, ...filtered.map((asset) => asset.id)])))}><Check size={16} />Select / clear group</button><button className="button button-primary" disabled={!visible.length} onClick={() => window.print()}><Printer size={17} />Print {visible.length} labels</button></div>
    </div>
    <div className="qr-batch-tip"><QrCode size={19} /><div><strong>Small labels for every item</strong><p>Select a department first to narrow the employee list, then choose the label size that fits the item. This print run uses {labelsPerPage} labels per A4 page.</p></div></div>
    <div className="qr-select-list">{filtered.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.serial || asset.location || "No serial"}</small></span><em>{asset.employeeId ? employeeMap[asset.employeeId]?.name : asset.assignedDepartment || asset.location || "In stock"}</em></label>)}</div>
    <section className="qr-print-sheet">{Array.from({ length: Math.ceil(visible.length / labelsPerPage) }, (_, pageIndex) => <div className={`qr-print-page qr-size-${labelSize}`} key={pageIndex}>{visible.slice(pageIndex * labelsPerPage, pageIndex * labelsPerPage + labelsPerPage).map((asset) => <QrLabel key={asset.id} asset={asset} owner={asset.employeeId ? employeeMap[asset.employeeId]?.name : asset.assignedDepartment} />)}</div>)}</section>
  </div>;
}

function QrLabel({ asset, owner }: { asset: Asset; owner?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/asset/${asset.id}`, {
      width: 180,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#171422", light: "#ffffff" },
    }).then(setSrc);
  }, [asset.id]);
  return <article className="qr-label"><div className="qr-label-brand"><ShieldCheck size={13} /><strong>ASSETFLOW</strong></div>{src && <img src={src} alt="" />}<div><strong>{asset.name}</strong><span>{asset.code}</span><small>{asset.serial || asset.location || "No serial number"}</small><em>{owner || asset.location || "Central Stock"}</em></div></article>;
}

function ScheduleForm({ value, onSave }: { value: RequirementWindowRecord; onSave: (next: RequirementWindowRecord) => void }) {
  const [form, setForm] = useState(value);
  const field = (key: keyof RequirementWindowRecord) => ({
    value: String(form[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value }),
  });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
    <label className="full">Form title<input required {...field("title")} /></label>
    <label>Planning period<input required placeholder="August–September 2026" {...field("periodLabel")} /></label>
    <label>Shareable link name<input required pattern="[a-z0-9-]+" {...field("slug")} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
    <label>Opens at<input required type="datetime-local" {...field("opensAt")} /></label>
    <label>Closes at<input required type="datetime-local" {...field("closesAt")} /></label>
    <label className="schedule-toggle full"><input type="checkbox" checked={form.isOpen} onChange={(event) => setForm({ ...form, isOpen: event.target.checked })} /><span><strong>Accept submissions</strong><small>The date range still applies when this switch is on.</small></span></label>
    <FormActions text="Save requirement window" />
  </form>;
}

function AdminGate({ state, email, error, onSignIn, onSignOut }: { state: "loading" | "signed-out" | "admin" | "denied"; email: string; error?: string; onSignIn: () => void; onSignOut: () => void }) {
  return (
    <main className="admin-gate">
      <section>
        <div className="admin-gate-brand"><ShieldCheck size={27} /><strong>AssetFlow</strong></div>
        {state === "loading" ? (
          <>
            <span className="gate-icon"><CircleDot size={27} /></span>
            <h1>Verifying administrator…</h1>
          </>
        ) : state === "denied" ? (
          <>
            <span className="gate-icon denied"><LockKeyhole size={27} /></span>
            <h1>Dashboard access restricted</h1>
            <p><strong>{email}</strong> is signed in, but company asset controls are restricted to <strong>@scot.lk</strong> company accounts.</p>
            <button className="button button-primary" onClick={onSignOut}><LogOut size={17} />Sign out and switch account</button>
          </>
        ) : (
          <>
            <span className="gate-icon"><LockKeyhole size={27} /></span>
            <h1>Administrator sign in</h1>
            <p>Sign in with your <strong>@scot.lk</strong> company account to manage company assets, assignments and requirements.</p>
            {error && (
              <div className="gate-error-banner">
                <strong>Firebase Authentication Notice</strong>
                {error}
              </div>
            )}
            <button className="button button-primary" onClick={onSignIn}><ShieldCheck size={17} />Continue with Google</button>
          </>
        )}
        <small>Public QR records and department requirement forms do not expose this dashboard.</small>
      </section>
    </main>
  );
}

function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{children}</div></div>;
}

function PanelHead({ title, subtitle, action, onClick }: { title: string; subtitle: string; action?: string; onClick?: () => void }) {
  return <div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={onClick}>{action} →</button>}</div>;
}

function Metric({ icon: Icon, label, value, change, tone }: { icon: typeof Package; label: string; value: string; change: string; tone: string }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon size={21} /></div><p>{label}</p><div><strong>{value}</strong><span>{change}</span></div></article>;
}

function FormActions({ text, disabled = false }: { text: string; disabled?: boolean }) {
  return <div className="form-actions full"><p>All changes are saved to the permanent asset history.</p><button disabled={disabled} className="button button-primary" type="submit"><Check size={17} />{text}</button></div>;
}

function modalTitle(modal: string) {
  return { asset: "Add a new asset", employee: "Add employee", employeeEdit: "Edit employee details", departments: "Manage departments", locations: "Manage classrooms & locations", toner: "Add toner SKU", tonerStock: "Update toner stock", assign: "Assign assets", return: "Return assets", repair: "Record asset repair", request: "Submit requirement", document: "Generate document", qrBatch: "Batch QR label printing", schedule: "Requirement form window" }[modal] || modal;
}
