"use client";

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
  Download,
  FileSpreadsheet,
  History,
  LayoutDashboard,
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
import { firebaseReady, saveRecord, watchCollection } from "@/lib/firebase";

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
};
type RequestRow = {
  id: string;
  department: string;
  item: string;
  quantity: number;
  neededDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Declined";
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

const demoEmployees: Employee[] = [
  { id: "e1", empNo: "EMP-0142", name: "Nethmi Perera", email: "nethmi@company.lk", department: "HR Dept", designation: "HR Executive", status: "Active" },
  { id: "e2", empNo: "EMP-0098", name: "Kasun Silva", email: "kasun@company.lk", department: "IT Dept", designation: "Systems Engineer", status: "Active" },
  { id: "e3", empNo: "EMP-0217", name: "Shehani Fernando", email: "shehani@company.lk", department: "Marketing Dept", designation: "Brand Executive", status: "Active" },
  { id: "e4", empNo: "EMP-0065", name: "Imran Ahamed", email: "imran@company.lk", department: "Finance Dept", designation: "Accountant", status: "Active" },
  { id: "e5", empNo: "EMP-0184", name: "Tharindu Jayasekara", email: "tharindu@company.lk", department: "EEE Dept", designation: "Lecturer", status: "Active" },
  { id: "e6", empNo: "EMP-0031", name: "Ayesha Wijesinghe", email: "ayesha@company.lk", department: "Registrar Dept", designation: "Senior Executive", status: "Active" },
];

const demoAssets: Asset[] = [
  { id: "a1", code: "IT-LAP-0048", name: "Dell Latitude 5440", category: "IT Asset", type: "Laptop", brand: "Dell", model: "Latitude 5440", serial: "DL5440-SL-8842", status: "Assigned", employeeId: "e1", condition: "Good", details: "Intel Core i5 13th Gen · 16 GB RAM · 512 GB SSD", updatedAt: "2026-07-26" },
  { id: "a2", code: "IT-MON-0021", name: "Dell 24” Monitor", category: "IT Asset", type: "Monitor", brand: "Dell", model: "P2422H", serial: "MON-P24-1298", status: "Available", condition: "Excellent", details: "24 inch · Full HD · DisplayPort", updatedAt: "2026-07-24" },
  { id: "a3", code: "IT-PHN-0014", name: "Samsung Galaxy A55", category: "IT Asset", type: "Mobile Phone", brand: "Samsung", model: "Galaxy A55", serial: "RF8XA2104LK", status: "Assigned", employeeId: "e3", condition: "Good", details: "128 GB · Dual SIM · Company SIM 077 456 2189", updatedAt: "2026-07-20" },
  { id: "a4", code: "NIT-CHR-0112", name: "Ergonomic Office Chair", category: "Non-IT Asset", type: "Computer Chair", brand: "Damro", model: "Ergo Pro", serial: "CHR-ER-0112", status: "Assigned", employeeId: "e4", condition: "Good", details: "Black mesh · Adjustable lumbar support", updatedAt: "2026-07-18" },
  { id: "a5", code: "IT-HDS-0037", name: "Jabra Evolve 20", category: "IT Asset", type: "Headset", brand: "Jabra", model: "Evolve 20", serial: "JB-E20-7341", status: "In repair", employeeId: "e2", condition: "Repair", details: "USB headset · Microphone cable issue", updatedAt: "2026-07-27" },
  { id: "a6", code: "IT-BAG-0064", name: "Targus Laptop Bag", category: "IT Asset", type: "Laptop Bag", brand: "Targus", model: "CitySmart", serial: "TG-CS-0064", status: "Available", condition: "Good", details: "15.6 inch · Black", updatedAt: "2026-07-11" },
  { id: "a7", code: "IT-MOU-0081", name: "Logitech M90 Mouse", category: "IT Asset", type: "Mouse", brand: "Logitech", model: "M90", serial: "LG-M90-0081", status: "Assigned", employeeId: "e1", condition: "Good", details: "USB optical mouse", updatedAt: "2026-07-26" },
  { id: "a8", code: "NIT-TBL-0033", name: "Office Workstation", category: "Non-IT Asset", type: "Computer Table", brand: "Local", model: "L-Desk", serial: "TBL-LD-0033", status: "Available", condition: "Good", details: "Walnut finish · 150 × 75 cm", updatedAt: "2026-07-05" },
];

const demoMovements: Movement[] = [
  { id: "m1", assetId: "a1", employeeId: "e1", type: "Assigned", date: "2026-01-08", note: "Issued with charger and laptop bag" },
  { id: "m2", assetId: "a1", employeeId: "e2", type: "Returned", date: "2025-12-22", note: "Returned in good condition" },
  { id: "m3", assetId: "a1", employeeId: "e2", type: "Assigned", date: "2024-11-04", note: "New employee allocation" },
  { id: "m4", assetId: "a5", employeeId: "e2", type: "Repair", date: "2026-07-27", note: "Microphone cable intermittently disconnects" },
  { id: "m5", assetId: "a3", employeeId: "e3", type: "Assigned", date: "2026-03-12", note: "Issued with company SIM" },
];

const demoRequests: RequestRow[] = [
  { id: "r1", department: "HR Dept", item: "Ergonomic office chair", quantity: 4, neededDate: "2026-09-15", reason: "Four new employees joining in September", status: "Pending" },
  { id: "r2", department: "EEE Dept", item: "24” Monitor", quantity: 3, neededDate: "2026-09-05", reason: "New electronics simulation lab workstations", status: "Approved" },
  { id: "r3", department: "Marketing Dept", item: "Adobe Creative Cloud licence", quantity: 2, neededDate: "2026-08-30", reason: "Design team expansion", status: "Pending" },
  { id: "r4", department: "Finance Dept", item: "Laptop", quantity: 1, neededDate: "2026-09-20", reason: "Replacement for end-of-life device", status: "Approved" },
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
  const [assets, setAssets] = useState<Asset[]>(demoAssets);
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [movements, setMovements] = useState<Movement[]>(demoMovements);
  const [requests, setRequests] = useState<RequestRow[]>(demoRequests);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [department, setDepartment] = useState("All");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modal, setModal] = useState<"asset" | "employee" | "assign" | "return" | "request" | "document" | null>(null);
  const [documentType, setDocumentType] = useState("Asset Handover");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;
    const cleanups = [
      watchCollection<Asset>("assets", (rows) => rows.length && setAssets(rows)),
      watchCollection<Employee>("employees", (rows) => rows.length && setEmployees(rows)),
      watchCollection<Movement>("movements", (rows) => rows.length && setMovements(rows)),
      watchCollection<RequestRow>("requirements", (rows) => rows.length && setRequests(rows)),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

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
    setMovements((rows) => [movement, ...rows]);
    await saveRecord("movements", movement);
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

  function openDocument(type: string) {
    setDocumentType(type);
    setModal("document");
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
              {name === "Requirements" && <span className="nav-count">4</span>}
            </button>
          ))}
          <p className="nav-label second">MANAGEMENT</p>
          <button className="nav-item"><Building2 size={19} />Departments</button>
          <button className="nav-item"><Settings size={19} />Settings</button>
        </nav>
        <div className="sidebar-foot">
          <div className="storage-row"><span>Inventory health</span><strong>94%</strong></div>
          <div className="progress"><span /></div>
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
            <div className="profile"><span>DA</span><div><strong>Disitha Admin</strong><small>Asset Manager</small></div><ChevronDown size={16} /></div>
          </div>
        </header>

        <div className="content">
          {view === "Dashboard" && (
            <Dashboard
              assets={assets}
              employees={employees}
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
            <MovementsView movements={movements} assetMap={assetMap} employeeMap={employeeMap} onAssign={() => setModal("assign")} onReturn={() => setModal("return")} />
          )}
          {view === "Requirements" && (
            <RequirementsView requests={requests} setRequests={setRequests} onAdd={() => setModal("request")} onExport={exportWorkbook} />
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
          {modal === "assign" && <AssignForm assets={assets} employees={employees} onSave={async (assetIds, employeeId) => { for (const assetId of assetIds) { const asset = assets.find((row) => row.id === assetId)!; await updateAsset({ ...asset, status: "Assigned", employeeId, updatedAt: today() }); await addMovement({ id: crypto.randomUUID(), assetId, employeeId, type: "Assigned", date: today(), note: "Asset issued through AssetFlow" }); } setModal(null); flash(`${assetIds.length} item${assetIds.length > 1 ? "s" : ""} assigned`); }} />}
          {modal === "return" && <ReturnForm assets={assets} employees={employees} onSave={async (assetIds, employeeId, clearance) => { for (const assetId of assetIds) { const asset = assets.find((row) => row.id === assetId)!; await updateAsset({ ...asset, status: "Available", employeeId: undefined, condition: "Good", updatedAt: today() }); await addMovement({ id: crypto.randomUUID(), assetId, employeeId, type: clearance ? "Cleared" : "Returned", date: today(), note: clearance ? "Returned during employee clearance" : "Returned to IT stock" }); } setModal(null); flash(clearance ? "Clearance return recorded" : "Return recorded"); }} />}
          {modal === "request" && <RequestForm onSave={async (request) => { setRequests((rows) => [request, ...rows]); await saveRecord("requirements", request); setModal(null); flash("Requirement submitted"); }} />}
          {modal === "document" && <PrintableDocument type={documentType} employees={employees} assets={assets} />}
        </Modal>
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function Dashboard({ assets, employees, requests, movements, employeeMap, assetMap, onView, onAddAsset, onAssign, onReturn, onRequest, onAsset }: {
  assets: Asset[]; employees: Employee[]; requests: RequestRow[]; movements: Movement[]; employeeMap: Record<string, Employee>; assetMap: Record<string, Asset>; onView: (view: View) => void; onAddAsset: () => void; onAssign: () => void; onReturn: () => void; onRequest: () => void; onAsset: (asset: Asset) => void;
}) {
  const assigned = assets.filter((asset) => asset.status === "Assigned").length;
  const available = assets.filter((asset) => asset.status === "Available").length;
  return (
    <>
      <PageHead eyebrow="TUESDAY, 28 JULY 2026" title="Good evening, Disitha" description="Here’s what’s happening with your company assets today.">
        <button className="button button-secondary" onClick={onAssign}><ArrowLeftRight size={17} />Assign assets</button>
        <button className="button button-primary" onClick={onAddAsset}><Plus size={17} />Add asset</button>
      </PageHead>
      <div className="metric-grid">
        <Metric icon={Package} label="Total assets" value={assets.length.toString()} change="+12 this month" tone="violet" />
        <Metric icon={Users} label="Assigned" value={assigned.toString()} change={`${Math.round((assigned / assets.length) * 100)}% utilisation`} tone="blue" />
        <Metric icon={ClipboardCheck} label="Available stock" value={available.toString()} change="Ready to assign" tone="green" />
        <Metric icon={Wrench} label="Needs attention" value={assets.filter((asset) => asset.status === "In repair").length.toString()} change="1 repair overdue" tone="orange" />
      </div>
      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <PanelHead title="Recent activity" subtitle="Latest asset movements across the company" action="View all" onClick={() => onView("Movements")} />
          <div className="activity-list">
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
          <PanelHead title="Upcoming requirements" subtitle="Current collection window · closes 31 Aug" action={`${requests.filter((r) => r.status === "Pending").length} pending`} onClick={() => onView("Requirements")} />
          <div className="request-list">
            {requests.slice(0, 4).map((request) => <div key={request.id}><span className="dept-badge">{request.department.split(" ")[0]}</span><div><strong>{request.quantity} × {request.item}</strong><small>{request.department} · Need by {new Date(request.neededDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></div><span className={statusClass(request.status)}>{request.status}</span></div>)}
          </div>
        </section>
      </div>
    </>
  );
}

function AssetsView({ assets, employeeMap, category, setCategory, onAdd, onAsset, onExport }: { assets: Asset[]; employeeMap: Record<string, Employee>; category: string; setCategory: (value: string) => void; onAdd: () => void; onAsset: (asset: Asset) => void; onExport: () => void }) {
  return (
    <>
      <PageHead eyebrow="INVENTORY" title="Assets" description="Track every IT and non-IT item, its condition, owner and complete history.">
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

function MovementsView({ movements, assetMap, employeeMap, onAssign, onReturn }: { movements: Movement[]; assetMap: Record<string, Asset>; employeeMap: Record<string, Employee>; onAssign: () => void; onReturn: () => void }) {
  return (
    <>
      <PageHead eyebrow="AUDIT TRAIL" title="Asset movements" description="Every assignment, return, clearance and repair is permanently recorded.">
        <button className="button button-secondary" onClick={onReturn}><RotateCcw size={17} />Record return</button><button className="button button-primary" onClick={onAssign}><ArrowLeftRight size={17} />New assignment</button>
      </PageHead>
      <section className="panel timeline-panel">
        <div className="table-toolbar"><div><strong>Complete history</strong><small>Newest activity first</small></div><span className="audit-badge"><ShieldCheck size={15} />Audit-ready records</span></div>
        <div className="timeline">{movements.map((movement) => <div key={movement.id} className="timeline-row"><div className={`timeline-mark activity-${movement.type.toLowerCase()}`}>{movement.type === "Assigned" ? <ArrowLeftRight size={17} /> : movement.type === "Repair" ? <Wrench size={17} /> : <RotateCcw size={17} />}</div><div><div className="timeline-title"><strong>{movement.type}</strong><span>{new Date(movement.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div><h3>{assetMap[movement.assetId]?.name} <small>{assetMap[movement.assetId]?.code}</small></h3><p>{movement.note}</p><span className="person-pill">{initials(employeeMap[movement.employeeId]?.name || "IT")} {employeeMap[movement.employeeId]?.name}</span></div></div>)}</div>
      </section>
    </>
  );
}

function RequirementsView({ requests, setRequests, onAdd, onExport }: { requests: RequestRow[]; setRequests: React.Dispatch<React.SetStateAction<RequestRow[]>>; onAdd: () => void; onExport: () => void }) {
  return (
    <>
      <PageHead eyebrow="PLANNING WINDOW" title="Department requirements" description="Collect upcoming two-month needs in one controlled submission window.">
        <button className="button button-secondary" onClick={onExport}><Download size={17} />Export summary</button><button className="button button-primary" onClick={onAdd}><Plus size={17} />Submit requirement</button>
      </PageHead>
      <div className="window-banner"><div className="window-icon"><CalendarClock size={24} /></div><div><span>SUBMISSION WINDOW OPEN</span><h3>August–September 2026 requirements</h3><p>Departments can submit needs until 31 August 2026 at 5:00 PM.</p></div><div className="countdown"><strong>34</strong><span>days left</span></div></div>
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
  useEffect(() => { QRCode.toDataURL(`${window.location.origin}/?asset=${asset.id}`, { width: 240, margin: 1, color: { dark: "#111827", light: "#ffffff" } }).then(setQr); }, [asset.id]);
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
  useEffect(() => setSelected([]), [employeeId]);
  return <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onSave(selected, employeeId, clearance); }}><label className="stacked-label">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{assignedEmployees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.department}</option>)}</select></label><p className="field-heading">Choose returned items</p><div className="check-list">{owned.map((asset) => <label key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((rows) => rows.includes(asset.id) ? rows.filter((id) => id !== asset.id) : [...rows, asset.id])} /><span><strong>{asset.name}</strong><small>{asset.code} · {asset.serial}</small></span><em>{asset.condition}</em></label>)}</div><label className="clearance-check"><input type="checkbox" checked={clearance} onChange={(event) => setClearance(event.target.checked)} /><span><strong>Employee clearance return</strong><small>Mark these items as part of final resignation clearance</small></span></label><FormActions text={clearance ? "Return & prepare clearance" : "Record return"} disabled={!selected.length} /></form>;
}

function RequestForm({ onSave }: { onSave: (request: RequestRow) => void }) {
  const [form, setForm] = useState({ department: departments[0], item: "", quantity: "1", neededDate: "2026-09-01", reason: "" });
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }) });
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ id: crypto.randomUUID(), department: form.department, item: form.item, quantity: Number(form.quantity), neededDate: form.neededDate, reason: form.reason, status: "Pending" }); }}><label className="full">Department<select {...field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full">Required item<input required placeholder="e.g. 24” monitor or Office licence key" {...field("item")} /></label><label>Quantity<input required min="1" type="number" {...field("quantity")} /></label><label>Needed date<input required type="date" {...field("neededDate")} /></label><label className="full">Business reason<textarea required placeholder="Explain the upcoming need, new employee, replacement or project…" {...field("reason")} /></label><FormActions text="Submit requirement" /></form>;
}

