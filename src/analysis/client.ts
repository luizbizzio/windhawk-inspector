import type { ScanReport } from './types';
import { MAX_AST_SOURCE_BYTES, MAX_SOURCE_BYTES } from './url';

export interface SourceInput { filename: string; source: string; }
export async function readLocalFile(file: File): Promise<SourceInput> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error('The file exceeds the 50 MB limit.');
  if (!/\.(?:wh\.cpp|cpp|h|hpp|txt)$/i.test(file.name)) throw new Error('Select a .wh.cpp, .cpp, .h, .hpp or .txt file.');
  return { filename: file.name, source: await file.text() };
}

export function runAnalysis(input: SourceInput): Promise<ScanReport> {
  const size = new TextEncoder().encode(input.source).byteLength;
  if (size > MAX_SOURCE_BYTES) {
    return Promise.reject(new Error('The source exceeds the 50 MB limit.'));
  }
  return new Promise<ScanReport>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/analyzer.worker.ts', import.meta.url), { type: 'module' });
    const id = 1;
    const timeoutMs = size > MAX_AST_SOURCE_BYTES ? 120_000 : 60_000;
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error(`Analysis timed out after ${timeoutMs / 1000} seconds.`)); }, timeoutMs);
    const finish = () => { window.clearTimeout(timeout); worker.terminate(); };
    worker.onmessage = (event: MessageEvent<{ id: number; report?: ScanReport; error?: string }>) => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.report) resolve(event.data.report);
      else reject(new Error('The analyzer returned an invalid response.'));
    };
    worker.onerror = () => { finish(); reject(new Error('Analysis worker could not start.')); };
    worker.postMessage({ id, ...input });
  });
}
