// penpen-gamePlus · 通用全端 UI 布局、安全区、触控面积与遮挡审计模板
// 覆盖多款手机横竖屏（含 #app.rot 自动横转）、刘海/底条安全区与桌面常见分辨率：
//   1. 禁止在 #app 内使用 position:sticky（Safari 旋转容器错位）
//   2. 必须存在 viewport meta
//   3. 触屏设备上按钮短边 >= 44px（Apple HIG）
//   4. 可见元素不超出安全区、不被无滚动父容器裁切、文字不溢框
//   5. 按钮中心 elementFromPoint 必须可真实点击（不被其他层盖住）
//   6. 任意两段可见文字框不实质互叠
//
// 用法：
//   node tools/checks/layout-check.js [dist/dev.html] [only=<正则>]
//   ENGINE=webkit node tools/checks/layout-check.js   # 用 WebKit 检查 Safari 行为
const PW = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const ENGINE = process.env.ENGINE || 'chromium';
const only = (process.argv.find(a => a.startsWith('only=')) || '').slice(5);
const html = path.resolve(process.argv.find(a => a.endsWith('.html')) || path.join(__dirname, '../../dist/dev.html'));

const PHONES = [
  ['iPhone mini', 375, 812, 50, 21],
  ['iPhone 15', 393, 852, 59, 21],
  ['iPhone SE', 375, 667, 0, 0],
  ['Android 360', 360, 800, 24, 0],
  ['Android 412', 412, 915, 26, 0],
];

const CONFIGS = [];
for (const [name, w, h, notch, home] of PHONES) {
  CONFIGS.push({ name: name + ' 横拿', vw: h, vh: w, touch: true, safe: { l: notch, r: notch, t: 0, b: home } });
  CONFIGS.push({ name: name + ' 竖拿', vw: w, vh: h, touch: true, safe: { l: 0, r: 0, t: notch ? notch - 3 : 24, b: notch ? 34 : 0 } });
}
for (const [w, h] of [[1024, 640], [1280, 720], [1440, 900], [1920, 1080]]) {
  CONFIGS.push({ name: `桌面 ${w}x${h}`, vw: w, vh: h, touch: false, safe: { l: 0, r: 0, t: 0, b: 0 } });
}

