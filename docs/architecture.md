# 架构与职责边界

```text
DSH slots / conversation / settings
        ↓ native-adapter / input-adapter / session-scope
React src → client controllers → AI v8 / storage v4 → host/service
                     ↓                    ↓
                shared contracts    model-adapter → DSH llm
                                    library-repository / usage-ledger
                                              ↓
                                       transaction-gate
```

| 层 | 负责 | 不负责 |
|---|---|---|
| methods/sources/bundles | 方法内容、来源、组合元数据 | 隐式触发模型或执行任务 |
| shared | 协议、纯目录搜索、适用性、约束、脱敏诊断 | 操作 DOM 或读写文件 |
| client | 输入适配、会话归属、请求控制、词库订阅、几何 | 复制宿主会话/权限/模型系统 |
| src | React 面板和设置、样式、宿主挂载 | 直接实现存储事务 |
| host | API 鉴权与校验、宿主模型、库和账本持久化 | 私自更换模型供应商 |
| tools/bin | 开发与显式离线诊断 | 自动扫描或清理用户目录 |

构建入口：`src/client.jsx` → `client.js`（React 外部依赖）；`src/host.mjs` → `index.mjs`（官方 SDK 外部依赖）；`tools/storage-doctor.mjs` → `bin/storage-doctor.mjs`（Node 原生依赖）。`cordis.patch.yml` 仅插入一条 prompt-coach；`package.json` 向 DSH 声明 bundle 与客户端注入。

生命周期：会话桶 get 只分配，activate 在 effect 中建立归属；clear 先提升代际、撤销归属，再逐项释放。词库控制器拥有 fetch 与 JSON 解析的 AbortController；serial 阻止迟到结果发布。独立 cleanup 防止一个子系统清理异常阻止另一个。

主库：读路径区分 ready / missing / missing-protected / corrupt；已有历史时不允许空库写入。写路径经 TransactionGate 同步互斥、修订号和文件 SHA 再验证，临时文件同步后发布。恢复只接受指定备份与 SHA，保留坏主库，不伪造更晚数据。

错误：只记录有限类别/代码；相对帧必须落在显式插件根内，拒绝外部绝对路径、查询参数和路径穿越。公开包不包含本机日志、登录入口、cookie 或用户资料。

测试分层：纯逻辑/故障注入 → 真实打包客户端与 Cordis 生命周期 → 官方 CLI 全新 profile 安装/移除 → 隔离 API / 浏览器。通过某层不代替其余层，也不等于任意模型增益或长期无故障。

## 历史实现记录

以下按版本保留设计变迁，不代表当前协议与期限；当前使用方式见 quickstart.md。

## 0.2.5 整稿路径

POST rewrite与原建议入口复用同一createHandler，operation只由注册路由指定，不放开用户自选执行命令。prepare/stream/取消/租约/用量待补登记只有一份。shared/rewrite-contract独立决定候选协议，不把自由改稿混入方法ID建议。

RewriteController属于SessionBucket，拥有响应headers与JSON body的取消、原稿/候选快照、用户显式采用与撤回；不克隆整个InputState，不保存queue。采用/撤回均为公开insertText(text,span)的CAS区间，保留独立原生undo边界，不使用setDraft或模拟键盘替换。Panel仅订阅结果并传递当前公开输入与组字状态；dispose纳入既有桶清理。

对比视图有自己的geometry标记，不能让后续方法卡抬高未展开浮窗最小高度；原方法库的一卡下限保持原算法。差异计算有输入长度与LCS规模上限，退化为线性比较，不执行模型HTML。

## 0.3.0 规范与可选审校路径

- guidance/rules.json是规则、来源和示例唯一数据源，构建生成RULES_HASH。shared/guidance只做有界选取；共享纯函数不依赖宿主、浏览器或模型SDK。
- shared/analysis-contracts负责AI v5握手、reviewMode和target，复用原v4输入边界；个人库、账本、修订与恢复协议不随AI协议迁移。
- shared/prompt-contract集中原文保护与有限高影响操作检查；shared/rewrite-review负责引用归属、审校结构与状态。审校不读取生成器自评，不把附件/模型文字升级成用户授权。
- host/prompts只负责三类提示词；host/service只保留一条callStep执行管线。生成与审校共用租约、整体45秒期限、取消和记账保护；阶段ID由父请求及阶段做SHA256，未知用量不记成免费。生成记账失败会停止下一阶段并保留候选；无隐式重试。
- ReviewControls是面板/设置共用配置组件，使用官方configForms；autoReview与targetMode只作为偏好。请求快照锁定本次模式，切换开关不追改旧结果。
- RewriteController管理候选与审校状态、源修订、显式采用及撤回；手改使旧审校stale，异常不伪造通过。RewriteView只展示这些状态，无第二套模型执行器或存储。

