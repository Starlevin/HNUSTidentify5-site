# 清寒 · Starlevin

清寒的个人主页：个人介绍、项目进展与近期状态。原生 HTML、CSS、JavaScript，支持手机浏览、明暗主题与键盘导航。

## 发布网站

源码已经准备好。第一次发布需要在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

如果初次工作流因为 Pages 尚未开启而失败，开启后在 **Actions → Deploy to GitHub Pages → Run workflow** 运行一次。

部署成功后访问 https://starlevin.github.io/qinghan-site/ 。

每次更新 `main` 分支都会自动发布。网站内容本身是公开的。

## 修改内容

- `index.html`：简介、项目、近期状态和链接。
- `styles.css`：配色、布局、响应式样式。
- `app.js`：主题、导航和动画。

项目状态是展示文字。私有项目暂不放下载链接；日后公开时可补上真实地址。

## 本地预览

无需构建。可以直接在浏览器中打开 `index.html`，或在项目目录运行 `python -m http.server 8000`，然后访问 http://localhost:8000 。

## 资源与验证

字体使用系统字体；头像来自 GitHub，加载失败时显示 Q 标识。已经检查文件路径、页内锚点，并用模拟浏览器对象验证主题切换和菜单交互，包括浏览器禁止本地存储的情况。当前会话没有浏览器执行工具，尚未进行实际浏览器截图验证。