function PrintableDocument({ type, employees, assets }: { type: string; employees: Employee[]; assets: Asset[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const employee = employees.find((row) => row.id === employeeId);
  const owned = assets.filter((asset) => asset.employeeId === employeeId);
  return <div><div className="document-controls"><label>Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="button button-primary" onClick={() => window.print()}><Printer size={17} />Print / Save PDF</button></div><article className="print-document"><header><div><strong>ASSETFLOW</strong><span>Company Asset Management</span></div><p>{type}</p></header><div className="document-title"><span>{type.toUpperCase()}</span><h1>{employee?.name}</h1><p>{employee?.empNo} · {employee?.designation} · {employee?.department}</p></div><div className="document-meta"><span>Document date<strong>{new Date().toLocaleDateString("en-GB")}</strong></span><span>Reference<strong>AF-{Date.now().toString().slice(-7)}</strong></span><span>Items covered<strong>{owned.length}</strong></span></div><table><thead><tr><th>#</th><th>Asset / item</th><th>Asset code</th><th>Serial number</th><th>Condition</th></tr></thead><tbody>{owned.map((asset, index) => <tr key={asset.id}><td>{index + 1}</td><td><strong>{asset.name}</strong><small>{asset.details}</small></td><td>{asset.code}</td><td>{asset.serial}</td><td>{asset.condition}</td></tr>)}</tbody></table><p className="document-statement">{type.includes("Clearance") ? "The above items have been returned to the company and verified by the responsible department. Any exceptions must be recorded before final clearance." : "I acknowledge receipt and responsibility for the company assets listed above. I agree to use them for authorised company work and return them in good condition when requested."}</p><div className="signature-grid"><span>Employee signature<small>Name & date</small></span><span>Issued / received by<small>IT Department</small></span><span>Authorised by<small>Department Head</small></span></div><footer>Generated from AssetFlow · Live company asset register</footer></article></div>;
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
  return { asset: "Add a new asset", employee: "Add employee", assign: "Assign assets", return: "Return assets", request: "Submit requirement", document: "Generate document" }[modal] || modal;
}
