"use client";

/* eslint-disable @next/next/no-img-element -- QR labels use generated data URLs. */

import {
  ArrowDownToLine,
  ArrowLeftRight,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Package,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_EMAIL,
  DEFAULT_REQUIREMENT_WINDOW,
  firebaseReady,
  getRequirementWindow,
  saveRecord,
  saveRequirementWindow,
  signInAsAdmin,
  signOutAdmin,
  watchAuth,
  watchCollection,
  type RequirementWindowRecord,
} from "@/lib/firebase";

type AssetStatus = "Available" | "Assigned" | "In repair" | "Retired";
type Asset = {
  id: string;
  code: string;
  name: string;
  category: "IT Asset" | "Non-IT Asset";
  type: string;
  brand: string;
  model: string;
  serial: string;
  status: AssetStatus;
  employeeId?: string;
  condition: string;
  details: string;
  updatedAt: string;
  custodianName?: string;
  custodianDepartment?: string;
};
type Employee = {
  id: string;
  empNo: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: "Active" | "Resigned";
};
type Movement = {
  id: string;
  assetId: string;
  employeeId: string;
  type: "Assigned" | "Returned" | "Repair" | "Cleared";
  date: string;
  note: string;
  employeeName?: string;
  department?: string;
};
type RequestRow = {
  id: string;
  department: string;
  item: string;
  quantity: number;
  neededDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Declined";
  requesterName?: string;
  requesterEmail?: string;
  createdAt?: string;
};
type View =
  | "Dashboard"
  | "Assets"
  | "Employees"
  | "Movements"
  | "Requirements"
  | "Reports";

const departments = [
  "Admin Dept",
  "HR Dept",
  "IT Dept",
  "SOBM Dept",
  "Marketing Dept",
  "Finance Dept",
  "Student Admission Dept",
  "Registrar Dept",
  "EEE Dept",
  "ME Dept",
  "Civil Dept",
  "R & D Dept",
];

