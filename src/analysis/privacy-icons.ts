// Icons describe source-code capabilities, not operating-system permissions.
// All icon geometry is static. Report content never becomes SVG markup.
export type ActivityGlyph =
  | 'camera' | 'microphone' | 'globe' | 'file-pen' | 'file-search' | 'folder-open'
  | 'trash' | 'download' | 'keyboard' | 'mouse' | 'shield' | 'shield-alert'
  | 'monitor' | 'memory' | 'puzzle' | 'package' | 'settings' | 'terminal'
  | 'lock' | 'power' | 'apps' | 'activity';

export type GlyphShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

const P = (d: string): GlyphShape => ({kind:'path',d});
const C = (cx: number,cy: number,r: number): GlyphShape => ({kind:'circle',cx,cy,r});
const R = (x: number,y: number,width: number,height: number,rx=0): GlyphShape => ({kind:'rect',x,y,width,height,rx});

export const ACTIVITY_SHAPES: Record<ActivityGlyph, readonly GlyphShape[]> = {
  camera: [P('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z'),C(12,13,3)],
  microphone: [R(9,2,6,12,3),P('M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8')],
  globe: [C(12,12,9),P('M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18')],
  'file-pen': [P('M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M13 3v6h6M10 17l7.5-7.5 2 2L12 19l-3 1z')],
  'file-search': [P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8M14 2v6h6M20 9v3'),C(15,16,3),P('m17.3 18.3 3 3')],
  'folder-open': [P('M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v3M2 20l3-9h18l-3 9z')],
  trash: [P('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 15h12l1-15M10 10v7M14 10v7')],
  download: [P('M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4')],
  keyboard: [R(2,5,20,14,2),P('M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12')],
  mouse: [R(6,2,12,20,6),P('M12 2v8M6 10h12')],
  shield: [P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'),P('m9 12 2 2 4-4')],
  'shield-alert': [P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'),P('M12 8v6m0 3v.1')],
  monitor: [R(2,3,20,15,2),P('M8 22h8M12 18v4M7 10h10')],
  memory: [R(5,5,14,14,2),R(9,9,6,6,1),P('M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3')],
  puzzle: [P('M4 4h6a2 2 0 1 1 4 0h6v6a2 2 0 1 1 0 4v6h-6a2 2 0 1 0-4 0H4v-6a2 2 0 1 1 0-4z')],
  package: [P('m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10M7.5 4.5l9 5')],
  settings: [P('M4 7h16M4 17h16'),C(9,7,2),C(15,17,2)],
  terminal: [R(2,4,20,16,2),P('m6 9 3 3-3 3m6 0h6')],
  lock: [R(5,10,14,11,2),P('M8 10V7a4 4 0 0 1 8 0v3M12 15v2')],
  power: [P('M12 2v10M6.1 5a9 9 0 1 0 11.8 0')],
  apps: [R(3,3,7,7,1),R(14,3,7,7,1),R(3,14,7,7,1),R(14,14,7,7,1)],
  activity: [C(12,12,9),P('M7 12h3l2-4 2 8 2-4h1')],
};

const MATCHES: Record<string,ActivityGlyph> = {
  'camera': 'camera',
  'microphone': 'microphone',
  'windows-components': 'puzzle',
  'extra-libraries': 'package',
  'process-details': 'monitor',
  'process-memory': 'memory',
  'permission-checks': 'shield',
  'permission-changes': 'shield-alert',
  'shortcut-checks': 'keyboard',
  'input-hooks': 'mouse',
  'files-attributes': 'file-search',
  'shell-associations': 'settings',
  'files-read': 'file-search',
  'files-write': 'file-pen',
  'files-open': 'folder-open',
  'files-delete': 'trash',
  'network': 'globe',
  'downloads': 'download',
  'registry': 'settings',
  'run-programs': 'terminal',
  'hooks': 'puzzle',
  'sensitive-data': 'lock',
  'startup': 'power',
  'scope': 'apps',
};

export function activityGlyph(id:string):ActivityGlyph {
  return Object.hasOwn(MATCHES,id) ? MATCHES[id] : 'activity';
}
export function activityGlyphShapes(id:string):readonly GlyphShape[] {
  return ACTIVITY_SHAPES[activityGlyph(id)];
}

/** Independent activity colors, not severity / safety levels. */
const ACTIVITY_COLORS: Record<ActivityGlyph,string> = {
  camera:'#d2a2ff', microphone:'#f3a9c3', globe:'#70d7c2',
  'file-pen':'#ffc27a', 'file-search':'#9bc9f7', 'folder-open':'#c0b1fa',
  trash:'#f58d90', download:'#86bbf1', keyboard:'#c5acf1', mouse:'#b8c8e7',
  shield:'#8ed0ab', 'shield-alert':'#ffb579', monitor:'#8bc0e9',
  memory:'#c4a7ef', puzzle:'#d2b3f0', package:'#d9b1f0', settings:'#e4bd8c',
  terminal:'#b7c1d4', lock:'#d3a5df', power:'#e6b47f', apps:'#b7d9a3', activity:'#c9d0d5',
};
export function activityIconColor(id:string):string {
  return ACTIVITY_COLORS[activityGlyph(id)];
}

/** Colored icon tiles with distinct hues. These indicate activity, not risk. */
const ACTIVITY_BACKGROUNDS: Record<ActivityGlyph,string> = {
  camera:'#64328c', microphone:'#752c59', globe:'#135c60',
  'file-pen':'#735022', 'file-search':'#2c567c', 'folder-open':'#58447e',
  trash:'#772e38', download:'#2c5689', keyboard:'#574181', mouse:'#425777',
  shield:'#245e42', 'shield-alert':'#78502a', monitor:'#2d597b',
  memory:'#514277', puzzle:'#5d3e7a', package:'#634575', settings:'#71512f',
  terminal:'#42536e', lock:'#603c6c', power:'#765027', apps:'#486537', activity:'#3d505c',
};
export function activityIconBackground(id:string):string {
  return ACTIVITY_BACKGROUNDS[activityGlyph(id)];
}

/** HTML report uses exactly the same icon geometry as the main interface. */
export function activityIconSvg(id:string):string {
  const markup = activityGlyphShapes(id).map(shape => {
    if (shape.kind === 'path') return `<path d="${shape.d}"/>`;
    if (shape.kind === 'circle') return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
    return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx ?? 0}"/>`;
  }).join('');
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="${activityIconColor(id)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
}
