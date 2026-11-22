# 05 · 无头测试契约、分层验收门禁与性能预算规范

本规范定义如何让 Agent 在**没有独立显卡的云端/无头浏览器环境（Playwright + SwiftShader）**下，自动完成逻辑压测、UI 审计、性能画像、逐像素回归与可视化验收。

---

## 一、`window.__game` 无头测试句柄契约（立项必建）

在 `src/99_main.js` 中，将游戏核心能力通过统一的 `window.__game` 暴露给无头验收脚本（生产游玩不受影响；当 URL 带 `?manual` 时不自动启动 `requestAnimationFrame`，完全由测试脚本按固定步长精准驱动）：

```js
window.__game = {
  // 1. 生命周期与步进
  boot: async () => 'ok',                         // 初始化图形与世界（?manual 下由脚本调用）
  frame: (dt = 1 / 60) => { /* 推演并渲染一帧 */ },
  sim: (seconds, steerFn, { draw = false } = {}) => {
    // 以固定步长 dt=1/60 连续模拟 seconds 秒；draw=false 时跳过渲染，几秒可跑完数分钟玩法
  },
  noDraw: (on = true) => { /* 屏蔽底层 GL/Canvas2D 绘制调用，供 perf-check 纯 JS 压测使用 */ },

  // 2. 状态控制与可复现
  reset: (seedOrPos) => { /* 归位到指定种子/进度 */ },
  tod: (nameOrHour) => { /* 跳转昼夜/光影状态，如 day/sunset/night */ },
  view: (pos, target, fov) => { /* 临时设置固定检查机位（可选） */ },
  set: (path, value) => { /* 按路径改模块参数，如 set('Sky.rate', 0) */ },

  // 3. 自动试玩与观测
  pilot: (opts) => (t) => ({ steer: 0, action: 0 }), // 返回确定性自动操控函数
  ui: () => ({ state: 'title', open: false, layerTop: () => null, go() {}, menu(on) {} }),
  shot: async () => canvas.toDataURL('image/png'),   // 返回当前画布 PNG dataURL
  capture: async () => ({ w, h, data: Uint8Array }), // 返回原始 RGBA 像素（供 shotdiff 使用）
  stats: () => ({ drawCalls: 0, tris: 0, entities: 0, speed: 0, mode: '' }),
  m: { /* 暴露内部模块引用，如 Game, World, Render, Quality, Variants, Input */ },
};
```

### 为什么必须支持 `draw: false` 与屏蔽绘制？
- 在无 GPU 的云端机器上，SwiftShader 软件渲染一帧可能需要几十到上百毫秒，但纯 JS 物理与逻辑一帧不到 `1 ms`。
- 通过 `sim(sec, pilot, { draw: false })` 或把 `gl.drawElements/drawArrays` 临时置空，Agent 可以在 **5 秒内跑完 4 分钟的真实游玩物理**，用来做镜头穿地审计、全赛道可达性搜索、动作录制与纯 JS 帧耗时压测。

---

## 二、动态画质档位与帧率调速器（`src/00c_quality.js`）

高质量 Web 游戏不能只在旗舰电脑上流畅、在中端手机上卡成 PPT：
1. **三档画质**：`高`（设计原版，电脑与旗舰机默认）、`均衡`（中端机默认）、`流畅`（入门机/降档兜底）。
2. **联动多维开销（绝不只改分辨率）**：
   - 手机瓶颈往往不在像素填充，而在顶点/阴影/粒子/后处理 Pass。
   - 三档画质应同步控制：`maxDpr` / `maxPx`（像素上限）、`shadow`（阴影图分辨率）、`blur/bloom`（后处理级别与动态模糊开关）、`particles`（非核心氛围粒子密度，适度提亮单个粒子以保视觉丰度）、`far`（远距装饰裁剪距离）。
3. **自动调速器（Governor）规则**：
   - **区分 JS 卡顿与 GPU 卡顿**：如果一帧变慢是因为偶发 GC/脚本抖动，不要误判为显卡不行而降画质。
   - **渐进降级**：持续掉帧时先缩动态分辨率比例（如降至 `0.75`）与轻载粒子档位；仍稳不住再降一档画质，并把结果持久化到 `localStorage`，下次启动直接以流畅档开局，不再先卡 5 秒。
   - **稳健回升**：持续宽裕满帧足够长时间（如 60 秒）后才允许回升一档，防止反复横跳闪烁。
   - 支持 `?quality=0|1|2` 强定档位、支持 `?gov=0` 在性能基准测试期间关闭自动调速器干扰。

---

## 三、性能测量与像素回归规范

1. **纯 JS 帧预算（`perf-check.template.js`）**
   - 屏蔽绘制调用，连续跑 1200–1800 帧，输出每帧 JS 耗时的：**中位数（p50）、p95、p99、最大值、超 `16.7ms` 帧数**。
   - 使用 CDP `Emulation.setCPUThrottlingRate` 叠加 `2x`（近似中端机）和 `4x`（近似低端机）CPU 降速，暴露主线程分配抖动与 GC 尖峰。
   - **目标基线**：1x 下 p95 `< 4ms`；2x CPU 降速下 p95 `< 10ms`、零连续超帧卡顿。
2. **渲染账本（Frame Ledger）**
   - 统计单帧的 `drawCalls`、三角形总数、RenderTarget 切换次数与估算显存占用。
   - 每次新增场景特效或场景物体，都要看账本增量，严禁无节制膨胀 draw call（优先合并与 Instancing）。
3. **同机位同帧逐像素对比（`shotdiff.template.js`）**
   - 做“纯性能优化”或“重构渲染管线”时，必须用相同种子、相同模拟秒数、相同机位分别截取旧 Variant（`?v-opt=a`）与新 Variant（`?v-opt=b`）的画面。
   - **对照组先行**：先跑一次“原版 vs 原版重新加载”，测出随机粒子等固有底噪；再比“新版本 vs 原版”。若优化声称“画质不变”，差异像素占比（单通道差 > 8/255）应与对照组底噪持平。
   - 若使用了分帧摊平（如流式地形分多帧更新），在 `sim` 瞬移后必须先加 `DRAIN` 空跑若干帧让队列排空，再截取对比帧。
4. **渲染 Pass 顺序核验**
   - 透明物体、体积光、粒子、UI/标牌的绘制顺序极易在多人/多轮迭代中被改乱，用简短脚本打印透明与后处理 Pass 队列名称并断言顺序不变。

---

## 四、Bug → 永久探针闭环（Feedback-to-Gate）

这是让游戏品质**持续单调递增、绝不前修后坏**的最关键流程：

1. 当人类试玩反馈任何体验问题（例：“手机竖拿时开始按钮点不到”、“切到低机位急转镜头穿进地里了”、“某个跳台怎么都够不到下一目标”）：
2. **第一步：先在无头脚本里复现它**（确认新断言在修复前明确报错 `✗` / `exit 1`）。
3. **第二步：修复游戏代码**（且严禁靠叠加新弹簧或破坏 `DESIGN_INVARIANTS.md` 的方式偷懒）。
4. **第三步：把该断言永久留在 `tools/checks/` 中**，并在注释顶部记下根因与触发场景。
5. **第四步：跑完 Tier 1 + 相关 Tier 2 门禁全部绿灯后再汇报结果**。
