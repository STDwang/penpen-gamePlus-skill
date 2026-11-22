// penpen-gamePlus · 通用纯 JS 帧耗时压测与渲染账本脚本模板
// 原理：无头浏览器加载游戏后屏蔽底层 GL 绘制调用（仅量纯脚本逻辑耗时），
// 可通过 CDP 叠加 CPU 降速倍率（2x≈中端机，4x≈低端机），并输出 p50/p95/p99/max 与超 16.7ms 帧数。
//
// 用法：
//   node tools/checks/perf-check.js [frames=1200] [cpuThrottle=2] [extraQuery=""]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [framesArg = '1200', throttleArg = '2', extraQ = ''] = process.argv.slice(2);
const FRAMES = +framesArg;
const THROTTLE = +throttleArg;
const html = path.resolve(process.env.HTML || path.join(__dirname, '../../dist/dev.html'));
const baselinePath = path.join(__dirname, 'baseline.json');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  if (THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }

  const baseUrl = pathToFileURL(html).href;
  await page.goto(`${baseUrl}?dev&manual&gov=0&backend=webgl2${extraQ ? '&' + extraQ : ''}`);
  await page.evaluate(async () => window.__game.boot());

  const res = await page.evaluate(n => {
    const g = window.__game;
    const statsBefore = g.stats ? g.stats() : null;
    // 优先使用标准 noDraw 开关，其次自动屏蔽 WebGL2 / Canvas2D 绘制调用
    let drawMuted = false;
    if (typeof g.noDraw === 'function') {
      g.noDraw(true);
      drawMuted = 'noDraw()';
    } else {
      const gl = (g.m && (g.m.Gfx?.gl || g.m.Render?.gl || g.m.App?.gfx?.gl)) || null;
      if (gl) {
        gl.drawElements = gl.drawArrays = gl.drawElementsInstanced = gl.drawArraysInstanced = gl.clear = () => {};
        drawMuted = 'webgl2';
      } else if (typeof CanvasRenderingContext2D !== 'undefined') {
        const p = CanvasRenderingContext2D.prototype;
        for (const fn of ['fillRect', 'strokeRect', 'clearRect', 'fill', 'stroke', 'drawImage', 'fillText', 'strokeText']) {
          if (typeof p[fn] === 'function') p[fn] = () => {};
        }
        drawMuted = 'canvas2d';
      }
    }
    const pilot = g.pilot();
    // 先预热 120 帧让 JIT 稳定
    g.sim(2, pilot, { draw: false });

    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      g.frame(1 / 60);
      times[i] = performance.now() - t0;
    }
    const sorted = Array.from(times).sort((a, b) => a - b);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const over16 = sorted.filter(x => x > 16.7).length;
    return {
      drawMuted,
      frames: n,
      p50: +pct(0.5).toFixed(2),
      p95: +pct(0.95).toFixed(2),
      p99: +pct(0.99).toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
      over16,
      ledger: statsBefore,
    };
  }, FRAMES);

  await browser.close();

  console.log(`# JS 性能压测 (${FRAMES} 帧, CPU ${THROTTLE}x 降速, 绘制屏蔽=${res.drawMuted || '未屏蔽'}${extraQ ? ', ' + extraQ : ''})`);
  console.log(`p50=${res.p50}ms | p95=${res.p95}ms | p99=${res.p99}ms | max=${res.max}ms | >16.7ms=${res.over16} 帧`);
  if (!res.drawMuted) console.warn('警告: 未检测到可屏蔽的绘制句柄，耗时可能混入软件光栅化时间');
  if (res.ledger) console.log('渲染账本快照:', JSON.stringify(res.ledger));

  let failed = errs.length > 0;
  if (errs.length) console.error('运行时报错:', errs);

  if (fs.existsSync(baselinePath)) {
    const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const budget = (base.perf && base.perf[`cpu${THROTTLE}x`]) || (base.perf && base.perf.default);
    if (budget) {
      if (budget.p95Max != null && res.p95 > budget.p95Max) {
        console.error(`✗ p95 (${res.p95}ms) 超出 baseline 预算 (${budget.p95Max}ms)`);
        failed = true;
      }
      if (budget.over16Max != null && res.over16 > budget.over16Max) {
        console.error(`✗ >16.7ms 帧数 (${res.over16}) 超出 baseline 预算 (${budget.over16Max})`);
        failed = true;
      }
    }
    if (base.ledger && res.ledger && base.ledger.drawCallsMax != null && res.ledger.drawCalls > base.ledger.drawCallsMax) {
      console.error(`✗ drawCalls (${res.ledger.drawCalls}) 超出 baseline 预算 (${base.ledger.drawCallsMax})`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
