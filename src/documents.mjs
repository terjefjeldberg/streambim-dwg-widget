export function normalizeDocuments(rows) {
  const unique = new Map();
  for (const row of rows) {
    const a = row.attributes ?? row;
    if (a['is-deleted'] || a.isDeleted || !/\.dwg$/i.test(a.filename ?? '')) continue;
    unique.set(String(row.id), {id:String(row.id), name:a.filename, folder:a.path || 'Prosjektrot', size:Number(a.filesize)||0, revision:a.revision, modified:a['last-modified'] || a.uploadedDate || a['uploaded-date'] || ''});
  }
  return [...unique.values()].sort((a,b)=>a.folder.localeCompare(b.folder,'nb',{numeric:true}) || a.name.localeCompare(b.name,'nb',{numeric:true}));
}
export async function collectDocuments(request, projectId) {
  const rows = [], seen = new Set();
  for (let skip=0;;) {
    const query = new URLSearchParams({'page[limit]':'100','page[skip]':String(skip)});
    const raw = await request(`/project-${projectId}/api/v1/v2/documents?${query}`);
    const page = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(page.data)) throw new Error('StreamBIM returnerte en ugyldig dokumentliste.');
    if (!page.data.length) break;
    let added=0;
    for(const row of page.data) if (!seen.has(String(row.id))) {seen.add(String(row.id)); rows.push(row); added++;}
    if (!added) throw new Error('StreamBIM gjentok samme side. Dokumentlisten kan være ufullstendig.');
    skip += page.data.length;
    if (Number.isFinite(page.meta?.total) && skip >= page.meta.total) break;
    // Continue until empty even when the backend caps page size below our limit.
  }
  return normalizeDocuments(rows);
}
export function resolveDownloadLink(raw, projectId, origin) {
  let value = raw;
  if (typeof raw === 'string') {try {value=JSON.parse(raw);} catch {value=raw;}}
  const path = typeof value === 'string' ? value : value?.data;
  if (typeof path !== 'string' || !path.trim()) throw new Error('StreamBIM returnerte ingen nedlastingslenke.');
  const base = `${origin}/project-${projectId}/api/v1/`;
  const trimmed = path.trim();
  const url = /^https:\/\//i.test(trimmed) ? new URL(trimmed) : new URL(trimmed.startsWith('/documents/') ? trimmed.slice(1) : trimmed, base);
  if(url.protocol!=='https:') throw new Error('Nedlastingslenken må bruke HTTPS.');
  if(url.origin !== origin && !/^https:\/\//i.test(trimmed)) throw new Error('Ugyldig nedlastingslenke.');
  return url.href;
}
