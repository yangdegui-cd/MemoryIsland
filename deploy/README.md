# 自有服务器部署

当前地址：http://43.135.170.243/
SSH：`ssh -i ~/.ssh/id_rsa ubuntu@43.135.170.243`。root 不接受此密钥。

- 服务：Nginx 80 → Docker 容器 daily-island（127.0.0.1:8787）。
- 镜像：daily-island:20261022；重启策略 unless-stopped。
- 发布文件：/home/ubuntu/daily-island-release。
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
