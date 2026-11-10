import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {downloadProxy} from './download-proxy.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer((req,res)=>downloadProxy(req,res,async()=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(path!==root&&!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  if(!(await stat(path)).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"frame-ancestors 'self' https://streambim.com https://*.streambim.com",'Cache-Control':extname(path)==='.html'?'no-cache':'public, max-age=3600'});
  if(req.method==='HEAD'){res.end();return;}createReadStream(path).pipe(res);
 }catch{res.writeHead(404);res.end('Ikke funnet.');}
}));
server.listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>console.log('DWG-widget klar på http://127.0.0.1:'+(Number(process.env.PORT)||4173)));
