// penpen-gamePlus · 通用模态弹层与返回栈闭环审计模板
// 验证每个弹层通过「返回按钮 / 点外部遮罩 / Esc / 系统返回(history.back)」都能干净退回标题页，
// 不误触开局、不残留弹层栈、不污染 history。
//
// 用法：
//   node tools/checks/layer-check.js [dist/dev.html]
//   ENGINE=webkit node tools/checks/layer-check.js
const PW = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const ENGINE = process.env.ENGINE || 'chromium';
const html = path.resolve(process.argv.find(a => a.endsWith('.html')) || path.join(__dirname, '../../dist/dev.html'));

const SIZES = [
  { name: '竖拿 375x667', w: 375, h: 667 },
  { name: '横拿 812x375', w: 812, h: 375 },
];

// 根据具体项目的弹层选择器与开关方法调整此处列表
const LAYERS = [
  {
    name: 'menu',
    open: '() => window.__game.ui().menu(true)',
    isOpen: '() => !!window.__game.ui().open',
    backSelector: '#m-back',
    hasScrim: false,
  },
];

(async () => {
  const browser = await PW[ENGINE].launch({ headless: true });
  let bad = 0;

  for (const s of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => { bad++; console.error('pageerror:', e.message); });

    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.__game && window.__game.ui && window.__game.ui().state === 'title', null, { timeout: 120000 });
    await page.waitForTimeout(600);

    for (const L of LAYERS) {
      for (const way of ['返回按钮', '点遮罩', 'Esc', '系统返回']) {
        if (way === '点遮罩' && !L.hasScrim) continue;
        await page.evaluate(`(${L.open})()`);
        await page.waitForTimeout(300);
        const opened = await page.evaluate(`(${L.isOpen})()`);

        if (way === '返回按钮') await page.tap(L.backSelector);
        else if (way === '点遮罩') { const vp = page.viewportSize(); await page.mouse.click(vp.width - 8, vp.height / 2); }
        else if (way === 'Esc') await page.keyboard.press('Escape');
        else await page.evaluate(() => history.back());

        await page.waitForTimeout(400);
        const r = await page.evaluate(`({
          open: (${L.isOpen})(),
          state: window.__game.ui().state,
          top: window.__game.ui().layerTop ? window.__game.ui().layerTop() : null
        })`);
        const ok = opened && !r.open && r.state === 'title' && r.top === null;
        if (!ok) bad++;
        console.log(`${ok ? '✓' : '✗'} ${s.name} [${L.name}] ${way}${ok ? '' : ' ' + JSON.stringify({ opened, ...r })}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  console.log(bad ? `弹层返回栈发现 ${bad} 个问题` : '全部弹层返回栈闭环通过');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
