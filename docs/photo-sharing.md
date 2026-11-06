# 单张照片分享

在记忆宫殿打开一张已上传的照片，点击右上角「分享」，再点击「生成分享链接」和「复制链接」。收到链接的人无需登录，只能查看这张照片及其标题、日期；不会获得相册、聊天或心情的访问权限。分享面板及公开查看页支持中文和英文。

照片默认不分享。打开分享面板只读取状态，不自动公开。Alexx 和 BV 都可以管理共同相册内照片的分享。点击「关闭分享」后，旧页面和图片地址的新请求都会返回 404；再次生成会获得不同的链接。删除照片也会使分享失效。关闭分享无法收回对方已经保存的照片。

## 接口

以下管理接口使用小岛现有会话登录，写请求还需通过同源校验：

| 请求 | 用途 |
| --- | --- |
| `GET /api/photos/:photoId/share` | 查询状态 |
| `POST /api/photos/:photoId/share` | 创建分享；已开启时返回原链接 |
| `DELETE /api/photos/:photoId/share` | 关闭分享 |

返回 `{"enabled":true,"url":"/share/photos/<token>"}` 或 `{"enabled":false,"url":null}`。URL 为相对路径，由网页使用当前网站域名构成完整链接。

匿名查看使用 `GET /share/photos/:token`；加 `?lang=en` 显示英文。图片使用 `/share/photos/:token/image`，加 `?download=1` 可保存。公开页面为独立 HTML 路由，不经过私有页面的身份选择框。原 `/api/photos/:photoId` 仍需要登录。

`drizzle/0003_photo_shares.sql` 新建分享表，使用 32 字节随机令牌和唯一索引，每张照片最多一个有效链接。不会批量开启已有照片。公开路由按令牌精确关联照片并校验归属、类型和对象存在性，不接受查询参数切换照片。页面转义标题和日期，不返回存储键或其他私有字段。

公开页面和图片响应设置 `no-store`、`no-referrer`、`noindex` 与 CSP。Nginx `/share/photos/` 不记录访问日志，避免日志保存分享令牌；图片不会复制到公共静态目录。

## 验证与部署

使用 Node 22：

```sh
npm run build
node node_modules/typescript/bin/tsc --noEmit
node tests/photo-sharing.integration.mjs
node tests/storage-api.integration.mjs
```

两套集成测试使用临时 D1/R2 数据，不连接正式数据库。分享测试包含匿名/跨域拒绝、默认私密、并发幂等、隔离其他照片、内容转义、匿名图片字节核对、中英切换、关闭和重新生成、删除级联失效。浏览器验收需覆盖生成、复制、未登录查看和关闭后再次访问。

按 `deploy/README.md` 发布构建、迁移和 Nginx 配置。先备份持久化目录；容器启动自动执行新增 SQL。保留现有 D1/R2、媒体室、音频与静态资源，禁止用本地测试数据库覆盖服务器数据。
