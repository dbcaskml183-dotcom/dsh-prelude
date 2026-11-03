# 安装、升级与恢复

[返回首页](../README.md) · [English](installation.en.md)

## 支持环境

| 0.4.21 安装环境 | 实测结果 |
|---|---|
| Windows 桌面端 · WSL2 内运行 DSH rc.2 · Node 24 | 已实测。通过 Windows 桌面启动器或浏览器使用 Prelude。 |
| Linux 原生宿主 · DSH rc.2 · Node 24 | 已验证安装、启动和登录后的插件响应。 |
| macOS 原生 · rc.2 · Node 24 | 在干净宿主安装、启动成功，登录后的插件状态接口返回 0.4.21，账本测试通过。尚未验证 macOS 桌面交互和真实模型回合。 |
| Linux 与 macOS · rc.3、rc.4、rc.5 | 0.4.21 清单指定 rc.2，默认安装被拒。在一次性测试机上为该版本启用宿主的精确版本豁免后，六种组合均通过安装、启动和登录后的插件状态检查。 |
| Windows 原生 Node 24 | 账本目录同步实际返回 EPERM。0.4.21 不支持原生 Windows 数据写入，Windows 用户可使用 WSL2。 |

[正常安装测试](https://github.com/dbcaskml183-dotcom/dsh-prelude/actions/runs/41567949491) · [其他 RC 的隔离启动测试](https://github.com/dbcaskml183-dotcom/dsh-prelude/actions/runs/41568664094)

## 首次安装

Prelude 的安装包名为 `dsh-prompt-coach`，沿用旧名以兼容已有配置和个人库。先保存现有 profile 的配置、依赖清单和锁文件；其他插件有本地修改时也要保存其程序副本。

**直接从 Release 安装。** 在运行 DSH 的 Linux / WSL 终端执行：

```sh
dsh plugin --profile web add https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
```

这条命令已在干净的 WSL2 宿主 rc.2 上验证，安装后宿主加载了 0.4.21，登录后的插件状态接口返回了该版本。

**使用已下载的文件。** 也可以先[下载安装包](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz)，把上面命令中的网址换成文件在宿主里的绝对路径。

例如文件保存在 Windows 的 `D:\Downloads`，WSL 路径通常为：

```sh
dsh plugin --profile web add /mnt/d/Downloads/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
```

以上假设使用 `web` profile；如实际 profile 不同，使用自己的名称。执行 CLI 应与运行宿主是同一版本。官方命令维护 bundle 和依赖，不重复手工添加 `prompt-coach` entry。

包已带构建产物，不需要启用安装脚本。保存草稿并等待运行任务结束，通过平时使用的启动器或服务管理器正常重启 DSH，再刷新浏览器。手动从终端启动的实例，正常停止后使用原命令、原 profile 和原环境重新启动。

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
