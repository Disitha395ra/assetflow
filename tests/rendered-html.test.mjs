import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the AssetFlow administrator entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>AssetFlow — Company Asset Management<\/title>/i);
  assert.match(html, /Verifying administrator/i);
  assert.match(html, /Firebase/i);
  assert.doesNotMatch(html, /codex-preview/i);
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
  assert.match(rules, /request\.time >= get\(.+requirement-window\)\.data\.opensAt/);
});