const nav = [
  { name: "Dashboard" as View, icon: LayoutDashboard },
  { name: "Assets" as View, icon: Package },
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

export default function Home() {
  const [view, setView] = useState<View>("Dashboard");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [adminState, setAdminState] = useState<"loading" | "signed-out" | "admin" | "denied">(
    firebaseReady ? "loading" : "admin",
  );
  const [signedInEmail, setSignedInEmail] = useState("");
  const [requirementWindow, setRequirementWindow] = useState<RequirementWindowRecord>(DEFAULT_REQUIREMENT_WINDOW);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [department, setDepartment] = useState("All");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modal, setModal] = useState<"asset" | "employee" | "assign" | "return" | "repair" | "request" | "document" | "qrBatch" | "schedule" | null>(null);
  const [documentType, setDocumentType] = useState("Asset Handover");
  const [documentEmployeeId, setDocumentEmployeeId] = useState("");
  const [documentAssetIds, setDocumentAssetIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;
    return watchAuth((user) => {
      const email = user?.email?.toLowerCase() ?? "";
      setSignedInEmail(email);
      if (!user) setAdminState("signed-out");
      else setAdminState(email === ADMIN_EMAIL ? "admin" : "denied");
    });
  }, []);

  useEffect(() => {
    if (!firebaseReady || adminState !== "admin") return;
    const cleanups = [
      watchCollection<Asset>("assets", setAssets),
      watchCollection<Employee>("employees", setEmployees),
      watchCollection<Movement>("movements", setMovements),
      watchCollection<RequestRow>("requirements", setRequests),
    ];
    getRequirementWindow().then((config) => config && setRequirementWindow(config));
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

  const filteredAssets = assets.filter((asset) => {
    const needle = search.toLowerCase();
    return (
      (category === "All" || asset.category === category) &&
      [asset.code, asset.name, asset.serial, asset.brand, asset.type]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  });

  const filteredEmployees = employees.filter((employee) => {
    const needle = search.toLowerCase();
    return (
      (department === "All" || employee.department === department) &&
      [employee.name, employee.empNo, employee.department, employee.designation]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  });

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function updateAsset(asset: Asset) {
    setAssets((rows) => rows.map((row) => (row.id === asset.id ? asset : row)));
    await saveRecord("assets", asset);
  }

  async function addMovement(movement: Movement) {
    const employee = employeeMap[movement.employeeId];
    const enriched = {
      ...movement,
      employeeName: employee?.name,
      department: employee?.department,
    };
    setMovements((rows) => [enriched, ...rows]);
    await saveRecord("movements", enriched);
    await saveRecord(`assets/${movement.assetId}/history`, {
      id: movement.id,
      type: movement.type,
      date: movement.date,
      note: movement.note,
      employeeName: employee?.name ?? "IT Department",
      department: employee?.department ?? "IT Dept",
    });
  }

  async function exportWorkbook() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const assetRows = assets.map((asset) => ({
      "Asset Code": asset.code,
      Category: asset.category,
      Type: asset.type,
      Asset: asset.name,
      Brand: asset.brand,
      Model: asset.model,
      "Serial Number": asset.serial,
      Status: asset.status,
      "Assigned Employee": asset.employeeId ? employeeMap[asset.employeeId]?.name : "",
      Department: asset.employeeId ? employeeMap[asset.employeeId]?.department : "",
      Condition: asset.condition,
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
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assetRows), "Current Assets");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeRows), "Employees");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(requests), "Requirements");
    XLSX.writeFile(workbook, `AssetFlow-current-report-${today()}.xlsx`);
    flash("Excel report downloaded");
  }

  function openDocument(type: string, employeeId = "", assetIds: string[] = []) {
    setDocumentType(type);
    setDocumentEmployeeId(employeeId);
    setDocumentAssetIds(assetIds);
    setModal("document");
  }

  const pendingRequirements = requests.filter((request) => request.status === "Pending").length;
  const healthyAssets = assets.filter((asset) => asset.status !== "In repair" && asset.status !== "Retired").length;
  const inventoryHealth = assets.length ? Math.round((healthyAssets / assets.length) * 100) : 100;

  if (firebaseReady && adminState !== "admin") {
    return <AdminGate state={adminState} email={signedInEmail} onSignIn={async () => {
      try {
        await signInAsAdmin();
      } catch {
        setAdminState("signed-out");
      }
    }} onSignOut={signOutAdmin} />;
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
              onClick={() => { setView(name); setSearch(""); setSidebarOpen(false); }}
            >
              <Icon size={19} />{name}
              {name === "Requirements" && pendingRequirements > 0 && <span className="nav-count">{pendingRequirements}</span>}
            </button>
          ))}
          <p className="nav-label second">MANAGEMENT</p>
          <button className="nav-item" onClick={() => { setView("Employees"); setDepartment("All"); }}><Building2 size={19} />Department directory</button>
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
          <div className="global-search"><Search size={19} /><input aria-label="Search assets and employees" placeholder="Search assets, people or serial numbers…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
          <div className="top-actions">
            <span className={firebaseReady ? "sync-pill live" : "sync-pill"}><CircleDot size={13} />{firebaseReady ? "Firebase live" : "Demo workspace"}</span>
            <button className="icon-button"><Bell size={19} /><i /></button>
            <div className="profile"><span>IT</span><div><strong>IT Services</strong><small>{signedInEmail || ADMIN_EMAIL}</small></div><ChevronDown size={16} /></div>
          </div>
        </header>

        <div className="content">
          {view === "Dashboard" && (
            <Dashboard
              assets={assets}
              requests={requests}
              movements={movements}
              employeeMap={employeeMap}
              assetMap={assetMap}
              onView={setView}
              onAddAsset={() => setModal("asset")}
              onAssign={() => setModal("assign")}
              onReturn={() => setModal("return")}
              onRequest={() => setModal("request")}
              onAsset={setSelectedAsset}
            />
          )}
          {view === "Assets" && (
            <AssetsView
              assets={filteredAssets}
              employeeMap={employeeMap}
              category={category}
              setCategory={setCategory}
              onAdd={() => setModal("asset")}
              onAsset={setSelectedAsset}
              onExport={exportWorkbook}
              onQrBatch={() => setModal("qrBatch")}
            />
          )}
          {view === "Employees" && (
            <EmployeesView
              employees={filteredEmployees}
              assets={assets}
              department={department}
              setDepartment={setDepartment}
              onAdd={() => setModal("employee")}
              onDocument={openDocument}
            />
          )}
          {view === "Movements" && (
            <MovementsView movements={movements} assetMap={assetMap} employeeMap={employeeMap} onAssign={() => setModal("assign")} onReturn={() => setModal("return")} onRepair={() => setModal("repair")} />
          )}
          {view === "Requirements" && (
            <RequirementsView requests={requests} setRequests={setRequests} windowConfig={requirementWindow} setWindowConfig={setRequirementWindow} onSchedule={() => setModal("schedule")} onAdd={() => setModal("request")} onExport={exportWorkbook} />
          )}
          {view === "Reports" && (
            <ReportsView assets={assets} employees={employees} requests={requests} onExport={exportWorkbook} onDocument={openDocument} />
          )}
        </div>
      </section>

      {selectedAsset && <AssetDrawer asset={selectedAsset} employee={selectedAsset.employeeId ? employeeMap[selectedAsset.employeeId] : undefined} movements={movements.filter((row) => row.assetId === selectedAsset.id)} employeeMap={employeeMap} onClose={() => setSelectedAsset(null)} />}
      {modal && (
        <Modal title={modalTitle(modal)} wide={modal === "document"} onClose={() => setModal(null)}>
          {modal === "asset" && <AssetForm onSave={async (asset) => { setAssets((rows) => [asset, ...rows]); await saveRecord("assets", asset); setModal(null); flash("Asset added to inventory"); }} />}
          {modal === "employee" && <EmployeeForm onSave={async (employee) => { setEmployees((rows) => [employee, ...rows]); await saveRecord("employees", employee); setModal(null); flash("Employee added"); }} />}
          {modal === "assign" && <AssignForm assets={assets} employees={employees} onSave={async (assetIds, employeeId) => { const employee = employeeMap[employeeId]; for (const assetId of assetIds) { const asset = assets.find((row) => row.id === assetId)!; await updateAsset({ ...asset, status: "Assigned", employeeId, custodianName: employee?.name, custodianDepartment: employee?.department, updatedAt: today() }); await addMovement({ id: crypto.randomUUID(), assetId, employeeId, type: "Assigned", date: today(), note: "Asset issued through AssetFlow" }); } openDocument("Asset Handover", employeeId, assetIds); flash(`${assetIds.length} item${assetIds.length > 1 ? "s" : ""} assigned — handover document ready`); }} />}
          {modal === "return" && <ReturnForm assets={assets} employees={employees} onSave={async (assetIds, employeeId, clearance) => { for (const assetId of assetIds) { const asset = assets.find((row) => row.id === assetId)!; await updateAsset({ ...asset, status: "Available", employeeId: undefined, custodianName: undefined, custodianDepartment: undefined, condition: "Good", updatedAt: today() }); await addMovement({ id: crypto.randomUUID(), assetId, employeeId, type: clearance ? "Cleared" : "Returned", date: today(), note: clearance ? "Returned during employee clearance" : "Returned to IT stock" }); } openDocument(clearance ? "Employee Clearance" : "Asset Return", employeeId, assetIds); flash(clearance ? "Clearance report ready" : "Return document ready"); }} />}
          {modal === "repair" && <RepairForm assets={assets} onSave={async (assetId, action, note) => { const asset = assets.find((row) => row.id === assetId); if (!asset) return; const nextStatus: AssetStatus = action === "start" ? "In repair" : asset.employeeId ? "Assigned" : "Available"; await updateAsset({ ...asset, status: nextStatus, condition: action === "start" ? "Repair" : "Good", updatedAt: today() }); await addMovement({ id: crypto.randomUUID(), assetId, employeeId: asset.employeeId || "", type: "Repair", date: today(), note: `${action === "start" ? "Sent for repair" : "Repair completed"}: ${note}` }); setModal(null); flash(action === "start" ? "Repair record started" : "Repair completion recorded"); }} />}
          {modal === "request" && <RequestForm onSave={async (request) => { setRequests((rows) => [request, ...rows]); await saveRecord("requirements", request); setModal(null); flash("Requirement submitted"); }} />}
          {modal === "document" && <PrintableDocument type={documentType} employees={employees} assets={assets} initialEmployeeId={documentEmployeeId} initialAssetIds={documentAssetIds} />}
          {modal === "qrBatch" && <QrBatch assets={assets} employeeMap={employeeMap} />}
          {modal === "schedule" && <ScheduleForm value={requirementWindow} onSave={async (next) => { setRequirementWindow(next); await saveRequirementWindow(next); setModal(null); flash(next.isOpen ? "Requirement form opened" : "Requirement form closed"); }} />}
        </Modal>
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function Dashboard({ assets, requests, movements, employeeMap, assetMap, onView, onAddAsset, onAssign, onReturn, onRequest, onAsset }: {
  assets: Asset[]; requests: RequestRow[]; movements: Movement[]; employeeMap: Record<string, Employee>; assetMap: Record<string, Asset>; onView: (view: View) => void; onAddAsset: () => void; onAssign: () => void; onReturn: () => void; onRequest: () => void; onAsset: (asset: Asset) => void;
}) {
  const assigned = assets.filter((asset) => asset.status === "Assigned").length;
  const available = assets.filter((asset) => asset.status === "Available").length;
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
        <Metric icon={Wrench} label="Needs attention" value={assets.filter((asset) => asset.status === "In repair").length.toString()} change="Items currently in repair" tone="orange" />
      </div>
      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <PanelHead title="Recent activity" subtitle="Latest asset movements across the company" action="View all" onClick={() => onView("Movements")} />
          <div className="activity-list">
            {movements.length === 0 && <div className="empty-panel"><History size={20} /><strong>No movements yet</strong><span>Assignments and returns will appear here.</span></div>}
            {movements.slice(0, 5).map((movement) => (
              <div className="activity-row" key={movement.id}>
                <div className={`activity-icon activity-${movement.type.toLowerCase()}`}>{movement.type === "Assigned" ? <ArrowLeftRight size={17} /> : movement.type === "Repair" ? <Wrench size={17} /> : <RotateCcw size={17} />}</div>
                <div><strong>{assetMap[movement.assetId]?.name}</strong><p>{movement.type} {movement.employeeId && <>· {employeeMap[movement.employeeId]?.name}</>}</p></div>
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

function AssetsView({ assets, employeeMap, category, setCategory, onAdd, onAsset, onExport, onQrBatch }: { assets: Asset[]; employeeMap: Record<string, Employee>; category: string; setCategory: (value: string) => void; onAdd: () => void; onAsset: (asset: Asset) => void; onExport: () => void; onQrBatch: () => void }) {
  return (
    <>
      <PageHead eyebrow="INVENTORY" title="Assets" description="Track every IT and non-IT item, its condition, owner and complete history.">
        <button className="button button-secondary" onClick={onQrBatch}><QrCode size={17} />Print QR labels</button>
        <button className="button button-secondary" onClick={onExport}><Download size={17} />Export</button>
        <button className="button button-primary" onClick={onAdd}><Plus size={17} />Add asset</button>
      </PageHead>
      <div className="filter-tabs">
        {["All", "IT Asset", "Non-IT Asset"].map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}<span>{item === "All" ? assets.length : assets.filter((asset) => asset.category === item).length}</span></button>)}
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><strong>Asset register</strong><small>{assets.length} matching records</small></div><div className="legend"><span><i className="dot green" />Available</span><span><i className="dot blue" />Assigned</span><span><i className="dot orange" />Repair</span></div></div>
        <AssetTable assets={assets} employeeMap={employeeMap} onAsset={onAsset} />
      </section>
    </>
  );
}

function EmployeesView({ employees, assets, department, setDepartment, onAdd, onDocument }: { employees: Employee[]; assets: Asset[]; department: string; setDepartment: (value: string) => void; onAdd: () => void; onDocument: (type: string) => void }) {
  return (
    <>
      <PageHead eyebrow="PEOPLE" title="Employees" description="See every employee and the full set of assets under their responsibility.">
        <button className="button button-secondary" onClick={() => onDocument("Employee Asset Summary")}><Printer size={17} />Print summary</button>
        <button className="button button-primary" onClick={onAdd}><Plus size={17} />Add employee</button>
      </PageHead>
      <div className="select-row"><label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><span>{employees.length} active employees</span></div>
      <div className="employee-grid">
        {employees.map((employee) => {
          const owned = assets.filter((asset) => asset.employeeId === employee.id);
          return <article className="employee-card" key={employee.id}><div className="employee-head"><span className="avatar">{initials(employee.name)}</span><span className={statusClass(employee.status)}>{employee.status}</span></div><h3>{employee.name}</h3><p>{employee.designation}</p><small>{employee.empNo} · {employee.department}</small><div className="asset-chip-row">{owned.length ? owned.slice(0, 3).map((asset) => <span key={asset.id}>{asset.type}</span>) : <em>No assets assigned</em>}{owned.length > 3 && <span>+{owned.length - 3}</span>}</div><div className="employee-foot"><strong>{owned.length} asset{owned.length !== 1 ? "s" : ""}</strong><button onClick={() => onDocument("Asset Handover")}>Document →</button></div></article>;
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
        <div className="timeline">{movements.length === 0 && <div className="empty-panel"><History size={20} /><strong>No lifecycle records yet</strong><span>Assignments, returns, clearance and repairs will appear here.</span></div>}{movements.map((movement) => <div key={movement.id} className="timeline-row"><div className={`timeline-mark activity-${movement.type.toLowerCase()}`}>{movement.type === "Assigned" ? <ArrowLeftRight size={17} /> : movement.type === "Repair" ? <Wrench size={17} /> : <RotateCcw size={17} />}</div><div><div className="timeline-title"><strong>{movement.type}</strong><span>{new Date(movement.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div><h3>{assetMap[movement.assetId]?.name} <small>{assetMap[movement.assetId]?.code}</small></h3><p>{movement.note}</p><span className="person-pill">{initials(employeeMap[movement.employeeId]?.name || "IT")} {employeeMap[movement.employeeId]?.name || "IT Department"}</span></div></div>)}</div>
      </section>
    </>
  );
}

function RequirementsView({ requests, setRequests, windowConfig, setWindowConfig, onSchedule, onAdd, onExport }: { requests: RequestRow[]; setRequests: React.Dispatch<React.SetStateAction<RequestRow[]>>; windowConfig: RequirementWindowRecord; setWindowConfig: (value: RequirementWindowRecord) => void; onSchedule: () => void; onAdd: () => void; onExport: () => void }) {
  const formUrl = typeof window === "undefined" ? "" : `${window.location.origin}/requirements/${windowConfig.slug}`;
  async function copyFormLink() {
    await navigator.clipboard.writeText(formUrl);
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

function ReportsView({ assets, employees, requests, onExport, onDocument }: { assets: Asset[]; employees: Employee[]; requests: RequestRow[]; onExport: () => void; onDocument: (type: string) => void }) {
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
      <PageHead eyebrow="DOCUMENT CENTRE" title="Reports & documents" description="Generate live operational reports, handover forms and clearance records."><button className="button button-primary" onClick={onExport}><Download size={17} />Export all data</button></PageHead>
      <div className="report-grid">{cards.map(({ icon: Icon, title, copy, action, click, tone }) => <article className="report-card" key={title}><span className={`report-icon ${tone}`}><Icon size={22} /></span><h3>{title}</h3><p>{copy}</p><button onClick={click}>{action}<ArrowDownToLine size={16} /></button></article>)}</div>
    </>
  );
}

function AssetTable({ assets, employeeMap, onAsset, compact = false }: { assets: Asset[]; employeeMap: Record<string, Employee>; onAsset: (asset: Asset) => void; compact?: boolean }) {
  return <div className="responsive-table"><table><thead><tr><th>Asset</th><th>Category</th>{!compact && <th>Serial number</th>}<th>Assigned to</th><th>Status</th><th /></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id} onClick={() => onAsset(asset)}><td><div className="asset-cell"><span>{asset.type === "Mobile Phone" ? <Smartphone size={18} /> : <Monitor size={18} />}</span><div><strong>{asset.name}</strong><small>{asset.code}</small></div></div></td><td><span className="category-label">{asset.category}</span></td>{!compact && <td><code>{asset.serial}</code></td>}<td>{asset.employeeId ? <div className="mini-person"><span>{initials(employeeMap[asset.employeeId]?.name || "")}</span><div><strong>{employeeMap[asset.employeeId]?.name}</strong><small>{employeeMap[asset.employeeId]?.department}</small></div></div> : <span className="muted">—</span>}</td><td><span className={statusClass(asset.status)}>{asset.status}</span></td><td><button className="row-action" aria-label={`View ${asset.name}`}>→</button></td></tr>)}</tbody></table></div>;
}

function AssetDrawer({ asset, employee, movements, employeeMap, onClose }: { asset: Asset; employee?: Employee; movements: Movement[]; employeeMap: Record<string, Employee>; onClose: () => void }) {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(`${window.location.origin}/asset/${asset.id}`, { width: 240, margin: 1, color: { dark: "#111827", light: "#ffffff" } }).then(setQr); }, [asset.id]);
  return <><button className="drawer-backdrop" aria-label="Close asset details" onClick={onClose} /><aside className="drawer"><div className="drawer-head"><div><span>{asset.code}</span><h2>{asset.name}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="drawer-body"><div className="asset-hero"><span className="asset-big-icon"><Monitor size={34} /></span><div><span className={statusClass(asset.status)}>{asset.status}</span><p>{asset.brand} · {asset.model}</p></div></div><section className="detail-section"><h3>Asset details</h3><div className="detail-grid"><label>Serial number<strong>{asset.serial}</strong></label><label>Condition<strong>{asset.condition}</strong></label><label>Category<strong>{asset.category}</strong></label><label>Type<strong>{asset.type}</strong></label></div><p className="spec-box">{asset.details}</p></section><section className="detail-section"><h3>Current custodian</h3>{employee ? <div className="owner-card"><span>{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>{employee.empNo} · {employee.department}</small><a href={`mailto:${employee.email}`}>{employee.email}</a></div></div> : <div className="empty-owner"><Package size={21} />Available in central stock</div>}</section><section className="detail-section qr-section"><div><h3>Live QR label</h3><p>Print and attach this code. Scanning always opens the latest asset record.</p><button className="button button-secondary" onClick={() => window.print()}><Printer size={16} />Print label</button></div>{qr && <img src={qr} alt={`QR code for ${asset.code}`} />}</section><section className="detail-section"><h3>History</h3><div className="mini-history">{movements.length ? movements.map((movement) => <div key={movement.id}><i /><div><strong>{movement.type}</strong><p>{employeeMap[movement.employeeId]?.name} · {movement.note}</p><small>{new Date(movement.date).toLocaleDateString("en-GB")}</small></div></div>) : <p className="muted">No previous movements.</p>}</div></section></div></aside></>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop"><section className={wide ? "modal modal-wide" : "modal"}><div className="modal-head"><div><span>ASSETFLOW</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="modal-body">{children}</div></section></div>;
}

function AssetForm({ onSave }: { onSave: (asset: Asset) => void }) {
  const [form, setForm] = useState({ category: "IT Asset", type: "Laptop", name: "", brand: "", model: "", serial: "", condition: "Excellent", details: "" });
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }) });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); const prefix = form.category === "IT Asset" ? "IT" : "NIT"; onSave({ id: crypto.randomUUID(), code: `${prefix}-${form.type.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-4)}`, ...form, category: form.category as Asset["category"], status: "Available", updatedAt: today() }); }}><label>Asset category<select {...field("category")}><option>IT Asset</option><option>Non-IT Asset</option></select></label><label>Item type<select {...field("type")}><option>Laptop</option><option>Monitor</option><option>Mouse</option><option>Laptop Charger</option><option>Headset</option><option>SIM</option><option>Mobile Phone</option><option>Laptop Bag</option><option>Computer Chair</option><option>Computer Table</option><option>Whiteboard</option><option>Other</option></select></label><label className="full">Display name<input required placeholder="e.g. Lenovo ThinkPad E14" {...field("name")} /></label><label>Brand<input required placeholder="Lenovo" {...field("brand")} /></label><label>Model<input required placeholder="ThinkPad E14 Gen 5" {...field("model")} /></label><label className="full">Serial number<input required placeholder="Manufacturer or company serial number" {...field("serial")} /></label><label>Condition<select {...field("condition")}><option>Excellent</option><option>Good</option><option>Fair</option><option>Repair</option></select></label><label className="full">Technical details<textarea placeholder="RAM, SSD/HDD, processor, SIM number, dimensions or other details…" {...field("details")} /></label><FormActions text="Add asset" /></form>;
}

