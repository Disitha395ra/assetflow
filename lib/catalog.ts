export const DEFAULT_DEPARTMENTS = [
  "Admin Dept",
  "HR Dept",
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

export const LOCATION_BUILDINGS = [
  "Building 1 (Main)",
  "Building 2 (New)",
] as const;

export const DEFAULT_LOCATIONS = [
  "Building 1 (Main) - Board Room",
  "Building 1 (Main) - Mechatronics Lab",
  "Building 1 (Main) - E&E Lab",
  "Building 1 (Main) - Admin Room",
  "Building 1 (Main) - Admission Office",
  "Building 1 (Main) - Computer Lab",
  "Building 1 (Main) - Classroom 101",
  "Building 1 (Main) - Classroom 102",
  "Building 1 (Main) - Classroom 103",
  "Building 2 (New) - Library",
  "Building 2 (New) - Classroom 101",
  "Building 2 (New) - Classroom 102",
  "Building 2 (New) - Classroom 201",
  "Building 2 (New) - Classroom 202",
  "Building 2 (New) - Classroom 301",
];

export function groupLocationsByBuilding(locations: string[]) {
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const loc of locations) {
    const sepIndex = loc.indexOf(" - ");
    const groupName = sepIndex > 0 ? loc.slice(0, sepIndex).trim() : "Other Locations";
    const roomLabel = sepIndex > 0 ? loc.slice(sepIndex + 3).trim() : loc.trim();
    const list = groups.get(groupName) ?? [];
    list.push({ value: loc, label: roomLabel || loc });
    groups.set(groupName, list);
  }
  return Array.from(groups.entries());
}

export const ASSET_TYPES = {
  "IT Asset": [
    "Laptop",
    "Monitor",
    "Classroom / Location Monitor",
    "Google Chromecast",
    "Printer",
    "Mouse",
    "Laptop Charger",
    "Headset",
    "SIM",
    "Mobile Phone",
    "Laptop Bag",
    "Other",
  ],
  "Non-IT Asset": [
    "Chair",
    "Table",
    "Other",
  ],
} as const;

export const LOCATION_ONLY_ASSET_TYPES = [
  "Classroom / Location Monitor",
  "Google Chromecast",
] as const;

export function isLocationOnlyAssetType(type: string) {
  return (LOCATION_ONLY_ASSET_TYPES as readonly string[]).includes(type);
}

export function isMonitorAssetType(type: string) {
  return type === "Monitor" || type === "Classroom / Location Monitor";
}

export function isPrinterAssetType(type: string) {
  return type === "Printer";
}

export const TONER_COLORS = [
  "Black",
  "Cyan",
  "Magenta",
  "Yellow",
  "Tri-Color",
  "Drum Unit",
  "Maintenance Kit",
] as const;

export const NON_IT_ITEM_MODELS = {
  Table: [
    "Alpha (60*120)",
    "Alpha CT-03 (135*80)",
    "Damro (135*70)",
    "KWT022 (75*152)",
  ],
  Chair: [
    "OCM-043",
    "OCL-018",
    "OCH-014",
    "Task Chair OCP-001",
  ],
} as const;

export const FURNITURE_IMAGE_OPTIONS = [
  { key: "chair-01", type: "Chair", label: "Low Back Chair", model: "OCL-018", src: "/assets/furniture/chair-01.png" },
  { key: "chair-02", type: "Chair", label: "Low Back Chair", model: "OCM-043", src: "/assets/furniture/chair-02.png" },
  { key: "chair-03", type: "Chair", label: "Task Chair", model: "OCP-001", src: "/assets/furniture/chair-03.png" },
  { key: "chair-04", type: "Chair", label: "Low Back Chair", model: "OCL-053", src: "/assets/furniture/chair-04.png" },
  { key: "table-01", type: "Table", label: "Office Table", model: "KWT022", src: "/assets/furniture/table-01.png" },
  { key: "table-02-alpha", type: "Table", label: "Alpha Office Table", model: "Alpha", src: "/assets/furniture/table-02-alpha.png" },
] as const;

