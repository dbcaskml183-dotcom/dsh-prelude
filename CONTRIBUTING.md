# 参与开发

感谢你帮助 Prelude 更实用。优先提交可复现的问题与小范围修复；新功能先说明真实使用场景。

## 报告问题

请提供 Prelude/DSH/Node 版本、宿主系统、浏览器、操作步骤、预期与实际结果。优先用不含私人内容的合成提示词复现。不要上传登录链接、API key、个人库或整段私人会话。

## 本地开发

在 Linux/WSL、Node.js 24 的仓库根目录运行：

```sh
npm ci --ignore-scripts
npm run lint
npm run build
npm pack --ignore-scripts --pack-destination release
node tools/manifest.mjs --release --write
npm test
npm run verify
```

完整测试会比对安装包，因此修改运行文件后须先同步上面的安装包；这不会上传或发布。

完整宿主验证需要 DSH 0.2.1-rc.2。自动测试不替代真实浏览器与模型使用；具体范围见 [验证说明](VERIFICATION.md)。

## 修改原则

- 针对可复现原因做最小修改，不为单个问题增加无关模块。
- 保留用户原意、路径、要求强度及显式采用流程。
- 不为适配 Prelude 修改宿主或第三方插件。
- 新增方法写清来源、适用条件和实际补句，不复制大段第三方提示词。
- 功能、模型和平台支持只按实际证据声明。

## 打包

发布前按变更管理版本，在仓库根执行：

```sh
npm run build
npm pack --ignore-scripts --pack-destination release
node tools/manifest.mjs --release --write
node tools/source-manifest.mjs --write
node tools/manifest.mjs --release
npm run verify:source
```

`release` 目录仅保留当前版本安装包及其 SHA256SUMS；其他版本在仓库外归档，不能混入附件集合。提交时包括构建产物与清单，正常 git add 后可运行 `npm run verify:source -- --tracked` 检查遗漏。

自动化工作流只做验证，不自动发布 npm 或 GitHub Release。公开上传前人工确认资料和附件范围。