function EmployeeForm({ onSave }: { onSave: (employee: Employee) => void }) {
  const [form, setForm] = useState({ name: "", empNo: "", email: "", department: departments[0], designation: "" });
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value }) });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ id: crypto.randomUUID(), ...form, status: "Active" }); }}><label className="full">Full name<input required placeholder="Employee full name" {...field("name")} /></label><label>Employee number<input required placeholder="EMP-0001" {...field("empNo")} /></label><label>Email<input required type="email" placeholder="name@company.lk" {...field("email")} /></label><label>Department<select {...field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label>Designation<input required placeholder="Job title" {...field("designation")} /></label><FormActions text="Add employee" /></form>;
}

function AssignForm({ assets, employees, onSave }: { assets: Asset[]; employees: Employee[]; onSave: (assetIds: string[], employeeId: string) => void }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [selected, setSelected] = useState<string[]>([]);
  const available = assets.filter((asset) => asset.status === "Available");
  return <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onSave(selected, employeeId); }}><label className="stacked-label">Assign to<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.filter((employee) => employee.status === "Active").map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.department}</option>)}</select></label><p className="field-heading">Select one or more available items</p><div className="check-list">{available.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.serial}</small></span><em>{asset.type}</em></label>)}</div><FormActions text={`Assign ${selected.length || ""} item${selected.length === 1 ? "" : "s"}`} disabled={!selected.length} /></form>;
}

