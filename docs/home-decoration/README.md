# 首页模块化背景验收

## 审计
原首页无背景素材、独立色块、周边贴纸及散落小球的实现；保留通用 body 渐变和 machine-stage 卡片。插入点为首页抽取状态的 app-shell 和 gacha-wrap 外层。

## 改动
- src/App.jsx：首页条件背景 picture，机器场景容器，渐变地面、2 个色块、7 个贴纸。
- styles.css：首页专用样式，响应式素材切换对应布局，全屏背景、装饰层级、柔化地面边缘及双层模糊接触阴影。
- public/images/bg/、public/images/decor/：引用用户提供的 12 张 PNG，未修改素材；这些目录在任务开始时即为未跟踪文件。
- docs/home-decoration/：完整截图、源码 diff 与此验收记录。

## 验证
- Vite production build 通过；现有测试 70/70 通过；git diff --check 通过。
- 1440×1000、390×844 浏览器完整截图见同目录 PNG。Web 完整页面高度为 1096px（含原布局底部导航预留空间）。
- 320、390、768、1024、1440px 宽度均无横向溢出，两个色块的外接矩形均位于 stage-copy 底部以下。
- 390px 使用 background-mobile.png；1440px 使用 background-web.png。
- 图片全部加载成功，无 Vite 错误覆盖层，浏览器 errors 为空。
- 色块 z-index: 1，贴纸 z-index: 2；所有装饰不接收指针事件。
- 切换至添加任务页后首页背景卸载，home-scene 样式不再生效。
- 散落小球原实现已撤销，本次未新增；任务、登录逻辑未修改。
