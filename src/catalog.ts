export interface CatalogMod {
  id: string;
  name: string;
  author: string;
  users: number;
}
export interface ModCatalog {
  generatedAt: string;
  mods: CatalogMod[];
}
const ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
export function parseCatalog(value: unknown): ModCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid Windhawk catalog');
  const data = value as Record<string, unknown>;
  if (typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt)) || !Array.isArray(data.mods))
    throw new Error('Invalid Windhawk catalog format');
  const used = new Set<string>();
  const mods: CatalogMod[] = [];
  for (const entry of data.mods) {
    if (!entry || typeof entry !== 'object') continue;
    const mod = entry as Record<string, unknown>;
    if (typeof mod.id !== 'string' || !ID.test(mod.id) || typeof mod.name !== 'string' || !mod.name.trim() || used.has(mod.id)) continue;
    used.add(mod.id);
    mods.push({id:mod.id,name:mod.name.slice(0,140),author:typeof mod.author==='string'?mod.author.slice(0,80):'',
      users:typeof mod.users==='number'&&Number.isSafeInteger(mod.users)&&mod.users>=0?mod.users:0});
  }
  if (!mods.length) throw new Error('No valid Windhawk mods');
  return {generatedAt:data.generatedAt,mods};
}
export function filterCatalog(mods: CatalogMod[], raw: string, limit=12): CatalogMod[] {
  const q=raw.trim().toLocaleLowerCase();
  if(!q) return [];
  const rank=(mod:CatalogMod) => {
    const id=mod.id.toLowerCase(), name=mod.name.toLocaleLowerCase();
    if(id===q||name===q)return 0;
    if(id.startsWith(q)||name.startsWith(q))return 1;
    if(id.includes(q))return 2;
    return 3;
  };
  return mods.filter(mod=>mod.id.includes(q)||mod.name.toLocaleLowerCase().includes(q))
    .sort((a,b)=>rank(a)-rank(b)||b.users-a.users||a.name.localeCompare(b.name))
    .slice(0,Math.max(0,limit));
}