function ReturnForm({ assets, employees, onSave }: { assets: Asset[]; employees: Employee[]; onSave: (assetIds: string[], employeeId: string, clearance: boolean) => void }) {
  const assignedEmployees = employees.filter((employee) => assets.some((asset) => asset.employeeId === employee.id));
  const [employeeId, setEmployeeId] = useState(assignedEmployees[0]?.id || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [clearance, setClearance] = useState(false);
  const owned = assets.filter((asset) => asset.employeeId === employeeId);
  return <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onSave(selected, employeeId, clearance); }}><label className="stacked-label">Employee<select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setSelected([]); }}>{assignedEmployees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.department}</option>)}</select></label><p className="field-heading">Choose returned items</p><div className="check-list">{owned.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.serial}</small></span><em>{asset.condition}</em></label>)}</div><label className="clearance-check"><input type="checkbox" checked={clearance} onChange={(event) => setClearance(event.target.checked)} /><span><strong>Employee clearance return</strong><small>Mark these items as part of final resignation clearance</small></span></label><FormActions text={clearance ? "Return & prepare clearance" : "Record return"} disabled={!selected.length} /></form>;
}

function RepairForm({ assets, onSave }: { assets: Asset[]; onSave: (assetId: string, action: "start" | "complete", note: string) => void }) {
  const repairable = assets.filter((asset) => asset.status !== "Retired");
  const [assetId, setAssetId] = useState(repairable[0]?.id || "");
  const [action, setAction] = useState<"start" | "complete">("start");
  const [note, setNote] = useState("");
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (assetId && note.trim()) onSave(assetId, action, note.trim()); }}>
    <label className="full">Asset<select value={assetId} onChange={(event) => { const nextId = event.target.value; setAssetId(nextId); setAction(assets.find((asset) => asset.id === nextId)?.status === "In repair" ? "complete" : "start"); }}>{repairable.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.code} · {asset.serial}</option>)}</select></label>
    <label className="full">Repair action<select value={action} onChange={(event) => setAction(event.target.value as "start" | "complete")}><option value="start">Send for repair</option><option value="complete">Mark repair completed</option></select></label>
    <label className="full">Repair details<textarea required minLength={5} placeholder="Fault, supplier, job reference, parts replaced or completion notes…" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {selectedAsset && <p className="full audit-badge">Current status: {selectedAsset.status} · Current condition: {selectedAsset.condition}</p>}
    <FormActions text={action === "start" ? "Start repair record" : "Complete repair record"} disabled={!assetId || note.trim().length < 5} />
  </form>;
}

