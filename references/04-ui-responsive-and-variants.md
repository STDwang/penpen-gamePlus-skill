# 04 · 克制 UI、全端响应式与 Variants 对比系统规范

高完成度游戏与普通 Demo 最直观的分水岭，往往体现在**界面是否克制、移动端横竖屏是否严丝合缝、返回键是否绝不误触，以及是否具备顺畅的 A/B 调优机制**。

---

## 一、视觉克制与氛围优先的界面原则

1. **画面永远是主角，UI 只做最轻的点缀**
   - 启动完成前用纯深色 `#veil` 遮罩，首帧渲染就绪后平滑淡出（`opacity 1 -> 0`），绝不闪白屏、绝不跳出未初始化的错位画面。
   - 标题页直接叠加在实时运行的动态游戏世界之上，只用极薄的上下渐变压暗层 `#shade` 保障文字可读性，禁止把整张画面糊上厚重卡片弹窗。
   - 游玩 HUD 只保留核心 1–3 个极简信息（如速度、时间/天气、暂停按钮），零系统日志、零调试红字、零装饰性无关标签。
2. **暂停即实时取景框（`mode = 'hold'`）**
   - 打开菜单或丢失窗口焦点时自动进入 `hold` 模式：物理与时间冻结，但**渲染循环继续画当前帧**。这样玩家在菜单里切换画质、机位、语言或 `?dev` 里的视觉 Variant 时，背后画面会瞬间实时反馈。
3. **零外链的质感排版**
   - 使用高可读性的无衬线 + 衬线双字族变量（`--f-song` / `--f-lat` / `--f-ui`），优先使用系统优雅字体回退栈；如确需品牌标题字体，只内嵌最小字符子集（`data:font/woff2;base64,...`），离线照常美观。

---

## 二、全端响应式与移动端硬性红线（可直接用 `layout-check` 审计）

所有界面容器统一放在 `#app` 内，使用标准安全区 CSS 变量体系：

```css
#app {
  position: fixed; inset: 0; overflow: hidden;
  user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  touch-action: none;
  --cw: 100vw; --ch: 100vh;
  --sl: env(safe-area-inset-left, 0px);
  --sr: env(safe-area-inset-right, 0px);
  --st: env(safe-area-inset-top, 0px);
  --sb: env(safe-area-inset-bottom, 0px);
  /* 预留宿主悬浮按钮占位（如小游戏容器顶栏），普通 Web 为 0px */
  --xl: 0px; --xr: 0px; --xt: 0px; --xb: 0px;
  --gl: max(20px, var(--sl), var(--xl));
  --gr: max(20px, var(--sr), var(--xr));
  --gt: calc(max(var(--st), var(--xt)) + 16px);
  --gb: calc(max(var(--sb), var(--xb)) + 18px);
}
```

### 必须通过自动审计的 7 条硬规矩
1. **必须声明移动端 `<meta name="viewport">`**（含 `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`）。
2. **横屏游戏竖拿自动旋转支持（如为纯横屏游戏）**：手机开启旋转锁竖拿时，通过 `#app.rot` 旋转 `90deg` 并将四边 `safe-area-inset-*` 对应重映射，确保玩家转手机就能满屏玩。
3. **容器内严禁使用 `position: sticky`**：在旋转容器（`transform: rotate(90deg)`）下，iOS Safari/WebKit 对 `position: sticky` 存在严重定位错乱，必须改用 `flex` 固定顶底栏 + 中间独立 `overflow-y: auto` 滚动区。
4. **触控热区底线 ≥ 44×44 CSS px**：在触摸设备（`pointer: coarse` / mobile）上，任何可点击按钮的短边不得小于 `44px`（Apple HIG 标准）。
5. **全元素位于安全区内且不被裁切**：除滚动容器内可滚动到达的列表项外，所有可见文字与按钮必须落在安全区 `[--sl, W - --sr] × [--st, H - --sb]` 内，且不得被无滚动的父容器 `overflow: hidden` 裁掉、不得文字溢框（`scrollWidth > clientWidth`）。
6. **按钮中心必须可真实命中**：对每个可见按钮中心点调用 `document.elementFromPoint(cx, cy)`，命中结果必须是该按钮或其子元素，严禁被透明遮罩、装饰层或其他面板盖住导致“看得见点不到”。
7. **文字互不压叠**：任意两个可见叶节点文字框在裁剪后不得发生实质重叠。

---

## 三、模态弹层与返回栈闭环规范（可直接用 `layer-check` 审计）

每一个盖在主画面或标题页之上的面板（菜单、选关、设置、帮助、拍照、排行榜），都必须纳入统一的 **Layer Stack（弹层栈）** 管理：
- **四路退回一致性**：点击面板内「返回」、点击外部暗色遮罩（scrim）、按键盘 `Esc`、触发手机系统返回（`history.back()` / `popstate`），四条路径必须走同一套出栈关闭逻辑。
- **零误触原则**：关闭最顶层弹层后，必须干净回到其下一层（例如标题页依然停留在标题页，**绝不能误触底部按钮直接开局**），且 `history.length` 保持整洁不堆积垃圾记录。

---

## 四、零侵入双语体系（`src/00a_i18n.js`）

- 以一种主语言（如中文）直接作为各模块内的字面量键，英文（或其他语言）作为独立字典表覆盖映射，由 `navigator.languages[0]` 自动检测，并支持设置页切换（存入 `localStorage`）与 URL 参数 `?lang=zh|en` 强测。
- 好处：新加开发期文案与 `Variants` 选项不会因为漏写 key 而显示 `undefined` 或裸 key 名；交付前只需检查字典是否全部覆盖即可。

---

## 五、Variants A/B 实时对比系统（`src/00b_variants.js`）

这是让人类与 Agent 高效共创高品质手感与画面的核心基础设施：

1. **什么时候必须建 Variant**：
   - 调整主观美术（曝光、雾色、粒子密度、后期色调）；
   - 调整主观手感与镜头（机位高度、FOV、转向灵敏度、物理阻尼）；
   - 引入复杂性能优化（分帧更新、LOD 降密、渲染合并）——保留 `a = 旧做法` 与 `b = 新做法`，可直接配合 `shotdiff.js` 与 `perf-check.js` 做客观前后对比。
2. **注册与读取约定**：
   ```js
   // 模块加载时注册一次，默认值为团队当前推荐方案
   Variants.def('cam', '追身镜头', [['a', '原机位'], ['b', '低机位']], 'b');
   // 热路径读取只是一个极廉价的属性访问
   if (Variants.val.cam === 'b') { /* ... */ }
   ```
3. **三层优先级**：URL 参数 `?v-<name>=<id>`（供自动化对比脚本使用） > `localStorage`（玩家本地调试记忆） > `def`（默认推荐值）。
4. **严格隔离普通玩家**：版本对比页与调试快捷键（切换时间/天气/关卡/拍测试照）仅在 `?dev` 或 `/dev` 开发者模式下可见，普通玩家界面永远保持纯净。
