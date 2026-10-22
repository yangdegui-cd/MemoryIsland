# 后端与数据库

React 19 + Vinext + Cloudflare Workers + D1 SQLite + Drizzle ORM + R2照片存储。

接口源文件：app/api/records/route.ts。表结构：db/schema.ts。迁移：drizzle/。

## API

- GET /api/records：当前用户全部记录；可使用 ?kind=diary|mood|habit|wish|wheel|spin。
- POST /api/records：JSON {kind,data,id?}；没有id新增，带id更新当前用户拥有的同类型记录。
- DELETE /api/records：JSON {id}；删除当前用户拥有的记录。

records表字段：id、user_id、kind、data(JSON)、created_at。

所有接口要求平台注入 oai-authenticated-user-id；未登录返回401。所有数据库操作限制当前用户。写入校验来源、类型、必填字段和长度；读取设置no-store。生产私人站点限制访问者。本地使用starter提供的模拟登录，不能将该身份头机制直接放到允许任意客户端伪造请求头的普通服务器。

## 范围说明

当前支持文字记录和抽取历史。照片上传见docs/album.md。没有多人联机和多设备编辑冲突合并。日历日期来自浏览器本地时间；心情同日期更新由前端定位已有记录，不保证跨标签页同时新增时唯一。轮盘属于娱乐用途，结果由浏览器抽取并保存到后端，不用于可信竞赛或奖品发放。

## 本地启动

Node >=22.13，npm ci，npm run db:generate，npm run build。再按README执行本地D1迁移后运行 npm run dev。生产数据库与本地数据库独立；Sites发布时应用生产迁移。
