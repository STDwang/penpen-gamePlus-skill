# 01 · 架构与单 HTML 工程规范

本规范定义零运行时依赖、单 HTML 交付游戏的目录组织、构建管线、双渲染后端抽象以及首帧启动性能架构。

---

## 1. 编号模块化目录结构（无打包器、零循环依赖）

所有源码放在 `src/`，通过前缀数字明确拼接与加载顺序，由 `build.js` 按字典序串联进一个 IIFE（`"use strict";`）：

```text
project/
├── build.js                    # 拼接 src/*.js + template.html -> dist/index.html & dist/dev.html
├── template.html               # HTML 骨架、CSS 变量与极简 HUD/菜单结构、/*__JS__*/ 占位符
├── DESIGN_INVARIANTS.md        # 视觉、物理、性能不可违背的决策账本
├── src/
│   ├── 00_util.js              # 数学库、确定性 PRNG、LiveRing 环形粒子池、通用工具
│   ├── 00a_i18n.js             # 双语字典（中文作 key，英文查表映射）
│   ├── 00b_variants.js         # A/B 实时对比开关（支持 localStorage 与 ?v-name=id）
│   ├── 00c_quality.js          # 三档画质（高/均衡/流畅）+ GPU 识别 + 动态调速参数
│   ├── 00d_par.js              # 可选：同脚本 Blob Web Worker 并行预计算池
│   ├── 00e_cache.js            # 可选：基于 __BUILD_HASH__ 的 IndexedDB 烘焙缓存
│   ├── 01_gfx.js               # 统一图形抽象层（WebGPU 优先 + WebGL2 自动回退）
│   ├── 02_shaderlib.js         # 所有 shader 共享的常量、相机/光照/雾效/阴影函数
│   ├── 03_world.js             # 纯数学世界/关卡生成（确定性种子，物理与渲染共用）
│   ├── 04_terrain.js           # 地形/场景主网格与流式更新
│   ├── 05_sky.js               # 天空、日月、昼夜时钟、曝光、大气层
│   ├── 06_meshgen.js           # 程序化几何体/SDF 表面网/参数建模工具
│   ├── 07_game.js              # 核心物理、状态机、操控与镜头系统
│   ├── 08_actors.js            # 主角、载具、NPC/生态实体的动画与绘制
│   ├── 09_post.js              # Bloom、色调映射、动态模糊、镜头微效应
│   ├── 10_fx.js                # 物理受光粒子、轨迹、天气粒子、体积光
│   ├── 18_sound.js             # Web Audio API 物理驱动连续音频与音效合成
│   ├── 19_ui.js                # 启动幕、标题页、HUD、暂停菜单、拍照模式、?dev 面板
│   ├── 20_director.js          # 可选：?director=1 离线固定镜头出帧录屏模块
│   └── 99_main.js              # 分阶段启动、主循环、帧率调速器、window.__game 测试句柄
└── tools/
    ├── serve.js                # 零依赖本地静态服（0.0.0.0:3000）
    └── checks/                 # 所有 Playwright 自动化验收脚本与 baseline.json
```

### 关键工程纪律
- **全局命名收敛**：每个模块使用 `const Foo = (() => { ... return api; })();` IIFE 暴露单一命名空间，不污染 `window`（除显式约定的 `window.__game` 调试句柄）。
- **构建产物双份输出**：
  - `dist/index.html`：保留完整 `<!doctype html>` 标准模式骨架，使用本地 `esbuild` 仅做 `--minify-whitespace --minify-syntax`（**不混淆标识符名**，便于线上报错堆栈定位与 Worker 复用）。
  - `dist/dev.html`：保留全部注释与可读格式，供 `/dev` 路由与所有无头工具脚本使用。
- **构建哈希**：在 `build.js` 中计算拼接后 JS 的 SHA-1 前 16 位并替换 `'__BUILD_HASH__'`，供本地烘焙缓存失效校验使用。

