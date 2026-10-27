"""Import a locally downloaded, authorized MP4. Run inside the media container."""
import argparse
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import time
import uuid
import server as service

parser = argparse.ArgumentParser()
parser.add_argument('file', type=Path)
parser.add_argument('--title', required=True)
parser.add_argument('--source', required=True)
parser.add_argument('--expected-duration', type=float, required=True)
args = parser.parse_args()
source, platform = service.normalize_url(args.source)
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(args.file)]))
duration = float(probe['format']['duration'])
if duration < args.expected_duration - max(10, args.expected_duration * .02):
    raise SystemExit('Incomplete video: refusing import')
if duration > service.MAX_DURATION or args.file.stat().st_size > service.MAX_BYTES:
    raise SystemExit('Video exceeds configured limits')
streams = [s for s in probe['streams'] if s.get('codec_type') in ('audio','video')]
if not any(s['codec_type']=='video' for s in streams) or any(s['codec_name'] not in ('h264','aac') for s in streams):
    raise SystemExit('Import requires H.264/AAC MP4')
usage = service.storage()
if usage['used'] + args.file.stat().st_size > service.QUOTA or usage['free'] < args.file.stat().st_size + 256*1024**2:
    raise SystemExit('Insufficient media storage')
service.initialize()
with service.db() as con:
    if con.execute("SELECT id FROM jobs WHERE source_url=? AND state='ready'",(source,)).fetchone():
        raise SystemExit('This source is already imported')
job_id=uuid.uuid4().hex
folder=service.ROOT/job_id
folder.mkdir()
try:
    target=folder/'video.mp4'
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(args.file),'-map','0:v:0','-map','0:a:0?','-c','copy','-movflags','+faststart',str(target)],check=True,timeout=600)
    now=time.time()
    with service.db() as con:
        con.execute('INSERT INTO jobs(id,source_url,platform,creator,title,state,progress,duration,size,token,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                    (job_id,source,platform,'local-import',args.title[:300],'ready',100,duration,target.stat().st_size,secrets.token_urlsafe(32),now,now))
    print(json.dumps({'id':job_id,'title':args.title,'duration':duration,'size':target.stat().st_size},ensure_ascii=False))
except BaseException:
    shutil.rmtree(folder,ignore_errors=True)
    raise
