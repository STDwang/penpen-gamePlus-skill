// penpen-gamePlus · 同种子同帧逐像素回归对比模板
// 用途：验证“纯性能优化 / 管线重构”或对比两个 Variants（a vs b）的画面差异。
// 原则：先跑一次 base vs base2 对照测出固有随机底噪，再比 base vs candidate。
//
// 用法：
//   node tools/checks/shotdiff.js [baseQuery=""] [candQuery="v-opt=b"] [w=844] [h=390] [simSec=10]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [
  baseQ = '',
  candQ = '',
  W = '844',
  H = '390',
  simSec = '10',
] = process.argv.slice(2);

const html = path.resolve(process.env.HTML || path.join(__dirname, '../../dist/dev.html'));
const outDir = path.resolve(process.env.OUTDIR || path.join(__dirname, '../../tmp/shots'));
const NFR = +(process.env.FRAMES || 8);
const DRAIN = +(process.env.DRAIN || 0);

fs.mkdirSync(outDir, { recursive: true });

function comparePixels(a, b) {
  let diffPx = 0, sum = 0, maxD = 0;
  const n = a.w * a.h;
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const d = Math.max(
      Math.abs(a.px[k] - b.px[k]),
      Math.abs(a.px[k + 1] - b.px[k + 1]),
      Math.abs(a.px[k + 2] - b.px[k + 2])
    );
    if (d > 8) diffPx++;
    sum += d;
    if (d > maxD) maxD = d;
  }
  return {
    pct: +(100 * diffPx / n).toFixed(3),
    avg: +(sum / n).toFixed(3),
    max: maxD,
  };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
  });

  async function grab(tag, q) {
    const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.error(`[${tag}] pageerror:`, e.message));
    const baseUrl = pathToFileURL(html).href;
    const url = `${baseUrl}?dev&manual&gov=0&backend=webgl2${q ? '&' + q : ''}`;
    await page.goto(url);
    await page.evaluate(async () => window.__game.boot());

    const r = await page.evaluate(async ([sec, drain, frames]) => {
      const g = window.__game;
      const pilot = g.pilot();
      g.sim(sec, pilot, { draw: false });
      for (let i = 0; i < drain; i++) g.frame(1 / 60);
      for (let i = 0; i < frames; i++) g.frame(1 / 60);
      const cap = await g.capture();
      let bin = '';
      const u = new Uint8Array(cap.data.buffer, cap.data.byteOffset, cap.data.byteLength);
      for (let i = 0; i < u.length; i += 0x6000) {
        bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x6000));
      }
      return { w: cap.w, h: cap.h, raw: btoa(bin), png: await g.shot() };
    }, [+simSec, DRAIN, NFR]);

    fs.writeFileSync(path.join(outDir, `shot-${W}x${H}-${tag}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    await page.close();
    return { w: r.w, h: r.h, px: Buffer.from(r.raw, 'base64') };
  }

  const base1 = await grab('base1', baseQ);
  const base2 = await grab('base2', baseQ);
  const ctrl = comparePixels(base1, base2);
  console.log(`对照组 (base vs base2): 差异像素(>8/255)=${ctrl.pct}%  平均差=${ctrl.avg}  最大差=${ctrl.max}`);

  let failed = false;
  if (candQ) {
    const cand = await grab('cand', candQ);
    const diff = comparePixels(base1, cand);
    console.log(`候选组 (${candQ} vs base): 差异像素(>8/255)=${diff.pct}%  平均差=${diff.avg}  最大差=${diff.max}`);
    const baselinePath = path.join(__dirname, 'baseline.json');
    if (process.env.STRICT === '1' && fs.existsSync(baselinePath)) {
      const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      const maxDelta = base.shotdiff?.maxPctAboveCtrl;
      if (maxDelta != null && diff.pct > ctrl.pct + maxDelta) {
        console.error(`✗ 差异像素 (${diff.pct}%) 超出对照组底噪 (${ctrl.pct}%) + 容差 (${maxDelta}%)`);
        failed = true;
      }
    }
  }

  await browser.close();
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
