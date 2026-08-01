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
  assert.match(page, /24 labels per page/);
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
  assert.match(rules, /request\.auth\.token\.email == "it@scot\.lk"/);
  assert.match(rules, /allow get: if true/);
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

test("keeps department choices synchronized across every department workflow", async () => {
  const [page, requirementPage, firebase] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/requirements/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /watchRequirementWindow\(\(config\) =>/);
  assert.match(page, /const departmentOptions = useMemo/);
  assert.match(page, /\.\.\.employees\.map\(\(employee\) => employee\.department\)/);
  assert.match(page, /\.\.\.assets\.map\(\(asset\) => asset\.location \?\? ""\)/);
  assert.match(page, /\.\.\.requests\.map\(\(request\) => request\.department\)/);
  assert.ok((page.match(/departments=\{departmentOptions\}/g) ?? []).length >= 6);
  assert.match(page, /employee\.department\.trim\(\)\.toLowerCase\(\) === department\.toLowerCase\(\)/);
  assert.match(requirementPage, /watchRequirementWindow\(applyConfig\)/);
  assert.match(firebase, /export function watchRequirementWindow/);
});

test("supports editing and deleting assigned or unassigned assets safely", async () => {
  const [page, firebase] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /assetEdit: "Edit asset details"/);
  assert.match(page, />Edit asset<\/button>/);
  assert.match(page, /<AssetForm departments=\{departmentOptions\} initial=\{editingAsset\}/);
  assert.match(page, /id: initial\?\.id \?\? crypto\.randomUUID\(\)/);
  assert.match(page, /code: initial\?\.code \?\?/);
  assert.match(page, /status: initial\?\.status \?\? "Available"/);
  assert.match(page, /deletion will remove that assignment without recording a return/);
  assert.match(page, /deleteAssetRecord\(asset\.id, movementIds\)/);
  assert.match(page, /onEdit=\{\(asset\) => \{ setEditingAsset\(asset\); setModal\("assetEdit"\); \}\}/);
  assert.match(page, /<AssetTable assets=\{assets\} employeeMap=\{employeeMap\} onAsset=\{onAsset\} onEdit=\{onEdit\} onDelete=\{onDelete\}/);
  assert.match(page, /aria-label=\{`Edit \$\{asset\.name\}`\}/);
  assert.match(page, /aria-label=\{`Delete \$\{asset\.name\}`\}/);
  assert.match(page, /event\.stopPropagation\(\); onEdit\?\.\(asset\)/);
  assert.match(page, /event\.stopPropagation\(\); void onDelete\?\.\(asset\)/);
  assert.match(firebase, /const withoutUndefined/);
  assert.match(firebase, /batch\.delete\(doc\(db, "assets", assetId, "history", movementId\)\)/);
  assert.match(firebase, /await batch\.commit\(\)/);
});

test("retains Non-IT model choices and accurate asset filters after workflow merge", async () => {
  const [page, catalog] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
  ]);

  for (const option of ["Alpha (60*120)", "KWT022 (75*152)", "OCM-043", "Task Chair OCP-001"]) {
    assert.ok(catalog.includes(`"${option}"`), `missing Non-IT option: ${option}`);
  }
  assert.match(page, /NON_IT_ITEM_MODELS/);
  assert.match(page, /Enter the other item type/);
  assert.match(page, /\{ value: "Available", label: "Available items"/);
  assert.match(page, /\{ value: "IT Asset", label: "IT items"/);
  assert.match(page, /\{ value: "Non-IT Asset", label: "Non-IT items"/);
  assert.match(page, /allAssets=\{assets\}/);
});

test("prevents realtime and double-submit duplicate assets in assignment", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /setAssets\(\(rows\) => \[asset, \.\.\.rows\.filter\(\(row\) => row\.id !== asset\.id\)\]\)/);
  assert.match(page, /const assetId = useRef\(initial\?\.id \?\? crypto\.randomUUID\(\)\)/);
  assert.match(page, /const submitting = useRef\(false\)/);
  assert.match(page, /if \(submitting\.current\) return; submitting\.current = true/);
  assert.match(page, /id: assetId\.current/);
  assert.match(page, /new Map\(assets\.filter\(\(asset\) => asset\.status === "Available"\)\.map\(\(asset\) => \[asset\.id, asset\]\)\)/);
});

test("prints QR label documents by live department", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<QrBatch assets=\{assets\} employeeMap=\{employeeMap\} departments=\{departmentOptions\}/);
  assert.match(page, /function QrBatch\(\{ assets, employeeMap, departments \}/);
  assert.match(page, /<option value="All">All departments<\/option>\{departmentOptions\.map/);
  assert.match(page, /\.\.\.departments, \.\.\.assets\.map\(assetDepartment\)/);
  assert.match(page, /assetDepartment\(asset\)\.toLowerCase\(\) === department\.toLowerCase\(\)/);
  assert.match(page, /QR LABEL REGISTER/);
  assert.match(page, /<h1>\{printDepartment\}<\/h1>/);
  assert.match(css, /\.qr-label-grid/);
});
