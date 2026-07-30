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
  const [page, catalog, requirementPage, rules] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/requirements/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Manage departments/);
  assert.match(page, /Edit employee details/);
  assert.match(page, /Employee details updated/i);
  assert.match(catalog, /RAM size/);
  assert.match(catalog, /Storage capacity/);
  assert.match(catalog, /Processor/);
  assert.match(catalog, /Wired USB/);
  assert.match(requirementPage, /config\.departments/);
  assert.match(rules, /match \/settings\/departments/);
});

test("preserves and safely migrates legacy department settings", async () => {
  const firebase = await readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8");

  assert.match(firebase, /doc\(db, "settings", "departments"\)/);
  assert.match(firebase, /legacySnapshot\.data\(\)\?\.items/);
  assert.match(firebase, /currentDepartments\.length \? currentDepartments : legacyDepartments/);
  assert.match(firebase, /runTransaction/);
  assert.match(firebase, /if \(!latestDepartments\.length\)/);
  assert.match(firebase, /\{ merge: true \}/);
});

test("uses constrained Chair, Table and Other inputs for Non-IT assets", async () => {
  const [page, catalog] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8"),
  ]);

  assert.match(catalog, /"Non-IT Asset": \[\s*"Chair",\s*"Table",\s*"Other"/);
  for (const option of [
    "Alpha (60*120)",
    "Alpha CT-03 (135*80)",
    "Damro (135*70)",
    "KWT022 (75*152)",
    "OCM-043",
    "OCL-018",
    "OCH-014",
    "Task Chair OCP-001",
  ]) {
    assert.ok(catalog.includes(`"${option}"`), `missing Non-IT option: ${option}`);
  }
  assert.match(page, /Select \{form\.type\.toLowerCase\(\)\} model/);
  assert.match(page, /Enter the other item type/);
  assert.match(page, /type: event\.target\.value, model: ""/);
});

test("keeps newly added departments usable when employees are added or updated", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const departmentOptions = useMemo/);
  assert.match(page, /const selectedDepartment = departmentOptions\.includes\(form\.department\)/);
  assert.match(page, /departmentOptions\.map\(\(item\) => <option value=\{item\}/);
  assert.match(page, /department: selectedDepartment\.trim\(\)/);
  assert.equal(page.match(/setDepartment\(employee\.department\)/g)?.length, 2);

  const departmentSave = page.match(/const nextWindow = \{ \.\.\.requirementWindow, departments: items \};(.+?)flash\("Department list updated"\)/s)?.[1] ?? "";
  assert.ok(
    departmentSave.indexOf("await saveRequirementWindow(nextWindow)") < departmentSave.indexOf("setDepartments(items)"),
    "department state must update only after Firestore confirms the save",
  );
});

test("supports editing assets without replacing their identity or assignment state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /assetEdit: "Edit asset details"/);
  assert.match(page, />Edit asset<\/button>/);
  assert.match(page, /<AssetForm initial=\{editingAsset\}/);
  assert.match(page, /id: initial\?\.id \?\? crypto\.randomUUID\(\)/);
  assert.match(page, /code: initial\?\.code \?\?/);
  assert.match(page, /status: initial\?\.status \?\? "Available"/);
  assert.match(page, /setAssets\(\(rows\) => rows\.map\(\(row\) => row\.id === asset\.id \? asset : row\)\)/);
  assert.match(page, /Asset details updated/);
});

test("deletes assigned or unassigned assets and their lifecycle records atomically", async () => {
  const [page, firebase] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const assignee = asset\.employeeId/);
  assert.match(page, /deletion will remove that assignment without recording a return/);
  assert.match(page, /window\.confirm\(`Permanently delete \$\{asset\.code\}/);
  assert.match(page, /deleteAssetRecord\(asset\.id, movementIds\)/);
  assert.match(page, /Asset and lifecycle history deleted/);
  assert.match(page, /disabled=\{deleting\}/);
  assert.match(firebase, /const batch = writeBatch\(db\)/);
  assert.match(firebase, /batch\.delete\(doc\(db, "assets", assetId\)\)/);
  assert.match(firebase, /batch\.delete\(doc\(db, "movements", movementId\)\)/);
  assert.match(firebase, /await batch\.commit\(\)/);
});
