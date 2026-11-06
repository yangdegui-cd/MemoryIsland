#!/usr/bin/env python3
"""Read account-attributed audit events from a local/server SQLite database."""
import argparse
import datetime as dt
import json
from pathlib import Path
import sqlite3
from zoneinfo import ZoneInfo

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--db', type=Path, help='Exact SQLite database path')
parser.add_argument('--data-dir', type=Path, default=Path('/opt/daily-island/data'))
parser.add_argument('--user', help='Authenticated account ID or name, e.g. BV')
parser.add_argument('--date', help='Calendar date in Asia/Shanghai: YYYY-MM-DD')
parser.add_argument('--visits', action='store_true', help='Only visible page views and returns')
parser.add_argument('--include-attempts', action='store_true', help='Also show attempts targeting this identity; these do not prove a visit by that person')
parser.add_argument('--limit', type=int, default=100)
parser.add_argument('--json', action='store_true')
args = parser.parse_args()
if not 1 <= args.limit <= 1000:
    parser.error('--limit must be between 1 and 1000')
zone = ZoneInfo('Asia/Shanghai')
databases = [args.db] if args.db else list(args.data_dir.rglob('*.sqlite'))
connections = []
for path in databases:
    connection = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_events'").fetchone():
        connections.append(connection)
    else:
        connection.close()
if len(connections) != 1:
    parser.error('Expected exactly one audit database; specify --db. Historical access logs cannot be backfilled as verified identities.')
connection = connections[0]
connection.row_factory = sqlite3.Row
filters, values = [], []
if args.user:
    clause = '(lower(actor_id)=? OR lower(actor_name)=?'
    values.extend([args.user.lower()] * 2)
    if args.include_attempts:
        clause += ' OR lower(subject_id)=?'
        values.append(args.user.lower())
    filters.append(clause + ')')
if args.date:
    try:
        day = dt.date.fromisoformat(args.date)
    except ValueError:
        parser.error('--date must be YYYY-MM-DD')
    start = dt.datetime.combine(day, dt.time(), zone)
    end = start + dt.timedelta(days=1)
    filters.append('created_at>=? AND created_at<?')
    values.extend([int(start.timestamp()*1000), int(end.timestamp()*1000)])
if args.visits:
    filters.append("action IN ('page.view','page.resume') AND outcome='success'")
where = ' WHERE ' + ' AND '.join(filters) if filters else ''
rows = connection.execute('SELECT * FROM audit_events' + where + ' ORDER BY created_at DESC, id DESC LIMIT ?', [*values, args.limit]).fetchall()
events = []
for row in rows:
    event = dict(row)
    event['time_beijing'] = dt.datetime.fromtimestamp(event['created_at']/1000, zone).isoformat(timespec='seconds')
    event['details'] = json.loads(event['details'])
    events.append(event)
if args.json:
    print(json.dumps(events, ensure_ascii=False, indent=2))
else:
    print('北京时间 | 已验证账号 | 事件 | 结果 | 页面/接口 | 目标记录')
    for event in events:
        actor = event['actor_name'] or '未验证'
        subject = f" (尝试身份: {event['subject_id']})" if not event['actor_id'] and event['subject_id'] else ''
        print(f"{event['time_beijing']} | {actor}{subject} | {event['action']} | {event['outcome']} ({event['status']}) | {event['path']} | {event['target_id'] or '-'}")
    if not events:
        print('没有匹配的审计记录；这不等于此前没有访问。')
connection.close()
