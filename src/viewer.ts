import type {AcApDocManager, AcApDocument} from '@mlightcad/cad-simple-viewer';
import type {Group,Box3} from 'three';
import type {Drawing} from './streambim';
import {hasDrawingBounds} from './references.mjs';
type SourceScene={doc:AcApDocument;scene:AcApDocManager['curView']['cadScene']};
type RenderedDrawing={root:Group;box:Box3;sources:SourceScene[];references:string[];warnings:string[]};
type ReferenceLookup=(parent:Drawing,blockName:string,pathName:string)=>Promise<{drawing:Drawing;content:ArrayBuffer}|undefined>;
export type LoadedDrawing=RenderedDrawing&{drawing:Drawing;color:string;visible:boolean};
export const COLORS=['#74d5e8','#f5bb6a','#b5a0ff','#8bdfad','#f38da9','#c5df75'];
export class CombinedViewer {
 private manager?:AcApDocManager;
 private modules?:typeof import('@mlightcad/cad-simple-viewer');
 private three?:typeof import('three');
 private model?:typeof import('@mlightcad/data-model');
 private hostDoc?:AcApDocument;
 private retained=new Map<string,LoadedDrawing>();
 readonly loaded:LoadedDrawing[]=[];
 private originalColors=false;
 constructor(private container:HTMLElement,private lookupReference?:ReferenceLookup,private progress?:(message:string)=>void){}
 private async init() {
  if(this.manager) return;
  const [cad,model,converter,three]=await Promise.all([import('@mlightcad/cad-simple-viewer'),import('@mlightcad/data-model'),import('@mlightcad/libredwg-converter'),import('three')]);
  const assets=new URL(`${import.meta.env.BASE_URL}assets/`,location.href);
  const worker=new URL('libredwg-parser-worker.js',assets).href;
  model.AcDbDatabaseConverterManager.instance.register(model.AcDbFileType.DWG,new converter.AcDbLibreDwgConverter({convertByEntityType:false,useWorker:true,parserWorkerUrl:worker}));
  cad.acedApplyUiTheme('dark',this.container);
  cad.AcApDocManager.createInstance({container:this.container,autoResize:true,disableExport:true,baseUrl:'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',webworkerFileUrls:{dwgParser:worker,mtextRender:new URL('mtext-renderer-worker.js',assets).href}});
  this.manager=cad.AcApDocManager.instance; this.modules=cad; this.three=three;this.model=model;
 }
 async add(drawing:Drawing,content:ArrayBuffer) {
  await this.init();
  const m=this.manager!;
  if(this.loaded.some(x=>x.drawing.id===drawing.id)) return;
  const cached=this.retained.get(drawing.id);
  if(cached && cached.drawing.revision===drawing.revision && cached.drawing.size===drawing.size){cached.visible=true;cached.root.visible=true;this.loaded.push(cached);this.retained.delete(drawing.id);await this.mount();return;}
  const color=COLORS[this.loaded.length%COLORS.length];
  try {
   const rendered=await this.renderDrawing(drawing,content,color,[],{remaining:32});
   if(!hasDrawingBounds(rendered.box))throw new Error(`${drawing.name} har ingen synlig modellgeometri. ${rendered.warnings.join(' ')||'Innholdet kan ligge i tegningsark eller på skjulte lag.'}`);
   this.loaded.push({...rendered,drawing,color,visible:true});
   await this.mount();
  } catch(error){if(this.hostDoc)await this.mount();throw error;}
 }
 private async renderDrawing(drawing:Drawing,content:ArrayBuffer,color:string,chain:string[],budget:{remaining:number}):Promise<RenderedDrawing>{
  if(chain.includes(drawing.id))throw new Error(`Sirkelreferanse til ${drawing.name}.`);
  if(chain.length>=8||budget.remaining--<=0)throw new Error('Tegningen har for mange eller for dypt nestede underlag.');
  const m=this.manager!,model=this.model!,three=this.three!;
  this.progress?.(`Viser ${drawing.name}`);
  const ok=await m.openDocument(drawing.name,content,{mode:this.modules!.AcEdOpenMode.Read,progressiveRendering:false,openViewMode:this.modules!.AcApOpenViewMode.Extents});
  if(!ok) throw new Error(`Vieweren kunne ikke tolke ${drawing.name}. DWG-versjonen eller innholdet støttes kanskje ikke.`);
  const doc=m.curDocument;
  {
   const view=m.curView;
   view.activeLayoutBtrId=view.cadScene.modelSpaceBtrId;
   await view.ensureEntitiesConvertedForExport({includeLayouts:false,includeInvisibleLayers:false});
   if(!await view.waitUntilIdle()) throw new Error('Tegningen ble ikke ferdig konvertert innen tidsgrensen.');
   // A file may have been saved on a paper-space tab. Export conversion can
   // restore that visibility, so explicitly show model space in our composite.
   for(const [id,layout] of view.cadScene.layouts) layout.visible=id===view.cadScene.modelSpaceBtrId;
   const nativeBox=view.cadScene.modelSpaceLayout?.box;
   const box=hasDrawingBounds(nativeBox)?nativeBox!.clone():new three.Box3();
   const requests:{name:string;path:string;transform:import('three').Matrix4}[]=[];
   // Capture INSERT transforms while this document is the active database.
   // Several project drawings contain only these external references.
   const collect=(record:import('@mlightcad/data-model').AcDbBlockTableRecord,transform:import('three').Matrix4,blocks:Set<string>)=>{
    if(blocks.has(record.name))return;
    const visited=new Set(blocks).add(record.name);
    for(const entity of record.newIterator()){
     if(!(entity instanceof model.AcDbBlockReference)||!entity.visibility)continue;
     const layer=doc.database.tables.layerTable.getAt(entity.layer);
     if(layer?.isOff||layer?.isFrozen||layer?.isHidden)continue;
     const target=entity.blockTableRecord;
     if(!target)continue;
     const matrix=transform.clone().multiply(new three.Matrix4().fromArray(entity.blockTransform.elements));
     if(target.isUnresolvedXref){requests.push({name:target.name,path:target.pathName,transform:matrix});}
     else if(!target.isXref){collect(target,matrix,visited);}
    }
   };
   collect(doc.database.tables.blockTable.modelSpace,new three.Matrix4(),new Set());
   if(!this.originalColors) m.setCompareDisplay({enabled:true,baseColor:parseInt(color.slice(1),16)});
   // Mount the fully rendered model, including expanded INSERTs, dimensions
   // and deferred glyph meshes. Native loadOverlay currently skips INSERTs.
   // Move the actual render roots: some CAD subclasses cannot be cloned with
   // THREE.Object3D.clone(). The source document retains ownership for cleanup.
   const root=new this.three!.Group();
   root.name=drawing.name;
   for(const child of [...view.internalScene.children]) root.add(child);
   const result:RenderedDrawing={root,box,sources:[{doc,scene:view.cadScene}],references:[],warnings:[]};
   for(const request of requests){
    try{
     this.progress?.(`Henter underlag ${request.name} til ${drawing.name}`);
     const reference=await this.lookupReference?.(drawing,request.name,request.path);
     if(!reference){result.warnings.push(`Mangler underlaget ${request.name}.`);continue;}
     const child=await this.renderDrawing(reference.drawing,reference.content,color,[...chain,drawing.id],budget);
     child.root.matrix.copy(request.transform);child.root.matrixAutoUpdate=false;child.root.matrixWorldNeedsUpdate=true;
     root.add(child.root);
     if(hasDrawingBounds(child.box))box.union(child.box.clone().applyMatrix4(request.transform));
     result.sources.push(...child.sources);
     result.references.push(reference.drawing.name,...child.references);
     result.warnings.push(...child.warnings);
    }catch(error){result.warnings.push(`${request.name}: ${error instanceof Error?error.message:'Underlaget kunne ikke åpnes.'}`);}
   }
   return result;
  }
 }
 private async mount() {
  const m=this.manager!;
  if(!this.hostDoc) {
   const blank='0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n';
   if(!await m.openDocument('Samlet visning.dxf',new TextEncoder().encode(blank).buffer,{mode:this.modules!.AcEdOpenMode.Read})) throw new Error('Kunne ikke opprette samlet visning.');
   this.hostDoc=m.curDocument;
  } else await m.activateDocument(this.hostDoc);
  for(const item of this.loaded) m.curView.internalScene.add(item.root);
  await m.curView.waitUntilIdle();
  m.curView.markLayoutAsInitialized(m.curView.activeLayoutBtrId);
  m.curView.isDirty=true;
  this.fit();
 }
 setVisible(id:string,visible:boolean) {
  const item=this.loaded.find(x=>x.drawing.id===id);
  if(!item || !this.manager) return;
  item.visible=visible; item.root.visible=visible; this.manager.curView.isDirty=true;
 }
 async remove(id:string) {
  const index=this.loaded.findIndex(x=>x.drawing.id===id);
  if(index<0 || !this.manager) return;
  const [item]=this.loaded.splice(index,1);
  item.root.removeFromParent();
  // Closing a parked source session can dispose buffers still used by the
  // composite. Retain removed sources for this session and reuse on reopen.
  this.retained.set(id,item);
  this.manager.curView.isDirty=true;
  this.fit();
 }
 fit() {
  if(!this.manager || !this.three || !this.loaded.length) return;
  const box=new this.three.Box3();
  for(const item of this.loaded) if(item.visible) box.union(item.box);
  if(box.isEmpty()) return;
  this.manager.curView.zoomTo(new this.model!.AcGeBox2d({x:box.min.x,y:box.min.y},{x:Math.max(box.max.x,box.min.x+1),y:Math.max(box.max.y,box.min.y+1)}),1.12);
  this.manager.curView.isDirty=true;
 }
 zoom(factor:number) {
  if(!this.manager) return;
  const camera=this.manager.curView.internalCamera;
  this.manager.curView.activeLayoutView.flyTo({x:camera.position.x,y:camera.position.y},camera.zoom*factor);this.manager.curView.isDirty=true;
 }
 async setOriginalColors(original:boolean) {
  this.originalColors=original;
  if(!this.manager) return;
  for(const item of this.loaded) {
   for(const source of item.sources)source.scene.setCompareDisplay({enabled:!original,baseColor:parseInt(item.color.slice(1),16)});
  }
  this.manager.curView.isDirty=true;
 }
}
