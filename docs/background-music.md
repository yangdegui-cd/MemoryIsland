# 全局背景音乐

播放器挂在 `app/layout.tsx` 的共享身份容器中。所有站内入口使用 `IslandLink` 的客户端路由，页面切换保留同一个 audio 元素、当前歌曲和进度。退出身份会销毁播放器。当前 Vinext 的生产版 Link 动态导入内部导航导出时会因打包重命名报错，因此通过静态导入 `useRouter` 实现同源链接跳转；保留修饰键、新窗口、下载和调用方取消点击的原生行为。

首次进入随机选择可播放歌曲；播放完随机切换到不同歌曲。浏览器拒绝自动播放时，下一次点击或键盘操作继续尝试。手动暂停和音量只保存在本机偏好中，业务记录仍由服务器保存。播放有声音的视频时音乐暂歇，结束后按之前的播放意愿恢复。全屏时操作面板移动到全屏容器，audio 本身不重新挂载。

右下角音乐图标打开歌单，支持选择歌曲、上一首、随机下一首、暂停、拖动进度与音量。播放时音符轻微摇摆，圆点缓慢呼吸；暂停或系统启用减少动态效果时静止。

## 音频部署

下载音频放在 `public/music/*.m4a`，构建复制到 `dist/client/music/`，发布后同步到 Nginx 的 `/var/www/daily-island/static/music/`，由 Nginx 提供缓存和 Range 请求。音频文件被 Git 忽略，构建前需从发布备份恢复；不要只检出源码就覆盖正在运行的音频目录。下载 Cookie、临时签名 URL 和完整下载元数据不进入源码或服务器。

`docs/music-sources.json` 记录已落地的 20 首音频的来源、时长、大小与 SHA-256。采用来源自身的 MV/PV 或歌曲版本，不把试听片段冒充完整版。20 首均已落地为完整音频文件，不依赖浏览器中的第三方音乐登录。

## 2026-11-01 歌单补充

新增 No Hands、天堂、Chicago、Sweet Dreams、Dissociation、You Rock My World，保留聊天分享的原始链接版本。《天堂》采用腾格尔《歌手2018》完整现场版本，《Sweet Dreams》采用 THEN 的 Cinematic Techno 版本。既有 9 首仍保留，歌单共 15 首。

## 验证

Node 22：`node --experimental-transform-types --test tests/music-playback.test.mjs`。覆盖自动播放被拦截、手动暂停、视频互斥恢复、异步切歌竞争、随机续播与卸载清理。对全部音频运行 FFmpeg 完整解码校验；播放器仍须使用真实浏览器检查切歌、场景切换及小屏布局。

## 2026-11-02 原视频入口

新增伍佰 & China Blue《挪威的森林》官方 MV 音频、Jolie Lyrics 的 Dance Monkey 合辑（原链接完整约 15 分 29 秒）、Hillsong Young & Free 的 Wake（Live from Summercamp）、P!NK 的 Try（Live from Los Angeles）以及 Far Away From Home（用户分享的环球视听1980版本），歌单共 20 首。每行右侧提供中英文“原视频 / Video”链接，保留分享的 YouTube 或 Bilibili 版本，在新标签页打开。来源链接与选歌按钮相互独立，打开来源不会切歌或重置播放进度。
