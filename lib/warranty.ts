import type { Asset } from "./types";

export type WarrantyState = "Under Warranty" | "Expiring Soon" | "Expired" | "Not Recorded";

export type WarrantyInfo = {
  state: WarrantyState;
  daysRemaining: number | null;
  label: string;
  shortLabel: string;
  detail: string;
  tone: "green" | "orange" | "red" | "muted";
  badgeClass: string;
};

export type OfficialWarrantyPortal = {
  id: string;
  brand: string;
  keywords: string[];
  label: string;
  url: string;
  batchUrl?: string;
  batchLabel?: string;
  buildSerialUrl?: (serial: string) => string;
  supportsOnlineSerialCheck: boolean;
  note: string;
};

export const OFFICIAL_WARRANTY_PORTALS: OfficialWarrantyPortal[] = [
  {
    id: "asus",
    brand: "ASUS",
    keywords: ["asus", "zenbook", "vivobook", "expertbook", "rog", "tuf"],
    label: "ASUS Sri Lanka Warranty Inquiry",
    url: "https://www.asus.com/lk/support/warranty-status-inquiry/",
    supportsOnlineSerialCheck: true,
    note: "Paste serial number & complete ASUS CAPTCHA check (Sri Lanka portal).",
  },
  {
    id: "dell",
    brand: "Dell",
    keywords: ["dell", "latitude", "inspiron", "vostro", "xps", "optiplex", "precision", "ultrasharp"],
    label: "Dell Warranty & Service Tag",
    url: "https://www.dell.com/support/home/en-lk?app=warranty",
    buildSerialUrl: (serial) =>
      `https://www.dell.com/support/home/en-lk/product-support/servicetag/${encodeURIComponent(serial.trim())}/overview`,
    supportsOnlineSerialCheck: true,
    note: "Opens directly to the Dell Service Tag warranty overview.",
  },
  {
    id: "hp",
    brand: "HP",
    keywords: ["hp", "hewlett", "probook", "elitebook", "pavilion", "zbook", "laserjet", "officejet", "deskjet"],
    label: "HP Warranty Check",
    url: "https://support.hp.com/us-en/check-warranty",
    batchUrl: "https://support.hp.com/us-en/check-warranty/multiple-products",
    batchLabel: "HP Multi-Unit Check (up to 20 serials)",
    supportsOnlineSerialCheck: true,
    note: "Use HP Multi-Unit to check up to 20 laptop/printer/monitor serials at once.",
  },
  {
    id: "lenovo",
    brand: "Lenovo",
    keywords: ["lenovo", "thinkpad", "thinkbook", "ideapad", "thinkvision", "legion", "yoga"],
    label: "Lenovo Warranty Lookup",
    url: "https://pcsupport.lenovo.com/lk/en/warranty-lookup#/",
    batchUrl: "https://pcsupport.lenovo.com/us/en/warrantylookup/batchquery",
    batchLabel: "Lenovo Batch Excel Query (up to 1,000 serials)",
    supportsOnlineSerialCheck: true,
    note: "Lenovo Batch Query accepts an Excel list of serials and exports Start & End dates to import right back here.",
  },
  {
    id: "acer",
    brand: "Acer",
    keywords: ["acer", "aspire", "travelmate", "swift", "nitro", "predator", "veriton"],
    label: "Acer Warranty Inquiry",
    url: "https://www.acer.com/us-en/support/warranty/warranty-inquiry",
    supportsOnlineSerialCheck: true,
    note: "Enter Serial Number or SNID on Acer official warranty inquiry.",
  },
  {
    id: "msi",
    brand: "MSI",
    keywords: ["msi", "modern", "prestige", "katana", "stealth", "pro mp"],
    label: "MSI Warranty Status",
    url: "https://account.msi.com/en/services/warranty-book",
    supportsOnlineSerialCheck: true,
    note: "Check warranty status via MSI official support portal.",
  },
  {
    id: "apple",
    brand: "Apple",
    keywords: ["apple", "macbook", "imac", "ipad", "iphone", "airpods"],
    label: "Apple Check Coverage",
    url: "https://checkcoverage.apple.com/",
    supportsOnlineSerialCheck: true,
    note: "Enter Apple serial number on Apple Check Coverage.",
  },
  {
    id: "logitech",
    brand: "Logitech",
    keywords: ["logitech", "logi", "mx master", "mk270", "h390", "b100", "m185", "m170"],
    label: "Logitech Warranty Info",
    url: "https://support.logi.com/hc/en-us/articles/360024350334",
    supportsOnlineSerialCheck: false,
    note: "Mice & headsets use purchase invoice date (typically 1–2 years warranty).",
  },
  {
    id: "jabra",
    brand: "Jabra",
    keywords: ["jabra", "evolve", "speak"],
    label: "Jabra Warranty & Service",
    url: "https://www.jabra.com/footerpages/warranty-and-service",
    supportsOnlineSerialCheck: false,
    note: "Headset warranty is based on invoice/PO purchase date (typically 2 years).",
  },
  {
    id: "samsung",
    brand: "Samsung",
    keywords: ["samsung", "galaxy", "odyssey"],
    label: "Samsung Warranty Support",
    url: "https://www.samsung.com/in/support/warranty/",
    supportsOnlineSerialCheck: false,
    note: "Monitors & mobile devices use distributor invoice date (typically 1–3 years).",
  },
  {
    id: "canon",
    brand: "Canon",
    keywords: ["canon", "imageclass", "pixma", "lbp", "mf"],
    label: "Canon Asia Warranty",
    url: "https://asia.canon/en/support/warranty",
    supportsOnlineSerialCheck: false,
    note: "Canon Sri Lanka (Metropolitan) printer warranty is tracked via invoice/PO date.",
  },
  {
    id: "epson",
    brand: "Epson",
    keywords: ["epson", "ecotank", "workforce"],
    label: "Epson Warranty Info",
    url: "https://www.epson.com.sg/warranty",
    supportsOnlineSerialCheck: false,
    note: "Epson printer warranty is tracked via authorized dealer invoice date.",
  },
  {
    id: "brother",
    brand: "Brother",
    keywords: ["brother", "hl-", "dcp-", "mfc-"],
    label: "Brother Support & Warranty",
    url: "https://support.brother.com/",
    supportsOnlineSerialCheck: false,
    note: "Brother printer warranty is tracked via invoice/PO date.",
  },
];

