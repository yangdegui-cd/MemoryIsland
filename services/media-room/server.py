"""Persistent, single-download media queue. Management reuses the island session."""
import contextlib
import http.client
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shutil
import signal
import sqlite3
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit, urlunsplit
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

ROOT = Path(os.environ.get("MEDIA_ROOT", "./media-data")).resolve()
ORIGIN = os.environ.get("MEDIA_ORIGIN", "http://127.0.0.1:5173").rstrip("/")
AUTH = urlsplit(os.environ.get("MEDIA_AUTH_URL", "http://127.0.0.1:8787/api/identity"))
MAX_BYTES = int(os.environ.get("MEDIA_MAX_BYTES", 2 * 1024**3))
QUOTA = int(os.environ.get("MEDIA_QUOTA_BYTES", 20 * 1024**3))
RESERVE = int(os.environ.get("MEDIA_RESERVE_BYTES", 5 * 1024**3))
MAX_DURATION = 3 * 3600
ACTIVE = ("queued", "fetching", "downloading", "processing", "cancelling")
STOP = threading.Event()
WAKE = threading.Event()
LOCK = threading.RLock()
ROOT.mkdir(parents=True, exist_ok=True)


@contextlib.contextmanager
def db():
    con = sqlite3.connect(ROOT / "jobs.sqlite3", timeout=15)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def initialize():
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("""CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY, source_url TEXT NOT NULL, platform TEXT NOT NULL,
          creator TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', state TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0, duration REAL NOT NULL DEFAULT 0,
          size INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
          token TEXT NOT NULL UNIQUE, created REAL NOT NULL, updated REAL NOT NULL
        )""")


def row(job_id):
    with db() as con:
        value = con.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return dict(value) if value else None


def update(job_id, **fields):
    allowed = {"title", "state", "progress", "duration", "size", "error"}
    assert set(fields) <= allowed
    with LOCK, db() as con:
        con.execute("UPDATE jobs SET " + ",".join(f"{k}=?" for k in fields) + ",updated=? WHERE id=?",
                    (*fields.values(), time.time(), job_id))


def normalize_url(raw):
    if not isinstance(raw, str) or len(raw) > 2048:
        raise ValueError("invalid_source")
    match = re.search(r"https?://[^\s<>\[\]（）]+", raw.strip())
    if not match:
        raise ValueError("invalid_source")
    parsed = urlsplit(match.group().rstrip(".,，。)"))
    if parsed.username or parsed.password or parsed.port not in (None, 80, 443):
        raise ValueError("invalid_source")
    host = (parsed.hostname or "").lower()
    if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"}:
        if host.endswith("youtu.be"):
            video_id = parsed.path.strip("/")
        elif parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        else:
            parts = parsed.path.strip("/").split("/")
            video_id = parts[1] if len(parts) == 2 and parts[0] in {"shorts", "embed", "live"} else ""
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            raise ValueError("invalid_source")
        return "https://www.youtube.com/watch?v=" + video_id, "youtube"
    if host in {"bilibili.com", "www.bilibili.com", "m.bilibili.com"}:
        path = parsed.path.rstrip("/")
        if not re.fullmatch(r"/(?:video/(?:BV[A-Za-z0-9]{10}|av\d+)|bangumi/play/ep\d+)", path):
            raise ValueError("invalid_source")
        part = parse_qs(parsed.query).get("p", [""])[0]
        query_string = "p=" + part if part.isdigit() and 0 < int(part) <= 1000 else ""
        return urlunsplit(("https", "www.bilibili.com", path, query_string, "")), "bilibili"
    if host in {"b23.tv", "www.b23.tv"} and re.fullmatch(r"/[A-Za-z0-9]+/?", parsed.path):
        return "https://b23.tv" + parsed.path, "bilibili"
    raise ValueError("invalid_source")


def resolve_short(url):
    if urlsplit(url).hostname != "b23.tv":
        return url
    # Follow only the official short-link response, then validate the destination.
    con = http.client.HTTPSConnection("b23.tv", timeout=15)
    try:
        con.request("GET", urlsplit(url).path, headers={"User-Agent": "Mozilla/5.0"})
        response = con.getresponse()
        destination = response.getheader("Location", "")
        if response.status not in (301, 302, 303, 307, 308):
            raise ValueError("source_unavailable")
        result, platform = normalize_url(destination)
        if platform != "bilibili" or urlsplit(result).hostname == "b23.tv":
            raise ValueError("invalid_source")
        return result
    finally:
        con.close()


def folder_size(path):
    total = 0
    for file in path.rglob("*"):
        try:
            if file.is_file():
                total += file.stat().st_size
        except FileNotFoundError:
            pass
    return total


