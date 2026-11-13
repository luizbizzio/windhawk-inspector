import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const CATALOG_URL = 'https://mods.windhawk.net/catalogs/en.json';
const MAX_BYTES = 15_000_000;
const ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
export function normalizeCatalog(source, generatedAt=new Date().toISOString()) {
  if (!source || typeof source !== 'object' || !source.mods || typeof source.mods !== 'object' || Array.isArray(source.mods))
    throw new Error('Invalid official Windhawk catalog');
  const mods = [];
  for (const [id, info] of Object.entries(source.mods)) {
    if (!ID.test(id) || !info || typeof info !== 'object') continue;
    const metadata=info.metadata;
    if (!metadata || typeof metadata !== 'object') continue;
    const name=typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim().slice(0,140) : id;
    const author=typeof metadata.author==='string'?metadata.author.trim().slice(0,80):'';
    const users=Number.isSafeInteger(info.details?.users)&&info.details.users>=0?info.details.users:0;
    mods.push({id,name,author,users});
  }
  if (!mods.length) throw new Error('Windhawk catalog is empty');
  mods.sort((a,b)=>b.users-a.users||a.name.localeCompare(b.name));
  return {generatedAt,mods};
}
async function downloadCatalog() {
  const res = await fetch(CATALOG_URL, {headers:{accept:'application/json'},signal:AbortSignal.timeout(45000)});
  if (!res.ok || !res.body) throw new Error(`Windhawk catalog returned ${res.status}`);
  if (Number(res.headers.get('content-length'))>MAX_BYTES) throw new Error('Catalog too large');
  const reader=res.body.getReader();const chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>MAX_BYTES)throw new Error('Catalog too large');chunks.push(value);}
  } finally {reader.releaseLock();}
  const data=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)),size);
  return JSON.parse(data.toString('utf8'));
}
export async function buildCatalog() {
  const payload=normalizeCatalog(await downloadCatalog());
  const dir=new URL('../public/data/',import.meta.url);
  await mkdir(dir,{recursive:true});
  await writeFile(new URL('catalog.json',dir),JSON.stringify(payload));
  console.log(`Generated ${payload.mods.length} Windhawk mods`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCatalog().catch(error=>{console.error(error);process.exitCode=1;});
}
