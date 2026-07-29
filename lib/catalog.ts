export const DEFAULT_DEPARTMENTS = [
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
    "Computer Chair",
    "Computer Table",
    "Whiteboard",
    "Other",
  ],
} as const;

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
  "Computer Chair": [
    { key: "chairType", label: "Chair type", options: ["Task chair", "Executive chair", "Visitor chair", "Ergonomic chair", "Other"] },
  ],
  "Computer Table": [
    { key: "dimensions", label: "Dimensions", placeholder: "e.g. 120 × 60 cm" },
  ],
  Whiteboard: [
    { key: "dimensions", label: "Dimensions", placeholder: "e.g. 120 × 90 cm" },
  ],
};
