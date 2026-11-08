import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog} from '../scripts/generate-catalog.mjs';
test('normalizes official catalog by popularity, ignoring invalid ids',()=>{
  const result=normalizeCatalog({mods:{'taskbar-zones':{metadata:{name:'Taskbar Zones',author:'Luiz'},details:{users:120}},'abc':{metadata:{name:'ABC'},details:{users:200}},'INVALID!':{metadata:{name:'bad'}}}},'2026-11-08T00:00:00Z');
  assert.deepEqual(result.mods.map(x=>x.id),['abc','taskbar-zones']);
  assert.equal(result.mods[1].author,'Luiz');
});
test('rejects empty or malformed official catalogs',()=>{
  assert.throws(()=>normalizeCatalog({mods:{}}),/empty/);
  assert.throws(()=>normalizeCatalog({mods:[]}),/Invalid/);
});