def storage():
    return {"used": folder_size(ROOT), "quota": QUOTA, "maxFile": MAX_BYTES,
            "free": max(0, shutil.disk_usage(ROOT).free - RESERVE)}


def identity(request: Request):
    if request.method not in ("GET", "HEAD"):
        if request.headers.get("origin") != ORIGIN or request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, "invalid_origin")
    cookie = request.headers.get("cookie", "")
    if not cookie or len(cookie) > 8192:
        raise HTTPException(401, "login_required")
    con = http.client.HTTPConnection(AUTH.hostname, AUTH.port or 80, timeout=5)
    try:
        con.request("GET", AUTH.path, headers={"Cookie": cookie, "Host": urlsplit(ORIGIN).netloc})
        response = con.getresponse()
        data = json.loads(response.read(32768))
        if response.status != 200:
            raise HTTPException(503, "service_unavailable")
        user_id = data.get("userId")
        if user_id not in ("alexx", "bv"):
            raise HTTPException(401, "login_required")
        return user_id
    except (OSError, ValueError, http.client.HTTPException):
        raise HTTPException(503, "service_unavailable")
    finally:
        con.close()


def public_job(value):
    result = {key: value[key] for key in ("id", "source_url", "platform", "creator", "title", "state", "progress", "duration", "size", "error", "created")}
    result["stream_url"] = f"{ORIGIN}/media-stream/{value['token']}.mp4" if value["state"] == "ready" else None
    return result


def terminate(process):
    if process.poll() is None:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()


def run_command(job_id, args, timeout, progress=False):
    """Bound lifetime/output/storage; cancel also kills child ffmpeg processes."""
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, start_new_session=True, bufsize=1)
    lines = queue.Queue(maxsize=256)
    def read_lines():
        try:
            for line in process.stdout:
                while process.poll() is None:
                    try:
                        lines.put(line[:4_000_000], timeout=.2)
                        break
                    except queue.Full:
                        pass
                else:
                    with contextlib.suppress(queue.Full):
                        lines.put_nowait(line[:4_000_000])
        finally:
            process.stdout.close()
    reader = threading.Thread(target=read_lines, daemon=True)
    reader.start()
    started = time.monotonic()
    checked = 0
    output = []
    length = 0
    try:
        while reader.is_alive() or not lines.empty() or process.poll() is None:
            now = time.monotonic()
            if now - checked > 1:
                checked = now
                value = row(job_id)
                if STOP.is_set() or not value or value["state"] in ("cancelled", "cancelling"):
                    raise ValueError("cancelled")
                if now - started > timeout:
                    raise ValueError("timed_out")
                usage = storage()
                if usage["used"] > QUOTA or usage["free"] < 256 * 1024**2:
                    raise ValueError("storage_full")
                if folder_size(ROOT / job_id) > MAX_BYTES * 2.2:
                    raise ValueError("too_large")
                output_file = ROOT / job_id / "playback.tmp.mp4"
                if output_file.exists() and output_file.stat().st_size > MAX_BYTES:
                    raise ValueError("too_large")
            try:
                line = lines.get(timeout=.2)
            except queue.Empty:
                continue
            if progress and line.startswith("PROGRESS:"):
                try:
                    item = json.loads(line[9:])
                    total = item.get("total_bytes") or item.get("total_bytes_estimate") or 0
                    downloaded = item.get("downloaded_bytes") or 0
                    if total > MAX_BYTES or downloaded > MAX_BYTES:
                        raise ValueError("too_large")
                    previous = row(job_id)["progress"]
                    percent = min(94, downloaded / total * 94) if total else previous
                    with LOCK:
                        if row(job_id)["state"] not in ("cancelled", "cancelling"):
                            update(job_id, state="downloading", progress=max(previous, percent))
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass
            else:
                length += len(line)
                if length > 4_000_000:
                    raise ValueError("source_unavailable")
                output.append(line)
        process.wait()
        if process.returncode:
            message = "".join(output).lower()
            if any(word in message for word in ("geo restrict", "geo-restrict", "not available from your location", "not available in your", "地区")):
                raise ValueError("geo_restricted")
            if any(word in message for word in ("429", "412", "403", "verify", "captcha", "bot", "风控")):
                raise ValueError("platform_restricted")
            if any(word in message for word in ("login", "sign in", "premium", "members", "vip", "cookie", "not available in your", "region", "geo-restrict", "地区", "大会员", "付费")):
                raise ValueError("access_required")
            if "max-filesize" in message or "larger than" in message:
                raise ValueError("too_large")
            raise ValueError("source_unavailable")
        return "".join(output)
    finally:
        terminate(process)
        reader.join(timeout=2)


