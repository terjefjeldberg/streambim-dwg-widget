import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadProxy} from '../server/download-proxy.mjs';
const request=async(url,method='GET')=>{let status,body;const parsed=new URL(url,'http://localhost');if(parsed.pathname==='/streambim-file'){if(!parsed.searchParams.has('origin'))parsed.searchParams.set('origin','https://sweden.streambim.com');if(!parsed.searchParams.has('projectId'))parsed.searchParams.set('projectId','319');}await downloadProxy({url:parsed.pathname+parsed.search,method},{writeHead(code){status=code;},end(text){body=text;}},()=>{status='next';});return {status,body};};
test('file proxy rejects arbitrary hosts, projects and API endpoints without making outbound calls',async()=>{
 for(const path of ['https://example.com/project-319/api/v1/documents/12/_download/plan.dwg','http://127.0.0.1/private','/project-100/api/v1/documents/12/_download/plan.dwg','/project-319/api/v1/v2/documents','/project-319/api/v1/documents/12/downloadlink']){
  assert.equal((await request('/streambim-file?path='+encodeURIComponent(path))).status,400);
 }
});
test('file proxy follows a different active project and region, rejecting mismatched project paths',async context=>{
 let destination;
 context.mock.method(globalThis,'fetch',async url=>{destination=String(url);return {ok:false,status:401};});
 const query=new URLSearchParams({origin:'https://app.streambim.com',projectId:'9876',path:'/project-9876/api/v1/documents/12/_download/plan.dwg?token=temporary'});
 assert.equal((await request('/streambim-file?'+query)).status,401);
 assert.ok(destination.startsWith('https://app.streambim.com/project-9876/'));
 query.set('path','/project-319/api/v1/documents/12/_download/plan.dwg');
 assert.equal((await request('/streambim-file?'+query)).status,400);
 query.set('origin','https://example.com');
 assert.equal((await request('/streambim-file?'+query)).status,400);
});
test('file proxy only handles GET and leaves other routes to the static server',async()=>{
 assert.equal((await request('/streambim-file','POST')).status,405);
 assert.equal((await request('/assets/index.js')).status,'next');
});
test('file proxy accepts the observed _download route and forwards no credentials',async context=>{
 let destination,options;
 context.mock.method(globalThis,'fetch',async(url,opts)=>{destination=String(url);options=opts;return {ok:false,status:401};});
 const path='/project-319/api/v1/documents/1115/_download/plan.dwg?token=temporary';
 assert.equal((await request('/streambim-file?path='+encodeURIComponent(path))).status,401);
 assert.equal(destination,'https://sweden.streambim.com'+path);
 assert.equal(options.headers,undefined);
 assert.equal(options.redirect,'manual');
});
