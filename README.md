# penpen-gamePlus-skill

一套提炼自《雪迹 Cold Smoke》实战工程的 **Agent 游戏开发技能包**。核心目标是让任何支持 Skill / 规则文件的 Coding Agent，在**极简提示词**下，稳定开发出具备以下特质的高品质 Web 游戏：

- **零外部素材**：画面、模型、纹理、大气、粒子、音效与音乐 100% 由代码生成
- **零运行时依赖 & 单 HTML 交付**：纯原生 JS + WebGPU/WebGL2 + Web Audio API，单文件离线可玩
- **工业级工程自检**：内置无头测试接口、UI 安全区/遮挡审计、弹层返回栈审计、同帧逐像素回归、JS 帧耗时预算、A/B `Variants` 对比系统

---

## 目录结构

```text
penpen-gamePlus-skill/
├── SKILL.md                                # Agent 主技能指令（总纲、硬约束、6 阶段工作流）
├── references/                             # 按阶段按需读取的专项工程规范
│   ├── 01-architecture-and-single-html.md  # 单 HTML 拼接、WebGPU/WebGL2、分阶段启动与多线程
│   ├── 02-procedural-art-and-audio.md      # 程序化美术与光影锚点 + Web Audio 物理合成配方
│   ├── 03-gameplay-physics-and-motion.md   # 物理与动作五条铁律、双尺评估、镜头净空与可达性
│   ├── 04-ui-responsive-and-variants.md    # 响应式安全区、44px 触控、返回栈、Variants A/B 系统
│   └── 05-acceptance-gates-and-perf.md     # window.__game 测试契约、分层门禁、性能账本与像素回归
└── templates/                              # 可直接复制到新游戏的工程与验收脚手架
    ├── build.template.js                   # 零依赖单 HTML 构建脚本（含模块名校验与语法预检）
    ├── serve.template.js                   # 零依赖本地开发服务器（0.0.0.0:3000）
    ├── template.template.html              # 最小单 HTML 骨架（#app.rot / #veil / 安全区变量）
    ├── package.template.json               # 零运行时依赖 package.json 模板
    ├── i18n.template.js                    # 中英双语字典模块
    ├── variants.template.js                # 实时 A/B 对比开关模块
    ├── quality.template.js                 # 三档画质 + GPU 分类 + 动态帧率调速器
    ├── DESIGN_INVARIANTS.template.md       # 视觉/手感/性能决策账本模板
    └── scripts/
        ├── baseline.template.json          # 性能与像素回归门禁阈值账本
        ├── layout-check.template.js        # Playwright 全端 UI 布局/安全区/遮挡/44px 审计
        ├── layer-check.template.js         # Playwright 弹层返回栈闭环审计
        ├── smoke-check.template.js         # Playwright 状态机与试玩闭环冒烟审计
        ├── shotdiff.template.js            # Playwright 同种子同帧逐像素回归对比
        └── perf-check.template.js          # Playwright JS 帧耗时与渲染预算检测
```

---

## 如何使用（极简提示词示例）

将该文件夹复制到你的项目或 Agent 的 skills 目录（如 `.claude/skills/penpen-gamePlus-skill`、`.agents/skills/penpen-gamePlus-skill` 等），然后只需用极简提示词即可启动：

- **示例 1（3D 无尽探索/运动类）**：
  > 使用 `penpen-gamePlus` skill，做一个黄昏云海中的无尽翼装飞行游戏，能贴着山脊滑翔、穿过云层与岩门、带风声和昼夜变化。
- **示例 2（3D 载具/竞速类）**：
  > 使用 `penpen-gamePlus` skill，做一个霓虹雨夜盘山公路的复古跑车漂移游戏，要湿滑路面反光、引擎与胎噪物理合成、多机位与拍照模式。
- **示例 3（2D/2.5D 氛围动作类）**：
  > 使用 `penpen-gamePlus` skill，做一个水墨风纸船顺流漂流游戏，有激流漩涡、竹林光影、雨滴涟漪与古琴泛音合成。

Agent 会自动根据 `SKILL.md` 中的**极简提示词展开协议**先产出 `DESIGN_INVARIANTS.md`，搭建零依赖单 HTML 架构与 `window.__game` 无头测试句柄，分 6 个阶段实现并执行自动化验收门禁。
