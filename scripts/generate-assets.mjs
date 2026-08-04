#!/usr/bin/env node
/**
 * 產生 favicon 全套 + OG 社群預覽圖。
 *
 * 用本機微軟正黑體（skill: og-social-preview-zh 的「本機系統中文字型法」）——
 * 產物是點陣 PNG 並直接 commit，部署後不依賴字型，所以不會有 Linux tofu 問題。
 *
 * 裝飾符號一律用 canvas 路徑自繪，不用字型的特殊字元（正黑體不一定有）。
 *
 * 用法：node scripts/generate-assets.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS = resolve(ROOT, 'assets');
mkdirSync(ASSETS, { recursive: true });

// ── 字型 ──────────────────────────────────────────
for (const [path, name] of [
  ['C:/Windows/Fonts/msjhbd.ttc', 'JhengHeiBold'],
  ['C:/Windows/Fonts/msjh.ttc', 'JhengHei'],
]) {
  if (existsSync(path)) GlobalFonts.registerFromPath(path, name);
  else console.warn(`⚠️ 找不到字型 ${path}`);
}

// ── 配色（沿用操作台的無障礙綠）──────────────────
const GREEN_DARK = '#3f4a30';
const GREEN = '#5d6b47';
const GREEN_LIGHT = '#7d8f63';
const CREAM = '#f6f7f4';
const GOLD = '#d9b166';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 自繪打勾（不用字型符號，避免缺字變方框） */
function drawCheck(ctx, cx, cy, size, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.42, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.10, cy + size * 0.34);
  ctx.lineTo(cx + size * 0.45, cy - size * 0.34);
  ctx.stroke();
  ctx.restore();
}

// ── 圖示 ──────────────────────────────────────────
function makeIcon(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  // maskable 要填滿整個畫布（Android 會自己裁圓），一般版做圓角
  const pad = maskable ? 0 : 0;
  const radius = maskable ? 0 : size * 0.22;

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, GREEN_LIGHT);
  g.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = g;
  if (radius) {
    roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, size, size);
  }

  // maskable 的主視覺要縮進 safe zone（約 60%）
  const scale = maskable ? 0.62 : 0.82;
  const cx = size / 2;
  const cy = size / 2;

  // 主視覺：「石」字
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = CREAM;
  ctx.font = `${Math.round(size * 0.58)}px JhengHeiBold`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('石', 0, -size * 0.045);
  ctx.restore();

  // 右下角打勾（代表「逐項完成」）
  const badge = size * (maskable ? 0.24 : 0.32);
  const bx = size - badge * (maskable ? 0.95 : 0.72);
  const by = size - badge * (maskable ? 0.95 : 0.72);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(bx, by, badge * 0.5, 0, Math.PI * 2);
  ctx.fill();
  drawCheck(ctx, bx, by, badge * 0.5, GREEN_DARK, Math.max(2, size * 0.035));

  return c;
}

const iconJobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-192-maskable.png', 192, true],
  ['icon-512-maskable.png', 512, true],
];
for (const [name, size, maskable] of iconJobs) {
  writeFileSync(resolve(ASSETS, name), makeIcon(size, { maskable }).toBuffer('image/png'));
}
writeFileSync(resolve(ROOT, 'apple-touch-icon.png'), makeIcon(180).toBuffer('image/png'));

// favicon.ico（16/32/48 合成）
const icoParts = [];
for (const s of [16, 32, 48]) {
  const p = resolve(ASSETS, `_ico-${s}.png`);
  writeFileSync(p, makeIcon(s).toBuffer('image/png'));
  icoParts.push(p);
}
writeFileSync(resolve(ROOT, 'favicon.ico'), await pngToIco(icoParts));

// favicon.svg（向量，高 DPI 最清晰）
writeFileSync(resolve(ROOT, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="石門國小校網遷移操作台">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_LIGHT}"/>
      <stop offset="1" stop-color="${GREEN_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="30" y="40" font-family="Microsoft JhengHei, Noto Sans TC, sans-serif"
        font-size="34" font-weight="700" fill="${CREAM}" text-anchor="middle">石</text>
  <circle cx="48" cy="48" r="12" fill="${GOLD}"/>
  <path d="M42.5 48.2 L46.4 52 L53.5 44.4" fill="none" stroke="${GREEN_DARK}"
        stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

// ── OG 社群預覽圖 1200×630 ────────────────────────
function makeOG() {
  const W = 1200, H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#4a5639');
  g.addColorStop(0.55, GREEN);
  g.addColorStop(1, '#6d7d55');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 背景裝飾：右側淡色同心圓
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (const r of [280, 200, 120]) {
    ctx.beginPath();
    ctx.arc(W - 130, H / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 左側色帶
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, 14, H);

  // 圖示
  const iconSize = 118;
  const ic = makeIcon(iconSize);
  ctx.drawImage(ic, 74, 74);

  // 學校名
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '26px JhengHei';
  ctx.fillText('桃園市龍潭區石門國民小學', 214, 126);

  ctx.fillStyle = GOLD;
  ctx.font = '22px JhengHeiBold';
  ctx.fillText('無障礙 AA 標章 · 共構網站遷移', 214, 168);

  // 主標題
  ctx.fillStyle = '#ffffff';
  ctx.font = '84px JhengHeiBold';
  ctx.fillText('校網遷移操作台', 74, 320);

  // 副標
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '31px JhengHei';
  ctx.fillText('12 個步驟，從舊校網搬到教育局共構平台', 74, 382);

  // 三個重點膠囊
  const pills = ['逐步操作清單', '一鍵複製內容', '對比度檢查工具'];
  let px = 74;
  ctx.font = '24px JhengHeiBold';
  for (const p of pills) {
    const w = ctx.measureText(p).width + 46;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, px, 424, w, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p, px + 23, 458);
    px += w + 16;
  }

  // 網址膠囊
  ctx.fillStyle = '#2c3423';
  roundRect(ctx, 74, 520, 468, 60, 30);
  ctx.fill();
  drawCheck(ctx, 110, 550, 22, GOLD, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = '23px JhengHeiBold';
  ctx.fillText('cagoooo.github.io/smes-web-migration', 140, 559);

  return c;
}
writeFileSync(resolve(ROOT, 'og-preview.png'), makeOG().toBuffer('image/png'));

// 清掉 ico 中間檔
import { unlinkSync } from 'node:fs';
for (const p of icoParts) { try { unlinkSync(p); } catch {} }

console.log('✔ favicon.ico / favicon.svg / apple-touch-icon.png');
console.log('✔ assets/icon-192|512(.-maskable).png');
console.log('✔ og-preview.png (1200×630)');
