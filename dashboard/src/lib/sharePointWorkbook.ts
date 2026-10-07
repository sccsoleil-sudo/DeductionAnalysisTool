import { CODIFICATION } from '../config/codification';

const FILE_KEY = 'lmd.sharepoint.file.v1';

/** True when this page is open from a SharePoint site, so it can read a sibling workbook. */
export function isSharePointPage(pageHref?: string): boolean {
  const href = pageHref ?? (typeof window === 'undefined' ? '' : window.location.href);
  if (!href) return false;
  try {
    const page = new URL(href);
    return /sharepoint/i.test(page.hostname) || /\/(?:sites|teams)\//i.test(page.pathname);
  } catch {
    return false;
  }
}

/** File name used by Refresh from SharePoint. `?sp=` on the page address wins, then a saved name. */
export function sharePointWorkbookName(): string {
  if (typeof window === 'undefined') return CODIFICATION.sharePointWorkbookFile;
  const fromQuery = new URLSearchParams(window.location.search).get('sp')?.trim();
  if (fromQuery) {
    try {
      localStorage.setItem(FILE_KEY, fromQuery);
    } catch {
      /* private mode */
    }
    return fromQuery;
  }
  try {
    const stored = localStorage.getItem(FILE_KEY)?.trim();
    if (stored) return stored;
  } catch {
    /* storage unavailable */
  }
  return CODIFICATION.sharePointWorkbookFile;
}

function folderUrl(pageHref: string): URL {
  const page = new URL(pageHref);
  page.search = '';
  page.hash = '';
  if (!page.pathname.endsWith('/')) {
    page.pathname = page.pathname.replace(/[^/]*$/, '');
  }
  return page;
}

function withDownload(fileUrl: URL): string {
  fileUrl.searchParams.set('download', '1');
  return fileUrl.toString();
}

/** Direct download of the workbook in the Deduction Management folder, or beside this page when not on SharePoint. */
export function workbookDownloadUrl(fileName: string, pageHref: string): string {
  const page = new URL(pageHref);
  if (/sharepoint/i.test(page.hostname)) {
    const folder = `${CODIFICATION.sharePointOrigin}${CODIFICATION.sharePointFolderPath}/`;
    return withDownload(new URL(fileName, folder));
  }
  return withDownload(new URL(fileName, folderUrl(pageHref).href));
}

function fileValueUrl(origin: string, sitePath: string, serverRelative: string): string {
  const encoded = encodeURI(serverRelative).replace(/'/g, "''");
  return `${origin}${sitePath}/_api/web/GetFileByServerRelativePath(decodedurl='${encoded}')/$value`;
}

/**
 * Same-site SharePoint file API. On L'Oréal SharePoint this targets the Deduction Management folder
 * even when the page address is a viewer link rather than the file itself.
 */
export function sharePointFileValueUrls(fileName: string, pageHref: string): string[] {
  const page = new URL(pageHref);
  if (/sharepoint/i.test(page.hostname)) {
    const serverRelative = `${CODIFICATION.sharePointFolderPath}/${fileName}`;
    return [
      fileValueUrl(page.origin, '/sites/ame-canada/supplychain', serverRelative),
      fileValueUrl(page.origin, '/sites/ame-canada', serverRelative),
    ];
  }
  const site = page.pathname.match(/^(.*?\/(?:sites|teams)\/[^/]+)/i);
  if (!site) return [];
  const dir = page.pathname.endsWith('/') ? page.pathname : page.pathname.replace(/[^/]*$/, '');
  let folder = dir;
  try {
    folder = decodeURI(dir);
  } catch {
    folder = dir;
  }
  return [fileValueUrl(page.origin, site[1], `${folder}${fileName}`)];
}

function isXlsx(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 2);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function readBytes(url: string): Promise<ArrayBuffer | null> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/octet-stream',
    },
  });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  return isXlsx(buffer) ? buffer : null;
}

export async function fetchSharePointWorkbook(fileName: string): Promise<File> {
  const pageHref = window.location.href;
  const urls = [
    workbookDownloadUrl(fileName, pageHref),
    ...sharePointFileValueUrls(fileName, pageHref),
  ];
  let buffer: ArrayBuffer | null = null;
  for (const url of urls) {
    buffer = await readBytes(url);
    if (buffer) break;
  }
  if (!buffer) {
    throw new Error(
      `Could not read “${fileName}” from the Deduction Management folder. Open the dashboard from that SharePoint folder while you are signed in. To use a different file name, add ?sp=FileName.xlsx to the page address.`,
    );
  }
  return new File([buffer], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
