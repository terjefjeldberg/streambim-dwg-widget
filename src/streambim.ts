import 'streambim-widget-api';
import type StreamBimType from 'streambim-widget-api';
const StreamBIM=(window as unknown as {StreamBIM:typeof StreamBimType}).StreamBIM;
import { collectDocuments, resolveDownloadLink } from './documents.mjs';
import {streamBimOrigin,projectId,projectFromUrl} from './project-context.mjs';
export type Drawing = {id:string;name:string;folder:string;size:number;revision?:number;modified:string;file?:File};
export class ProjectSource {
 projectId='';
 origin='';
 connected=false;
 private pending?:Promise<void>;
 private async request(url:string,accept?:string):Promise<string> {
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([StreamBIM.API.makeApiRequest({url,method:'GET',accept}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('StreamBIM svarte ikke innen 30 sekunder. Kontroller at tilkoblingsvinduet er åpent og prøv igjen.')),30000);})]).finally(()=>clearTimeout(timer));
 }
 async connect() {
  if (this.connected) return;
  if (this.pending) return this.pending;
  this.pending = this.doConnect().finally(()=>{this.pending=undefined;});
  return this.pending;
 }
 private async doConnect() {
  let connection:Promise<void>;
  if (window.parent !== window) {
   if(!document.referrer) throw new Error('StreamBIM må sende opprinnelsesadressen til widgeten.');
   this.origin=streamBimOrigin(document.referrer);
   // The SDK accepts the actual remote parent window, despite the parameter name.
   connection = StreamBIM.connectToParent(window.parent, {});
  } else {
   const configured=new URL(location.href).searchParams.get('projectUrl');
   const input=configured||window.prompt('Lim inn nettadressen til StreamBIM-prosjektet du vil åpne:');
   if(!input) throw new Error('Ingen prosjektadresse valgt.');
   const context=projectFromUrl(input.trim());
   this.origin=context.origin;
   const url=`${this.origin}/webapp/default/#/viewer?projectId=${context.projectId}&embedded=true`;
   const remote=window.open(url,'_blank','width=1100,height=780');
   if(!remote) throw new Error('Tillat sprettoppvinduet for å koble til StreamBIM.');
   connection = StreamBIM.connectToWindow(remote,url,{});
  }
  let timer:ReturnType<typeof setTimeout>;
  await Promise.race([connection, new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Ingen forbindelse. Logg inn i StreamBIM-vinduet. Widget-adressen må eventuelt godkjennes i StreamBIM.')),45000);})]).finally(()=>clearTimeout(timer));
  // The connected StreamBIM host is authoritative, including when the widget
  // URL has been reused in another project or contains old query parameters.
  this.projectId=projectId(await StreamBIM.API.getProjectId());
  this.connected=true;
 }
 async list():Promise<Drawing[]> {
  if(!this.connected) throw new Error('Koble til StreamBIM først.');
  return collectDocuments((url:string)=>this.request(url),this.projectId);
 }
 async read(drawing:Drawing):Promise<ArrayBuffer> {
  if(drawing.file) return drawing.file.arrayBuffer();
  const raw=await this.request(`/project-${this.projectId}/api/v1/documents/${encodeURIComponent(drawing.id)}/downloadlink`,'application/json');
  const url=resolveDownloadLink(raw,this.projectId,this.origin);
  let response:Response;
  const target=new URL(url);
  const query=new URLSearchParams({origin:this.origin,projectId:this.projectId,path:target.pathname+target.search});
  const download=target.origin===this.origin?`${import.meta.env.BASE_URL}streambim-file?${query}`:url;
  try {response=await fetch(download,{credentials:'omit',signal:AbortSignal.timeout(120000)});}
  catch {throw new Error('Kunne ikke hente DWG-filen. StreamBIM må tillate nedlasting fra widgetens adresse (CORS).');}
  if(!response.ok) throw new Error(`Kunne ikke laste ned ${drawing.name} (${response.status}). Prøv å oppdatere listen.`);
  const content=await response.arrayBuffer();
  if(new TextDecoder().decode(content.slice(0,2))!=='AC') throw new Error('Nedlastingen var ikke en DWG-fil. Kontroller tilgangen i StreamBIM.');
  return content;
 }
}
