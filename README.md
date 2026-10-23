# 日常小岛

有真实后端和D1数据库的生活记录网站，页面独立编写，导航采用独立路由。

| 功能 | 页面 | 独立文档 |
|---|---|---|
| 我的小岛 | / | docs/home.md |
| 回忆相册 | /album | docs/album.md |
| 时光走廊 | /river | docs/river.md |
| 生活手记 | /diary | docs/diary.md |
| 心情日历 | /mood | docs/mood.md |
| 习惯花园 | /habits | docs/habits.md |
| 愿望清单 | /wishes | docs/wishes.md |
| 话题轮盘 | /wheel | docs/wheel.md |

源文件位于app对应目录的page.tsx，共享导航与数据请求在app/components。

后端接口、数据库、登录与部署说明见 docs/backend.md。

## 开发

需要 Node >=22.13。

```sh
npm ci
npm run db:generate
npm run build
```

本地数据库：根据drizzle目录实际生成的迁移文件名执行：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_secret_roughhouse.sql
npm run dev
```

打开终端显示的localhost地址；通过 `/signin-with-chatgpt?return_to=/` 使用本地模拟账号。生产采用真实ChatGPT身份及私人访问策略。生活记录和轮盘抽取历史保存在D1数据库，照片文件保存在R2，不使用浏览器localStorage存储业务记录。
