# 自有服务器部署

当前地址：https://island.ydgui.com/（原 HTTP 地址自动跳转）
SSH：`ssh -i ~/.ssh/id_rsa ubuntu@43.135.170.243`。root 不接受此密钥。

- 服务：Nginx 443 HTTPS → Docker 容器 daily-island（127.0.0.1:8787）；80 用于跳转和证书验证。
- 镜像：daily-island:music-20261027T102315Z-nav；重启策略 unless-stopped。
- 当前发布文件：/home/ubuntu/daily-island-music-20261027T102315Z-nav。旧发布目录保留。
- 持久化数据：/opt/daily-island/data（d1 SQLite、r2 照片文件）。更新镜像不应删除这个目录。
- 登录沿用项目的 Alexx / BV 密码登录，首次使用由本人设置密码。未复制本机预览数据库或照片。
- 使用 HTTPS 域名访问并登录；登录会话 Cookie 设置 Secure、HttpOnly 和 SameSite=Lax。

## island.ydgui.com 域名与 HTTPS（2026-10-25）

腾讯云 DNSPod 的域名状态已恢复为 `enable`。子域名 `island` 的 A 记录指向 `43.135.170.243`（记录 ID `2437193446`，TTL 600）。根域名不用于本网站；本次临时添加的 `@` 解析已撤回，原有其他子域名记录未修改。权威及公共 DNS 已验证，公网 HTTPS 和 HTTP/2 正常，HTTP 保留路径和查询参数并以 308 跳转至 `https://island.ydgui.com`。

证书由 Let's Encrypt 签发，覆盖 `island.ydgui.com`，使用 ECDSA；本次证书到期时间为 `2027-01-24 03:46:20 UTC`。完整证书链及私钥仅保存在服务器 `/etc/letsencrypt/live/island.ydgui.com/`。Nginx 开启 TLS 1.2/1.3，保留既有静态资源、应用代理和独立 `/topic-wheel/` 路由。HTTPS 启用前的 HTTP 配置备份为 `/etc/nginx/backups/daily-island.pre-https-20261026T043929Z`。

Certbot 使用 webroot HTTP-01 验证，目录为 `/var/www/letsencrypt`。80 端口的 `/.well-known/acme-challenge/` 不跳转，`certbot.timer` 已启用。`deploy/renew-nginx.sh` 已安装至 `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx`（0755），证书续期后先检查 Nginx 配置再重载。`sudo certbot renew --dry-run --run-deploy-hooks --cert-name island.ydgui.com --no-random-sleep-on-renew` 已通过，包括重载钩子；后续真实续期由定时器执行。

Nginx 必须覆盖设置 `MF-Original-URL $scheme://$host$request_uri`：当前 Miniflare 不会仅凭 `X-Forwarded-Proto` 恢复 HTTPS 请求 URL，缺少此设置会使同源校验拒绝登录请求，也无法正确生成 Secure Cookie。上游端口只绑定本机，外部请求提供的原始 URL 头会被代理覆盖。

已验证首页、走廊、心情、相册、独立轮盘和身份接口返回 200，页面引用的 11 个站内 JS/CSS 资源正常；HTTPS 同源校验、跨域拒绝、原始 URL 头覆盖及匿名退出响应的 Secure/HttpOnly Cookie 均通过。浏览器可正常显示 HTTPS 登录页，未代填用户账号或密码。本次仅修改域名和代理配置，应用镜像、数据库及照片未变更。重新部署到新服务器时，应先签发证书，再启用包含证书路径的 `deploy/nginx.conf`。

运行方式：构建后的 Worker 由 Miniflare/workerd 执行，不运行 Vite 或 Wrangler 开发服务器。D1/R2 使用 Miniflare 本地兼容实现，并非 Cloudflare 托管资源。这是单机兼容部署，尚未替换为独立的生产数据库和对象存储服务。

本地使用 Node >=22.13 构建：`node node_modules/vinext/dist/cli.js build`。上传 dist、drizzle、deploy 和 package.json/package-lock.json 后，在发布目录运行：

