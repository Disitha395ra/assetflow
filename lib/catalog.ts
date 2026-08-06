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

export const ASSET_TYPES = {
  "IT Asset": [
    "Laptop",
    "Monitor",
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
};

export const ASSET_SPEC_FIELDS: Record<string, AssetSpecField[]> = {
  Laptop: [
    { key: "ram", label: "RAM size", options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB"] },
    { key: "storageType", label: "Storage type", options: ["NVMe SSD", "SSD", "HDD", "SSD + HDD"] },
    { key: "storageSize", label: "Storage capacity", options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB", "4 TB"] },
    { key: "processor", label: "Processor", placeholder: "e.g. Intel Core i5-1335U" },
  ],
  Monitor: [
    { key: "screenSize", label: "Screen size", options: ["19 inch", "21.5 inch", "22 inch", "24 inch", "27 inch", "32 inch", "Other"] },
    { key: "resolution", label: "Resolution", options: ["HD", "Full HD", "2K / QHD", "4K / UHD", "Other"] },
    { key: "connector", label: "Connection", options: ["HDMI", "DisplayPort", "USB-C", "VGA", "Multiple"] },
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
