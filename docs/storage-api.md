# 日常小岛 · 存储 API v1

服务地址：https://island.ydgui.com
密钥管理：https://island.ydgui.com/settings/api
在线文档：https://island.ydgui.com/api/v1/docs

通过 HTTP 上传记忆宫殿（回忆相册）图片、保存聊天记录。图片原文件存入 R2，图片元数据与聊天记录存入 D1，和网站使用同一套持久化数据。重新打开或刷新 `/album`、`/river` 即可看到新内容；当前已打开的场景不会实时推送更新。

## 1. 创建 API 密钥

登录小岛，打开「身份设置 → 存储 API 与文档」，或直接进入 `/settings/api`。填写名称、选择权限与有效期，生成并保存密钥。完整密钥只显示一次，服务器仅保存 SHA-256 摘要。每人最多 20 个有效密钥。

权限相互独立：

- `photos:write`：上传图片。
- `photos:read`：列出共享图片、读取原文件。
- `chats:write`：导入聊天。
- `chats:read`：列出、读取共享聊天记录。

密钥属于创建它的身份，读权限可读取 Alexx 与 BV 的共享照片或聊天，不能访问心情、密码等其他资源。有效期默认 90 天，可选 1–365 天。可在管理页撤销；重设本人密码也会使本人旧密钥全部失效，普通退出登录不会使密钥失效。API 密钥不能创建新密钥，也不能用于网站登录。

所有 v1 数据接口使用请求头：

```http
Authorization: Bearer di_你的密钥
```

请在自己的服务器或脚本中使用，不放入公开前端源码、查询参数或 Git。数据接口不接受 Cookie 登录代替 Bearer，也不开放跨域浏览器调用；跨域网页应通过自己的后端调用。HTTPS 部署下使用 HTTPS 地址。

以下命令先设置环境变量（在你自己的终端中填写）：

```sh
export ISLAND_BASE='https://island.ydgui.com'
export ISLAND_API_KEY='di_替换为你生成的密钥'
```

## 2. 上传图片

`POST /api/v1/photos`，权限：`photos:write`。

请求为 `multipart/form-data`，每次一张，客户端自动生成 boundary，不要手工设置 Content-Type。

- `file`：必填，JPEG / PNG / WebP，非空且最多 8 MiB（8,388,608 字节）。根据文件签名检查类型，原字节保存；不自动压缩或修改方向、EXIF。
- `title`：必填，1–120 字符，首尾空白会去掉。
- `date`：必填，有效的 `YYYY-MM-DD` 日期，例如 `2026-10-27`。
- `externalId`：可选，1–160 字符，调用方稳定的去重编号，建议始终填写。

```sh
curl --fail-with-body "$ISLAND_BASE/api/v1/photos" \
  -H "Authorization: Bearer $ISLAND_API_KEY" \
  -F 'file=@/absolute/path/photo.jpg' \
  -F 'title=一起看过的日落' \
  -F 'date=2026-10-27' \
  -F 'externalId=photo-sunset-20261027'
```

首次保存返回 `201`：

```json
{
  "ok": true,
  "replayed": false,
  "item": {
    "id": "api-photo-...",
    "createdAt": 1793059200000,
    "title": "一起看过的日落",
    "date": "2026-10-27",
    "mime": "image/jpeg",
    "size": 123456,
    "authorId": "alexx",
    "externalId": "photo-sunset-20261027",
    "url": "/api/v1/photos/api-photo-...",
    "albumUrl": "/album?photo=api-photo-..."
  }
}
```

`url` 是需要 Bearer 的私有原图地址，不能作为匿名公开图床链接。`albumUrl` 是需要网站登录的相册分享页。

读取原图：`GET /api/v1/photos/{id}`，权限 `photos:read`，成功返回图片二进制和正确的 Content-Type：

```sh
curl --fail-with-body "$ISLAND_BASE/api/v1/photos/替换为返回的id" \
  -H "Authorization: Bearer $ISLAND_API_KEY" -o downloaded-photo.jpg
```

## 3. 导入聊天记录

