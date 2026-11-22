// penpen-gamePlus · 通用状态机与可玩性闭环冒烟脚本模板
// 验证：标题页 -> 开局进入 playing -> pilot() 自动试玩 -> 暂停(hold) -> 恢复 -> 重开，全程零 pageerror。
//
// 用法：
//   node tools/checks/smoke-check.js [dist/dev.html]
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const html = path.resolve(process.argv.find(a => a.endsWith('.html')) || path.join(__dirname, '../../dist/dev.html'));

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.goto(`${pathToFileURL(html).href}?dev&manual&gov=0`);
  await page.evaluate(async () => window.__game.boot());

  const res = await page.evaluate(() => {
    const g = window.__game;
    const log = [];
    const ui0 = g.ui();
    log.push(['title', ui0.state]);

    // 开局
    ui0.go();
    g.frame(1 / 60);
    const ui1 = g.ui();
    log.push(['start', ui1.state]);

    // 自动试玩 5 秒
    const pilot = g.pilot();
    g.sim(5, pilot, { draw: false });
    const s1 = g.stats ? g.stats() : null;
    log.push(['after_sim', g.ui().state, s1]);

    // 暂停 -> 恢复（支持 menu(true/false) 或 Esc）
    if (typeof ui1.menu === 'function') {
      ui1.menu(true);
      g.frame(1 / 60);
      log.push(['paused', g.ui().state, g.ui().open]);
      ui1.menu(false);
      g.frame(1 / 60);
      log.push(['resumed', g.ui().state, g.ui().open]);
    }

    // 重开归位
    g.reset();
    g.frame(1 / 60);
    log.push(['reset', g.ui().state]);

    return { log, ok: ui0.state === 'title' && ui1.state === 'playing' };
  });

  await browser.close();
  console.log('冒烟轨迹:', JSON.stringify(res.log));
  if (errs.length || !res.ok) {
    console.error('冒烟失败:', { ok: res.ok, errs });
    process.exit(1);
  }
  console.log('✓ 状态机与试玩闭环冒烟通过');
})().catch(e => { console.error(e); process.exit(1); });
