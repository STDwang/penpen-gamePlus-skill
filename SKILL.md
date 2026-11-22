---
name: "penpen-gamePlus"
description: >-
  Studio-grade, zero-asset, zero-runtime-dependency, single-HTML game engineering
  and craft skill distilled from Cold Smoke (雪迹). Use whenever building, iterating,
  or auditing a web game (3D or 2D) from a minimal user prompt so that procedural
  visuals, physics-driven audio, tactile feel, responsive UI, A/B Variants, and
  automated headless acceptance gates reach production quality.
---

# penpen-gamePlus — 零素材单 HTML 高品质游戏工程技能

本 Skill 将《雪迹 Cold Smoke》的全部工程架构、程序化美术与音频配方、物理手感守则及自动化验收体系提炼为一套可直接执行的标准。目标：**即使用户只给出一两句极简提示词，Agent 也能稳定交付具备独立游戏美术水准、物理驱动手感、跨端稳帧、可离线单文件运行且通过自动化门禁验收的完整作品。**

---

## 一、不可妥协的 6 条硬性约束（Hard Constraints）

除非用户在当前对话中**明确书面豁免**其中某条，否则必须全部严格遵守：

1. **零外部素材（Zero Asset Files）**
   - 严禁引入任何外部图片、贴图、3D 模型、音频、视频文件（`.png/.jpg/.webp/.glb/.gltf/.obj/.mp3/.wav` 等）或外链素材 URL。
   - 几何体、材质贴图、天空大气、粒子、UI 图标、音效与环境音乐 **100% 由代码在运行时程序化生成**（唯一允许的例外是极简内嵌子集字体或纯系统字体栈）。
2. **零运行时依赖、无打包器（Zero Runtime Dependencies）**
   - 严禁在游戏运行时引入 React、Vue、Three.js、Phaser、Pixi、Tailwind 等第三方库或 Webpack/Vite 打包管线。
   - 全部使用原生现代 JavaScript + 原生 WebGPU/WebGL2（或 Canvas2D）+ Web Audio API。
3. **单 HTML 交付（Single Self-Contained HTML）**
   - 源码按职责与依赖顺序以编号模块化存放在 `src/`（如 `00_util.js` → `99_main.js`），通过 `build.js` 拼接进 `template.html`，构建产出单个可离线运行的 `dist/index.html`（压缩版）与 `dist/dev.html`（完整调试版）。
   - `package.json` 零 `dependencies`（仅允许 `devDependencies` 中放 `esbuild` 做离线去空白压缩、放 `playwright` 跑无头验收）。
4. **先造“眼和手”，再做内容（Testability-First）**
   - 项目骨架搭建完成时，必须同步实现无头调试句柄 `window.__game`（确定性种子、固定步长 `step(dt)`、屏蔽绘制开关、自动试玩 `pilot()`、状态/时间/场景跳转 `reset/tod/view`、截图 `shot()`）。
5. **所有主观视觉/手感改动必须走 `Variants` + 决策账本**
   - 项目根目录必须维护 `DESIGN_INVARIANTS.md`（视觉、曝光、构图、手感红线）。修改视觉或手感前必读。
   - 任何主观体验调整（色调、镜头机位、物理阻尼、难度曲线等）默认注册为 `Variants`（`?v-<name>=a|b` 且在 `?dev` 面板可热切），保留对照组便于同帧对比与人类拍板。
6. **验收门禁不可绕过、不可同提交作弊**
   - 每次改动后必须执行对应层级的自动化验收脚本（见第六节）。
   - **反作弊铁律**：严禁在同一次改动中既改游戏实现又放宽测试阈值；修改验收基线或指标范围必须单独说明依据并显式确认。

---

## 二、极简提示词自动展开协议（Brief-to-Blueprint）

当用户只给出一两句简短需求（例如“帮我做一个落日大海上的无尽帆船冲浪游戏”或“做一个霓虹雨夜的赛博单车速降”）时，**不要反问一堆琐碎问题，也不要直接开始堆代码**。先在工作区生成 `DESIGN_INVARIANTS.md`（套用 `templates/DESIGN_INVARIANTS.template.md`），自主补全以下 5 块蓝图，再按阶段落地：

1. **核心情绪与画面锚点（Look & Feel Invariants）**：
   - 定下“第一眼决定品质”的 5 个数值锚点：**主光仰角与逆光关系**（低仰角逆光/侧逆光天然出层次）、**前景亮度压制范围**（避免高光死白过曝，如前景中调压在 L*65–70）、**空气透视与雾化分层**（近/中/远三层色相与对比度衰减）、**动态时间或天气节律**、**核心视觉招牌特效**（如浪花/雪雾/尾焰/雨丝的背光散射）。
2. **程序化资产与音频配方**：
   - 列出所有几何体（参数曲面/SDF/实例化植被与道具）、程序噪声贴图、以及至少 3 条物理驱动的连续合成音轨（环境风/摩擦介质声/动力或动作峰值声）+ 触发式瞬态音效。
