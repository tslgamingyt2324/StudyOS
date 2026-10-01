import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { MARK_PATH, WORDMARK_PATH } from "../src/components/brand/paths";

const pub = (p: string) => `public${p}`;
const png = (p: string) => {
  const b = readFileSync(pub(p));
  assert.equal(b.subarray(1, 4).toString(), "PNG", `${p} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; // IHDR
};

test("every icon in the manifest exists, is a valid PNG, and has its declared size", () => {
  const m = JSON.parse(readFileSync(pub("/manifest.json"), "utf8"));
  const purposes = new Set<string>();
  for (const i of m.icons) {
    assert.ok(existsSync(pub(i.src)), `${i.src} missing`);
    const [w, h] = i.sizes.split("x").map(Number);
    const d = png(i.src);
    assert.deepEqual([d.w, d.h], [w, h], `${i.src} is ${d.w}x${d.h}, manifest says ${i.sizes}`);
    assert.equal(i.type, "image/png");
    purposes.add(`${i.purpose}-${w}`);
  }
  for (const k of ["any-192", "any-512", "maskable-192", "maskable-512"]) assert.ok(purposes.has(k), `manifest lacks ${k}`);
  assert.equal(m.short_name, "StudyOS");
  for (const s of m.shortcuts ?? []) for (const i of s.icons ?? []) assert.ok(existsSync(pub(i.src)));
});

test("every icon referenced from layout metadata and the service worker exists", () => {
  const refs = [...readFileSync("src/app/layout.tsx", "utf8").matchAll(/"(\/[\w.-]+\.(?:png|ico|svg))"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4);
  for (const r of refs) assert.ok(existsSync(pub(r)), `layout references missing ${r}`);
  const sw = readFileSync(pub("/sw.js"), "utf8");
  for (const r of [...sw.matchAll(/"(\/[\w.-]+\.(?:png|svg))"/g)].map((m) => m[1])) assert.ok(existsSync(pub(r)), `sw.js caches missing ${r}`);
});

test("apple-touch-icon is square, 180px and fully opaque (no alpha channel)", () => {
  const d = png("/apple-touch-icon.png");
  assert.deepEqual([d.w, d.h], [180, 180]);
  assert.equal(d.colorType, 2, "colour type 2 = RGB (no alpha)");
  assert.equal(png("/icon-maskable-512.png").colorType, 2, "maskable icons must be opaque full-bleed");
});

test("favicon.ico contains 16, 32 and 48px images; badge has an alpha channel", () => {
  const b = readFileSync(pub("/favicon.ico"));
  assert.equal(b.readUInt16LE(2), 1, "ICO type");
  const n = b.readUInt16LE(4);
  assert.deepEqual(Array.from({ length: n }, (_, i) => b[6 + 16 * i]).sort((a, c) => a - c), [16, 32, 48]);
  assert.equal(png("/badge-96.png").colorType, 6, "RGBA — the notification badge needs transparency");
});

test("logo SVGs are well-formed and the mark is a single closed path", () => {
  for (const f of ["/icon.svg", "/brand/app-icon.svg", "/brand/mark.svg", "/brand/wordmark.svg", "/brand/logo.svg"]) {
    const s = readFileSync(pub(f), "utf8");
    assert.match(s, /^<svg[\s\S]*<\/svg>\s*$/, `${f} malformed`);
  }
  assert.equal((MARK_PATH.match(/M/g) ?? []).length, 1, "one subpath");
  assert.ok(MARK_PATH.endsWith("Z"));
  assert.ok(!/NaN|undefined/.test(MARK_PATH + WORDMARK_PATH));
});

test("the old placeholder 'S' badge is gone from the sidebar and the new logo is used", () => {
  const nav = readFileSync("src/components/shell/Navigation.tsx", "utf8");
  assert.ok(!/>S<\/span>/.test(nav), "old typed-S placeholder still present");
  assert.match(nav, /<Logo /);
});
