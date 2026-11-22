// penpen-gamePlus · 三档画质与动态帧率调速器模块模板（建议保存为 src/00c_quality.js）
// 原则：电脑与旗舰机默认「高」；中低端手机按 GPU 名称自动分级；
// 掉帧时先缩分辨率与非核心粒子（排除偶发 JS 卡顿干扰），仍不稳再降档并持久化记忆。
const Quality = (() => {
  const LEVELS = [
    { name: '高', maxDpr: 2.0, maxPx: 3.4e6, floor: 0.75, shadow: 2048, blur: true, bloom: 6, fx: 1.0, far: 1.0 },
    { name: '均衡', maxDpr: 1.25, maxPx: 1.2e6, floor: 0.75, shadow: 1536, blur: true, bloom: 5, fx: 0.7, far: 0.9 },
    { name: '流畅', maxDpr: 1.0, maxPx: 0.7e6, floor: 0.70, shadow: 1024, blur: false, bloom: 4, fx: 0.45, far: 0.75 },
  ];
  const LITE = [1.0, 0.8, 0.62]; // 档内轻载粒子缩放
  const K_PICK = 'gp.q.pick';
  const K_AUTO = 'gp.q.auto';

  const Q = { LEVELS, pick: 'auto', tier: 0, lite: 0, scale: 1.0, gpu: '', why: '', L: LEVELS[0], subs: [] };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const get = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (_) {} };
  const isPhone = () => !!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (hover: none)').matches);

  function probeGPU() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return '';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return String(s || '');
    } catch (_) {
      return '';
    }
  }

  Q.classify = function (name, phone) {
    if (!phone) return [0, 'desktop'];
    const s = name.toLowerCase();
    let m;
    if ((m = /adreno[^0-9]*(\d{3})/.exec(s))) {
      const n = +m[1];
      if (n >= 725) return [0, 'adreno ' + n];
      if (n >= 616) return [1, 'adreno ' + n];
      return [2, 'adreno ' + n];
    }
    if (/immortalis|mali-g(7[1-9]0|9\d\d)|apple gpu/.test(s)) return [0, 'mobile high'];
    if (/mali-g(78|77|68|610|615|620|625)/.test(s)) return [1, 'mali mid'];
    if (/mali|powervr|swiftshader/.test(s)) return [2, 'mobile low'];
    return [1, 'mobile default'];
  };

  Q.apply = function (tier, saveAuto) {
    tier = clamp(tier | 0, 0, LEVELS.length - 1);
    Q.tier = tier;
    Q.L = LEVELS[tier];
    Q.scale = 1.0;
    Q.lite = 0;
    if (saveAuto) put(K_AUTO, tier);
    for (const fn of Q.subs) try { fn(tier, Q.L); } catch (_) {}
  };

  Q.decide = function () {
    const qs = new URLSearchParams(location.search);
    const forced = qs.get('quality');
    Q.gpu = probeGPU();
    if (forced != null && /^[012]$/.test(forced)) {
      Q.pick = +forced; Q.why = 'url'; Q.apply(+forced, false); return;
    }
    const savedPick = get(K_PICK);
    if (savedPick != null && /^[012]$/.test(savedPick)) {
      Q.pick = +savedPick; Q.why = 'user'; Q.apply(+savedPick, false); return;
    }
    Q.pick = 'auto';
    const savedAuto = get(K_AUTO);
    if (savedAuto != null && /^[012]$/.test(savedAuto)) {
      Q.why = 'remembered'; Q.apply(+savedAuto, false); return;
    }
    const [t, why] = Q.classify(Q.gpu, isPhone());
    Q.why = why; Q.apply(t, false);
  };

  Q.setPick = function (v) {
    if (v === 'auto') { put(K_PICK, null); Q.decide(); }
    else { put(K_PICK, v); Q.pick = +v; Q.why = 'user'; Q.apply(+v, false); }
  };

  // 每帧调用：dtMs 为真实帧间隔，jsMs 为本帧 JS 逻辑耗时（排除纯脚本偶发抖动）
  let badAcc = 0, goodAcc = 0;
  Q.govern = function (dtMs, jsMs) {
    if (Q.pick !== 'auto') return;
    if (jsMs > 14 && dtMs - jsMs < 10) return; // 仅脚本卡顿时不误降显卡画质
    if (dtMs > 23) {
      badAcc += dtMs; goodAcc = 0;
      if (badAcc > 2200) {
        badAcc = 0;
        if (Q.lite < LITE.length - 1) { Q.lite++; return; }
        if (Q.scale > Q.L.floor + 0.01) { Q.scale = Math.max(Q.L.floor, +(Q.scale - 0.1).toFixed(2)); return; }
        if (Q.tier < LEVELS.length - 1) Q.apply(Q.tier + 1, true);
      }
    } else if (dtMs < 18.5) {
      goodAcc += dtMs; badAcc = Math.max(0, badAcc - dtMs);
      if (goodAcc > 15000 && Q.scale < 1.0) { goodAcc = 0; Q.scale = Math.min(1.0, +(Q.scale + 0.1).toFixed(2)); }
      else if (goodAcc > 20000 && Q.lite > 0) { goodAcc = 0; Q.lite--; }
      else if (goodAcc > 60000 && Q.tier > 0) { goodAcc = 0; Q.apply(Q.tier - 1, true); }
    }
  };

  Q.fxScale = () => Q.L.fx * LITE[Q.lite];
  Q.on = fn => { Q.subs.push(fn); };
  return Q;
})();