3. **单一所有权表（Single-Ownership Table）**：
   - 明确写死：谁拥有主角位置/姿态？谁拥有相机？谁拥有碰撞与地面高度？禁止多模块互写。
4. **编号模块切片计划**：
   - 规划 `src/00_util.js` ~ `src/99_main.js` 的文件清单与职责边界。
5. **专属验收尺度**：
   - 在通用门禁（UI 布局、弹层栈、JS 帧耗时、同帧像素对比）之外，定义 1–2 条该品类的专属自动化尺子（如 3D 镜头净空、赛道/平台可达性搜索、动作双尺）。

---

## 三、标准 6 阶段开发工作流（Execution Lifecycle）

按顺序推进，**每一阶段结束必须构建并通过本阶段检查再进入下一阶段**：

### Phase 0：骨架与工具链就绪
- 复制并适配 `templates/build.template.js`、`templates/serve.template.js`、`templates/template.template.html`、`templates/package.template.json`、`templates/i18n.template.js`、`templates/variants.template.js`、`templates/quality.template.js`、`templates/DESIGN_INVARIANTS.template.md` 及 `templates/scripts/baseline.template.json`。
- 建立 `src/00_util.js`（确定性 PRNG、数学向量/矩阵、环形粒子池 `LiveRing`）、`src/00a_i18n.js`、`src/00b_variants.js`、`src/00c_quality.js`。
- 搭建最小 `template.html`（含 `#app`、`#view`、`#veil` 揭幕层、`#shade` 上下压暗可读层、完整安全区 CSS 变量 `--sl/--sr/--st/--sb`）。
- **过关标志**：`node build.js` 成功生成 `dist/index.html` 与 `dist/dev.html`，服务可在 `0.0.0.0:3000` 访问。

### Phase 1：渲染基座 + 无头可测核心闭环
- 阅读 `references/01-architecture-and-single-html.md`。
- 搭建统一图形层 `src/01_gfx.js`（3D 游戏优先 WebGPU + WebGL2 双后端与统一着色器子集；2D 高密特效游戏优先 WebGL2 或分层 Canvas2D）与共享着色器常量库 `src/02_shaderlib.js`。
- 实现核心世界/关卡生成（纯数据、确定性种子，供物理与渲染共用）与主循环 `src/99_main.js`，同步暴露 `window.__game` 测试句柄。
- **过关标志**：无头浏览器加载 `dist/dev.html?dev&manual` 能成功 `boot()`、稳定 `sim(10)` 且零 `pageerror`。

### Phase 2：核心玩法、物理手感与镜头系统
- 阅读 `references/03-gameplay-physics-and-motion.md`。
- 严格遵守**物理与动作五条铁律**实现操控、物理、角色/载具程序化建模与动画、以及带硬边界保护的镜头系统。
- 同步编写该游戏的核心 `pilot()` 自动驾驶函数（能稳定游玩 60–180 秒不卡死）。
- **过关标志**：跑通品类专属物理/镜头净空/可达性检查；响应延迟与手感参数记录入 `DESIGN_INVARIANTS.md`。

### Phase 3：程序化美术升维（光影、大气、粒子、后处理）
- 阅读 `references/02-procedural-art-and-audio.md`。
- 补齐天空/昼夜/天气循环、远景层次、地形/表面细节法线、动态轨迹或环境交互（如雪痕/水波/胎印）、受光粒子系统、Bloom/色调映射/镜头微效应（注意半浮点溢出限幅）。
- 补齐三档画质（`高/均衡/流畅`）与动态帧率调速器（不仅降分辨率，也要联动阴影图尺寸、粒子密度、远距剔除、后处理采样数）。
- **过关标志**：`?backend=webgl2` 与默认后端视觉一致；通过 `perf-check` JS 帧预算与 `shotdiff` 基准建立。

### Phase 4：物理驱动的程序化音频
- 阅读 `references/02-procedural-art-and-audio.md` 音频章节。
- 用 Web Audio API 预生成短循环噪声/波表底材（高斯白噪、Kellet 粉噪、颗粒脉冲等），每帧由速度、转向角、载荷、腾空/接地状态连续调制滤波器截止频率、Q 值、声像与增益；配合懒加载避免拖慢首屏启动。
- **过关标志**：静音开关、浏览器首次交互解锁 `AudioContext`、切后台自动静音/恢复正常无爆音。

### Phase 5：克制的 UI、全端响应式与全量验收门禁
- 阅读 `references/04-ui-responsive-and-variants.md` 与 `references/05-acceptance-gates-and-perf.md`。
- 完成加载进度、标题页、极简 HUD、暂停即定格画面（`mode = 'hold'`，画面继续渲染使设置变更实时可见）、触控/键鼠双端操作、拍照模式与开发者 `?dev` 面板。
- 运行全套 Tier 1 + Tier 2 自动化验收脚本，所有异常清零。

---

## 四、按需查阅的参考手册（References）