export function getWarrantyPortalForAsset(
  brand?: string,
  model?: string,
  serial?: string,
): { portal: OfficialWarrantyPortal | null; lookupUrl: string } {
  const haystack = `${brand ?? ""} ${model ?? ""}`.trim().toLowerCase();
  const portal =
    OFFICIAL_WARRANTY_PORTALS.find((p) => p.keywords.some((kw) => haystack.includes(kw))) ?? null;
  if (!portal) {
    return {
      portal: null,
      lookupUrl: `https://www.google.com/search?q=${encodeURIComponent(`${brand || ""} warranty status check`.trim())}`,
    };
  }
  const cleanSerial = (serial ?? "").trim();
  const lookupUrl = cleanSerial && portal.buildSerialUrl ? portal.buildSerialUrl(cleanSerial) : portal.url;
  return { portal, lookupUrl };
}

export function addYearsToDate(startDate: string, years: number): string {
  const parsed = normalizeIsoDate(startDate);
  if (!parsed) return "";
  const [y, m, d] = parsed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wholeYears = Math.floor(years);
  const extraMonths = Math.round((years - wholeYears) * 12);
  dt.setUTCFullYear(dt.getUTCFullYear() + wholeYears);
  if (extraMonths) dt.setUTCMonth(dt.getUTCMonth() + extraMonths);
  // Standard warranty ends the day before the anniversary (e.g. 2024-01-01 + 2 yrs -> 2025-12-31) or same date
  return dt.toISOString().slice(0, 10);
}

export function normalizeIsoDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    // Excel serial date (days since 1899-12-30)
    const utcMs = Math.round((raw - 25569) * 86400 * 1000);
    const dt = new Date(utcMs);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
  }
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? "" : raw.toISOString().slice(0, 10);
  }
  const str = String(raw).trim();
  if (!str || str === "—" || str === "-" || str.toLowerCase() === "n/a") return "";

  // Already YYYY-MM-DD (or ISO timestamp)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    // If first part > 12 it is definitely DD/MM/YYYY; default to DD/MM/YYYY (Sri Lanka / UK standard) unless b > 12
    const day = b > 12 ? b : a;
    const month = b > 12 ? a : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

