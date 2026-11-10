import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../cloudflare/worker.mjs';
const env={WIDGET_ALLOWED_ORIGINS:'https://terjefjeldberg.github.io'};
const makeRequest=(path,origin='https://terjefjeldberg.github.io')=>new Request('https://files.example.workers.dev/streambim-file?'+new URLSearchParams({origin:'https://sweden.streambim.com',projectId:'9876',path}),{headers:{Origin:origin}});
test('Cloudflare streams the DWG response and forwards no credentials',async()=>{
 const bytes=new Uint8Array([65,67,49,48,50,55,0,255]);
 let options;
 const response=await handleRequest(makeRequest('/project-9876/api/v1/documents/12/_download/plan.dwg?token=temporary'),env,async(url,opts)=>{options=opts;assert.ok(url.startsWith('https://sweden.streambim.com/project-9876/'));return new Response(bytes);});
 assert.equal(response.status,200);assert.equal(options.headers,undefined);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.WIDGET_ALLOWED_ORIGINS);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
});
test('Cloudflare blocks unapproved widget origins, project mismatches, and arbitrary URLs',async()=>{
 const forbidden=()=>{throw new Error('No upstream request should occur');};
 assert.equal((await handleRequest(makeRequest('/project-9876/api/v1/documents/12/_download/x.dwg','https://example.com'),env,forbidden)).status,403);
 for(const path of ['/project-319/api/v1/documents/12/_download/x.dwg','https://example.com/project-9876/api/v1/documents/12/_download/x.dwg','/project-9876/api/v1/v2/documents'])assert.equal((await handleRequest(makeRequest(path),env,forbidden)).status,400);
});
test('Cloudflare rejects redirects to unrelated domains',async()=>{
 let calls=0;
 const result=await handleRequest(makeRequest('/project-9876/api/v1/documents/12/_download/x.dwg'),env,async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://example.com/private'}});});
 assert.equal(result.status,502);assert.equal(calls,1);
});
test('Cloudflare permits CORS preflight from the configured widget',async()=>{
 const req=new Request('https://files.example.workers.dev/streambim-file',{method:'OPTIONS',headers:{Origin:env.WIDGET_ALLOWED_ORIGINS}});
 const result=await handleRequest(req,env);
 assert.equal(result.status,204);assert.equal(result.headers.get('Access-Control-Allow-Origin'),env.WIDGET_ALLOWED_ORIGINS);
});
