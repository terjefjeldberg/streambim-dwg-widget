import './style.css';
import {ProjectSource,type Drawing} from './streambim';
import {CombinedViewer} from './viewer';
const icon=(name:string)=>{const paths:Record<string,string>={layers:'<path d="m12 3 10 5-10 5L2 8Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',folder:'<path d="M3 7V5h6l2 2h10v13H3Z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v6h-6"/>',file:'<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 14h8M8 17h5"/>',fit:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',link:'<path d="m9 15 6-6m-7 4-1 1a4 4 0 0 0 6 6l3-3m-3-9 1-1a4 4 0 0 1 6 6l-3 3"/>',plus:'<path d="M12 4v16M4 12h16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;};
document.querySelector('#app')!.innerHTML=`
 <header class="topbar"><div class="brand"><span class="brand-icon">${icon('layers')}</span><div>DWG <span class="brand-light">Viewer</span><small>STREAMBIM WIDGET</small></div></div><div class="project"><span class="dot"></span><span id="project-label">StreamBIM-prosjekt <small>Prosjektet velges ved tilkobling</small></span></div><button id="connect" class="button secondary">${icon('link')} Koble til StreamBIM</button></header>
 <main><aside class="library"><div class="library-heading"><div><span class="eyebrow">PROSJEKTBIBLIOTEK</span><h1>Tegninger <span id="count" class="count">0</span></h1></div><button id="refresh" class="icon-button" aria-label="Oppdater tegningslisten" title="Oppdater tegningslisten">${icon('refresh')}</button></div>
 <label class="search">${icon('search')}<input id="search" type="search" placeholder="Søk etter fil eller mappe…" aria-label="Søk i DWG-filer"><kbd>⌕</kbd></label>
 <div class="filter-line"><span class="chip">DWG <span>2D</span></span><select id="sort" aria-label="Sorter tegninger"><option value="folder">Etter mappe</option><option value="name">Filnavn A–Å</option><option value="date">Nyeste først</option></select></div>
 <div class="select-line"><label><input id="select-all" type="checkbox">Velg alle viste</label><span id="selected-count">0 valgt</span></div>
 <div id="files" class="files"><div class="list-empty">${icon('folder')}<strong>Prosjektets DWG-filer</strong><p>Koble til StreamBIM for å hente tegninger fra alle prosjektmapper.</p></div></div>
 <div class="library-footer"><button id="open" class="button primary" disabled>Åpne valgte sammen ${icon('arrow')}</button><button id="local" class="text-button">${icon('plus')} Legg til lokale filer</button><input type="file" id="file-input" accept=".dwg,.dxf" multiple hidden></div></aside>
 <section class="workspace"><div class="view-header"><div class="view-title">${icon('layers')}<strong>Samlet visning</strong><span class="view-pill">2D</span></div><div class="view-actions"><label class="color-choice"><input type="checkbox" id="original">Originalfarger</label><button id="fit" class="button compact">${icon('fit')} Tilpass alle</button><button id="fullscreen" class="icon-button" aria-label="Fullskjerm">${icon('expand')}</button></div></div>
 <div class="canvas-wrap" id="canvas-wrap"><div id="cad"></div><div class="empty-view" id="empty"><div class="drawing-symbol">${icon('layers')}</div><span class="eyebrow">FLERE TEGNINGER. ÉN OVERSIKT.</span><h2>Se tegningene i sammenheng</h2><p>Velg én eller flere DWG-filer fra prosjektet.<br>Åpne dem sammen, og utforsk detaljene i 2D.</p><button id="empty-connect" class="button primary">${icon('link')} Hent prosjektets tegninger</button><div class="feature-note"><span>Felles koordinater</span><span>Av/på per tegning</span><span>Zoom og panorering</span></div></div>
 <div class="canvas-label"><span class="dot"></span>MODELLROM <span>XY</span></div><div id="loaded-panel" class="loaded-panel" hidden><div class="loaded-heading">ÅPNE TEGNINGER <span id="loaded-count">0</span></div><div id="loaded"></div></div><div class="zoom-controls"><button id="zoom-in" aria-label="Zoom inn">+</button><button id="zoom-out" aria-label="Zoom ut">−</button><button id="zoom-fit" aria-label="Tilpass synlige tegninger">${icon('fit')}</button></div><div class="axis"><span>Y</span><i></i><b>X</b></div><div id="busy" class="busy" hidden><div class="spinner"></div><strong id="busy-text">Laster…</strong></div></div>
 <footer class="statusbar"><div><span id="connection-dot" class="dot neutral"></span><span id="status" role="status" aria-live="polite">Klar til å koble til prosjektet</span></div><span>Rull for å zoome · Dra med midtknapp for å panorere</span><a href="https://github.com/mlightcad/cad-viewer" target="_blank" rel="noreferrer">MLightCAD / LibreDWG ↗</a></footer></section></main>
 <div id="notice" class="notice" role="alert" hidden><span></span><button aria-label="Lukk melding">×</button></div>
 <dialog id="connection-dialog"><div class="dialog-header"><div><strong>Koble til StreamBIM</strong><p>Logg inn i prosjektet hvis du blir bedt om det.</p></div><button id="close-dialog" class="icon-button" aria-label="Lukk tilkoblingsvindu">${icon('close')}</button></div><iframe id="streambim-frame" title="StreamBIM-prosjekt for tilkobling" allow="fullscreen"></iframe><div class="dialog-footer">Vinduet lukkes automatisk når forbindelsen er klar.</div></dialog>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const source=new ProjectSource();
const viewer=new CombinedViewer($('cad'));
let drawings:Drawing[]=[],selected=new Set<string>(),busy=false,connecting=false;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const size=(n:number)=>n>=1048576?`${(n/1048576).toLocaleString('nb',{maximumFractionDigits:1})} MB`:`${Math.max(1,Math.round(n/1024))} kB`;
function notify(message:string){$('notice').hidden=false;$('notice').querySelector('span')!.textContent=message;}
function status(message:string){$('status').textContent=message;}
function shown(){const q=$<HTMLInputElement>('search').value.toLocaleLowerCase('nb');const result=drawings.filter(d=>`${d.name} ${d.folder}`.toLocaleLowerCase('nb').includes(q));const sort=$<HTMLSelectElement>('sort').value;return result.sort((a,b)=>sort==='date'?b.modified.localeCompare(a.modified):sort==='name'?a.name.localeCompare(b.name,'nb',{numeric:true}):a.folder.localeCompare(b.folder,'nb',{numeric:true})||a.name.localeCompare(b.name,'nb',{numeric:true}));}
function render(){
 $('count').textContent=String(drawings.length); const list=shown();
 let folder='';
 $('files').innerHTML=list.map(d=>{const heading=$<HTMLSelectElement>('sort').value==='folder'&&folder!==d.folder?`<div class="folder-label">${icon('folder')}<span>${escape(d.folder)}</span></div>`:'';folder=d.folder;return `${heading}<label class="file-row ${selected.has(d.id)?'selected':''}"><input type="checkbox" value="${escape(d.id)}" ${selected.has(d.id)?'checked':''} ${busy?'disabled':''}><span class="file-icon">${icon('file')}<small>DWG</small></span><span class="file-info"><strong title="${escape(d.name)}">${escape(d.name)}</strong><span>${size(d.size)} <i>·</i> ${d.revision?`Rev. ${d.revision}`:d.file?'Lokal fil':'DWG'}${viewer.loaded.some(x=>x.drawing.id===d.id)?' <em>Åpen</em>':''}</span></span></label>`;}).join('') || `<div class="list-empty">${icon('folder')}<strong>${drawings.length?'Ingen treff':source.connected?'Ingen DWG-filer funnet':'Prosjektets DWG-filer'}</strong><p>${drawings.length?'Prøv et annet søkeord.':source.connected?'Det er ingen tilgjengelige DWG-filer i dette prosjektet.':'Koble til StreamBIM for å hente tegninger fra alle prosjektmapper.'}</p></div>`;
 $('selected-count').textContent=`${selected.size} valgt`;
 const all=$<HTMLInputElement>('select-all');all.checked=!!list.length&&list.every(d=>selected.has(d.id));all.indeterminate=list.some(d=>selected.has(d.id))&&!all.checked;all.disabled=busy||!list.length;
 $<HTMLButtonElement>('open').disabled=busy||!selected.size;
 $<HTMLButtonElement>('refresh').disabled=busy||connecting||!source.connected;
 $<HTMLButtonElement>('local').disabled=busy;
 const loaded=viewer.loaded;
 $('loaded-panel').hidden=!loaded.length;$('empty').hidden=!!loaded.length;$('loaded-count').textContent=String(loaded.length);
 $('loaded').innerHTML=loaded.map(x=>`<div class="loaded-row"><label><input type="checkbox" data-visible="${escape(x.drawing.id)}" ${x.visible?'checked':''} ${busy?'disabled':''}><span class="color-dot" style="background:${x.color}"></span><span title="${escape(x.drawing.name)}">${escape(x.drawing.name)}</span></label><button data-remove="${escape(x.drawing.id)}" aria-label="Fjern ${escape(x.drawing.name)}" ${busy?'disabled':''}>${icon('close')}</button></div>`).join('');
}
async function refresh(){try{status('Henter alle DWG-filer…');const remote=await source.list();drawings=[...remote,...drawings.filter(d=>d.file)];selected=new Set([...selected].filter(id=>drawings.some(d=>d.id===id)));render();status(`${remote.length} DWG-filer hentet fra prosjekt ${source.projectId}`);}catch(e){notify(errorText(e));status('Kunne ikke hente dokumentlisten');}}
const errorText=(e:unknown)=>e instanceof Error?e.message:'Forespørselen mislyktes. Kontroller tilkoblingen og tilgangen i StreamBIM.';
async function connect(){
 if(source.connected){await refresh();return;}if(connecting)return;
 connecting=true;render();status('Kobler til StreamBIM…');
 try{await source.connect();$<HTMLDialogElement>('connection-dialog').close();$('connection-dot').classList.remove('neutral');$('connect').innerHTML=`${icon('link')} Tilkoblet · ${source.projectId}`;$('empty-connect').textContent='Velg tegninger fra listen';$<HTMLButtonElement>('empty-connect').disabled=true;await refresh();}
 catch(e){notify(errorText(e));status('Tilkoblingen er ikke klar');}
 finally{connecting=false;render();}
}
async function openSelected(){
 if(busy)return;busy=true;$('busy').hidden=false;render();const errors:string[]=[];
 const toOpen=drawings.filter(d=>selected.has(d.id));
 try{for(let i=0;i<toOpen.length;i++){const d=toOpen[i];if(viewer.loaded.some(x=>x.drawing.id===d.id)){selected.delete(d.id);continue;}$('busy-text').textContent=`Henter ${i+1} av ${toOpen.length} · ${d.name}`;try{const content=await source.read(d);$('busy-text').textContent=`Viser ${i+1} av ${toOpen.length} · ${d.name}`;await viewer.add(d,content);selected.delete(d.id);}catch(e){errors.push(`${d.name}: ${errorText(e)}`);}render();}}
 finally{busy=false;$('busy').hidden=true;render();viewer.fit();status(`${viewer.loaded.length} tegninger i felles koordinatsystem`);if(errors.length)notify(errors.join('\n'));}
}
$('files').addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.checked)selected.add(input.value);else selected.delete(input.value);render();});
$('select-all').addEventListener('change',e=>{for(const d of shown())if((e.target as HTMLInputElement).checked)selected.add(d.id);else selected.delete(d.id);render();});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('connect').onclick=connect;$('empty-connect').onclick=connect;$('refresh').onclick=refresh;$('open').onclick=openSelected;
$('close-dialog').onclick=()=>$<HTMLDialogElement>('connection-dialog').close();
$('notice').querySelector('button')!.onclick=()=>$('notice').hidden=true;
$('local').onclick=()=>$<HTMLInputElement>('file-input').click();
$('file-input').onchange=()=>{const files=$<HTMLInputElement>('file-input').files;for(const file of Array.from(files||[])){const id=`local:${file.name}:${file.size}:${file.lastModified}`;if(!/\.(dwg|dxf)$/i.test(file.name))continue;if(!drawings.some(d=>d.id===id))drawings.push({id,name:file.name,folder:'Lokale filer',size:file.size,modified:new Date(file.lastModified).toISOString(),file});selected.add(id);}render();$<HTMLInputElement>('file-input').value='';};
$('loaded').addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.dataset.visible)viewer.setVisible(input.dataset.visible,input.checked);render();});
$('loaded').addEventListener('click',async e=>{const button=(e.target as Element).closest<HTMLButtonElement>('[data-remove]');if(button?.dataset.remove&&!busy){await viewer.remove(button.dataset.remove);render();status(`${viewer.loaded.length} tegninger i felles koordinatsystem`);}});
$('fit').onclick=$('zoom-fit').onclick=()=>viewer.fit();$('zoom-in').onclick=()=>viewer.zoom(1.3);$('zoom-out').onclick=()=>viewer.zoom(1/1.3);
$('original').onchange=async()=>{try{await viewer.setOriginalColors($<HTMLInputElement>('original').checked);}catch(e){notify(errorText(e));}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Nettleseren tillater ikke fullskjerm her.');}};
render();if(window.parent!==window)void connect();

