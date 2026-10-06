# HNUST 第五人格校队介绍站

湖南科技大学第五人格校队与社群介绍网站。GitHub 仓库：Starlevin/HNUSTidentify5-site。

当前正式地址：https://hnust-identityv.levinluo2005.chatgpt.site

> 本分支为独立账号候选版本。GitHub 仓库当前是静态展示版，不包含正式站上一版的 Vinext 源代码。合并此代码不会自动替换正式站的 ChatGPT 登录，必须完成后端部署和源代码同步。

## 独立账号

- 队员用网站自己的用户名和密码登录，不依赖 ChatGPT 账号。
- 注册必须提供一次性邀请码，管理员设置1–30天有效期，默认7天。管理员可撤销未使用的邀请码。
- 密码以服务端 HMAC pepper 预处理，再经独立随机盐的 PBKDF2-SHA256 散列，数据库不保存明文密码。AUTH_PEPPER 必须为不少于32字符的高熵秘密值。
- 登录会话通过 __Host-hnust_session Cookie 保存，设置 HttpOnly、Secure、SameSite=Strict。数据库只保存会话令牌散列，管理员设置1–30天有效期，默认7天。
- 写请求检查同源 Origin，提交体限制16KB。用户名与IP登录尝试受服务端速率限制。
- 修改密码会使全部已有会话失效，停用或更改账号权限也会注销该账号的所有会话。
- 每位成员只可修改自己的公开主页和队内资料。
- 私密资料仅本人和管理员可查看，普通队员无法查询其他队员资料；公开主页响应永远不包含队内联系方式。
- 管理员可发放队员邀请码。队长可邀请其他管理员、升降权限及停用账号。

队员空间入口是 account.html。纯 GitHub Pages 没有服务端账号能力，该页面会明确提示未接入账号服务，不会用浏览器存储模拟登录。

## 数据与原有档案

原来的16份公开游戏档案、队徽、群二维码、官方素材与静态 Pages 构建保留。邀请码可绑定已有档案编号，避免其他成员自行认领。队长通过一次性管理初始化邀请码注册，创建新的队长档案，不自动占用已有成员档案；队员使用绑定档案的邀请码保留原有游戏字段。

公开字段为昵称、队内称呼、阵营、历史段位、角色池、介绍、主题与已收录立绘。公开主页会拒绝疑似私人联系方式。真实姓名、个人联系方式、学院、年级、游戏ID、训练时间和备注只保存到服务端私密字段。队内字段均选填，保存前确认提交给管理员；清空字段并取消共享可以撤回。

worker/roster.mjs 是现有公开档案的服务端副本。修改 data/team-roster.json 后需要同步此副本。原始 Excel、私人资料、密码、初始化邀请码与部署秘密均不得提交到仓库。

## 构建和验证

使用 Node 24 与 Python 3：

- npm install
- npm run test:auth
- python -m unittest discover -s scripts -p test_public.py -v
- SITE_BASE_PATH=/ python scripts/build.py

独立账号工作流在分支推送及PR时运行：JavaScript语法检查、真实 Workers/Miniflare + D1 权限集成测试、原有隐私白名单测试、静态构建检查。不依赖真实用户数据或生产秘密。

## 托管要求

worker/index.mjs 是 Cloudflare Workers-compatible ESM 入口，DB 为D1绑定，ASSETS 为 dist 的静态资产绑定。migrations/0001_independent_accounts.sql 是新增的 account_* 表，与正式站原先的表名区分开。不要在运行时自动创建表。

wrangler.toml 中的数据库ID是显式占位值；本仓库未配置真实 Cloudflare 账户、数据库或部署凭据。已有平台的资源ID必须通过托管平台获取，不能推导或猜测。