def download(job):
    job_id = job["id"]
    directory = ROOT / job_id
    directory.mkdir(exist_ok=True)
    try:
        source = resolve_short(job["source_url"])
        base = [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist", "--no-warnings",
                "--socket-timeout", "20", "--retries", "2", "--fragment-retries", "2",
                "--js-runtimes", "node", "--no-cache-dir"]
        metadata = run_command(job_id, base + ["--skip-download", "--dump-single-json", "--", source], 180)
        info = json.loads(next(line for line in metadata.splitlines() if line.startswith("{")))
        if info.get("is_live") or info.get("live_status") in ("is_live", "is_upcoming") or info.get("_type") in ("playlist", "multi_video"):
            raise ValueError("unsupported_video")
        if info.get("availability") in ("premium_only", "subscriber_only", "needs_auth", "private"):
            raise ValueError("access_required")
        duration = info.get("duration") or 0
        if duration > MAX_DURATION:
            raise ValueError("too_long")
        with LOCK:
            if row(job_id)["state"] in ("cancelled", "cancelling"):
                raise ValueError("cancelled")
            update(job_id, title=str(info.get("title") or "Video")[:300], duration=duration, state="downloading")
        fmt = "bv[height<=1080][vcodec^=avc1]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv[height<=1080]+ba/b[height<=1080]"
        run_command(job_id, base + ["--newline", "--progress", "--progress-delta", "1", "--progress-template", "download:PROGRESS:%(progress)j",
                    "--max-filesize", str(MAX_BYTES), "--format", fmt, "--merge-output-format", "mp4",
                    "--output", str(directory / "source.%(ext)s"), "--", source], 7200, progress=True)
        files = [p for p in directory.glob("source.*") if p.suffix in (".mp4", ".mkv", ".webm", ".flv", ".mov")]
        if len(files) != 1 or files[0].stat().st_size > MAX_BYTES:
            raise ValueError("too_large" if files else "source_unavailable")
        source_file = files[0]
        with LOCK:
            if row(job_id)["state"] in ("cancelled", "cancelling"):
                raise ValueError("cancelled")
            update(job_id, state="processing", progress=95)
        probe = json.loads(run_command(job_id, ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(source_file)], 30))
        streams = probe.get("streams", [])
        actual_duration = float(probe.get("format", {}).get("duration") or 0)
        if duration and actual_duration < duration - max(10, duration * .02):
            raise ValueError("incomplete_video")
        has_video = any(s.get("codec_type") == "video" for s in streams)
        if not has_video:
            raise ValueError("unsupported_video")
        compatible = all(s.get("codec_name") in ("h264", "aac") for s in streams if s.get("codec_type") in ("audio", "video"))
        output = directory / "playback.tmp.mp4"
        codec = ["-c", "copy"] if compatible else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-threads", "2", "-c:a", "aac", "-b:a", "128k"]
        run_command(job_id, ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source_file),
                    "-map", "0:v:0", "-map", "0:a:0?", *codec, "-movflags", "+faststart", str(output)], 7200)
        size = output.stat().st_size
        if size > MAX_BYTES or size < 128:
            raise ValueError("too_large")
        with LOCK:
            if row(job_id)["state"] in ("cancelled", "cancelling"):
                raise ValueError("cancelled")
            output.replace(directory / "video.mp4")
            for path in directory.iterdir():
                if path.name != "video.mp4":
                    path.unlink(missing_ok=True)
            update(job_id, state="ready", progress=100, size=size, duration=actual_duration or duration, error="")
    except Exception as error:
        # Publish terminal states only after cleanup, so retry/delete cannot race it.
        with LOCK:
            current = row(job_id)
            shutil.rmtree(directory, ignore_errors=True)
            if current and current["state"] in ("cancelled", "cancelling"):
                update(job_id, state="cancelled", error="")
            elif current and STOP.is_set():
                update(job_id, state="queued", error="", progress=0)
            elif current:
                code = str(error) if isinstance(error, ValueError) and str(error) in {"too_large", "too_long", "unsupported_video", "storage_full", "access_required", "geo_restricted", "incomplete_video", "platform_restricted", "source_unavailable", "timed_out", "invalid_source"} else "source_unavailable"
                update(job_id, state="failed", error=code)


def worker():
    while not STOP.is_set():
        with LOCK, db() as con:
            candidate = con.execute("SELECT * FROM jobs WHERE state='queued' ORDER BY created LIMIT 1").fetchone()
            if candidate:
                con.execute("UPDATE jobs SET state='fetching',updated=? WHERE id=?", (time.time(), candidate["id"]))
        if candidate:
            download(dict(candidate))
        else:
            WAKE.wait(2)
            WAKE.clear()


