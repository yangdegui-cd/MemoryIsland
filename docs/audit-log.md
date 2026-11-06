# 账号活动审计

服务端将事件追加到持久化 D1 的 `audit_events` 表，UTC 毫秒存储，查询工具统一按北京时间显示。服务器原有数据备份包含此表。

- `auth.setup` / `auth.login`：首次设置、密码登录；仅成功验证后才填写 `actor_id`。失败尝试中 `subject_id` 是试图登录的身份，不能当作该本人访问。`reason` 区分错误密码、锁定、未知身份和跨站请求。
- `auth.password_reset` / `auth.logout`：重设密码、主动退出；保留操作时的已验证账号和不可用于登录的会话指纹。退出不会删除历史。
- `identity.check`：检查记住的登录状态，可能由前端自动刷新发起，不代表密码登录或用户阅读。
- `page.view`：登录后的可见页面初次打开或切换；`page.resume`：页面隐藏至少一分钟后恢复可见。不会用资源加载、预取、后台心跳推算访问/阅读时长。同一账号同一事件 ID 的重试只保存一次。
- `record.*`、`mood.unlock_all`：查询、新增、修改、删除、批量解锁；记录实际操作者，而非记录原作者。幂等重放标记为 `record.replay`。
- `photo.*`、`people.update`、`api_key.*`、`api.chat.*` / `api.photo.*`：照片、分享开关、时区设置、API 密钥管理及存储 API 操作；API 调用单独标注 `api_key` 来源。

记录 HTTP 状态/成功或拒绝、服务端时间、账号、页面/接口、记录编号、经 Nginx 覆盖的来源 IP、浏览器信息。只保留固定字段；不保存密码、Cookie、密钥值、分享链接令牌、查询参数或笔记/聊天/照片内容。页面由浏览器上报，账号由服务端会话验证；只能证明该账号会话发起活动，不能证明操作者本人的物理身份。独立媒体服务的下载/播放操作不经过此审计入口，但进入媒体页面会记录。

数据库写日志失败时，不改变已经完成的业务响应，服务进程输出 `audit.write_failed`，避免用户重复提交。此信号应和应用运行日志一起检查。

## 网页查看

登录后打开 `/activity`，或在身份设置里选择「活动记录」。Alexx 和 BV 均可查看两人的活动，支持账号、北京时间日期、活动类型筛选及分页。默认隐藏后台身份检查和读取请求；选择「全部日志」可查看。

`GET /api/audit` 只允许这两个已登录账号读取，响应禁止缓存。接口返回显示所需的账号、时间、事件、结果、页面和有限说明，不返回 IP、User-Agent、会话指纹、API 密钥 ID 或原始详情。按某个账号筛选只匹配已验证身份；未验证的登录尝试可在「全部 → 登录与安全」查看，尝试名字不会被当作操作者。

查询参数：`actor=all|alexx|bv`、`view=activity|visits|auth|all`、`date=YYYY-MM-DD`、`limit=1..100`、`cursor`。默认每页 50 条，按时间和事件 ID 倒序；翻页使用相同筛选条件。

## 服务器查询

在当前发布目录执行（需要数据库读取权限）：

```sh
sudo python3 scripts/audit-log.py --user BV --visits --limit 30
sudo python3 scripts/audit-log.py --user BV --date 2026-11-06
sudo python3 scripts/audit-log.py --user BV --include-attempts --json
```

`--user BV` 默认仅匹配**已验证为 BV**的事件。加 `--include-attempts` 才会同时显示试图使用 BV 身份的失败/识别请求。`--db` 可指定数据库文件，默认从 `/opt/daily-island/data` 中发现唯一审计数据库。连接启用 SQLite `query_only`，禁止修改数据；SQLite 可能创建读取 WAL 所需的辅助文件。

日志从本次部署起生效；过去只有 IP/浏览器的访问不会补写成确定身份。