export function furnitureImageForAsset(asset: { type: string; name?: string; model?: string; imageKey?: string }) {
  const explicit = FURNITURE_IMAGE_OPTIONS.find((option) => option.key === asset.imageKey);
  if (explicit) return explicit;
  const searchable = `${asset.name ?? ""} ${asset.model ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (asset.type === "Chair") {
    if (searchable.includes("ocm043")) return FURNITURE_IMAGE_OPTIONS[1];
    if (searchable.includes("ocp001")) return FURNITURE_IMAGE_OPTIONS[2];
    if (searchable.includes("ocl053")) return FURNITURE_IMAGE_OPTIONS[3];
    return FURNITURE_IMAGE_OPTIONS[0];
  }
  if (asset.type === "Table") {
    if (searchable.includes("alpha")) return FURNITURE_IMAGE_OPTIONS[5];
    return FURNITURE_IMAGE_OPTIONS[4];
  }
  return undefined;
}

export type AssetSpecField = {
  key: string;
  label: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
};

export const MONITOR_SCREEN_SIZES = [
  "19 inch",
  "20 inch",
  "21 inch",
  "22 inch",
  "24 inch",
  "27 inch",
  "32 inch",
] as const;

export const ASSET_SPEC_FIELDS: Record<string, AssetSpecField[]> = {
  Laptop: [
    { key: "ram", label: "RAM size", options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB"] },
    { key: "storageType", label: "Storage type", options: ["NVMe SSD", "SSD", "HDD", "SSD + HDD"] },
    { key: "storageSize", label: "Storage capacity", options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB", "4 TB"] },
    { key: "processor", label: "Processor", placeholder: "e.g. Intel Core i5-1335U" },
    { key: "pCores", label: "No. of P-Cores", options: ["0", "2", "4", "5", "6", "8", "10", "12", "14", "16", "N/A"] },
    { key: "eCores", label: "No. of E-Cores", options: ["0", "2", "4", "6", "8", "10", "12", "16", "N/A"] },
  ],
  Monitor: [
    { key: "screenSize", label: "Screen size", options: [...MONITOR_SCREEN_SIZES] },
    { key: "resolution", label: "Resolution", options: ["HD", "Full HD", "2K / QHD", "4K / UHD", "Other"] },
    { key: "connector", label: "Connection", options: ["HDMI", "DisplayPort", "USB-C", "VGA", "Multiple"] },
  ],
  "Classroom / Location Monitor": [
    { key: "screenSize", label: "Screen size", options: [...MONITOR_SCREEN_SIZES] },
    { key: "resolution", label: "Resolution", options: ["HD", "Full HD", "2K / QHD", "4K / UHD", "Other"] },
    { key: "connector", label: "Connection", options: ["HDMI", "DisplayPort", "USB-C", "VGA", "Multiple"] },
    { key: "mountType", label: "Mount / placement", options: ["Wall Mounted", "Desk Stand", "Ceiling Bracket", "Mobile Stand", "Podium"] },
  ],
  "Google Chromecast": [
    { key: "generation", label: "Chromecast model", options: ["Chromecast with Google TV (4K)", "Chromecast with Google TV (HD)", "Chromecast Ultra", "Chromecast (3rd Gen)", "Chromecast (2nd Gen)", "Google TV Streamer", "Other"] },
    { key: "resolution", label: "Max resolution", options: ["1080p Full HD", "4K UHD", "4K HDR"] },
    { key: "connectivity", label: "Connectivity", options: ["Wi-Fi", "Wi-Fi + Ethernet Adapter"] },
    { key: "remoteIncluded", label: "Remote included", options: ["Yes (Voice Remote)", "No"] },
  ],
  Printer: [
    { key: "printerType", label: "Printer type", options: ["Laser (Mono)", "Laser (Color)", "Multifunction Laser (MFP)", "Inkjet / Ink Tank", "Dot Matrix", "Thermal / Label", "Other"] },
    { key: "printColor", label: "Color mode", options: ["Monochrome (Black)", "Color (CMYK)"] },
    { key: "connectivity", label: "Connectivity", options: ["USB", "Ethernet (LAN)", "Wi-Fi", "USB + LAN", "USB + LAN + Wi-Fi"] },
    { key: "duplex", label: "Duplex printing", options: ["Automatic Duplex", "Manual Duplex", "Single-sided"] },
    { key: "compatibleToner", label: "Compatible toner model", placeholder: "e.g. HP 58A / Canon 057 / TN-2380" },
    { key: "ipAddress", label: "Network IP address", placeholder: "e.g. 192.168.1.50 (optional)", required: false },
  ],
  Mouse: [
    { key: "connectivity", label: "Connection type", options: ["Wired USB", "Wireless USB", "Bluetooth", "Wireless + Bluetooth"] },
  ],
  "Laptop Charger": [
    { key: "wattage", label: "Wattage", options: ["45 W", "65 W", "90 W", "100 W", "120 W", "Other"] },
    { key: "connector", label: "Connector type", options: ["USB-C", "Round pin", "Slim tip", "MagSafe", "Other"] },
  ],
  Headset: [
    { key: "connectivity", label: "Connection type", options: ["Wired USB", "3.5 mm wired", "Wireless USB", "Bluetooth"] },
  ],
  SIM: [
    { key: "network", label: "Network", options: ["Dialog", "Mobitel", "Hutch", "Airtel", "Other"] },
    { key: "phoneNumber", label: "Phone number", placeholder: "e.g. 0771234567" },
  ],
  "Mobile Phone": [
    { key: "ram", label: "RAM size", options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"] },
    { key: "storageSize", label: "Storage capacity", options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
    { key: "imei", label: "IMEI number", placeholder: "Enter device IMEI" },
  ],
  "Laptop Bag": [
    { key: "bagSize", label: "Laptop size", options: ["13 inch", "14 inch", "15.6 inch", "16 inch", "17 inch", "Universal"] },
  ],
};

const SPEC_LABELS: Record<string, string> = {
  ram: "RAM size",
  storageType: "Storage type",
  storageSize: "Storage capacity",
  processor: "Processor",
  pCores: "No. of P-Cores",
  eCores: "No. of E-Cores",
  screenSize: "Screen size",
  resolution: "Resolution",
  connector: "Connection",
  mountType: "Mount / placement",
  generation: "Chromecast model",
  connectivity: "Connectivity",
  remoteIncluded: "Remote included",
  printerType: "Printer type",
  printColor: "Color mode",
  duplex: "Duplex printing",
  compatibleToner: "Compatible toner",
  ipAddress: "Network IP",
  wattage: "Wattage",
  network: "Network",
  phoneNumber: "Phone number",
  imei: "IMEI number",
  bagSize: "Laptop size",
};

export function formatSpecLabel(key: string) {
  return (
    SPEC_LABELS[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function getAssetKeySpecChips(asset: { type: string; specs?: Record<string, string> }): string[] {
  const s = asset.specs;
  if (!s) return [];
  const chips: string[] = [];
  if (asset.type === "Laptop") {
    if (s.processor) chips.push(s.processor);
    if (s.pCores || s.eCores) {
      const parts = [];
      if (s.pCores) parts.push(`${s.pCores} P-Cores`);
      if (s.eCores) parts.push(`${s.eCores} E-Cores`);
      chips.push(parts.join(" / "));
    }
    if (s.ram) chips.push(s.ram);
    if (s.storageSize) chips.push(s.storageType ? `${s.storageSize} ${s.storageType}` : s.storageSize);
    return chips;
  }
  if (asset.type === "Printer") {
    if (s.printerType) chips.push(s.printerType);
    if (s.compatibleToner) chips.push(`Toner: ${s.compatibleToner}`);
    if (s.connectivity) chips.push(s.connectivity);
    return chips;
  }
  if (asset.type === "Classroom / Location Monitor" || asset.type === "Monitor") {
    if (s.screenSize) chips.push(s.screenSize);
    if (s.resolution) chips.push(s.resolution);
    if (s.mountType) chips.push(s.mountType);
    return chips;
  }
  if (asset.type === "Google Chromecast") {
    if (s.generation) chips.push(s.generation);
    if (s.resolution) chips.push(s.resolution);
    return chips;
  }
  return [];
}

export function tonerMatchesPrinter(
  toner: { printerModel: string; tonerModel: string },
  printer: { model?: string; name?: string; specs?: Record<string, string> },
) {
  const normalize = (val?: string) => (val ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const tPrinter = normalize(toner.printerModel);
  const tCode = normalize(toner.tonerModel);
  const pModel = normalize(printer.model);
  const pCompat = normalize(printer.specs?.compatibleToner);

  if (tPrinter && pModel && (tPrinter === pModel || pModel.includes(tPrinter) || tPrinter.includes(pModel))) {
    return true;
  }
  if (tCode && pCompat && (pCompat.includes(tCode) || tCode.includes(pCompat))) {
    return true;
  }
  return false;
}

export function effectiveAssetStatus(asset: { status: string; condition?: string }): string {
  if (asset.condition === "Repair" && asset.status !== "Retired") {
    return "In repair";
  }
  return asset.status;
}

export function matchesSearchQuery(query: string, fields: (string | undefined | null)[]): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