@contextlib.asynccontextmanager
async def lifespan(_):
    initialize()
    STOP.clear()
    with db() as con:
        con.execute("UPDATE jobs SET state='queued',progress=0 WHERE state IN ('fetching','downloading','processing')")
        con.execute("UPDATE jobs SET state='cancelled' WHERE state='cancelling'")
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    yield
    STOP.set()
    WAKE.set()
    thread.join(timeout=8)


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def headers(request, call_next):
    response = await call_next(request)
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, no-store"
    return response


@app.get("/healthz")
def health():
    return {"ok": True}


@app.get("/api/media/jobs")
def list_jobs(user=Depends(identity)):
    with db() as con:
        values = [public_job(dict(v)) for v in con.execute("SELECT * FROM jobs ORDER BY created DESC LIMIT 200")]
    return {"jobs": values, "storage": storage()}


@app.post("/api/media/jobs")
async def create(request: Request, user=Depends(identity)):
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except ValueError:
        raise HTTPException(400, "invalid_source")
    if content_length > 4096:
        raise HTTPException(413, "invalid_source")
    data = bytearray()
    async for part in request.stream():
        data.extend(part)
        if len(data) > 4096:
            raise HTTPException(413, "invalid_source")
    try:
        body = json.loads(data)
        url, platform = normalize_url(body.get("url"))
    except (ValueError, AttributeError):
        raise HTTPException(400, "invalid_source")
    with LOCK, db() as con:
        duplicate = con.execute("SELECT * FROM jobs WHERE source_url=? AND state NOT IN ('failed','cancelled') LIMIT 1", (url,)).fetchone()
        if duplicate:
            return JSONResponse(public_job(dict(duplicate)), status_code=200)
        if con.execute("SELECT COUNT(*) FROM jobs WHERE state IN ('queued','fetching','downloading','processing')").fetchone()[0] >= 5:
            raise HTTPException(429, "queue_full")
        usage = storage()
        if usage["used"] >= QUOTA - MAX_BYTES or usage["free"] < MAX_BYTES * 2:
            raise HTTPException(507, "storage_full")
        job_id = uuid.uuid4().hex
        now = time.time()
        con.execute("INSERT INTO jobs(id,source_url,platform,creator,state,token,created,updated) VALUES(?,?,?,?,?,?,?,?)",
                    (job_id, url, platform, user, "queued", secrets.token_urlsafe(32), now, now))
    WAKE.set()
    return JSONResponse(public_job(row(job_id)), status_code=201)


def require_job(job_id):
    if not re.fullmatch(r"[a-f0-9]{32}", job_id) or not (value := row(job_id)):
        raise HTTPException(404, "not_found")
    return value


@app.post("/api/media/jobs/{job_id}/cancel")
def cancel(job_id: str, user=Depends(identity)):
    with LOCK:
        value = require_job(job_id)
        if value["state"] not in ACTIVE:
            raise HTTPException(409, "invalid_state")
        if value["state"] == "queued":
            shutil.rmtree(ROOT / job_id, ignore_errors=True)
        update(job_id, state="cancelled" if value["state"] == "queued" else "cancelling", error="")
    return {"ok": True}


@app.post("/api/media/jobs/{job_id}/retry")
def retry(job_id: str, user=Depends(identity)):
    with LOCK, db() as con:
        value = require_job(job_id)
        if value["state"] not in ("failed", "cancelled"):
            raise HTTPException(409, "invalid_state")
        if con.execute("SELECT COUNT(*) FROM jobs WHERE state IN ('queued','fetching','downloading','processing')").fetchone()[0] >= 5:
            raise HTTPException(429, "queue_full")
        update(job_id, state="queued", error="", progress=0)
    WAKE.set()
    return {"ok": True}


@app.delete("/api/media/jobs/{job_id}")
def delete(job_id: str, user=Depends(identity)):
    with LOCK:
        value = require_job(job_id)
        if value["state"] in ACTIVE:
            raise HTTPException(409, "invalid_state")
        shutil.rmtree(ROOT / job_id, ignore_errors=True)
        with db() as con:
            con.execute("DELETE FROM jobs WHERE id=?", (job_id,))
    return {"ok": True}


@app.api_route("/media-stream/{token}.mp4", methods=["GET", "HEAD"])
def stream(token: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(404)
    with db() as con:
        value = con.execute("SELECT id FROM jobs WHERE token=? AND state='ready'", (token,)).fetchone()
    if not value:
        raise HTTPException(404)
    file = ROOT / value["id"] / "video.mp4"
    if not file.is_file():
        raise HTTPException(404)
    return FileResponse(file, media_type="video/mp4", headers={"Access-Control-Allow-Origin": "*", "Content-Disposition": 'inline; filename="video.mp4"'})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("MEDIA_HOST", "127.0.0.1"), port=int(os.environ.get("MEDIA_PORT", "8792")), access_log=False)
