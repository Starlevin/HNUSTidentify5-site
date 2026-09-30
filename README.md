# HNUST 第五人格校队介绍站

湖南科技大学第五人格校队与社群的公开介绍网站。沿用 GitHub Pages 免费部署，保留仓库名称 qinghan-site。

## 页面

- 首页：校队介绍、公开队员、社群介绍、官方资源。
- 队员档案：按阵营筛选、搜索游戏昵称与角色池。
- 加入社群：日常搭子、选拔说明、公开群号 648418715、二维码。
- 每位队员拥有独立 `players/p0001/` HTML 页面，随公开资料自动生成。
- 资料说明：公开内容范围。
- `tools/roster-editor.html`：浏览器本地读取收集表，整理经确认的公开字段。

## 公开内容边界

**原始 Excel、真实姓名、身份证号、手机号、学号、个人 QQ/微信/邮箱/住址不能上传到公开仓库，也不能作为隐藏字段或附件发布。**

`data/team-roster.json` 只允许 id、nickname、role、characters、rank、intro 六个键。nickname 只能填游戏昵称或队内代号。role 使用 survivor、hunter、flex、support。

游戏昵称也可能与真名相同，文本介绍也可能含身份线索，必须人工确认。字段白名单和数字/联系信息检查是辅助措施，不能自动识别所有真名。未经确认的选拔报名者不要当成正式队员公开。

原表目前未导入。公开名单暂为空；没有虚构人员、战绩、名次、建队时间或学校背书。

## 添加资料

打开站点的 `tools/roster-editor.html`。文件只在当前浏览器内存中解析，不保存原表到服务器。读取表格使用 SheetJS 0.20.3 官方脚本；仅工具页加载，介绍站不依赖外部字体或脚本。

1. 选择表格、工作表和表头行，只能映射游戏字段列。
2. 在预览中检查游戏昵称、阵营、角色池、段位，逐个勾选可公开队员。
3. 下载 team-roster.json，放入仓库 data 目录。可留空的 rank 不应填个人数据。
4. 选择队徽和二维码原图，通过工具按网站需要的名称下载，放入 assets 目录。
5. 提交后 GitHub Actions 自动验证并生成独立队员页、发布网站。

原始收集表不会加入导出数据。页面不提供网络上传接口，工具页的 CSP 禁止数据连接和提交表单。

## 图片

只使用上传的原图。不仿制队徽或二维码。当前运行环境无法获取附件字节，故原图尚未接入。图片未接入时，页面显示 HNUST 文字队标与公开群号。

图片名称见 assets/README.md。只打包已列出的队徽和二维码图片，原始收集表不进入托管产物。

## 本地开发

`python -m unittest discover -s scripts -p test_public.py -v`
`python scripts/build.py`
`python -m http.server 8000 --directory dist`

在浏览器打开 http://localhost:8000 。部署只上传 dist，不上传项目源文件。网站 CSS 支持移动端和减少动画偏好；队员信息通过 textContent 渲染。

## 资料来源

- 队伍存在、社群选拔路径、队徽与社群二维码：网站维护者提供。
- 学校名称与校训：https://www.hnust.edu.cn/xxgk/xxbz/xx/index.htm
- 第五人格官方站点：https://www.identity-v.com/
- IVL 官方链接：https://ivl.163.com/
- 表格解析器文档：https://docs.sheetjs.com/docs/getting-started/installation/standalone/

网络搜索没有找到足以核实 HNUST 校队历史战绩的资料，因此不填赛事成绩、时间表、队员数量。外部资料与队伍自身资料分别处理，学校官网链接不代表学校管理本网站。

## 验证状态

部署工作流执行公开字段检查、敏感联系方式检查、独立页面路径与标题转义检查，然后构建并发布。实际界面仍需浏览器访问确认；当前会话没有浏览器或本地文件执行工具。