function RequestForm({ onSave }: { onSave: (request: RequestRow) => void }) {
  const [form, setForm] = useState({ department: departments[0], item: "", quantity: "1", neededDate: "2026-09-01", reason: "" });
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }) });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ id: crypto.randomUUID(), department: form.department, item: form.item, quantity: Number(form.quantity), neededDate: form.neededDate, reason: form.reason, status: "Pending" }); }}><label className="full">Department<select {...field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full">Required item<input required placeholder="e.g. 24” monitor or Office licence key" {...field("item")} /></label><label>Quantity<input required min="1" type="number" {...field("quantity")} /></label><label>Needed date<input required type="date" {...field("neededDate")} /></label><label className="full">Business reason<textarea required placeholder="Explain the upcoming need, new employee, replacement or project…" {...field("reason")} /></label><FormActions text="Submit requirement" /></form>;
}

function PrintableDocument({ type, employees, assets, initialEmployeeId = "", initialAssetIds = [] }: { type: string; employees: Employee[]; assets: Asset[]; initialEmployeeId?: string; initialAssetIds?: string[] }) {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || employees[0]?.id || "");
  const employee = employees.find((row) => row.id === employeeId);
  const contextualAssets = initialAssetIds.length ? assets.filter((asset) => initialAssetIds.includes(asset.id)) : assets.filter((asset) => asset.employeeId === employeeId);
  const [selected, setSelected] = useState<string[]>(() => initialAssetIds.length ? initialAssetIds : assets.filter((asset) => asset.employeeId === (initialEmployeeId || employees[0]?.id)).map((asset) => asset.id));
  const owned = initialAssetIds.length ? contextualAssets : assets.filter((asset) => asset.employeeId === employeeId);
  const included = owned.filter((asset) => selected.includes(asset.id));
  const returnDocument = type.includes("Return") || type.includes("Clearance");
  return <div><div className="document-controls"><label>Employee<select value={employeeId} disabled={Boolean(initialEmployeeId)} onChange={(event) => { const nextId = event.target.value; setEmployeeId(nextId); setSelected(assets.filter((asset) => asset.employeeId === nextId).map((asset) => asset.id)); }}>{employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="button button-primary" disabled={!employee || !included.length} onClick={() => window.print()}><Printer size={17} />Print / Save PDF</button></div><div className="document-item-picker"><div><strong>Select items for this document</strong><span>{selected.length} of {owned.length} included</span></div><div>{owned.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} />{asset.name}<small>{asset.code}</small></label>)}</div></div><article className="print-document"><div className="document-accent" /><header><div><strong>ASSETFLOW</strong><span>Company Asset Management · Official Record</span></div><p>{type}</p></header><div className="document-title"><span>{type.toUpperCase()}</span><h1>{employee?.name || "Select an employee"}</h1><p>{employee ? `${employee.empNo} · ${employee.designation} · ${employee.department}` : "No employee selected"}</p></div><div className="document-meta"><span>Document date<strong>{new Date().toLocaleDateString("en-GB")}</strong></span><span>Reference<strong>AF-{employee?.empNo || "UNASSIGNED"}-{type.replaceAll(" ", "-").toUpperCase()}</strong></span><span>Items covered<strong>{included.length}</strong></span></div><table><thead><tr><th>#</th><th>Asset / item</th><th>Asset code</th><th>Serial number</th><th>Condition</th></tr></thead><tbody>{included.map((asset, index) => <tr key={asset.id}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{asset.name}</strong><small>{asset.details}</small></td><td>{asset.code}</td><td>{asset.serial}</td><td><span className="document-condition">{asset.condition}</span></td></tr>)}</tbody></table><p className="document-statement">{returnDocument ? "The assets listed above have been returned to the company and verified by the responsible department. Any exception or damage must be recorded before final employee clearance is approved." : "I acknowledge receipt and responsibility for the company assets listed above. I agree to use them only for authorised company work, take reasonable care of them, and return them in good condition when requested."}</p><div className="signature-grid"><span>Employee signature<small>Name, signature & date</small></span><span>Issued / received by<small>IT Department</small></span><span>Authorised by<small>Department Head</small></span></div><footer><strong>AssetFlow verified document</strong><span>Generated from the live company asset register · {new Date().toLocaleString("en-GB")}</span></footer></article></div>;
}

