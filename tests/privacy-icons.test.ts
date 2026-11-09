import { describe, expect, it } from 'vitest';
import { ACTIVITY_SHAPES, activityGlyph, activityGlyphShapes, activityIconSvg } from '../src/analysis/privacy-icons';
import { buildInsights } from '../src/analysis/insights';
import { findingsFromCalls } from '../src/analysis/rules';
import { findLexicalCalls } from '../src/analysis/lexical';
import type { Finding } from '../src/analysis/types';

const fake = (ruleId:string, symbol:string, title:string):Finding => ({
  id:ruleId, ruleId, symbol, title, line:2, column:1, category:'File System',
  severity:'medium', certainty:'detected', explanation:'', recommendation:'', excerpt:'',
});

describe('privacy-style activity icons',()=>{
  it('uses distinct icons for common capabilities',()=>{
    expect(activityGlyph('network')).toBe('globe');
    expect(activityGlyph('files-write')).toBe('file-pen');
    expect(activityGlyph('files-delete')).toBe('trash');
    expect(activityGlyph('files-read')).toBe('file-search');
    expect(activityGlyph('shortcut-checks')).toBe('keyboard');
    expect(activityGlyph('permission-changes')).toBe('shield-alert');
    expect(activityGlyph('camera')).toBe('camera');
    expect(activityGlyph('microphone')).toBe('microphone');
  });
  it('has static SVG for every supported glyph and a neutral fallback',()=>{
    for(const name of Object.keys(ACTIVITY_SHAPES)) {
      expect(activityGlyphShapes(name).length).toBeGreaterThan(0);
      expect(activityIconSvg(name)).toContain('<svg');
    }
    expect(activityGlyph('<img src=x onerror=alert(1)>')).toBe('activity');
    expect(activityIconSvg('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });
  it('uses camera and microphone symbols only for explicit capture APIs',()=>{
    const source = `capCreateCaptureWindowW(L"video", 0, 0, 0, 100, 100, nullptr, 1);
waveInOpen(&handle, WAVE_MAPPER, &fmt, 0, 0, CALLBACK_NULL);
MFEnumDeviceSources(attrs, &devices, &count);`;
    const findings = findingsFromCalls(findLexicalCalls(source));
    const topics = buildInsights({findings});
    expect(topics.some(item => item.id==='camera')).toBe(true);
    expect(topics.some(item => item.id==='microphone')).toBe(true);
    expect(topics.find(item => item.id==='camera')?.priority).toBe('review');
    expect(topics.find(item => item.id==='microphone')?.priority).toBe('review');
    expect(topics.map(item=>activityGlyph(item.id))).toContain('camera');
    expect(topics.map(item=>activityGlyph(item.id))).toContain('microphone');
    // Device enumeration requires video/audio attribute context to infer access.
    expect(findings.some(item=>item.symbol==='MFEnumDeviceSources')).toBe(false);
  });
  it('maps real findings to the correct category without creating camera findings',()=>{
    const items=buildInsights({findings:[fake('fs-write','WriteFile','File or handle write'), fake('reg-read','RegQueryValueExW','Registry read') ]});
    expect(items.map(item=>activityGlyph(item.id))).toContain('file-pen');
    expect(items.map(item=>activityGlyph(item.id))).toContain('settings');
    expect(items.some(item=>item.id==='camera')).toBe(false);
  });
});
