# Prelude

**DSH 提示词优化与改写助手**

发现需求中的遗漏，选择需要补充的要求，再决定怎样修改。

- **补一句** — 从方法卡中选择补充内容，插入当前草稿。
- **改整段** — 生成候选稿，对照原稿查看和编辑，确认后采用。

90 张方法卡可按阶段、领域和关键词查找。是否采用、何时发送，都由你决定。

<!-- prelude-current:start -->
当前 **0.4.21 预览版** · [下载安装包](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz) · [安装说明](docs/installation.md) · [English](README.en.md)
<!-- prelude-current:end -->

## 先看一次改写

**原稿**

> 用 Python 标准库把 CSV 转成 JSON，保留原文件。

**选用「验收标准」后，一种可能的写法**

> 用 Python 标准库把 CSV 转成 JSON，保留原文件。请附一小段 CSV、对应的预期 JSON 和运行命令，让我能检查转换结果。

这次只补了怎样验收。「只用标准库」和「保留原文件」仍是原来的要求。你可以只插入新增的那句话，也可以比较整稿后再采用。

## 安装到 DSH

已在 Linux / WSL2 的 DSH 0.2.1-rc.2、`web` 配置实测。已有插件时先备份当前配置，然后在运行 DSH 的终端执行：

```sh
dsh plugin --profile web add https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
```

重新加载同一个 profile，刷新页面，在聊天输入框旁打开 **Prelude**。安装包沿用兼容名称 `dsh-prompt-coach`。[本地文件安装与其他平台](docs/installation.md)

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

**Windows 桌面端已实测**：通过 Windows 桌面启动器或浏览器使用 Prelude，DSH 0.2.1-rc.2 运行在 WSL2 中。Linux 和原生 macOS 上也已验证同版宿主的安装、启动与插件响应。[各平台与 DSH 版本实测](docs/installation.md#支持环境)

[使用指南](docs/quickstart.md) · [报告问题](https://github.com/dbcaskml183-dotcom/dsh-prelude/issues/new/choose) · [开发与贡献](CONTRIBUTING.md) · [安全问题](SECURITY.md) · [MIT 许可证](LICENSE)

Prelude 是独立社区项目。
