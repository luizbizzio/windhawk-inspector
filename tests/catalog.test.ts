import {describe,it,expect} from 'vitest';
import {parseCatalog,filterCatalog,formatCatalogSummary} from '../src/catalog';
const data={generatedAt:'2026-11-08T00:00:00Z',mods:[
{id:'taskbar-zones',name:'Taskbar Zones',author:'Luiz',users:120},
{id:'taskbar-styler',name:'Windows Taskbar Styler',author:'Someone',users:10000},
{id:'other',name:'Other Tool',author:'Another',users:5000}]};
describe('mod catalog',()=>{
  it('validates, filters, and ranks exact ID before popularity',()=>{
    const mods=parseCatalog(data).mods;
    expect(filterCatalog(mods,'taskbar')[0].id).toBe('taskbar-styler');
    expect(filterCatalog(mods,'taskbar-zones')[0].id).toBe('taskbar-zones');
    expect(filterCatalog(mods,'zones')[0].id).toBe('taskbar-zones');
  });
  it('formats count and UTC update date dynamically from catalog data',()=>{
    expect(formatCatalogSummary(parseCatalog(data))).toBe('3 mods · Updated 08/11/2026');
    const newer = parseCatalog({...data, generatedAt:'2026-11-09T23:59:59Z'});
    expect(formatCatalogSummary(newer)).toBe('3 mods · Updated 09/11/2026');
  });
  it('rejects malformed catalogs',()=>{
    expect(()=>parseCatalog({mods:[],generatedAt:'bad'})).toThrow();
    expect(()=>parseCatalog({mods:[],generatedAt:'2026-11-08T00:00:00Z'})).toThrow();
  });
});