一个插件阶段不等于一个供应商HTTP请求；适配器可能有内部行为，本插件不承诺全供应商严格调用次数。此处测试记录明确区分宿主合成路由与官方HTTP测试适配器。

## 0.3.1 合同边界

shared/prompt-contract.mjs统一提取原文保护片段、明确权限与有限约束；shared/editor-policy.mjs独立判断可否把纯文本直接写入宿主编辑器。模型结果、手改候选、主动审校入口和最终采用复用同一validateRewrite。UI controller保留revision/CAS、附件/会话/组字边界，React视图不维护第二份判据。原始数据仍沿用v4，AI接口沿用v5；规则哈希变更使旧页面先刷新。

## 0.3.2 约束与宿主输入语义

原文合同只在 shared/prompt-contract.mjs 内统一否定、权限极性、边界与输出事实，生成/手改/审校/采用复用现有校验链。shared/editor-policy.mjs 独立处理宿主输入语义；整稿和 client/insertion.mjs 共同使用，避免个人补句绕过。没有增加供应商、存储、权限或状态机实体。宿主URI规则用实际rc.2解析器做差分验收，浏览器运行时不导入宿主Node模块。

最终源码构建后冻结一次TGZ，安装、运行、界面与生命周期证据都记录相同完整哈希。包外证据可追加，不反向改变包内容；源码清单最后生成，并验证实际Git检出和发行附件跟踪。远端CI与作者元数据仍是公开发布前的独立事项，不伪造为已经完成。

## 0.3.3 要求识别

沿用 shared/prompt-contract.mjs 作为生成、服务端审校和前端采用的共同检查入口；条件关联句与实际源片段在这里识别，不增加独立解析服务或执行状态机。礼貌前缀只用于判断，受保护文本仍来自真实原文；必须/只/不得等操作符不剥离。描述性检查与源稿定向反转检查互为对照。有限词法检查不等同于语义证明；主 Agent 的权限与工具完全不变。

## 0.3.5 职责边界

未新增服务、运行时依赖或持久化实体。prompt-contract保存同一套有限要求规则；rewrite-contract分开安全解析与严格采用；service复用原rewrite接口、模型适配器、租约与用量账本；controller拥有修稿取消/身份/采用撤回；view只呈现状态与显式按钮。review-selectable-v2能力握手拒绝不匹配旧前端。repair请求仅在rewrite路由接受，原文引文在服务端复核，代码拦截在服务端和客户端独立复算。

## 0.3.6 单一规则投影

仍由shared/prompt-contract维护要求识别；modalParts分离模态、动作体、话题及不能安全归一的前缀。同一结果供保留、强度及常见授权对象比较复用。动作匹配只用遮罩视图，对象消歧使用等长原始视图；覆盖面与提议文本的例外逐动作判定，不扩成全句豁免。服务、控制器、视图及持久化没有新职责。

## 0.4.0 显式方法融合

唯一新增纯模块shared/method-selection拥有确认正文快照、组合、取消与恢复合并；无I/O或模型。React继续拥有本会话临时选择，RewriteController继续独占源身份与CAS/receipt事务。生成、审校、修稿沿用同一个host/service管线；选方法不新增调用阶段、数据库、路由SDK或全局技能。decision合同扩展uncertain，AI握手升v6，存储v4不迁移。历史章节中的v5指此前版本。


## 0.4.1修订
selectedMethods传递目录确认快照；explicitRequirements只包含手写内容。方法允许自然改述，精确字面量和明确安全限制继续保护；代码仅检查有限副作用冲突。普通方法的完整语义覆盖依赖用户核对及可选模型审校，不保证任意语义等价。AI v7，存储v4。上述0.4.0实现描述保留作历史。


