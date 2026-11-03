# Prelude

DeepSeek Harness 的提示词写作助手。在输入框里挑选方法、补充要求，对照原稿查看改写，再决定采用哪一版。

<!-- prelude-current:start -->
当前 **0.4.21 预览版** · [下载安装包](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz) · [安装说明](docs/installation.md) · [English](README.en.md)
<!-- prelude-current:end -->

![Prelude 方法库实拍：每张卡片说明适用场景，并提供用于本次改写、插入光标处和复制操作](docs/assets/method-library.png)

## 第一次使用

1. 在 DSH 输入框写下需求，然后打开 **Prelude**。
2. 在 **方法库** 中查找需要的补充，或点击 **分析提示词** 看看草稿还缺什么。90 张方法卡可按阶段、领域或关键词查找。
3. 点 **用于本次改写** 选好方法，再点 **改写整稿**。也可以直接把卡片上的一句话插入光标处。
4. 对照原稿编辑候选。点 **采用到输入框** 后，由你决定何时发送。

例如，你写下「用 Python 标准库把 CSV 转成 JSON，保留原文件」。选择 **验收标准** 方法后，可以补上「给一组输入和预期输出，说明怎样运行验证」。这样，收到脚本的人就知道怎样判断转换是否正确。

## 模型与数据

浏览和收藏方法卡免费，无需模型。智能分析、改写和可选审校使用你在 DSH 配置的模型，可能产生供应商费用。默认只处理当前草稿，上文和文本附件由你主动选取。[模型与隐私](docs/privacy.md)

## 支持环境

**Windows 桌面端已实测**：通过 Windows 桌面启动器或浏览器使用 Prelude，DSH 0.2.1-rc.2 运行在 WSL2 中。Linux 和原生 macOS 上也已验证同版宿主的安装、启动与插件响应。[各平台与 DSH 版本实测](docs/installation.md#支持环境)

[使用指南](docs/quickstart.md) · [报告问题](https://github.com/dbcaskml183-dotcom/dsh-prelude/issues/new/choose) · [开发与贡献](CONTRIBUTING.md) · [安全问题](SECURITY.md) · [MIT 许可证](LICENSE)

Prelude 是独立社区项目。