启用前由网站维护者配置：
1. 将 DB 绑定至实际数据库，并先应用新增迁移。
2. 通过托管平台秘密变量设置 AUTH_PEPPER 和 ADMIN_SETUP_TOKEN，均使用独立的高熵随机值，不能放入网页或GitHub。
3. 通过同源 HTTPS 托管 worker 与 dist；将所有 /api/account/* 请求交给 worker。
4. 维护者用 ADMIN_SETUP_TOKEN 作为第一次注册的邀请码，建立队长账户。建成后该初始化邀请码即使再次提交也不能创建第二个队长，随后删除此秘密变量。
5. 队长分别生成两个管理员邀请码，交给实际管理员自行设置用户名和密码，再为已有队员绑定对应档案生成邀请。

先在隔离环境验证，再更新正式站。不要只发布静态页面而声称账号功能已启用，也不要把本候选分支当作已经部署的正式版本。正式站源码和数据库中的已有账号/资料需要另行核对并按绑定的档案迁移，不能直接丢弃。

## 美术来源

已有官方佣兵、红夫人立绘可用于选手主页。游戏美术 © 网易 / Joker Studio，详见 assets/game/README.md。全角色立绘尚未补齐。

学校官网：https://www.hnust.edu.cn/  
第五人格官网：https://www.identity-v.com/  
IVL联赛官网：https://ivl.163.com/

本站为校队社群介绍网站，不表示学校或游戏官方授权。


## 免费生产部署（推荐）

使用 GitHub + Cloudflare Workers 静态资源 + D1。无需 Supabase、独立域名或 VPS，默认网址为 HTTPS `workers.dev`。仅使用 Cloudflare 的 Free 档；额度限制不是无限量保障，超过额度可能暂时不能使用 API。此流程不购买或升级套餐。

1. 注册或登录 Cloudflare 免费账号。在 Workers & Pages 开通 Workers 子域名。
2. 创建 API Token，限制到目标账号，赋予 Workers Scripts Edit、D1 Edit、Account Settings Read。首次开通 workers.dev 子域名请在控制台完成。
3. 在本仓库 Settings → Secrets and variables → Actions 添加下表4项（不要发到公开聊天或提交到 Git）。
4. 在 Actions → Deploy free Cloudflare team platform → Run workflow 运行一次。该流程自动复用或创建 D1、应用迁移、设置秘密变量和部署网页及后端。默认不随提交自动发布，避免误发。
5. 从部署日志获取实际 HTTPS 地址，打开 `/account.html`，以 `ADMIN_SETUP_TOKEN` 为邀请码创建队长账号，自行设置用户名和密码。请保存初始化邀请码。之后生成两个管理员邀请，让管理员各自注册。
6. 通过邀请码绑定已有档案。队长初始化时创建新档案，避免误认领已有成员档案。已有成员只通过管理员发放的绑定邀请码注册。

| Actions Secret | 内容 |
| --- | --- |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare 账号ID |
| CLOUDFLARE_API_TOKEN | 限定到该账号的部署Token |
| AUTH_PEPPER | 稳定保存的随机秘密，至少32字符；不要随部署更换 |
| ADMIN_SETUP_TOKEN | 独立随机初始化邀请码，至少32字符 |

用密码管理器生成两组不同的64位随机字符串，保存好。AUTH_PEPPER 丢失或更换会导致已有密码无法验证。不要在 CI 中输出秘密。脚本不删除或重建已有数据库，后续执行只应用尚未运行的迁移。

如使用本地CLI：配置同名环境变量，然后 `npm ci`、`npm run test:auth`、`npm run build`、`npm run deploy:cloudflare`。`.env.example`仅说明字段，部署脚本不自动加载 `.env`。

## 比赛与训练赛

`matches.html` 支持真实数据库中的新增、编辑、删除与发布。访客仅可读取发布的记录；队员可读取队内记录；仅管理员能修改。按每局我方求生者/监管者半场录入地图、积分、4名求生者或1名监管者、选用角色、Ban角色。半场积分校验为5:0、3:1、2:2、1:3、0:5。

统计显示当前查询范围内的半场胜率与累计积分，明确区别于大局胜率/整场胜负，暂不推断加赛或时长判胜。无真实数据时显示空状态，不生成战绩。支持浏览器打印战报页为PDF；自动图片战报、完整角色图鉴、角色熟练度与AI BP分析尚未实现。

## 数据备份与恢复

上线后用实际数据库ID生成的配置或控制台绑定执行 `npx wrangler d1 export hnust-identityv-accounts --remote --output team-backup.sql`。导出的SQL包含敏感信息，不要提交到仓库或放入公开网站。加密保存，恢复前先导出当前数据，并在独立数据库演练恢复。D1控制台也提供恢复工具；不要直接覆盖生产库。

当前仓库只保留已有公开资料；不会自动搬运旧正式站的私密资料或账号。旧站地址不会被本工作流修改。上线验证后，另行更新对外分享地址。
