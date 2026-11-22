// penpen-gamePlus · 中英双语字典模板（建议保存为 src/00a_i18n.js）
// 约定：中文作为 key，英文查表映射；支持 URL (?lang=en|zh) > localStorage > navigator.language。
const I18N = (() => {
  const KEY = 'gp.lang';
  const EN = {
    '正在加载…': 'Loading…',
    '开始': 'Play',
    '设置': 'Settings',
    '暂停': 'Pause',
    '继续': 'Resume',
    '重开': 'Restart',
    '返回': 'Back',
    '画质': 'Quality',
    '高': 'High',
    '均衡': 'Balanced',
    '流畅': 'Smooth',
    '声音': 'Audio',
    '语言': 'Language',
  };

  function detect() {
    try {
      const u = new URLSearchParams(location.search).get('lang');
      if (u === 'en' || u === 'zh') return u;
      const s = localStorage.getItem(KEY);
      if (s === 'en' || s === 'zh') return s;
    } catch (_) {}
    return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  }

  let lang = detect();
  const subs = [];

  const t = (zh, ...args) => {
    let s = (lang === 'en' && EN[zh]) ? EN[zh] : zh;
    for (let i = 0; i < args.length; i++) s = s.replace(`{${i}}`, args[i]);
    return s;
  };

  function applyDom(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.getAttribute('data-i18n'));
    }
  }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (_) {}
    applyDom();
    for (const fn of subs) try { fn(lang); } catch (_) {}
  }

  return {
    get lang() { return lang; },
    t,
    setLang,
    applyDom,
    extend(dict) { Object.assign(EN, dict); },
    on(fn) { subs.push(fn); },
  };
})();
