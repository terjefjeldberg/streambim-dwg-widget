import {streamBimOrigin as validateOrigin,projectId as validateProjectId} from '../src/project-context.mjs';
export async function downloadProxy(req,res,next) {
 const request=new URL(req.url,'http://localhost');
 if(request.pathname!=='/streambim-file'){next();return;}
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 let streamBimOrigin,project;
 try{streamBimOrigin=validateOrigin(request.searchParams.get('origin')||'');project=validateProjectId(request.searchParams.get('projectId'));}
 catch{res.writeHead(400);res.end('Ugyldig StreamBIM-prosjekt.');return;}
 try {
  const path=request.searchParams.get('path')||'';
  const target=new URL(path,streamBimOrigin);
  // This is deliberately a StreamBIM-only, read-only file proxy. Never accept
  // arbitrary destinations or forward the user's cookies or authorization.
  if(target.origin!==streamBimOrigin || !new RegExp(`^/project-${project}/api/v1/documents/\\d+/(?:\\d+/)?_?download(?:/|$)`).test(target.pathname)) {
   res.writeHead(400);res.end('Ugyldig filadresse.');return;
  }
  let response=await fetch(target,{signal:AbortSignal.timeout(120000),redirect:'manual'});
  for(let redirects=0;response.status>=300&&response.status<400&&redirects<3;redirects++){
   const location=response.headers.get('location');
   if(!location)throw new Error('Missing redirect');
   const destination=new URL(location,target);
   if(destination.protocol!=='https:'||(destination.origin!==streamBimOrigin&&!destination.hostname.endsWith('.amazonaws.com')))throw new Error('Invalid redirect');
   response=await fetch(destination,{signal:AbortSignal.timeout(120000),redirect:'manual'});
  }
  if(!response.ok){res.writeHead(response.status);res.end('Nedlastingen ble avvist av StreamBIM.');return;}
  res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const {Readable}=await import('node:stream');
  Readable.fromWeb(response.body).pipe(res);
 }catch{res.writeHead(502);res.end('Kunne ikke hente filen fra StreamBIM.');}
}