```sh
sudo docker build -f deploy/Dockerfile -t daily-island:performance .
sudo docker stop daily-island
sudo docker rm daily-island
sudo docker run -d --name daily-island --restart unless-stopped --init \
  -p 127.0.0.1:8787:8787 -v /opt/daily-island/data:/data \
  --memory=1g --cpus=1.5 daily-island:performance
```

启动时按文件名执行 drizzle SQL，迁移名写入 deployment_migrations，已执行的迁移不会重复执行。新增迁移必须使用新文件名。备份数据前先停止容器，完整归档 /opt/daily-island/data 后启动容器；恢复时同样需要停止容器。

检查：`sudo docker logs --tail 50 daily-island`、`sudo docker ps`、`curl https://island.ydgui.com/api/identity`。

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

## 静态资源加速

构建后运行 `node scripts/optimize-server-assets.mjs`，生成 AVIF/WebP 图片及 gzip JS/CSS/字体/模型。上传 dist 后，在服务器执行：

```sh
sudo mkdir -p /var/www/daily-island/static
sudo cp -a ~/daily-island-release/dist/client/. /var/www/daily-island/static/
sudo chmod -R a+rX /var/www/daily-island/static
sudo cp ~/daily-island-release/deploy/nginx.conf /etc/nginx/sites-available/daily-island
sudo nginx -t && sudo systemctl reload nginx
```

Nginx 根据 Accept 请求头优先提供 AVIF，其次提供 `.png.webp` / `.jpg.webp`，不支持时回退原图；透明图片保留 WebP 的无损 alpha；两种响应均带 `Vary: Accept`。图片尺寸和透明通道保留。公开 art/fonts/models 缓存 7 天，带构建哈希的 JS/CSS 缓存一年。私人照片仍通过 API 登录校验，不进入公共静态目录。HTML 和身份接口不设公共缓存。

手写字体使用 WOFF2 Unicode 子集，保留原字体的全部 7015 个 Unicode 映射；常用界面字符优先放入一个约 122 KB 的子集，其余字符按需加载。重新生成：在独立 Python 环境安装 `fonttools[woff]`，运行 `python scripts/optimize-fonts.py`，然后重新构建。游戏屋字体保留全部字符，转换为 WOFF2。

静态目录保留旧构建的哈希文件，以便已经打开的页面继续工作。每次发布应用时都要同步静态目录，避免新 HTML 引用不存在的 JS/CSS。应用容器与数据挂载方式保持不变。

本次优化前镜像保留为 `daily-island:before-performance`，旧容器 `daily-island-before-performance` 已停止，必要时可停止当前容器后用旧镜像挂载同一数据目录恢复。

## 2026-10-25 媒体室

当前应用镜像 `daily-island:media-20261025`，发布目录 `/home/ubuntu/daily-island-media-20261025`。入口 `/media` 与游戏屋按钮。独立下载镜像 `daily-island-media:20261025`，发布目录 `/home/ubuntu/daily-island-media-room-20261025`，容器 `daily-island-media`，host network 下仅监听 `127.0.0.1:8792`。Nginx 分别代理 `/api/media/` 和 `/media-stream/`。

持久化媒体目录 `/opt/daily-island/media`（uid/gid 1000），含 SQLite 和视频，更新镜像需保留。该容器限制 768 MB 内存、1 CPU、128 进程，去除 Linux capabilities 并启用 no-new-privileges。运行命令：

```sh
sudo docker run -d --name daily-island-media --restart unless-stopped \
  --network host --memory=768m --cpus=1 --pids-limit=128 \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -e MEDIA_ORIGIN=https://island.ydgui.com \
  -e MEDIA_AUTH_URL=http://127.0.0.1:8787/api/identity \
  -v /opt/daily-island/media:/data daily-island-media:20261025
```

