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
