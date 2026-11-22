import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("starts with a clean Firebase-backed register", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /useState<Asset\[\]>\(\[\]\)/);
  assert.match(page, /useState<Employee\[\]>\(\[\]\)/);
  assert.match(page, /useState<Movement\[\]>\(\[\]\)/);
  assert.match(page, /useState<RequestRow\[\]>\(\[\]\)/);
  assert.doesNotMatch(page, /demoAssets|demoEmployees|demoMovements|demoRequests/);
  assert.match(page, /Print \{visible\.length\} labels/);
  assert.match(page, /Compact — 24 per A4/);
});

test("ships public QR and requirement routes with restricted admin writes", async () => {
  const [assetPage, requirementPage, rules] = await Promise.all([
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/requirements/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(assetPage, /Verified company record/);
  assert.match(assetPage, /Lifecycle record/);
  assert.match(requirementPage, /SUBMISSIONS OPEN/);
  assert.match(requirementPage, /saveRecord\("requirements"/);
  assert.match(rules, /"it@scot\.lk"/);
  assert.match(rules, /allow get: if true/);
});

test("grants every approved administrator full asset controls and supports scoped small QR labels", async () => {
  const [page, firebase, rules, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const email of ["admin@scot.lk", "it@scot.lk", "shanaka@scot.lk", "duminda@scot.lk", "nimantha@scot.lk", "shamila@scot.lk", "niroshan@scot.lk", "musthaque@scot.lk", "sheran@scot.lk"]) {
    assert.match(firebase, new RegExp(email.replace(".", "\\.")));
    assert.match(rules, new RegExp(email.replace(".", "\\.")));
  }
  assert.match(page, /isAdminEmail\(email\)/);
  assert.match(page, /Edit asset/);
  assert.match(page, /Delete asset/);
  assert.match(page, /deleteAssetRecord/);
  assert.match(page, /QR label scope/);
  assert.match(page, /departmentEmployees/);
  assert.match(page, /QR label size/);
  assert.match(page, /Extra small — 54 per A4/);
  assert.match(page, /labelsPerPage/);
  assert.match(page, /One department/);
  assert.match(page, /One employee/);
  assert.match(page, /Compact — 24 per A4/);
  assert.match(css, /\.qr-batch-filters/);
  assert.match(css, /\.button-danger/);
});

test("supports custom departments, employee editing and type-specific asset fields", async () => {
  const [page, catalog, requirementPage, rules, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/requirements/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Manage departments/);
  assert.match(page, /Edit employee details/);
  assert.match(page, /Employee details updated/i);
  assert.match(catalog, /RAM size/);
  assert.match(catalog, /"20 GB"/);
  assert.match(catalog, /"Mobile Phone": \[\s*\{ key: "ram", label: "RAM size", options: \["Optional"/);
  assert.match(catalog, /\{ key: "storageSize", label: "Storage capacity", options: \["Optional"/);
  assert.match(catalog, /Storage capacity/);
  assert.match(catalog, /Processor/);
  assert.match(catalog, /Wired USB/);
  assert.match(page, /Current location/);
  assert.match(page, /isNonIt \? "" : form\.serial/);
  assert.match(page, /qr-print-page/);
  assert.match(css, /grid-template-rows: repeat\(8, 32mm\)/);
  assert.match(requirementPage, /config\.departments/);
  assert.match(rules, /match \/settings\/departments/);
});

test("summarizes assets and employees by department", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /Asset availability summary/);
  assert.match(page, /Availability department/);
  assert.match(page, /Active employees/);
  assert.match(page, /asset\.custodianDepartment \|\| asset\.location/);
  assert.match(page, /summary\[asset\.type\]/);
  assert.match(css, /\.asset-type-summary/);
});

test("drills into available asset details from department cards", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /selectedAvailableAssets/);
  assert.match(page, /aria-controls="available-asset-details"/);
  assert.match(page, /View available items/);
  assert.match(page, /No available \{selectedType\.toLowerCase\(\)\} items/);
  assert.match(page, /onClick=\{\(\) => onAsset\(asset\)\}/);
  assert.match(css, /\.available-asset-details/);
  assert.match(css, /\.available-asset-list/);
});

test("uses selectable furniture images across inventory and Excel exports", async () => {
  const [page, publicAssetPage, catalog, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /FURNITURE_IMAGE_OPTIONS/);
  assert.match(catalog, /chair-04\.png/);
  assert.match(catalog, /table-02-alpha\.png/);
  assert.match(page, /Select \{form\.type\} design/);
  assert.match(page, /furnitureImageForAsset\(asset\)/);
  assert.match(page, /xl\/drawings\/drawing1\.xml/);
  assert.match(page, /Excel report with asset images downloaded/);
  assert.match(publicAssetPage, /public-furniture-image/);
  assert.match(css, /\.furniture-picker/);
  assert.match(packageJson, /"fflate"/);
});

test("permanently removes the retired IT department and uses central stock", async () => {
  const [page, catalog, firebase, publicAssetPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(catalog, /"IT Dept"/);
  assert.match(page, /purgeDepartmentData/);
  assert.match(page, /assets\/\$\{assetId\}\/history/);
  assert.match(page, /Delete all data/);
  assert.match(page, /Central Stock/);
  assert.match(firebase, /listRecords/);
  assert.match(publicAssetPage, /currently in Central Stock/);
});

test("supports employee email confirmation on asset assignment and diagnostic auth error feedback", async () => {
  const [page, apiRoute, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/send-assignment-email/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Employee confirmation email/);
  assert.match(page, /Send email confirmation to employee/);
  assert.match(page, /\/api\/send-assignment-email/);
  assert.match(page, /auth\/unauthorized-domain/);
  assert.match(apiRoute, /export async function POST/);
  assert.match(apiRoute, /Asset Allocation Confirmation/);
  assert.match(apiRoute, /admin@scot\.lk/);
  assert.match(apiRoute, /it@scot\.lk/);
  assert.match(apiRoute, /hr@scot\.lk/);
  assert.match(css, /\.email-toggle-check/);
  assert.match(css, /\.gate-error-banner/);
});

test("supports employee email confirmation on asset returns and clearance", async () => {
  const [page, returnApiRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/send-return-email/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Employee returning assets/);
  assert.match(page, /Send return confirmation email to employee/);
  assert.match(page, /\/api\/send-return-email/);
  assert.match(returnApiRoute, /export async function POST/);
  assert.match(returnApiRoute, /Asset Return Confirmation/);
  assert.match(returnApiRoute, /admin@scot\.lk/);
  assert.match(returnApiRoute, /it@scot\.lk/);
  assert.match(returnApiRoute, /hr@scot\.lk/);
  assert.match(returnApiRoute, /Discharge of Custody/);
});

test("supports Laptop P-Cores and E-Cores dropdowns and displays them across asset views", async () => {
  const [catalog, page, publicAssetPage] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /key: "pCores"/);
  assert.match(catalog, /label: "No\. of P-Cores"/);
  assert.match(catalog, /key: "eCores"/);
  assert.match(catalog, /label: "No\. of E-Cores"/);
  assert.match(catalog, /getAssetKeySpecChips/);
  assert.match(catalog, /formatSpecLabel/);
  assert.match(page, /getAssetKeySpecChips\(asset\)/);
  assert.match(page, /"No\. of P-Cores"/);
  assert.match(page, /"No\. of E-Cores"/);
  assert.match(publicAssetPage, /formatSpecLabel\(key\)/);
});

test("divides monitors into Staff vs Classroom/Location monitors and adds location-allocated Google Chromecast", async () => {
  const [catalog, page, publicAssetPage] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /"Classroom \/ Location Monitor"/);
  assert.match(catalog, /"Google Chromecast"/);
  assert.match(catalog, /"Projector"/);
  assert.match(catalog, /MONITOR_SCREEN_SIZES/);
  assert.match(catalog, /"19 inch"[\s\S]*"20 inch"[\s\S]*"21 inch"[\s\S]*"22 inch"[\s\S]*"24 inch"[\s\S]*"27 inch"[\s\S]*"32 inch"/);
  assert.doesNotMatch(catalog, /21\.5 inch|43 inch|50 inch|55 inch|65 inch|75 inch|85 inch/);
  assert.match(catalog, /LOCATION_ONLY_ASSET_TYPES/);
  assert.match(catalog, /DEFAULT_LOCATIONS/);
  assert.match(catalog, /Building 1 \(Main\) - Mechatronics Lab/);
  assert.match(catalog, /Building 2 \(New\) - Classroom 301/);
  assert.match(catalog, /groupLocationsByBuilding/);
  assert.match(page, /Monitor division \(2 parts\)/);
  assert.match(page, /Staff \/ Employee Monitor/);
  assert.match(page, /Classroom \/ Location Monitor/);
  assert.match(page, /Location-allocated IT asset \(not assigned to a person\)/);
  assert.match(page, /!isLocationOnlyAssetType\(asset\.type\)/);
  assert.match(page, /Manage locations/);
  assert.match(publicAssetPage, /Allocated to classroom \/ location/);
});

test("supports Printer IT asset with department/person assignment and model-based Toner stock management", async () => {
  const [catalog, page, printersView, rules] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PrintersTonersView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /"Printer"/);
  assert.match(catalog, /compatibleToner/);
  assert.match(catalog, /TONER_COLORS/);
  assert.match(catalog, /tonerMatchesPrinter/);
  assert.match(page, /Printers & Toners/);
  assert.match(page, /Printer assignment/);
  assert.match(page, /Compatible toner stock \(Subsection\)/);
  assert.match(page, /watchCollection<TonerStock>\("toners"/);
  assert.match(page, /watchCollection<TonerTransaction>\("tonerTransactions"/);
  assert.match(printersView, /Toner stock \(Subsection\)/);
  assert.match(printersView, /TonerForm/);
  assert.match(printersView, /TonerStockActionForm/);
  assert.match(printersView, /Toner stock movement history/);
  assert.match(rules, /match \/toners\/\{tonerId\}/);
  assert.match(rules, /match \/tonerTransactions\/\{transactionId\}/);
});

test("generates 6 dedicated styled Excel reports sorted A-Z by department with required laptop columns", async () => {
  const [page, excelReports, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/excelReports.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /All Staff Laptops/);
  assert.match(page, /All Staff Monitors/);
  assert.match(page, /All Staff Headsets/);
  assert.match(page, /All Staff Mouses/);
  assert.match(page, /Employee IT Assets Details/);
  assert.match(page, /Printer & Toner Details/);
  assert.match(page, /Asset verified \(Yes\/No\)/);
  assert.match(excelReports, /buildStaffLaptopsReport/);
  assert.match(excelReports, /buildStaffMonitorsReport/);
  assert.match(excelReports, /buildStaffHeadsetsReport/);
  assert.match(excelReports, /buildStaffMousesReport/);
  assert.match(excelReports, /buildEmployeeItAssetsReport/);
  assert.match(excelReports, /buildPrinterAndTonerReport/);
  assert.match(excelReports, /sortAssetsByDepartmentAZ/);
  assert.match(excelReports, /Laptop Processor/);
  assert.match(excelReports, /No\. of P-Cores/);
  assert.match(excelReports, /No\. of E-Cores/);
  assert.match(excelReports, /Asset Verified \(Yes\/No\)/);
  assert.match(excelReports, /buildStyledWorkbookFiles/);
  assert.match(css, /\.structured-report-card/);
});

test("uses atomic Firestore transactions, multi-token search, orange repair badges, and printable movement history", async () => {
  const [firebase, catalog, page, css] = await Promise.all([
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(firebase, /commitAssetMovementsBatch/);
  assert.match(firebase, /applyTonerStockTransaction/);
  assert.match(firebase, /syncEmployeeCustodianOnAssets/);
  assert.match(catalog, /effectiveAssetStatus/);
  assert.match(catalog, /matchesSearchQuery/);
  assert.match(page, /applyTonerStockTransaction/);
  assert.match(page, /commitAssetMovementsBatch/);
  assert.match(page, /watchRequirementWindow/);
  assert.match(page, /ASSET MOVEMENT HISTORY/);
  assert.match(page, /One classroom \/ location/);
  assert.match(page, /View toner stock/);
  assert.match(css, /\.available-asset-condition\.condition-repair/);
  assert.match(css, /\.document-condition\.condition-repair/);
});

test("supports dropdown printer-toner mapping, toner replacement history, zero-buffer orange cards, and Admin Dept requisition report", async () => {
  const [page, printersView, excelReports, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PrintersTonersView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/excelReports.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(printersView, /Mapped printer model/);
  assert.match(printersView, /Target printer \(mapped by model\)/);
  assert.match(printersView, /Replaced \/ changed by/);
  assert.match(printersView, /toner-card-zero/);
  assert.match(printersView, /zero-stock-banner/);
  assert.match(printersView, /Download 0-Stock Requisition/);
  assert.match(page, /Toner Replacement/);
  assert.match(page, /card-zero-highlight/);
  assert.match(page, /buildZeroStockTonerRequisitionReport/);
  assert.match(page, /Select mapped toner from stock/);
  assert.match(excelReports, /buildZeroStockTonerRequisitionReport/);
  assert.match(excelReports, /ADMIN DEPT — URGENT ZERO-STOCK TONER REQUISITION/);
  assert.match(css, /\.card-zero-highlight/);
  assert.match(css, /\.toner-card-zero/);
  assert.match(css, /\.zero-stock-banner/);
});

test("detects duplicate employees, supports safe merge/delete, and prevents duplicate Emp No creation", async () => {
  const [page, firebase, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(firebase, /mergeDuplicateEmployeeRecord/);
  assert.match(page, /mergeDuplicateEmployeeRecord/);
  assert.match(page, /Duplicate employees detected/);
  assert.match(page, /Keep &amp; remove duplicate/);
  assert.match(page, /already exists/);
  assert.match(page, /deleteEmployee/);
  assert.match(css, /\.duplicate-employees-banner/);
  assert.match(css, /\.employee-delete-btn/);
});

test("supports red Damage condition tag alongside Good, Excellent, Fair, and orange Repair without a Warranty tab", async () => {
  const [catalog, page, publicAsset, excelReports, css] = await Promise.all([
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/excelReports.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /ASSET_CONDITIONS/);
  assert.match(catalog, /"Damage"/);
  assert.match(catalog, /conditionClassName/);
  assert.match(catalog, /if \(asset\.condition === "Damage"\) return "Damage"/);
  assert.match(page, /ASSET_CONDITIONS\.map/);
  assert.match(page, /dot red/);
  assert.doesNotMatch(page, /WarrantyHubView/);
  assert.doesNotMatch(page, /name: "Warranty" as View/);
  assert.match(publicAsset, /conditionClassName/);
  assert.match(excelReports, /s === "damage"/);
  assert.match(css, /\.status-damage/);
  assert.match(css, /\.available-asset-condition\.condition-damage/);
  assert.match(css, /\.document-condition\.condition-damage/);
  assert.match(css, /\.public-status-damage/);
});

test("adds styled Excel reports for Projectors, Chromecasts, and Mobile Phones plus resilient Firestore toner persistence", async () => {
  const [firebase, page, excelReports] = await Promise.all([
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/excelReports.ts", import.meta.url), "utf8"),
  ]);

  assert.match(firebase, /watchFallbackTonerStore/);
  assert.match(firebase, /saveTonerRecord/);
  assert.match(firebase, /deleteTonerRecord/);
  assert.match(firebase, /isPermissionDeniedError/);
  assert.match(page, /watchFallbackTonerStore/);
  assert.match(page, /saveTonerRecord/);
  assert.match(page, /deleteTonerRecord/);
  assert.match(page, /All Projectors/);
  assert.match(page, /All Google Chromecasts/);
  assert.match(page, /All Mobile Phones/);
  assert.match(excelReports, /buildProjectorsReport/);
  assert.match(excelReports, /buildChromecastsReport/);
  assert.match(excelReports, /buildMobilePhonesReport/);
});

test("optimizes Firestore reads/writes with IndexedDB multi-tab cache, delta updates, chunked batch deletes, and pooled email service", async () => {
  const [firebase, emailService, page, publicAsset, requirementPage] = await Promise.all([
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/emailService.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asset/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/requirements/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(firebase, /persistentLocalCache/);
  assert.match(firebase, /persistentMultipleTabManager/);
  assert.match(firebase, /export async function updateRecord/);
  assert.match(firebase, /export function watchRecord/);
  assert.match(firebase, /export async function deleteRecordsBatch/);
  assert.match(firebase, /batch\.update\(/);
  assert.match(emailService, /pool: true/);
  assert.match(emailService, /AbortSignal\.timeout/);
  assert.match(emailService, /isValidEmail/);
  assert.match(page, /assetsByEmployeeId/);
  assert.match(page, /deleteRecordsBatch/);
  assert.match(page, /updateRecord/);
  assert.match(page, /markTonerCollectionRestricted/);
  assert.match(publicAsset, /watchRecord<PublicAsset>/);
  assert.match(requirementPage, /setSubmitError/);
});





