import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface ExportSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

// Standard "Folio" page size (8.5 x 13in) for PDF export, with a half-inch
// margin all around. Content is always scaled to fill the page WIDTH - never
// shrunk further just to cram everything onto a single page - and instead
// continues onto as many pages as it needs, so text stays a consistent,
// readable size whether the program is one week or twelve.
export const PDF_PAGE_WIDTH_IN = 8.5;
export const PDF_PAGE_HEIGHT_IN = 13;
export const PDF_MARGIN_IN = 0.5;

/**
 * Captures a node exactly as laid out - full width, full height, nothing
 * clipped by a scrollbar the way an on-screen table can be. Passing
 * width/height explicitly (rather than trusting toPng to infer them) locks
 * the raster's pixel size to what we measured, which paginateForPdf below
 * depends on lining up with. Pass `filter` to drop UI-only elements (e.g.
 * edit buttons) from the raster - same shape as html-to-image's own option.
 */
export async function captureFullSnapshot(
  node: HTMLElement,
  filter?: (node: Node) => boolean
): Promise<ExportSnapshot> {
  // Each table in the print copy sizes to its own natural (auto) width, so a
  // narrow category table (say, 5 columns) and a wide one (many weeks) end
  // up at different widths - the page reads as unaligned, with the header
  // spanning edge to edge while a narrower table sits docked left next to a
  // patch of blank space. Pin every table to the widest one's natural width
  // right before capturing (a concrete px value, not a percentage, so it
  // can't re-trigger the shrink-to-fit-vs-100%-width feedback loop that
  // w-full caused against this node's own w-fit sizing), then restore each
  // table's own sizing afterward so nothing changes for the live page.
  const tables = Array.from(node.querySelectorAll('table'));
  const naturalWidths = tables.map((t) => t.getBoundingClientRect().width);
  const maxTableWidth = naturalWidths.length > 0 ? Math.max(...naturalWidths) : 0;
  const previousTableWidths = tables.map((t) => t.style.width);
  if (maxTableWidth > 0) {
    tables.forEach((t) => {
      t.style.width = `${maxTableWidth}px`;
    });
  }

  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const dataUrl = await toPng(node, {
    cacheBust: true,
    width,
    height,
    backgroundColor: '#f8f9fa', // Matches the cool-toned off-white canvas background (not stark white)
    ...(filter ? { filter } : {}),
  });

  tables.forEach((t, i) => {
    t.style.width = previousTableWidths[i];
  });

  return { dataUrl, width, height };
}

/** Loads a data URL into an <img>, so it can be redrawn (sliced) onto a canvas. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Every table row's top position (in content px, relative to `node`'s own
 * top) - the only places a page break is allowed to land, so a break never
 * cuts through the middle of a row.
 */
function getPageBreakCandidates(node: HTMLElement): number[] {
  const rootTop = node.getBoundingClientRect().top;
  const rows = node.querySelectorAll('tr');
  const tops = Array.from(rows).map((row) => row.getBoundingClientRect().top - rootTop);
  return Array.from(new Set(tops)).sort((a, b) => a - b);
}

export interface ExportPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Slices one full-height snapshot into standard Folio-size (8.5x13in) pages:
 * always scaled to fill the page width, never shrunk further just to cram
 * everything onto one page, and cut at a row boundary instead of through
 * the middle of one. Content that already fits on one page still only
 * produces one page - it isn't stretched to fill it.
 */
export async function paginateForPdf(
  node: HTMLElement,
  dataUrl: string,
  contentWidth: number,
  contentHeight: number
): Promise<ExportPage[]> {
  const printableWidthIn = PDF_PAGE_WIDTH_IN - PDF_MARGIN_IN * 2;
  const printableHeightIn = PDF_PAGE_HEIGHT_IN - PDF_MARGIN_IN * 2;
  const inchesPerPx = printableWidthIn / contentWidth;
  const pageContentHeightPx = printableHeightIn / inchesPerPx;

  const candidates = getPageBreakCandidates(node);
  const img = await loadImage(dataUrl);
  // toPng rasterizes at window.devicePixelRatio, so on a Retina/HiDPI
  // screen the actual bitmap is 2x (or more) the CSS-pixel contentWidth/
  // contentHeight we measured on the live DOM. Scale our CSS-pixel math up
  // to the bitmap's real pixel grid before sampling from it, or drawImage
  // silently reads only the top-left fraction of the image - the source of
  // the "export is cut off" bug (title/last columns missing) on Retina
  // Macs, since 1x-assuming coordinates only ever covered one quarter of
  // a 2x image.
  const scale = img.naturalWidth / contentWidth;

  const pages: ExportPage[] = [];
  let cursor = 0;
  while (cursor < contentHeight - 0.5) {
    const target = cursor + pageContentHeightPx;
    let cut = contentHeight;
    if (target < contentHeight) {
      // The latest row boundary that still fits on this page - falls back
      // to a hard cut only if a single row is somehow taller than a page.
      const fitting = candidates.filter((c) => c > cursor + 1 && c <= target);
      cut = fitting.length > 0 ? fitting[fitting.length - 1] : target;
    }
    const sliceHeight = Math.max(1, Math.round(cut - cursor));
    const sourceY = Math.round(cursor * scale);
    const sourceWidth = Math.round(contentWidth * scale);
    const sourceHeight = Math.round(sliceHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    }
    pages.push({ dataUrl: canvas.toDataURL('image/png'), width: contentWidth, height: sliceHeight });
    cursor = cut;
  }
  if (pages.length === 0) {
    pages.push({ dataUrl, width: contentWidth, height: Math.max(1, contentHeight) });
  }
  return pages;
}

/** Builds a multi-page Folio PDF from paginated pages and triggers the save-as download. */
export function buildAndSavePdf(pages: ExportPage[], filename: string): void {
  const printableWidthIn = PDF_PAGE_WIDTH_IN - PDF_MARGIN_IN * 2;
  const inchesPerPx = printableWidthIn / pages[0].width;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: [PDF_PAGE_WIDTH_IN, PDF_PAGE_HEIGHT_IN],
  });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(page.dataUrl, 'PNG', PDF_MARGIN_IN, PDF_MARGIN_IN, printableWidthIn, page.height * inchesPerPx);
  });
  pdf.save(filename);
}

/** Triggers a same-tab download of a data URL. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