(async () => {
  const browser = await PW[ENGINE].launch({ headless: true });
  let totalBad = 0;

  for (const cfg of CONFIGS) {
    if (only && !new RegExp(only).test(cfg.name)) continue;
    const ctx = await browser.newContext({
      viewport: { width: cfg.vw, height: cfg.vh },
      isMobile: cfg.touch,
      hasTouch: cfg.touch,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    await page.addInitScript(c => {
      const s = c.safe;
      const rot = c.touch && c.vh > c.vw * 1.04;
      const f = rot ? { l: s.t, r: s.b, t: s.r, b: s.l } : s;
      const st = document.createElement('style');
      st.textContent = `#app,#app.rot,#app.rot.flip{--sl:${f.l}px!important;--sr:${f.r}px!important;--st:${f.t}px!important;--sb:${f.b}px!important}`;
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
      window.__touch = c.touch;
      window.__TOUCH_MIN = 44;
    }, cfg);

    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.__game && window.__game.ui && window.__game.ui().state === 'title', null, { timeout: 120000 });
    await page.waitForTimeout(800);

    const auditScene = sceneName => page.evaluate(scene => {
      const app = document.getElementById('app') || document.body;
      const cs = getComputedStyle(app);
      const px = v => parseFloat(cs.getPropertyValue(v)) || 0;

      // 通过三个角锚点反推逻辑坐标系（自动兼容 #app.rot 旋转 90 度）
      const pts = ['left:0;top:0', 'left:100%;top:0', 'left:0;top:100%'].map(css => {
        const p = document.createElement('i');
        p.style.cssText = 'position:absolute;width:0;height:0;' + css;
        app.appendChild(p);
        const r = p.getBoundingClientRect();
        p.remove();
        return [r.left, r.top];
      });
      const ex = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
      const ey = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1]];
      const W = Math.hypot(...ex) || 1;
      const H = Math.hypot(...ey) || 1;
      const uv = (x, y) => [
        ((x - pts[0][0]) * ex[0] + (y - pts[0][1]) * ex[1]) / W,
        ((x - pts[0][0]) * ey[0] + (y - pts[0][1]) * ey[1]) / H,
      ];
      const box = r => {
        const a = uv(r.left, r.top), b = uv(r.right, r.bottom);
        return { l: Math.min(a[0], b[0]), r: Math.max(a[0], b[0]), t: Math.min(a[1], b[1]), b: Math.max(a[1], b[1]) };
      };
      const safe = { l: px('--sl'), r: W - px('--sr'), t: px('--st'), b: H - px('--sb') };
      const vis = e => {
        for (let q = e; q && q !== document.body; q = q.parentElement) {
          const s = getComputedStyle(q);
          if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false;
        }
        return true;
      };
      const isLeaf = e => e.tagName === 'BUTTON' || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const label = e => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';

      const probs = [];
      if (!document.querySelector('meta[name=viewport]')) probs.push({ scene, k: '缺少 viewport meta' });
      for (const e of app.querySelectorAll('*')) {
        if (getComputedStyle(e).position === 'sticky') probs.push({ scene, k: '禁止 position:sticky', id: label(e) });
      }

      const boxes = [];
      for (const e of app.querySelectorAll('*')) {
        if (!isLeaf(e) || !vis(e)) continue;
        if (e.closest('#view,#veil,#shade,.dev-only,svg,kbd')) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const B = box(r);
        const s = getComputedStyle(e);
        const isBtn = e.tagName === 'BUTTON';

        // 检查是否被不可滚动父容器裁切
        let scroller = null, clipped = false;
        for (let q = e.parentElement; q && q !== app; q = q.parentElement) {
          const qs = getComputedStyle(q);
          if (qs.overflowX === 'visible' && qs.overflowY === 'visible') continue;
          const Q = box(q.getBoundingClientRect());
          const out = B.l < Q.l - 1 || B.r > Q.r + 1 || B.t < Q.t - 1 || B.b > Q.b + 1;
          if (/auto|scroll/.test(qs.overflowY + qs.overflowX)) {
            if (out || q.scrollHeight > q.clientHeight + 1) scroller = q;
          } else if (out) {
            clipped = true; break;
          }
        }
        if (clipped) { probs.push({ scene, k: '被容器裁切', id: label(e) }); continue; }
        if (scroller) continue;

        if (isBtn && window.__touch && Math.min(B.r - B.l, B.b - B.t) < window.__TOUCH_MIN - 0.5 && s.pointerEvents !== 'none') {
          probs.push({ scene, k: '按钮小于44px', id: label(e), size: [Math.round(B.r - B.l), Math.round(B.b - B.t)] });
        }
        if (B.l < safe.l - 1 || B.r > safe.r + 1 || B.t < safe.t - 1 || B.b > safe.b + 1) {
          probs.push({ scene, k: '超出安全区/画面', id: label(e) });
        }
        if ((s.overflow !== 'visible' || s.textOverflow === 'ellipsis') && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2)) {
          probs.push({ scene, k: '文字溢框', id: label(e) });
        }
        if (isBtn && s.pointerEvents !== 'none') {
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          if (hit && hit !== e && !e.contains(hit) && !hit.contains(e)) {
            probs.push({ scene, k: '按钮被遮挡点不到', id: label(e), by: label(hit) });
          }
        }
        boxes.push([e, B]);
      }

      // 任意两个无包含关系的可见叶节点文本不得实质重叠
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [e1, a] = boxes[i], [e2, b] = boxes[j];
          if (e1.contains(e2) || e2.contains(e1)) continue;
          const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
          const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (ox > 4 && oy > 4) probs.push({ scene, k: '元素/文字互叠', a: label(e1), b: label(e2) });
        }
      }
      return probs;
    }, sceneName);

    const probs = [...await auditScene('title')];
    // 如存在菜单，顺便审计菜单打开状态
    const hasMenu = await page.evaluate(() => !!(window.__game.ui && window.__game.ui().menu));
    if (hasMenu) {
      await page.evaluate(() => window.__game.ui().menu(true));
      await page.waitForTimeout(300);
      probs.push(...await auditScene('menu'));
    }

    if (errs.length) probs.push({ scene: 'runtime', k: 'pageerror', errs });
    totalBad += probs.length;
    console.log((probs.length ? '✗ ' : '✓ ') + cfg.name + (probs.length ? ' -> ' + JSON.stringify(probs) : ''));
    await ctx.close();
  }

  await browser.close();
  console.log(totalBad ? `发现 ${totalBad} 项布局问题` : '全部分辨率布局审计通过');
  process.exit(totalBad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
