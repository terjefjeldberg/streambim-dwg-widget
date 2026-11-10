import {streamBimOrigin,projectId} from '../src/project-context.mjs';

export async function handleRequest(request,env={},fetchFile=fetch){
 const url=new URL(request.url);
 if(url.pathname==='/health')return new Response('DWG file server ready',{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
 if(url.pathname!=='/streambim-file')return new Response('Not found',{status:404});
 const caller=request.headers.get('Origin');
 const allowed=(env.WIDGET_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean);
 // Browsers must come from a configured widget origin. Signed download links
 // remain mandatory; this service never receives StreamBIM login credentials.
 if(caller&&!allowed.includes(caller))return new Response('Widget origin is not allowed',{status:403});
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(caller)headers['Access-Control-Allow-Origin']=caller;
 const reply=(message,status)=>new Response(message,{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'600'}});
 if(request.method!=='GET')return reply('Method not allowed',405);
 let target,origin,id;
 try{
  origin=streamBimOrigin(url.searchParams.get('origin')||'');
  id=projectId(url.searchParams.get('projectId'));
  target=new URL(url.searchParams.get('path')||'',origin);
  if(target.origin!==origin||target.username||target.password||!new RegExp(`^/project-${id}/api/v1/documents/\\d+/(?:\\d+/)?_?download(?:/|$)`).test(target.pathname))throw new Error('Invalid file path');
 }catch{return reply('Invalid StreamBIM file address',400);}
 try{
  let response;
  for(let redirects=0;redirects<=3;redirects++){
   response=await fetchFile(target.href,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(120000)});
   if(response.status<300||response.status>=400)break;
   const location=response.headers.get('Location');
   await response.body?.cancel();
   if(!location||redirects===3)return reply('Invalid download redirect',502);
   const next=new URL(location,target);
   if(next.protocol!=='https:'||next.username||next.password||(next.origin!==origin&&!next.hostname.endsWith('.amazonaws.com')))return reply('Download redirect is not allowed',502);
   target=next;
  }
  if(!response?.ok)return reply('StreamBIM rejected the download',response?.status||502);
  // Streaming avoids buffering large DWGs inside the Worker's memory limit.
  return new Response(response.body,{headers:{...headers,'Content-Type':'application/octet-stream'}});
 }catch{return reply('Could not retrieve the DWG file',502);}
}
export default {fetch(request,env){return handleRequest(request,env);}};
