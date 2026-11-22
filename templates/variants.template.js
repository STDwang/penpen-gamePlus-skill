// penpen-gamePlus · Variants A/B 实时对比开关模块模板（建议保存为 src/00b_variants.js）
// 凡涉及主观美术、镜头、手感或性能优化取舍，先在此注册 2-3 个可选版本：
//   Variants.def('cam', '追身镜头', [['a', '原机位'], ['b', '低机位']], 'b');
//   if (Variants.val.cam === 'b') { ... }
// 优先级：URL 参数 (?v-cam=a) > localStorage > 默认推荐值 def。
const Variants = (() => {
  const V = { defs: [], val: {}, subs: [] };
  const KEY = n => 'gp.v.' + n;
  const fromUrl = n => {
    try {
      const m = new RegExp('[?&]v-' + n + '=([a-z0-9]+)').exec(location.search);
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  };

  V.def = function (name, label, opts, def) {
    const has = id => opts.some(o => o[0] === id);
    if (!has(def)) def = opts[0][0];
    const idx = V.defs.findIndex(d => d.name === name);
    const d = { name, label, opts, def };
    if (idx >= 0) V.defs[idx] = d;
    else V.defs.push(d);

    let v = def;
    try {
      const saved = localStorage.getItem(KEY(name));
      if (saved && has(saved)) v = saved;
    } catch (_) {}
    const u = fromUrl(name);
    if (u && has(u)) v = u;

    V.val[name] = v;
    for (const fn of V.subs) try { fn(name, v, true); } catch (_) {}
    return v;
  };

  V.set = function (name, id) {
    const d = V.defs.find(x => x.name === name);
    if (!d || !d.opts.some(o => o[0] === id) || V.val[name] === id) return;
    V.val[name] = id;
    try { localStorage.setItem(KEY(name), id); } catch (_) {}
    for (const fn of V.subs) try { fn(name, id, false); } catch (_) {}
  };

  V.reset = function () {
    for (const d of V.defs) {
      V.set(d.name, d.def);
      try { localStorage.removeItem(KEY(d.name)); } catch (_) {}
    }
  };

  V.on = fn => { V.subs.push(fn); };
  return V;
})();
