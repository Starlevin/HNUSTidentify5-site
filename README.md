# HNUST 第五人格校队介绍站

湖南科技大学第五人格校队与社群介绍网站。GitHub 仓库：Starlevin/HNUSTidentify5-site。

当前正式地址：https://hnust-identityv.levinluo2005.chatgpt.site

> 本分支为独立账号候选版本。GitHub 仓库当前是静态展示版，不包含正式站上一版的 Vinext 源代码。合并此代码不会自动替换正式站的 ChatGPT 登录，必须完成后端部署和源代码同步。

## 独立账号

- 队员用网站自己的用户名和密码登录，不依赖 ChatGPT 账号。
- 注册必须提供一次性邀请码，有效期7天。管理员可撤销未使用的邀请码。
- 密码以服务端 HMAC pepper 预处理，再经独立随机盐的 PBKDF2-SHA256 散列，数据库不保存明文密码。AUTH_PEPPER 必须为不少于32字符的高熵秘密值。
- 登录会话通过 __Host-hnust_session Cookie 保存，设置 HttpOnly、Secure、SameSite=Strict。数据库只保存会话令牌散列，有效期7天。
- 写请求检查同源 Origin，提交体限制16KB。用户名与IP登录尝试受服务端速率限制。
- 修改密码会使全部已有会话失效，停用或更改账号权限也会注销该账号的所有会话。
- 每位成员只可修改自己的公开主页和队内资料。
- 所有有效成员可在登录后查看确认共享的队内资料；公开主页响应永远不包含队内联系方式。
- 管理员可发放队员邀请码。队长可邀请其他管理员、升降权限及停用账号。

队员空间入口是 account.html。纯 GitHub Pages 没有服务端账号能力，该页面会明确提示未接入账号服务，不会用浏览器存储模拟登录。

## 数据与原有档案

原来的16份公开游戏档案、队徽、群二维码、官方素材与静态 Pages 构建保留。邀请码可绑定已有档案编号，避免其他成员自行认领。队长通过一次性管理初始化邀请码注册，绑定现有 p0001 档案；原有游戏字段保留。

公开字段为昵称、队内称呼、阵营、历史段位、角色池、介绍、主题与已收录立绘。公开主页会拒绝疑似私人联系方式。真实姓名、个人联系方式、学院、年级、游戏ID、训练时间和备注只保存到服务端私密字段。队内字段均选填，保存前确认向有效成员共享；清空字段并取消共享可以撤回。

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
