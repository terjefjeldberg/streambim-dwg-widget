export function streamBimOrigin(value) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.port||url.username||url.password||!/^([a-z0-9-]+\.)?streambim\.com$/i.test(url.hostname)) throw new Error('Bruk en HTTPS-adresse på streambim.com.');
 return url.origin;
}
export function projectId(value) {
 const id=String(value??'');
 if(!/^[1-9]\d*$/.test(id)) throw new Error('StreamBIM returnerte ingen gyldig prosjekt-ID.');
 return id;
}
export function projectFromUrl(value) {
 const url=new URL(value);
 const origin=streamBimOrigin(value);
 const hashQuery=url.hash.includes('?')?new URLSearchParams(url.hash.slice(url.hash.indexOf('?')+1)):new URLSearchParams();
 return {origin,projectId:projectId(hashQuery.get('projectId')||url.searchParams.get('projectId'))};
}
