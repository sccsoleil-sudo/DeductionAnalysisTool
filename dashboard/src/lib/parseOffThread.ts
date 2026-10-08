import type { ParseResult } from './types';
import { parseWorkbook } from './parseWorkbook';

/** Reads the workbook off the page thread so the browser does not freeze or crash. */
export function parseWorkbookOffMainThread(file: File): Promise<ParseResult> {
  if (typeof Worker === 'undefined') return parseWorkbook(file);

  return new Promise<ParseResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./parseWorkbook.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(parseWorkbook(file));
      return;
    }

    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('Reading the workbook took too long. Close other browser tabs and try again.'));
    }, 120_000);

    const finish = (error?: Error, result?: ParseResult) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (result) resolve(result);
      else reject(error ?? new Error('Could not read that workbook.'));
    };

    worker.onmessage = (event: MessageEvent<ParseResult>) => finish(undefined, event.data);
    worker.onerror = () =>
      finish(new Error('The browser ran out of memory while reading that workbook. Close other tabs and try again.'));

    file.arrayBuffer().then(
      (buffer) => worker.postMessage({ buffer, fileName: file.name }, [buffer]),
      (error: unknown) => finish(error instanceof Error ? error : new Error('Could not read that workbook.')),
    );
  });
}
