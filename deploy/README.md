# 自有服务器部署

当前地址：http://43.135.170.243/
SSH：`ssh -i ~/.ssh/id_rsa ubuntu@43.135.170.243`。root 不接受此密钥。

- 服务：Nginx 80 → Docker 容器 daily-island（127.0.0.1:8787）。
- 镜像：daily-island:corridor-20261022；重启策略 unless-stopped。
- 当前发布文件：/home/ubuntu/daily-island-update-20261022-corridor。旧发布目录保留。
- 持久化数据：/opt/daily-island/data（d1 SQLite、r2 照片文件）。更新镜像不应删除这个目录。
- 登录沿用项目的 Alexx / BV 密码登录，首次使用由本人设置密码。未复制本机预览数据库或照片。
- 当前是 HTTP；配置域名和 HTTPS 后再正式录入密码和私人内容。

运行方式：构建后的 Worker 由 Miniflare/workerd 执行，不运行 Vite 或 Wrangler 开发服务器。D1/R2 使用 Miniflare 本地兼容实现，并非 Cloudflare 托管资源。这是单机兼容部署，尚未替换为独立的生产数据库和对象存储服务。

本地使用 Node >=22.13 构建：`node node_modules/vinext/dist/cli.js build`。上传 dist、drizzle、deploy 和 package.json/package-lock.json 后，在发布目录运行：

```sh
sudo docker build -f deploy/Dockerfile -t daily-island:20261022 .
sudo docker stop daily-island
sudo docker rm daily-island
sudo docker run -d --name daily-island --restart unless-stopped --init \
  -p 127.0.0.1:8787:8787 -v /opt/daily-island/data:/data \
  --memory=1g --cpus=1.5 daily-island:20261022
```

启动时按文件名执行 drizzle SQL，迁移名写入 deployment_migrations，已执行的迁移不会重复执行。新增迁移必须使用新文件名。备份数据前先停止容器，完整归档 /opt/daily-island/data 后启动容器；恢复时同样需要停止容器。

检查：`sudo docker logs --tail 50 daily-island`、`sudo docker ps`、`curl http://127.0.0.1/api/identity`。

## 2026-10-22 时光走廊更新

已发布日历传送按钮、紧凑双语聊天、2K 渲染修复，并通过独立迁移 `20261022_corridor_chat_archive.sql` 导入 2537 条聊天。聊天正文只存在本地忽略目录的发布包与服务器数据库中。

切换前完整数据备份：`/opt/daily-island/backups/data-20261022T132054Z.tar.gz`。旧容器：`daily-island-before-corridor-20261022T132054Z`，已停止，保留用于回退。现有账号和业务记录保留，Nginx 配置未改动。

已验证首页、`/river`、`/album`、`/api/identity` 返回 200；未登录聊天接口返回 401；数据库聊天总数 2537。
## Nginx 静态资源同步（每次发布必须执行）

服务器 Nginx 的静态根目录是 `/var/www/daily-island/static`，独立于 Docker 镜像。发布后将本次 `dist/client/` 内容复制到该目录，保留旧哈希文件，不清空目录。仅更换镜像会造成新 HTML 引用的新 JS/CSS 全部 404，页面可见但轮盘等交互失效。保留现有图片压缩变体，注意同名预压缩文件是否过期。

本次已补齐静态资源，并检查 43 个 JS/CSS 文件全部返回 200。
## 2026-10-22 心情身份锁定更新

当前镜像 `daily-island:mood-privacy-20261022`，发布目录 `/home/ubuntu/daily-island-mood-privacy-20261022`。已同步 Nginx 独立静态目录，43 个 JS/CSS 全部正常，`/mood` 返回 200。

切换前备份 `/opt/daily-island/backups/data-20261022T141621Z.tar.gz`，旧容器 `daily-island-before-mood-privacy-20261022T141621Z` 保留。3 篇心情、2537 条聊天记录保留。本次无需数据库迁移。