## 0.4.3 当前任务重置
RewriteController统一推导来源适用性、审校入口理由和完整dismiss；采用后的receipt单独保持撤回安全。会话桶只协调当前任务字段和重置序号，视图展示旧稿只读与必要确认。原有会话所有者分配逻辑不变，未增加持久化、后台服务或HTTP协议。
资料预览和方法卡片用有前缀的局部key重置；重置序号不进入模型请求。固定入口处于滚动区外，只有明确确认操作才滚动到提示；日常输入不抢滚动。

## 0.4.4 展开偏好与临时界面状态

client/presentation 统一定义四个区域和字段映射，并以纯函数处理每次打开的初始值、手动触碰与一次性迟到配置。src/settings 复用 native-adapter 的官方 configForms 单字段、修订号写入；host schema 四项 boolean.default(false).volatile()，运行中改偏好不会重建模型处理器。没有新增运行时模块。

会话桶只增加临时 disclosure 状态。明确关闭再打开时取配置；浮窗展开/收起不是重开。区域 summary 的捕获点击记录用户意图，toggle 只同步实际开合，避免浏览器合并连续 toggle 后丢掉用户先开后关的选择。卸载旧节点、旧工作代际的事件不回写。资料、方法搭配、模型和要求的内容生命周期保持原职责。

偏好不参与请求快照、指纹、taskResetPatch 或重置序号；展开资料不触发预览请求或勾选。配置全局共享、临时状态各页面独立。设置保存存在忙碌门和结果不明保护；不以传输错误中的自然语言猜测服务端是否已保存。


## 0.4.5 显示让位

`popover.mjs` 只管理展示资格、几何和临时事件。`ui.open` 保留用户打开意图，`surfaceVisible` 是瞬时视图状态，不参与请求 fingerprint、配置或任务重置。宿主模态判断从其公开 primitives 虚拟模块导入；不得打包另一份宿主。外部语义浮层使自有 panel 隐藏并 inert；最后一层离开后恢复同一子树，默认不聚焦。入口触发的恢复不重建业务。

候选发现观察变动子树，候选祖先的可见性定向观察；不随 token 全页面扫描。自有动作执行前做一次当前语义浮层检查，封住观察器交付前的竞态。卸载释放观察器、事件和待执行回调。原生 API 抛错时保守隐藏；不支持 API 时维持已有 fixed 后备路径。

0.4.6：在原显示生命周期内记住最近属于本面板的聚焦控件。非阻挡状态下，焦点主动离开即清除归属；外部模态把焦点先挪走后，仍可在其关闭且activeElement仅为body时有限归还。两个focusin监听随原release清理，不进入持久状态或请求。

0.4.7：个人编辑身份仍由 PersonalEditor 持有，提交与读取只由 LibraryController 协调。模型阶段关闭继续由 host/service 的单一 record/pending 管理；不增加执行器或模型调用。ui-primitives 为宿主静态模块表依赖，运行包不携带其副本。

0.4.7：个人编辑身份与普通发布分开，提交回执推进基准而不擦除后写内容；模型流关闭使用既有 pending/lease；恢复可用性由读取能力派生。表面观察的 action-time 检查先消费 MutationObserver.takeRecords，再复用候选集合；不具备 takeRecords 时全文发现作保守回退，不取消新模态即时闸门。没有新增持久状态或后台服务。

## 0.4.8 数据边界

操作限制、当前所选指导和正文覆盖是三个独立事实。供匹配的排版投影不改写原稿，不提供权限；引用/代码/资料不能通过跨边界拼接被认作新要求。有限动作检查返回已体现、部分匹配或未知；没有匹配不是确认缺失。

suggest模型目录采用固定列的紧凑行，保留真实通用正文及适用限制。suggest结果的increment包含sourceBlockId/sourceQuote/snippetQuote，分别绑定本次真实原文与可信补句；字段齐全不等于语义获证。模型卡默认显示/选择通用正文，已有确认的技能文本不静默降级；方法库的技能写法继续由原有可用性校验负责。

已表达的勾选仍经过可信目录和原限制校验，作为核对指导保留；改写不应反复追加同一句。覆盖判断不替代原意与安全审校。AI协议8拒绝旧页面；个人库、调用账本与存储协议4不迁移。没有新增后台模型阶段或历史记忆库。