主应用继续挂载原来的 `/opt/daily-island/data`，本次没有新增业务数据库迁移。切换前备份为 `/opt/daily-island/backups/data-media-20261026T051732Z.tar.gz`，保留旧容器 `daily-island-before-media-20261026T051732Z`。Nginx 配置备份 `/etc/nginx/backups/daily-island.pre-media-20261026T051732Z`。新静态资源已同步，保留旧哈希文件和图片变体。

已核对：`/media`、`/games`、`/river`、`/album`、身份接口 HTTP 200，媒体管理匿名请求 401，媒体页面引用的 12 个 JS/CSS 均为 200；Nginx 配置通过。功能限制和本机授权下载后的管理员导入方式见 `docs/media-room.md`。平台下载测试结果须区分服务器网络、浏览器登录态和文件完整性。

媒体正式验收已通过：完整授权视频已导入，公网 MP4 的 HEAD 和开头/中间/末尾 Range 内容校验正常，浏览器线上播放正常。原始平台的地区/登录限制仍适用于后续服务器下载；本次会员视频通过用户授权的本机登录会话下载后导入。临时签名下载元数据已清理，浏览器 Cookie 未复制到服务器。

## 2026-10-27 首页双人标题

首页标题更新为 `Flash & Octopus’s little island` / `Flash 和章鱼的小岛`，显示名按用户最终选择使用 Flash 和章鱼，英文 Octopus；标题进一步缩小字号，保留换行。

本次从线上 `daily-island:media-20261025` 镜像提取构建文件，仅替换首页中英文标题和标题 CSS；为浏览器 JS/CSS 生成新 URL 并同步引用与预压缩资源，保留现有线上功能和数据。当前镜像 `daily-island:names-20261027T095758Z`，发布目录 `/home/ubuntu/island-title-20261027T095758Z`，前一容器 `daily-island-before-names-20261027T095758Z` 可用于回退。已同步 Nginx 静态资源。源码更新在 `app/page.tsx` 与 `app/island-home.css`；后续常规构建会保留这两处修改。

首页标题现已按用户要求固定两行：名字在第一行，little island / 小岛在第二行，使用换行文本及 white-space:pre-line。

## 2026-10-27 全局音乐与角色更新

发布全局背景音乐、9 首完整 M4A 音频、播放图标轻动画、跨页面连续播放，以及最新 VRM 角色、首页标题和媒体室源码。当前镜像及目录见文件顶部。为避免并行编辑和构建覆盖发布文件，最终产物由 Git 暂存树的独立源码快照构建。

生产浏览器验收发现当前 Vinext Link 的动态导航导出在打包后被重命名，已使用 `IslandLink` 静态导入路由器修复。已在公网浏览器确认播放、拖动进度、进入心情页和返回首页，音乐保持连续且无需重新登录。

Nginx 新增 `/music/` 静态服务；9 首音频的 HEAD 长度、首段/中段/末段 Range 206 和字节内容均核对。发布目录及 Nginx 静态目录中的全部构建文件 SHA-256 与本地独立构建一致。音频文件按 `.gitignore` 单独部署，来源和校验见 `docs/music-sources.json`，恢复构建时需同时恢复这些文件。

最终切换前备份：`/opt/daily-island/backups/data-music-20261027T102315Z-nav.tar.gz`；初次发布前原版本备份：`/opt/daily-island/backups/data-music-20261027T102315Z.tar.gz`。原首页标题版本容器 `daily-island-before-music-20261027T102315Z` 保留用于回退。Nginx 配置备份位于 `/etc/nginx/backups/daily-island.pre-music-20261027T102315Z`。本次没有新增数据库迁移，209 条记录、2 个账号保留；现有媒体服务代码与本地哈希一致，无需重新部署媒体容器。

验证：类型检查与生产构建通过，27 项前端测试和 7 项媒体服务测试通过；7 个公开页面、身份与匿名受保护接口、页面引用的 JS/CSS、全部音乐 Range 均通过检查。现有图片压缩变体和旧哈希资源保留。
