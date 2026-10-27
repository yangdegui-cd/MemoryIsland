import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from starlette.requests import Request
from fastapi import HTTPException
from fastapi.testclient import TestClient

sandbox = tempfile.TemporaryDirectory()
os.environ['MEDIA_ROOT'] = sandbox.name
os.environ['MEDIA_RESERVE_BYTES'] = '0'
spec = importlib.util.spec_from_file_location('media_server', Path(__file__).with_name('server.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
s.initialize()

class MediaTest(unittest.TestCase):
    def setUp(self):
        with s.db() as con: con.execute('DELETE FROM jobs')
        s.app.dependency_overrides.clear()
        self.client = TestClient(s.app)
    def tearDown(self):
        self.client.close()
        s.app.dependency_overrides.clear()
    def signed_in(self): s.app.dependency_overrides[s.identity] = lambda: 'alexx'
    def create(self):
        self.signed_in()
        response = self.client.post('/api/media/jobs', json={'url':'https://youtu.be/BaW_jenozKc?t=5'})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['id']
    def test_sources(self):
        self.assertEqual(s.normalize_url('https://www.bilibili.com/bangumi/play/ep734213?theme=movie')[0], 'https://www.bilibili.com/bangumi/play/ep734213')
        self.assertEqual(s.normalize_url('https://www.youtube.com/shorts/BaW_jenozKc')[0], 'https://www.youtube.com/watch?v=BaW_jenozKc')
        for url in ['http://127.0.0.1/admin','https://youtube.com.evil.test/watch?v=BaW_jenozKc','https://user:pass@youtube.com/watch?v=BaW_jenozKc','https://youtube.com:8080/watch?v=BaW_jenozKc','https://youtube.com/playlist?list=abc','file:///etc/passwd']:
            with self.subTest(url=url), self.assertRaises(ValueError): s.normalize_url(url)
    def test_auth_and_csrf(self):
        self.assertEqual(self.client.get('/api/media/jobs').status_code, 401)
        self.assertEqual(self.client.post('/api/media/jobs', json={'url':'x'}, headers={'Origin':'https://other.test'}).status_code, 403)
        self.assertEqual(self.client.post('/api/media/jobs', json={'url':'x'}, headers={'Origin':s.ORIGIN}).status_code, 401)
        class Response:
            status=200
            def read(self, n): return b'{"userId":"bv"}'
        class Connection:
            def __init__(self,*a,**kw): pass
            def request(self,*a,**kw): self.headers=kw['headers']
            def getresponse(self): return Response()
            def close(self): pass
        req=Request({'type':'http','method':'GET','headers':[(b'cookie',b'qa=test')]})
        with patch.object(s.http.client,'HTTPConnection',Connection): self.assertEqual(s.identity(req),'bv')
    def test_lifecycle_dedupe_cancel_retry_delete(self):
        job=self.create()
        duplicate=self.client.post('/api/media/jobs',json={'url':'https://www.youtube.com/watch?v=BaW_jenozKc&list=abc'})
        self.assertEqual(duplicate.status_code,200)
        self.assertEqual(duplicate.json()['id'],job)
        self.assertEqual(self.client.delete('/api/media/jobs/'+job).status_code,409)
        self.assertEqual(self.client.post(f'/api/media/jobs/{job}/cancel').status_code,200)
        self.assertEqual(s.row(job)['state'],'cancelled')
        self.assertEqual(self.client.post(f'/api/media/jobs/{job}/retry').status_code,200)
        s.update(job,state='downloading')
        self.client.post(f'/api/media/jobs/{job}/cancel')
        self.assertEqual(s.row(job)['state'],'cancelling')
        self.assertEqual(self.client.post(f'/api/media/jobs/{job}/retry').status_code,409)
        s.update(job,state='failed',error='access_required')
        self.assertEqual(self.client.delete('/api/media/jobs/'+job).status_code,200)
        self.assertIsNone(s.row(job))
    def test_stream_range_and_revocation(self):
        job=self.create(); directory=s.ROOT/job; directory.mkdir(exist_ok=True)
        content=bytes(range(256))*8
        (directory/'video.mp4').write_bytes(content)
        token=s.row(job)['token']; route='/media-stream/'+token+'.mp4'
        self.assertEqual(self.client.get(route).status_code,404)
        s.update(job,state='ready',size=len(content))
        s.app.dependency_overrides.clear()
        response=self.client.get(route,headers={'Range':'bytes=10-29'})
        self.assertEqual(response.status_code,206)
        self.assertEqual(response.content,content[10:30])
        self.assertEqual(response.headers['content-range'],'bytes 10-29/2048')
        self.assertEqual(self.client.head(route).headers['content-length'],'2048')
        self.assertEqual(self.client.get(route,headers={'Range':'bytes=9999-'}).status_code,416)
        self.signed_in(); self.client.delete('/api/media/jobs/'+job)
        self.assertEqual(self.client.get(route).status_code,404)
    def test_worker_failure_cleans_files_before_retry(self):
        job=self.create(); directory=s.ROOT/job; directory.mkdir(exist_ok=True)
        (directory/'source.part').write_bytes(b'partial')
        with patch.object(s,'run_command',side_effect=ValueError('access_required')): s.download(s.row(job))
        self.assertEqual(s.row(job)['error'],'access_required')
        self.assertFalse(directory.exists())
        self.assertEqual(self.client.post(f'/api/media/jobs/{job}/retry').status_code,200)
    def test_preview_is_not_published_as_full_movie(self):
        job=self.create()
        def command(job_id,args,*a,**kw):
            if '--dump-single-json' in args: return json.dumps({'title':'Preview QA','duration':7200})
            if args[0]=='ffprobe': return json.dumps({'streams':[{'codec_type':'video','codec_name':'h264'}],'format':{'duration':'360'}})
            (s.ROOT/job_id/'source.mp4').write_bytes(b'preview')
            return ''
        with patch.object(s,'run_command',command): s.download(s.row(job))
        self.assertEqual(s.row(job)['state'],'failed')
        self.assertEqual(s.row(job)['error'],'incomplete_video')
        self.assertFalse((s.ROOT/job).exists())
    def test_invalid_body_and_storage(self):
        self.signed_in()
        self.assertEqual(self.client.post('/api/media/jobs',content='[]').status_code,400)
        self.assertEqual(self.client.post('/api/media/jobs',content='x'*5000).status_code,413)
        with patch.object(s,'QUOTA',1):
            self.assertEqual(self.client.post('/api/media/jobs',json={'url':'https://youtu.be/BaW_jenozKc'}).status_code,507)

if __name__=='__main__': unittest.main(verbosity=2)
