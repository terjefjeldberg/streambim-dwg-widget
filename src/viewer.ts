import type {AcApDocManager, AcApDocument} from '@mlightcad/cad-simple-viewer';
import type {Group,Box3} from 'three';
import type {Drawing} from './streambim';
export type LoadedDrawing={drawing:Drawing;doc:AcApDocument;root:Group;box:Box3;scene:AcApDocManager['curView']['cadScene'];color:string;visible:boolean};
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
 constructor(private container:HTMLElement){}
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
  const ok=await m.openDocument(drawing.name,content,{mode:this.modules!.AcEdOpenMode.Read,progressiveRendering:false,openViewMode:this.modules!.AcApOpenViewMode.Extents});
  if(!ok) throw new Error(`Vieweren kunne ikke tolke ${drawing.name}. DWG-versjonen eller innholdet støttes kanskje ikke.`);
  const doc=m.curDocument;
  try {
   const view=m.curView;
   view.activeLayoutBtrId=view.cadScene.modelSpaceBtrId;
   await view.ensureEntitiesConvertedForExport({includeLayouts:false,includeInvisibleLayers:false});
   if(!await view.waitUntilIdle()) throw new Error('Tegningen ble ikke ferdig konvertert innen tidsgrensen.');
   // A file may have been saved on a paper-space tab. Export conversion can
   // restore that visibility, so explicitly show model space in our composite.
   for(const [id,layout] of view.cadScene.layouts) layout.visible=id===view.cadScene.modelSpaceBtrId;
   const box=view.cadScene.modelSpaceLayout?.box.clone() ?? new this.three!.Box3();
   const color=COLORS[this.loaded.length%COLORS.length];
   if(!this.originalColors) m.setCompareDisplay({enabled:true,baseColor:parseInt(color.slice(1),16)});
   // Mount the fully rendered model, including expanded INSERTs, dimensions
   // and deferred glyph meshes. Native loadOverlay currently skips INSERTs.
   // Move the actual render roots: some CAD subclasses cannot be cloned with
   // THREE.Object3D.clone(). The source document retains ownership for cleanup.
   const root=new this.three!.Group();
   root.name=drawing.name;
   for(const child of [...view.internalScene.children]) root.add(child);
   this.loaded.push({drawing,doc,root,box,scene:view.cadScene,color,visible:true});
  } catch(error) {await m.closeDocument(doc); throw error;}
  await this.mount();
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
   item.scene.setCompareDisplay({enabled:!original,baseColor:parseInt(item.color.slice(1),16)});
  }
  this.manager.curView.isDirty=true;
 }
}
