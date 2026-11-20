export type AssetStatus = "Available" | "Assigned" | "In repair" | "Retired";
export type AssetAllocationType = "person" | "location" | "department";

export type Asset = {
  id: string;
  code: string;
  name: string;
  category: "IT Asset" | "Non-IT Asset";
  type: string;
  brand: string;
  model: string;
  serial: string;
  location?: string;
  allocationType?: AssetAllocationType;
  assignedDepartment?: string;
  status: AssetStatus;
  employeeId?: string;
  condition: string;
  verified?: boolean;
  details: string;
  specs?: Record<string, string>;
  updatedAt: string;
  custodianName?: string;
  custodianDepartment?: string;
  imageKey?: string;
};

export type Employee = {
  id: string;
  empNo: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: "Active" | "Resigned";
};

export type Movement = {
  id: string;
  assetId: string;
  employeeId: string;
  type: "Assigned" | "Returned" | "Repair" | "Cleared";
  date: string;
  createdAt?: string;
  note: string;
  employeeName?: string;
  department?: string;
};

export type RequestRow = {
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

export type TonerColor =
  | "Black"
  | "Cyan"
  | "Magenta"
  | "Yellow"
  | "Tri-Color"
  | "Drum Unit"
  | "Maintenance Kit";

export type TonerStock = {
  id: string;
  printerModel: string;
  printerBrand?: string;
  tonerModel: string;
  color: TonerColor;
  quantity: number;
  minStock: number;
  storageLocation?: string;
  notes?: string;
  updatedAt: string;
};

export type TonerTransactionType = "Restock" | "Issued" | "Adjustment";

export type TonerTransaction = {
  id: string;
  tonerId: string;
  printerModel: string;
  tonerModel: string;
  color: string;
  type: TonerTransactionType;
  quantity: number;
  resultingStock: number;
  printerAssetId?: string;
  printerName?: string;
  department?: string;
  recipientName?: string;
  date: string;
  createdAt?: string;
  note: string;
};
