# Prelude

**DSH 提示词优化与改写助手**

发现需求中的遗漏，选择需要补充的要求，再决定怎样修改。

- **补一句** — 从方法卡中选择补充内容，插入当前草稿。
- **改整段** — 生成候选稿，对照原稿查看和编辑，确认后采用。

90 张方法卡可按阶段、领域和关键词查找。是否采用、何时发送，都由你决定。

<!-- prelude-current:start -->
当前 **0.4.24 预览版** · [下载安装包](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.24/dsh-prompt-coach-0.4.24.tgz) · [安装说明](docs/installation.md) · [English](README.en.md)
<!-- prelude-current:end -->

## 先看看方法卡

安装前即可阅读[全部 90 张方法卡](docs/catalog.md)，每张包含适用条件、场景示例、补句和参考来源。

### 验收标准

把做完的标准变成可核对的结果。

适合完成标准不明确、或准备交付的任务。简单事实问答通常无需增加验收流程。

> 请明确可核对的完成标准；收尾时逐项说明证据和仍未验证的部分。

[查看场景和来源](docs/catalog.md#method-acceptance)

### 高内聚低耦合

让相关逻辑放一起，让模块少互相牵连。

适合模块边界混乱、一次修改牵动多处的情况。小脚本应按实际需要组织，避免为了分层而拆分。

> 按职责组织模块，明确接口和依赖方向，减少修改的连锁影响；必要结构以当前需求为依据。

[查看场景和来源](docs/catalog.md#method-cohesion)

### 二阶思维 / Second-order Thinking

别只看眼前收益，也检查后续的连锁影响和反馈。

适合方案决策、功能设计和长期权衡。目标和做法明确的简单任务通常无需展开；推演应有依据并适时收束。

> 检查方案的直接结果，以及随后可能引发的连锁影响、反馈和延迟；区分有证据的后果与待验证的推测，优先说明会改变决策的风险和观察信号，避免无限推演。

[查看场景和来源](docs/catalog.md#method-second-order)

## 先看一次改写

**原稿**

> 用 Python 标准库把 CSV 转成 JSON，保留原文件。

**选用「验收标准」后，一种可能的写法**

> 用 Python 标准库把 CSV 转成 JSON，保留原文件。请附一小段 CSV、对应的预期 JSON 和运行命令，让我能检查转换结果。

这次只补了怎样验收。「只用标准库」和「保留原文件」仍是原来的要求。你可以只插入新增的那句话，也可以比较整稿后再采用。

## 安装到 DSH

支持 Linux / WSL2、macOS，DSH 0.2.1-rc.2 至 rc.5，Node 24 及以上。已有插件时先备份当前配置，然后在运行 DSH 的终端执行：

```sh
dsh plugin --profile web add dsh-prompt-coach@0.4.24 --ignore-scripts
```

保存草稿、等任务结束后，按原启动方式正常重启 DSH，再刷新页面，在聊天输入框旁打开 **Prelude**。安装包沿用兼容名称 `dsh-prompt-coach`。[本地文件安装与其他平台](docs/installation.md)

## 第一次打开 Prelude

在 DSH 输入框写下需求，打开旁边的 **Prelude**，按你此刻想做的事选一条。

| 我想做什么 | 在面板里怎么做 |
| --- | --- |
| 给草稿补一句具体要求 | 打开 **方法库**，按关键词、阶段或领域找卡片，点 **插入光标处**。90 张卡都可在本地浏览。 |
| 看看自己的需求哪里没讲清楚 | 点 **分析提示词**，查看建议及理由。原稿已经说清的部分可以保留。 |
| 把几条要求整理成完整提示词 | 按需点 **用于本次改写** → **改写整稿**。对照原稿改好候选，再点 **采用到输入框**，由你发送。 |

经常写同一句要求？可以把它存到 **我的补句**，下次直接插入。[查看使用指南](docs/quickstart.md)

![Prelude 方法库实拍：每张卡片说明适用场景，并提供用于本次改写、插入光标处和复制操作](docs/assets/method-library.jpg)

## 模型与数据

浏览和收藏方法卡免费，无需模型。智能分析、改写和可选审校使用你在 DSH 配置的模型，可能产生供应商费用。默认只处理当前草稿，上文和文本附件由你主动选取。[模型与隐私](docs/privacy.md)

## 支持环境

**Windows 桌面端已实测**：通过 Windows 桌面启动器或浏览器使用 Prelude，DSH 0.2.1-rc.2 运行在 WSL2 中。Linux 和原生 macOS 的 rc.2–rc.5 已通过干净宿主安装、启动及数据保存检查。[各平台与 DSH 版本实测](docs/installation.md#支持环境)

[使用指南](docs/quickstart.md) · [报告问题](https://github.com/dbcaskml183-dotcom/dsh-prelude/issues/new/choose) · [开发与贡献](CONTRIBUTING.md) · [安全问题](SECURITY.md) · [MIT 许可证](LICENSE)

Prelude 是独立社区项目。
