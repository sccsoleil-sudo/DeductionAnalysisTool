import { parseWorkbookBuffer } from './parseWorkbook';

interface ParseRequest {
  buffer: ArrayBuffer;
  fileName: string;
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { buffer, fileName } = event.data;
  self.postMessage(parseWorkbookBuffer(buffer, fileName));
};