export function getWarrantyStatus(
  asset: Pick<Asset, "warrantyStartDate" | "warrantyEndDate" | "warrantyVendor" | "warrantyInvoiceNo">,
  referenceDate = new Date(),
): WarrantyInfo {
  const endIso = normalizeIsoDate(asset.warrantyEndDate);
  if (!endIso) {
    return {
      state: "Not Recorded",
      daysRemaining: null,
      label: "No Warranty Info",
      shortLabel: "No warranty",
      detail: "Warranty start & end dates not recorded yet",
      tone: "muted",
      badgeClass: "warranty-pill warranty-none",
    };
  }

  const todayUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const [ey, em, ed] = endIso.split("-").map(Number);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const daysRemaining = Math.round((endUtc - todayUtc) / 86400000);

  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return {
      state: "Expired",
      daysRemaining,
      label: `Expired (${endIso})`,
      shortLabel: "Expired",
      detail: `Warranty expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago on ${endIso}`,
      tone: "red",
      badgeClass: "warranty-pill warranty-expired",
    };
  }

  if (daysRemaining <= 60) {
    return {
      state: "Expiring Soon",
      daysRemaining,
      label: daysRemaining === 0 ? "Expires Today" : `Expiring in ${daysRemaining}d`,
      shortLabel: `${daysRemaining}d left`,
      detail: `Warranty expires on ${endIso} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining)`,
      tone: "orange",
      badgeClass: "warranty-pill warranty-expiring",
    };
  }

  const monthsLeft = Math.floor(daysRemaining / 30);
  const shortSpan = monthsLeft >= 12
    ? `${(daysRemaining / 365).toFixed(1).replace(/\.0$/, "")}y left`
    : `${monthsLeft}m left`;

  return {
    state: "Under Warranty",
    daysRemaining,
    label: `Under Warranty · ${shortSpan}`,
    shortLabel: shortSpan,
    detail: `Active until ${endIso} (${daysRemaining} days remaining)`,
    tone: "green",
    badgeClass: "warranty-pill warranty-active",
  };
}

export type WarrantyImportMatch = {
  assetId: string;
  assetCode: string;
  assetName: string;
  serial: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyVendor?: string;
  warrantyInvoiceNo?: string;
  warrantyProofUrl?: string;
  matchedBy: "Asset Code" | "Serial Number";
};

export type WarrantyImportPreview = {
  matched: WarrantyImportMatch[];
  unmatchedRows: { rowNumber: number; identifier: string; reason: string }[];
  totalRowsRead: number;
};

function pickColumn(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const exact = keys.find((k) => k.trim().toLowerCase() === candidate);
    if (exact && row[exact] !== undefined && String(row[exact]).trim() !== "") return row[exact];
  }
  for (const candidate of candidates) {
    const partial = keys.find((k) => k.trim().toLowerCase().includes(candidate));
    if (partial && row[partial] !== undefined && String(row[partial]).trim() !== "") return row[partial];
  }
  return undefined;
}