function QrBatch({ assets, employeeMap }: { assets: Asset[]; employeeMap: Record<string, Employee> }) {
  const [category, setCategory] = useState("All");
  const filtered = assets.filter((asset) => category === "All" || asset.category === category);
  const [selected, setSelected] = useState<string[]>(assets.map((asset) => asset.id));
  const visible = filtered.filter((asset) => selected.includes(asset.id));
  return <div className="qr-batch">
    <div className="qr-batch-toolbar">
      <label>Asset group<select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>IT Asset</option><option>Non-IT Asset</option></select></label>
      <div><button className="button button-secondary" onClick={() => setSelected((rows) => filtered.every((asset) => rows.includes(asset.id)) ? rows.filter((id) => !filtered.some((asset) => asset.id === id)) : Array.from(new Set([...rows, ...filtered.map((asset) => asset.id)])))}><Check size={16} />Select / clear group</button><button className="button button-primary" disabled={!visible.length} onClick={() => window.print()}><Printer size={17} />Print {visible.length} labels</button></div>
    </div>
    <div className="qr-batch-tip"><QrCode size={19} /><div><strong>Fast method for 100+ labels</strong><p>Filter a group, select all, then print on A4 adhesive label sheets. AssetFlow automatically arranges 24 labels per page; no one-by-one printing.</p></div></div>
    <div className="qr-select-list">{filtered.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.serial}</small></span><em>{asset.employeeId ? employeeMap[asset.employeeId]?.name : "In stock"}</em></label>)}</div>
    <section className="qr-print-sheet">{visible.map((asset) => <QrLabel key={asset.id} asset={asset} owner={asset.employeeId ? employeeMap[asset.employeeId]?.name : undefined} />)}</section>
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
  return <article className="qr-label"><div className="qr-label-brand"><ShieldCheck size={13} /><strong>ASSETFLOW</strong></div>{src && <img src={src} alt="" />}<div><strong>{asset.name}</strong><span>{asset.code}</span><small>{asset.serial}</small><em>{owner || "IT Department stock"}</em></div></article>;
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