`POST /api/v1/chats`，权限：`chats:write`，`Content-Type: application/json`。

每次提交一个日期分组，内含 1–500 条消息，整个 JSON 不超过 2 MiB。多个日期分别提交；单日超过 500 条时拆成多个分组，使用不同 externalId 和递增的 part。所有字段先验证，失败不会保存半条记录。

字段：

- `title`：必填，1–120 字符。
- `date`：必填，有效 `YYYY-MM-DD`；时间未知可以写 `undated`，该组不会点亮某个具体日期的门。
- `externalId`：可选，1–160 字符，建议使用 `来源-日期-分段`。
- `part`：可选，0–100000 的整数，用于同日分段顺序，建议从 0 递增。
- `sourceNote`：可选，最多 2000 字符，记录来源与时间说明。
- `messages`：必填，消息数组，数组顺序即聊天显示顺序。

消息字段：

- `role`：必填，`user` / `assistant` / `system`。一般自己用 user，对方用 assistant；这只是显示角色，不会调用 AI。
- `content`：必填，非空字符串，最多 20000 字符。
- `speaker`：可选，1–120 字符的显示名字，如 Alexx、BV。
- `time`：可选，可为 null、`YYYY-MM-DD HH:mm:ss` 或带 Z / 偏移的 ISO 8601 时间。
- `original`、`translation`：可选，原文与译文，各最多 20000 字符；网站可切换显示。
- `note`：可选，最多 2000 字符。

按原样保存时间文本，不自动换时区。`date` 决定属于时光长河哪一天，应由调用方按希望使用的时区计算；不要把接收时间误当发送时间。禁止额外字段（如伪造 authorId），上传者身份由密钥确定。

将下面内容保存为 `chat.json`：

```json
{
  "title": "Alexx · BV",
  "date": "2026-10-27",
  "externalId": "my-chat-20261027-part-0",
  "part": 0,
  "sourceNote": "从自己的聊天备份导入，时间为原始消息时间。",
  "messages": [
    {"role":"user","speaker":"Alexx","time":"2026-10-27 10:00:00","content":"Good morning!","original":"Good morning!","translation":"早上好！"},
    {"role":"assistant","speaker":"BV","time":"2026-10-27 10:00:05","content":"Morning!","original":"Morning!","translation":"早呀！"}
  ]
}
```

```sh
curl --fail-with-body "$ISLAND_BASE/api/v1/chats" \
  -H "Authorization: Bearer $ISLAND_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @chat.json
```

首次保存返回 `201`，格式为 `{ "ok": true, "replayed": false, "item": { "id": "...", "createdAt": 1793059200000, "authorId": "alexx", ...提交的聊天字段 } }`。

读取单组：`GET /api/v1/chats/{id}`，权限 `chats:read`，返回 `{ "item": { ... } }`。导入的数据也会出现在网站现有 `/api/records?kind=chat` 中，无需额外同步。

## 4. 列表与分页

`GET /api/v1/photos` 或 `GET /api/v1/chats`，分别需要对应 read 权限。返回所有共享记录，包括以前通过网页上传或脚本导入的记录。

可选查询参数：

- `limit`：每页 1–50，默认 20。
- `date`：按记录日期筛选。聊天额外接受 `undated`。
- `cursor`：上一页返回的 nextCursor，通过 URL 编码传入，不自行解析或修改。

```sh
curl --fail-with-body -G "$ISLAND_BASE/api/v1/chats" \
  -H "Authorization: Bearer $ISLAND_API_KEY" \
  --data-urlencode 'date=2026-10-27' --data-urlencode 'limit=20'
```

返回 `{ "items": [...], "nextCursor": "...或null" }`。按保存时间倒序，再按 id 倒序稳定分页。nextCursor 为 null 时结束。聊天 items 含完整 messages；图片列表仅含元数据，不含文件内容或内部对象存储路径。

## 5. 重试与去重

externalId 的唯一范围是「创建密钥的身份 + 图片或聊天类别」。同一身份换新密钥仍可去重，两种类别可以使用相同 externalId，不同身份独立计数。

