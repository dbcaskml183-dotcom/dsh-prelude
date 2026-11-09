# 安装、升级与恢复

[返回首页](../README.md) · [English](installation.en.md)

## 支持环境

0.4.28 支持 Node 24 及以上，在 Linux / WSL2、macOS 和原生 Windows 上使用 DSH 0.2.1-rc.2 至 rc.5，以及 0.2.2-rc.1。原生 Windows 实测宿主为 rc.5。默认安装无需版本豁免；尚未验证的后续宿主版本不自动放行。

| 环境 | 已验证的范围 |
|---|---|
| Windows 桌面端，DSH 运行在 WSL2 中 | Windows 桌面启动器或浏览器连接 WSL2 内的 DSH，已实操验证；在 WSL 内安装插件。 |
| Linux，DSH rc.2 / rc.3 / rc.4 / rc.5 | 官方干净宿主默认安装、启动、鉴权后的插件响应、收藏写入、重启后保留；本地存储测试通过。 |
| macOS，DSH rc.2 / rc.3 / rc.4 / rc.5 | 同上。在 GitHub 的 macOS 测试机运行；不等同于 macOS 人工桌面操作或真实模型验收。 |
| Windows 原生 Node | 原生 Windows · Node 24 · DSH rc.5：已验证安装、启动、插件响应与收藏保存。 |

0.4.26 在原生 Windows 的 0.2.2-rc.1 Web 宿主上实测了方法库、收藏及插入补句。[兼容验证记录](../VERIFICATION.md)

## 首次安装

Prelude 的安装包名为 `dsh-prompt-coach`，沿用旧名以兼容已有配置和个人库。先保存现有 profile 的配置、依赖清单和锁文件；其他插件有本地修改时也要保存其程序副本。

**从 npm 安装当前 npm 版本。** 如需指定 0.4.28，请使用下方 本地候选包 地址。

```sh
dsh plugin --profile web add dsh-prompt-coach --ignore-scripts
```

**从 Release 安装指定版本。** 在运行 DSH 的终端执行（原生 Windows 可用 PowerShell）：

```sh
dsh plugin --profile web add /path/to/dsh-prompt-coach-0.4.28.tgz --ignore-scripts
```

本版使用同一份安装包进行跨平台验证与发布。

**使用已下载的文件。** 也可以先[下载安装包](/path/to/dsh-prompt-coach-0.4.28.tgz)，把上面命令中的网址换成文件在宿主里的绝对路径。

例如文件保存在 Windows 的 `D:\Downloads`，WSL 路径通常为：

```sh
dsh plugin --profile web add /mnt/d/Downloads/dsh-prompt-coach-0.4.28.tgz --ignore-scripts
```

以上假设使用 `web` profile；如实际 profile 不同，使用自己的名称。执行 CLI 应与运行宿主是同一版本。官方命令维护 bundle 和依赖，不重复手工添加 `prompt-coach` entry。

包已带构建产物，不需要启用安装脚本。保存草稿并等待运行任务结束，通过平时使用的启动器或服务管理器正常重启 DSH，再刷新浏览器。手动从终端启动的实例，正常停止后使用原命令、原 profile 和原环境重新启动。

## 亲眼确认安装成功

1. 设置中出现 **Prelude**，版本为 **0.4.28**。
2. 输入区打开 Prelude，搜索“验收标准”，预览并插入一条补句。
3. 确认原草稿仍在，并且没有自动发送。

登录状态下 `/api/prompt-coach/v4/status` 返回版本信息；匿名访问 401 不代表安装失败。

## 升级与回退

停止插件写入后，保存旧包、profile 配置/依赖/锁文件，以及 `${DSH_HOME:-$HOME/.dsh}/prompt-coach` 整个状态目录。数据在安装目录之外，不要只备份代码。

安装新包后重新加载并核对。回退时先保存升级后新增的数据，再停写、恢复匹配的程序与配置/状态，最后启动。不要在线覆盖正在写入的数据，也不要用整份旧 profile 覆盖其他插件的新配置。恢复旧快照可能失去快照后的修改。

更多说明见 [存储与恢复](operations.md)。

## 卸载

```sh
dsh plugin --profile web remove dsh-prompt-coach
```

重新加载并刷新浏览器。卸载不自动删除个人库；是否删除由你另行决定。