export function parseWarrantyImportRows(
  rawRows: Record<string, unknown>[],
  existingAssets: Asset[],
): WarrantyImportPreview {
  const byCode = new Map<string, Asset>();
  const bySerial = new Map<string, Asset>();

  for (const asset of existingAssets) {
    if (asset.code?.trim()) byCode.set(asset.code.trim().toLowerCase(), asset);
    if (asset.serial?.trim()) bySerial.set(asset.serial.trim().toLowerCase(), asset);
  }

  const matched: WarrantyImportMatch[] = [];
  const unmatchedRows: { rowNumber: number; identifier: string; reason: string }[] = [];
  const seenAssetIds = new Set<string>();

  rawRows.forEach((row, index) => {
    const rawCode = String(pickColumn(row, ["asset code", "code", "asset id"]) ?? "").trim();
    const rawSerial = String(
      pickColumn(row, ["serial number", "serial no", "serial", "service tag", "s/n", "sn", "snid"]) ?? "",
    ).trim();

    if (!rawCode && !rawSerial) return;
    // Skip title/total footer rows
    if (rawCode.toLowerCase().startsWith("total") || rawSerial.toLowerCase().startsWith("total")) return;

    let target: Asset | undefined;
    let matchedBy: "Asset Code" | "Serial Number" = "Serial Number";
    if (rawCode && byCode.has(rawCode.toLowerCase())) {
      target = byCode.get(rawCode.toLowerCase());
      matchedBy = "Asset Code";
    } else if (rawSerial && bySerial.has(rawSerial.toLowerCase())) {
      target = bySerial.get(rawSerial.toLowerCase());
      matchedBy = "Serial Number";
    }

    if (!target) {
      unmatchedRows.push({
        rowNumber: index + 2,
        identifier: rawCode || rawSerial,
        reason: "No matching Asset Code or Serial Number in AssetFlow",
      });
      return;
    }

    const startDate = normalizeIsoDate(
      pickColumn(row, [
        "warranty start date",
        "warranty start",
        "start date",
        "purchase date",
        "ship date",
        "shipped date",
      ]),
    );
    let endDate = normalizeIsoDate(
      pickColumn(row, [
        "warranty end date",
        "warranty end",
        "end date",
        "expiration date",
        "expiry date",
        "expire date",
      ]),
    );

    if (!endDate && startDate) {
      const durationRaw = String(
        pickColumn(row, ["warranty duration", "duration (years)", "warranty years", "years", "period"]) ?? "",
      ).trim();
      const yearsNum = parseFloat(durationRaw.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(yearsNum) && yearsNum > 0 && yearsNum <= 15) {
        endDate = addYearsToDate(startDate, yearsNum);
      }
    }

    if (!startDate && !endDate) {
      unmatchedRows.push({
        rowNumber: index + 2,
        identifier: `${target.code} (${target.serial || target.name})`,
        reason: "Row has no valid Warranty Start Date or Warranty End Date",
      });
      return;
    }

    const vendor = String(
      pickColumn(row, ["warranty vendor", "vendor / supplier", "vendor", "supplier", "distributor"]) ?? "",
    ).trim();
    const invoiceNo = String(
      pickColumn(row, ["invoice / po no", "invoice no", "invoice", "po number", "po no"]) ?? "",
    ).trim();
    const proofUrl = String(
      pickColumn(row, ["warranty proof url", "proof url", "proof link", "warranty url", "proof"]) ?? "",
    ).trim();

    if (seenAssetIds.has(target.id)) {
      // Keep the latest end date if multiple rows appear for the same serial (common in Lenovo/Dell multi-entitlement exports!)
      const existingIdx = matched.findIndex((m) => m.assetId === target!.id);
      if (existingIdx >= 0 && endDate && (!matched[existingIdx].warrantyEndDate || endDate > matched[existingIdx].warrantyEndDate)) {
        matched[existingIdx] = {
          ...matched[existingIdx],
          warrantyStartDate: startDate || matched[existingIdx].warrantyStartDate,
          warrantyEndDate: endDate,
          warrantyVendor: vendor || matched[existingIdx].warrantyVendor,
          warrantyInvoiceNo: invoiceNo || matched[existingIdx].warrantyInvoiceNo,
          warrantyProofUrl: proofUrl || matched[existingIdx].warrantyProofUrl,
        };
      }
      return;
    }

    seenAssetIds.add(target.id);
    matched.push({
      assetId: target.id,
      assetCode: target.code,
      assetName: target.name,
      serial: target.serial,
      warrantyStartDate: startDate || target.warrantyStartDate || "",
      warrantyEndDate: endDate || target.warrantyEndDate || "",
      warrantyVendor: vendor || target.warrantyVendor,
      warrantyInvoiceNo: invoiceNo || target.warrantyInvoiceNo,
      warrantyProofUrl: proofUrl || target.warrantyProofUrl,
      matchedBy,
    });
  });

  return {
    matched,
    unmatchedRows,
    totalRowsRead: rawRows.length,
  };
}
