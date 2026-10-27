# 媒体室

入口：游戏屋 → 媒体室，或 `/media`。沿用小岛登录，支持中英文。粘贴 Bilibili（BV/av/单集/b23 短链）或 YouTube（watch/shorts/youtu.be）视频链接，任务在服务器后台排队，离开页面后继续。完成后可播放、拖动进度、复制播放链接；支持取消、重试和删除。

## 下载与存储

- 独立 Python/FastAPI 服务与 yt-dlp、FFmpeg；串行队列最多 5 个等待/运行任务。
- 单部最高 1080p、2 GiB、3 小时；媒体总额 20 GiB，另外保留 5 GiB 服务器磁盘空间。
- 数据在 `/opt/daily-island/media`：SQLite 任务库与每个任务独立目录内的 MP4。与原来的 D1/R2 分开。
- H.264/AAC 兼容文件直接封装，否则转换；MP4 faststart 支持开始播放及 HTTP Range 拖动。
- 完成前核对实际文件时长，明显短于页面时长的试看片段/不完整视频会失败并清理。
- 重启恢复中断任务；运行中取消需先停止子进程，再清理文件并允许重试。
- 链接使用随机令牌。拥有链接的人可播放，删除视频会让旧链接失效；不要把私人视频链接发给不希望访问的人。

## 平台限制

服务器不保存用户的平台登录信息。会员、地区限制和平台验证可能导致下载失败，错误会显示在片单。已购买不代表服务器自动获得浏览器的登录状态。

用户明确授权使用本机现有登录会话时，可以先在本机下载本人可访问的视频，确认完整时长后，仅把视频文件导入服务器。登录信息和带签名的下载元数据留在本机，不进 Git，也不传到服务器。服务不解密 DRM 内容。

管理员导入已取得的 H.264/AAC MP4：

```sh
# 把文件放入媒体挂载目录的 incoming/，并确保容器 uid 1000 可读取。
sudo docker exec daily-island-media python import_video.py /data/incoming/video.mp4 \
  --title '视频标题' --source '原始 Bilibili 或 YouTube URL' --expected-duration 120
```

导入成功后移除 incoming/ 临时文件。导入脚本重新核对时长、大小、编解码器及配额，并以 `local-import` 标记来源，不冒充某个登录身份。

## 接口与验证

- `/api/media/jobs` GET/POST：片单与新增任务。
- `/api/media/jobs/:id/cancel`、`/retry` POST；`/api/media/jobs/:id` DELETE。
- `/media-stream/:random-token.mp4` GET/HEAD：仅已完成文件，支持 Range。
- 管理接口向主应用 `/api/identity` 验证当前会话；写操作验证同源。输入 URL 仅允许指定平台和单视频路径，不接受任意服务器地址。
- 本地 Vite 代理媒体路径至 `127.0.0.1:8792`；上线由 Nginx 代理，下载端口仅监听本机。流地址不写 Nginx 访问日志。

测试：在独立 Python 环境安装 requirements.txt 和 httpx，执行 `python services/media-room/test_server.py`。涵盖登录/来源校验、非法 URL、取消重试、重复任务、配额、试看拒绝、Range、删除撤销和失败清理。浏览器隔离测试使用独立 D1/R2 和带 QA 标记的样片，不写正式账号数据。

本次验收中，所给 Bilibili 单集在服务器返回地区限制；匿名本机请求只得到 6 分钟试看，已增加完整时长检查。得到用户授权后，本机使用已有 Chrome 登录会话取得完整片源（约 7162.645 秒），不向服务器复制浏览器 Cookie。普通服务器下载与本机授权导入是两条不同路径；前者仍受平台地区、会员和验证规则影响。

上线验收补充：授权取得的完整视频已完成 H.264/AAC 转换并导入正式媒体库，文件 1,263,310,172 字节、时长 7162.645 秒。本机与服务器暂存文件 SHA-256 一致；公网 HEAD 为 200，开头/中段/末尾三个 Range 请求均为 206 且内容与服务器文件一致。已在正式网站的已登录 Chrome 页面播放，片单与复制链接操作正常；实际画面和测试记录在本地忽略目录 `outputs/media-room/`，不提交视频、令牌或登录信息。