---

## 2. 图形抽象层规范（WebGPU First + WebGL2 Fallback）

### 3D 游戏推荐架构（单份着色器，双后端运行）
1. **编写统一着色器子集（SSL / Typed WGSL Subset）**：
   - 所有变量必须显式标注类型（`let x: f32 = ...`），Uniform 结构体只用 `vec4f` / `mat4x4f` 避免跨后端内存对齐坑。
   - 统一坐标系约定：裁剪空间 `z ∈ [0, 1]`、NDC `y` 向上、纹理第 0 行在顶部。
   - 通过几十行正则转译函数 `sslToWgsl` / `sslToGlsl` 分别输出 WGSL 与 GLSL ES 3.00（配合 `#define saturate/tex/texLod/texShadow/select` 前导宏）。
2. **自动回退与强测参数**：
   - 默认尝试 WebGPU；失败或设备不支持时无缝回退 WebGL2；两者都不支持时给出清晰单行中文提示，绝不白屏报错。
   - 必须支持 URL 参数 `?backend=webgl2` 强制走回退路径，验收阶段两条路径都必须零报错。
3. **2D / 2.5D 游戏的简化策略**：
   - 若游戏为 2D/伪 3D，可用 WebGL2（单层统一着色器）或“多离屏 Canvas + 像素/法线合成”实现同等级光影氛围，但依然必须遵守统一画质档位与 `capture()` 截图接口。

---

## 3. 确定性、分阶段启动与流畅度基础架构

### 确定性随机（Seeded PRNG）
- 严禁在世界生成、地形细节、关卡道具摆放中使用裸 `Math.random()`。
- 必须使用可设种子的确定性伪随机流（如 Mulberry32 / Xoshiro128**），并且**不同子系统使用独立随机流**（例如“主路径地形”和“装饰性障碍”分流），确保开关装饰变体时主赛道一比特不变。

### 分阶段启动与并行预计算（不卡死主线程）
1. **分步让出主线程**：启动流程切分为清晰阶段（如：初始化图形 → 烘焙基础噪声/表面纹理 → 生成远景与主场景 → 雕刻主角/道具网格 → 首帧揭幕），每步之间 `requestAnimationFrame` 让进度条和画面能实时刷新；在测试模式 `?manual` 下跳过等待以加速无头测试。
2. **非首屏内容延迟构建**：标题画面看不到的东西（如远距生态实体、音频缓冲区、部分非首屏特效 Shader）在标题页出现后再后台逐帧补齐（且可通过 `Variants` 开关对比验证）。
3. **同脚本 Blob Web Worker（大计算量场景推荐）**：
   - 当程序化烘焙（如 SDF 网格提取、大尺寸程序纹理、远山高度图）耗时超过 `500ms` 时，可用 `document.currentScript.textContent` 构造 Blob Worker 运行同一份代码并行算数据，通过 `Transferable ArrayBuffer` 零拷贝传回主线程；在不支持 Worker 的容器环境自动降级为主线程串行。
4. **环形实例池（`LiveRing`）**：
   - 粒子与临时特效严禁每帧 `new` 对象或每帧绘制全部死槽位。采用定长 TypedArray 环形池，只提交当前存活区间的 `baseInstance + instanceCount`。

---

## 4. 跨端与环境约束（可选条件编译块）

- 若后续需要导出为离线小程序/原生壳子，在 `src/` 中使用成对注释标记隔离环境特有 API：
  - `/*web{*/ ... /*}web*/`：仅普通浏览器允许的代码（如 Fullscreen API、DeviceOrientation、Blob Worker）。
  - `/*native{*/ ... /*}native*/`：仅原生桥接使用的代码，Web 构建时自动剔除并校验开闭标记成对平衡。
- **不依赖内联事件处理器**：模板中严禁写 `onclick="..."` 或 `eval()`，全部用 `addEventListener` 绑定，天然兼容严格 CSP 与小游戏容器。
