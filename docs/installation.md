# 安装、升级与恢复

[返回首页](../README.md)

## 支持环境

- Linux / WSL2 中的 DSH **0.2.1-rc.2**，Node.js **24**。
- Windows Chrome/Edge 可以连接 WSL 内的 DSH；这不等于支持 Windows 原生 Node 宿主。
- DSH rc.3 或其他版本、macOS 宿主尚不在支持范围。不要为安装插件更改现有宿主版本。

## 首次安装

使用仓库中的 `release/dsh-prompt-coach-0.4.21.tgz`。正式发布后，应从已核对的官方项目 Release 下载同名文件。当前没有 npm 发布，不使用 `npm install dsh-prelude` 或来源不明的同名包替代。

先保存当前 profile 的配置、依赖清单/锁文件，以及已有插件程序。其他插件有本地修改时，保存其快照，避免 profile 依赖重算影响本地版本。

在运行 DSH 的 Linux/WSL 终端执行：

```sh
dsh plugin --profile web add /absolute/path/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
dsh --profile web --dump-config
```

例如文件保存在 Windows 的 `D:\Downloads`，WSL 路径通常为：

```sh
dsh plugin --profile web add /mnt/d/Downloads/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
```

以上假设使用 `web` profile；如实际 profile 不同，使用自己的名称。执行 CLI 应与运行宿主是同一版本。官方命令维护 bundle 和依赖，不重复手工添加 `prompt-coach` entry。

包已带构建产物，不需要启用安装脚本。正常重新加载同一个 profile，刷新浏览器。

## 亲眼确认安装成功

1. 设置中出现 **Prelude**，版本为 **0.4.21**。
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
