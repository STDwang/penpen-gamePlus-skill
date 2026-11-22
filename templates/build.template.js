// penpen-gamePlus · 零依赖单 HTML 构建脚本模板
// 按文件名顺序拼接 src/*.js 并注入 template.html 的 /*__JS__*/ 占位符，
// 产出单个离线可运行的 dist/index.html（去注释去空白，不混淆标识符）与 dist/dev.html（完整注释调试版）。
// 用法：node build.js   （设 MIN=0 跳过压缩）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const root = __dirname;
const srcDir = path.join(root, 'src');

function parseModuleOrder(name) {
  const m = /^(\d{2})([a-z]?)_.*\.js$/.exec(name);
  if (!m) throw new Error(`Invalid module filename "${name}": expected NN[a-z]?_name.js (e.g. 00_util.js, 00a_i18n.js)`);
  return [+m[1], m[2] || ''];
}

function stripMarkedBlocks(src, tag) {
  const openRe = new RegExp(`\\/\\*${tag}\\{\\*\\/`, 'g');
  const closeRe = new RegExp(`\\/\\*\\}${tag}\\*\\/`, 'g');
  const blockRe = new RegExp(`\\/\\*${tag}\\{\\*\\/[\\s\\S]*?\\/\\*\\}${tag}\\*\\/`, 'g');
  const open = (src.match(openRe) || []).length;
  const close = (src.match(closeRe) || []).length;
  if (open !== close) throw new Error(`unbalanced /*${tag}{*/ markers: ${open} open, ${close} close`);
  const out = src.replace(blockRe, '');
  if (openRe.test(out) || closeRe.test(out)) throw new Error(`nested or malformed /*${tag}{*/ markers`);
  return { out, n: open };
}

const files = fs.readdirSync(srcDir)
  .filter(f => f.endsWith('.js'))
  .sort((a, b) => {
    const [na, sa] = parseModuleOrder(a);
    const [nb, sb] = parseModuleOrder(b);
    return na !== nb ? na - nb : sa.localeCompare(sb);
  });
if (!files.length) throw new Error('src/ has no .js files');

let js = '';
for (const f of files) {
  js += `\n// ===== ${f} =====\n` + fs.readFileSync(path.join(srcDir, f), 'utf8');
}

const stripped = stripMarkedBlocks(js, 'native');
js = stripped.out;

// 拼接后立即做一次零依赖语法预检
new vm.Script(js, { filename: 'bundle.js' });

// 计算整体代码哈希，供本地烘焙缓存（IndexedDB）在源码变更后自动失效
const buildHash = crypto.createHash('sha1').update(js).digest('hex').slice(0, 16);
js = js.replace("'__BUILD_HASH__'", () => `'${buildHash}'`);

let tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
if (!tpl.includes('/*__JS__*/')) throw new Error('template.html missing /*__JS__*/ placeholder');

// 若项目存在可选内嵌子集字体目录 fonts/fonts.css，自动转为 data:font/woff2 内联，彻底零外链
const fontCssPath = path.join(root, 'fonts', 'fonts.css');
if (fs.existsSync(fontCssPath) && tpl.includes('<style>')) {
  const fd = path.join(root, 'fonts');
  const css = fs.readFileSync(fontCssPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\/\s*/g, '')
    .replace(/url\(\.\/([\w.-]+\.woff2)\)/g, (_, f) =>
      'url(data:font/woff2;base64,' + fs.readFileSync(path.join(fd, f)).toString('base64') + ')'
    );
  tpl = tpl.replace('<style>', () => '<style id="faces">' + css.trim() + '</style>\n<style>');
}

const ensureDoctype = html => (/^\s*<!doctype\s+html>/i.test(html)
  ? html
  : '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>' + html + '</body></html>');

const outDev = tpl.replace('/*__JS__*/', () => js);
let outProd = outDev;

if (process.env.MIN !== '0') {
  try {
    const esbuild = require('esbuild');
    // 仅去除空白与注释，不重命名标识符（保留报错堆栈与 Worker 可读性）
    const min = esbuild.transformSync(js, {
      minifyWhitespace: true,
      minifySyntax: true,
      charset: 'utf8',
      legalComments: 'none',
      logLevel: 'warning',
    }).code;
    outProd = tpl.replace('/*__JS__*/', () => min);
  } catch (e) {
    console.warn('esbuild not installed locally, dist/index.html left unminified:', e.message.split('\n')[0]);
  }
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), ensureDoctype(outProd));
fs.writeFileSync(path.join(root, 'dist', 'dev.html'), ensureDoctype(outDev));

console.log(
  `built dist/index.html ${(outProd.length / 1024).toFixed(1)} KB ` +
  `(dev.html ${(outDev.length / 1024).toFixed(1)} KB), ` +
  `${files.length} files, hash=${buildHash}, stripped ${stripped.n} native blocks`
);