在对应阶段**必须先读取**对应参考文件，不要凭印象发挥：

- `references/01-architecture-and-single-html.md`：编号拼接架构、WebGPU/WebGL2 双后端与 SSL 转译、启动分阶段/Web Worker 并行与首帧缓存策略。
- `references/02-procedural-art-and-audio.md`：零素材视觉品质法则（低仰角光、前景压暗、SDF 网格、半浮点防溢出）、Web Audio 物理驱动合成配方。
- `references/03-gameplay-physics-and-motion.md`：物理与动画五条铁律、双尺防作弊评估体系、镜头近裁剪面净空、关卡可达性与视线检查。
- `references/04-ui-responsive-and-variants.md`：移动端横竖屏旋转与刘海安全区体系、44px 触控底线、模态返回栈、双语字典、`Variants` 对比系统。
- `references/05-acceptance-gates-and-perf.md`：`window.__game` 标准测试契约、Tier 1/Tier 2 门禁清单、JS 帧耗时/资源账本/逐像素回归、Bug→永久探针闭环。

---

## 五、防 Agent 退化的 5 条工程铁律（必守）

1. **单源真相（Single Source of Truth）**：每个关键自由度（角色接地高度、骨骼末端、相机坐标、关卡地表高度）只能有一个权威计算者。渲染和物理读同一份纯数学函数，禁止各写一套近似公式。
2. **统一时钟，不叠弹簧（One Clock, No Stacked Springs）**：不要为了掩盖抖动在旧平滑器外面再套一层 `lerp` / 弹簧——这会破坏响应延迟和动作节奏。想加新平滑器，必须先删除旧的。
3. **约束永远最后重跑一遍（Constraints Last）**：任何后置偏移（呼吸、受击、相机震动、特效动作）执行完后，必须重新执行硬约束（不穿地、不穿墙、镜头近裁剪面不入地、角色不出画）。
4. **双尺防刷分（Dual-Ruler Verification）**：所有质量评估必须成对设计——下限尺拦住“坏/穿模/超预算”（硬失败 `exit 1`），上限尺拦住“僵/延迟大/画面缩水”（防止 Agent 为过测试把表现阉割掉）。
5. **Bug 必须沉淀为永久探针（Feedback-to-Gate）**：每当用户指出一个体验、布局、遮挡、镜头或手感问题，修复代码后**必须在 `tools/checks/` 中补一条对应的无头断言或场景**，并在脚本头部注释记下问题根因，确保永不回归。

---

## 六、分层验收门禁速查表

| 层级 | 触发时机 | 必跑脚本（参考 `templates/scripts/`） | 过关硬标准 |
|---|---|---|---|
| **Tier 1 快检**（每次改完必跑） | 任何代码修改 | `node build.js` + `layout-check`（关键分辨率）+ `layer-check` + `smoke-check` | `build.js` 语法预检通过、零 `pageerror`、状态机开局/试玩/暂停/重开闭环、零按钮遮挡/出安全区/<44px、零 `position:sticky`、弹层 4 种退出方式闭环 |
| **Tier 2 渲染与性能** | 改着色器/特效/地形/渲染循环 | `perf-check`（含 2x CPU 降速 + `baseline.json`）+ `shotdiff`（对比旧 Variant 或基线）+ 双后端冒烟 | JS 帧中位数与 p95 在 `baseline.json` 预算内、超 `16.7ms` 帧数可控、WebGPU & WebGL2 均无报错、非视觉优化项像素差近零 |
| **Tier 2 玩法与镜头** | 改物理/关卡/相机/角色动作 | 品类专属 `camclear`（3D 镜头净空 / 2D 视口边界）+ `reach/sight`（可达性与视线）+ 动作双尺回归 | 镜头穿地/出界帧 = 0%、主路径可达率 = 100%、动作突变与穿模不劣于 `baseline.json` 且幅度在合理带内 |

> **2D / 2.5D 游戏降维映射**：若项目采用 Canvas2D 或正交 WebGL2，无需硬套 3D 术语——`01_gfx.js` 封装分层离屏 Canvas / WebGL2；`noDraw(true)` 屏蔽 `ctx` 绘制；`camclear` 改为验证主角与关键目标在任何长宽比下均不超出视口安全区且不被 HUD 遮挡。

---

## 七、交付检查清单（给用户前的最终自检）

- [ ] `dist/index.html` 可完全离线单文件打开，无任何外部图片/音频/模型请求。
- [ ] 默认打开即进入沉浸氛围画面（无丑陋白框、无满屏按钮堆砌），`#veil` 平滑揭幕。
- [ ] 电脑键鼠与手机触控（含竖屏自动横转或自适应安全区）均已通过 `layout-check`。
- [ ] `DESIGN_INVARIANTS.md` 已更新为当前版本的真实视觉、物理、性能基线。
- [ ] 面向用户的回复中明确给出：操作方式、当前已过门禁结果、以及 `?dev` 模式下可对比的 `Variants` 开关。