function AdminGate({ state, email, onSignIn, onSignOut }: { state: "loading" | "signed-out" | "admin" | "denied"; email: string; onSignIn: () => void; onSignOut: () => void }) {
  return <main className="admin-gate"><section><div className="admin-gate-brand"><ShieldCheck size={27} /><strong>AssetFlow</strong></div>{state === "loading" ? <><span className="gate-icon"><CircleDot size={27} /></span><h1>Verifying administrator…</h1></> : state === "denied" ? <><span className="gate-icon denied"><LockKeyhole size={27} /></span><h1>Dashboard access restricted</h1><p><strong>{email}</strong> is signed in, but only <strong>{ADMIN_EMAIL}</strong> can access company asset controls.</p><button className="button button-primary" onClick={onSignOut}><LogOut size={17} />Sign out and switch account</button></> : <><span className="gate-icon"><LockKeyhole size={27} /></span><h1>Administrator sign in</h1><p>Asset records, employee data and management controls are restricted to <strong>{ADMIN_EMAIL}</strong>.</p><button className="button button-primary" onClick={onSignIn}><ShieldCheck size={17} />Continue with Google</button></>}<small>Public QR records and department requirement forms do not expose this dashboard.</small></section></main>;
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
  return { asset: "Add a new asset", employee: "Add employee", assign: "Assign assets", return: "Return assets", repair: "Record asset repair", request: "Submit requirement", document: "Generate document", qrBatch: "Batch QR label printing", schedule: "Requirement form window" }[modal] || modal;
}
