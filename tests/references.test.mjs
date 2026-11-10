import test from 'node:test';
import assert from 'node:assert/strict';
import {findReference,hasDrawingBounds} from '../src/references.mjs';
test('a reference-only drawing resolves named DWG underlays from the same folder',()=>{
 const parent={id:'sheet',folder:'Architecture'};
 const files=[{id:'a',name:'Plan.DWG',folder:'Architecture'},{id:'b',name:'Plan.dwg',folder:'Archive'},{id:'c',name:'Grid.dwg',folder:'Shared'}];
 assert.equal(findReference(files,parent,'Plan').id,'a');
 assert.equal(findReference(files,parent,'Grid').id,'c');
 assert.equal(findReference(files,parent,'Other','C:\\old\\Plan.dwg').id,'a');
});
test('unresolved and ambiguous underlays are never silently replaced by another drawing',()=>{
 const parent={id:'sheet',folder:'Architecture'};
 assert.equal(findReference([],parent,'Missing'),undefined);
 assert.throws(()=>findReference([{id:'a',name:'Plan.dwg',folder:'Archive 1'},{id:'b',name:'Plan.dwg',folder:'Archive 2'}],parent,'Plan'),/Flere prosjektfiler/);
});
test('an explicit reference path takes precedence over the host folder and block alias',()=>{
 const files=[{id:'local',name:'Plan.dwg',folder:'Architecture'},{id:'archive',name:'Plan.dwg',folder:'Archive'},{id:'alias',name:'LinkedPlan.dwg',folder:'Architecture'}];
 assert.equal(findReference(files,{folder:'Architecture'},'LinkedPlan','C:\\export\\Archive\\Plan.dwg').id,'archive');
});
test('empty or non-finite native extents cannot be accepted as a visible drawing',()=>{
 assert.equal(hasDrawingBounds({min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}}),false);
 assert.equal(hasDrawingBounds({min:{x:0,y:0,z:0},max:{x:NaN,y:2,z:0}}),false);
 assert.equal(hasDrawingBounds({min:{x:1,y:2,z:0},max:{x:10,y:20,z:0}}),true);
});
