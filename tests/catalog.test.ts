import {describe,it,expect} from 'vitest';
import {parseCatalog,filterCatalog} from '../src/catalog';
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
  it('rejects malformed catalogs',()=>{
    expect(()=>parseCatalog({mods:[],generatedAt:'bad'})).toThrow();
    expect(()=>parseCatalog({mods:[],generatedAt:'2026-11-08T00:00:00Z'})).toThrow();
  });
});
