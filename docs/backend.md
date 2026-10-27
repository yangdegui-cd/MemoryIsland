# 后端与数据库

React 19 + Vinext + Cloudflare Workers + D1 SQLite + Drizzle ORM + R2照片存储。

接口源文件：app/api/records/route.ts。表结构：db/schema.ts。迁移：drizzle/。

## API

- GET /api/records：当前用户全部记录；可使用 ?kind=diary|mood|habit|wish|wheel|spin。
- POST /api/records：JSON {kind,data,id?}；没有id新增，带id更新当前用户拥有的同类型记录。
- DELETE /api/records：JSON {id}；删除当前用户拥有的记录。

records表字段：id、user_id、kind、data(JSON)、created_at。

网页接口使用 `/api/identity` 登录后的 HttpOnly `island_identity` Cookie，未登录返回 401。Alexx 与 BV 的共享记录使用固定的 pair owner；心情按作者与公开状态过滤。写入校验来源、类型、必填字段和长度，读取设置 no-store。自托管 Nginx 会清除客户端伪造的平台身份头。

外部脚本使用独立 Bearer 密钥调用 `/api/v1/photos` 和 `/api/v1/chats`，不需要复制网页 Cookie。密钥管理在 `/settings/api`，完整接口与示例见 [存储 API 文档](storage-api.md)。API 数据进入现有 D1/R2，支持 externalId 重试去重，密钥不授予心情等其他资源访问权。

## 范围说明

当前支持文字记录和抽取历史。照片上传见docs/album.md。没有多人联机和多设备编辑冲突合并。日历日期来自浏览器本地时间；心情同日期更新由前端定位已有记录，不保证跨标签页同时新增时唯一。轮盘属于娱乐用途，结果由浏览器抽取并保存到后端，不用于可信竞赛或奖品发放。

## 本地启动

Node >=22.13，npm ci，npm run db:generate，npm run build。再按README执行本地D1迁移后运行 npm run dev。生产数据库与本地数据库独立；Sites发布时应用生产迁移。
