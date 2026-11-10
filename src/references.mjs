const normalize=value=>String(value||'').replaceAll('\\','/').normalize('NFC').toLocaleLowerCase('nb');
export function findReference(drawings,parent,blockName,pathName='') {
 const names=[pathName,blockName].filter(Boolean).map(value=>normalize(value).split('/').pop()).map(value=>/\.(dwg|dxf)$/.test(value)?value:`${value}.dwg`);
 for(const name of new Set(names)){
  const candidates=drawings.filter(d=>normalize(d.name)===name);
  const explicit=candidates.filter(d=>pathName&&('/'+normalize(pathName)).endsWith('/'+normalize(`${d.folder}/${d.name}`)));
  const sameFolder=candidates.filter(d=>normalize(d.folder)===normalize(parent.folder));
  const matches=explicit.length?explicit:sameFolder.length?sameFolder:candidates;
  if(matches.length>1)throw new Error(`Flere prosjektfiler heter ${matches[0].name}. Referansen må kunne identifiseres entydig.`);
  if(matches.length)return matches[0];
 }
 return undefined;
}
export function hasDrawingBounds(box) {
 return !!box && ['x','y','z'].every(axis=>Number.isFinite(box.min[axis])&&Number.isFinite(box.max[axis])&&box.min[axis]<=box.max[axis]);
}
