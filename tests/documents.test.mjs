import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDocuments,collectDocuments,resolveDownloadLink} from '../src/documents.mjs';
test('DWG filter excludes deleted files, keeps mixed-case suffixes and deduplicates IDs',()=>{
 const rows=[{id:1,attributes:{filename:'Plan.DWG',path:'A',filesize:20}},{id:2,attributes:{filename:'Plan.pdf'}},{id:3,attributes:{filename:'Slettet.dwg','is-deleted':true}},{id:1,attributes:{filename:'Plan.DWG',path:'A',revision:2}}];
 assert.equal(normalizeDocuments(rows).length,1);assert.equal(normalizeDocuments(rows)[0].revision,2);
});
test('pagination follows actual page size and includes DWGs in later pages',async()=>{
 const requested=[];
 const pages=[{data:[{id:1,attributes:{filename:'a.pdf'}}],meta:{total:3}},{data:[{id:2,attributes:{filename:'b.DWG',path:'B'}}],meta:{total:3}},{data:[{id:3,attributes:{filename:'c.dwg',path:'A'}}],meta:{total:3}}];
 const docs=await collectDocuments(async url=>{requested.push(url);return JSON.stringify(pages.shift());},'319');
 assert.deepEqual(docs.map(x=>x.id),['3','2']);assert.ok(requested[2].includes('page%5Bskip%5D=2'));
});
test('repeated page fails instead of silently returning a partial list',async()=>{
 await assert.rejects(()=>collectDocuments(async()=>({data:[{id:1,attributes:{filename:'x.dwg'}}],meta:{total:4}}),'319'),/gjentok/);
});
test('download links support API-relative paths, JSON and signed absolute URLs',()=>{
 const origin='https://sweden.streambim.com';
 assert.equal(resolveDownloadLink('{"data":"/documents/1/1/download?token=x"}','319',origin),origin+'/project-319/api/v1/documents/1/1/download?token=x');
 assert.equal(resolveDownloadLink('documents/1/download/plan.dwg','319',origin),origin+'/project-319/api/v1/documents/1/download/plan.dwg');
 assert.equal(resolveDownloadLink('/documents/1115/_download/plan.dwg?token=x','319',origin),origin+'/project-319/api/v1/documents/1115/_download/plan.dwg?token=x');
 assert.equal(resolveDownloadLink('"https://example.com/plan.dwg?signature=x"','319',origin),'https://example.com/plan.dwg?signature=x');
 assert.throws(()=>resolveDownloadLink('javascript:alert(1)','319',origin),/HTTPS/);
});