- 相同 externalId 和内容：返回原 id，HTTP 200，replayed=true，不重复保存。图片按原文件字节、标题、日期比较；聊天按验证后的字段和消息内容比较。
- 相同 externalId、不同内容：409，不覆盖旧数据。需要追加聊天时，请为新分段使用新的 externalId。
- 不提供 externalId：每次请求都新增，重试可能产生重复。
- 网络超时或 503：保留 externalId 和原请求内容重试。文件名改变不影响图片去重。

v1 目前提供新增、列表与读取，不提供修改或删除接口。照片可在网页相册内删除；删除后再次提交同一 externalId 会重新创建。聊天暂不提供 API 删除。

## 6. Python 示例

先安装 requests：`python3 -m pip install requests`。密钥从环境变量读取。

```python
import json, os, requests

base = os.environ.get("ISLAND_BASE", "https://island.ydgui.com").rstrip("/")
session = requests.Session()
session.headers["Authorization"] = "Bearer " + os.environ["ISLAND_API_KEY"]

with open("photo.jpg", "rb") as photo:
    result = session.post(base + "/api/v1/photos",
        files={"file": ("photo.jpg", photo, "image/jpeg")},
        data={"title": "一起看过的日落", "date": "2026-10-27",
              "externalId": "photo-sunset-20261027"}, timeout=120)
    result.raise_for_status()
    print(result.json())

with open("chat.json", encoding="utf-8") as file:
    result = session.post(base + "/api/v1/chats", json=json.load(file), timeout=60)
    result.raise_for_status()
    print(result.json())

cursor = None
while True:
    params = {"limit": 20}
    if cursor:
        params["cursor"] = cursor
    response = session.get(base + "/api/v1/chats", params=params, timeout=60)
    response.raise_for_status()
    page = response.json()
    for chat in page["items"]:
        print(chat["id"], chat["date"], len(chat["messages"]))
    cursor = page["nextCursor"]
    if not cursor:
        break
```

## 7. 错误返回

业务错误统一为 JSON：`{ "error": "说明", "details": [{ "path": "messages.0.content", "message": "..." }] }`；details 仅在字段校验失败时存在。

- 400：JSON、字段、日期或 cursor 无效。
- 401：密钥缺失、无效、撤销、过期，或因密码重设失效。
- 403：密钥没有所需权限；管理密钥接口的来源检查失败。
- 404：记录或图片不存在。
- 409：externalId 内容冲突，或密钥数量达到上限。
- 413：文件或请求体过大。
- 415：请求 Content-Type 或图片格式不支持。
- 503：存储暂不可用，可使用相同 externalId 重试。

代理/框架可能先拒绝超大请求并返回 HTML/纯文本 413，请先检查 HTTP 状态再尝试解析 JSON。multipart 总体上限 9 MiB，Nginx 上限 10 MiB，图片本身上限仍为 8 MiB。JSON 上限 2 MiB。

## 8. 密钥管理接口与维护

以下仅接受网站登录 Cookie，写入还要求同源，不接受 Bearer：

- `GET /api/api-keys`：列出本人的密钥元数据，不返回明文或摘要。
- `POST /api/api-keys`：JSON `{ "name":"备份脚本", "scopes":["photos:write","chats:write"], "expiresInDays":90 }`，201 返回 `{id,name,token,scopes,expiresAt}`，token 仅此一次。
- `DELETE /api/api-keys/{id}`：撤销本人的密钥，返回 `{ "ok":true }`。

新增数据库迁移：`drizzle/0002_living_machine_man.sql`。自托管服务 `deploy/server.mjs` 在启动时自动执行尚未应用的迁移；本地开发应将新迁移应用到本地 D1。原 records、users、sessions 以及 R2 文件保留不变。

验证命令（Node 22.13+）：

```sh
npm run build
node tests/storage-api.integration.mjs
```

集成测试在一次性 Miniflare D1/R2 中执行，验证密钥隔离/撤销/过期、图片字节读回、8 MiB 限制、聊天持久化、网页兼容、并发重试、冲突、日期与分页；不连接生产数据。
