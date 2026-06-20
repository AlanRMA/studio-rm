import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { INVOICE_PREVIEW_WIDTH } from '@/lib/constants';

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
}

function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 2000);
        })
    )
  ).then(() => undefined);
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Clona o preview para fora da árvore visível (grid/colunas/overflow do layout)
 * e captura em largura fixa de 600px — evita o corte horizontal no desktop.
 */
async function captureFromOffScreenClone(node: HTMLDivElement): Promise<CaptureResult> {
  const clone = node.cloneNode(true) as HTMLDivElement;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.className = 'invoice-export-wrapper';
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${INVOICE_PREVIEW_WIDTH}px`,
    overflow: 'visible',
    background: '#ffffff',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  clone.classList.add('invoice-export-clone');
  Object.assign(clone.style, {
    width: `${INVOICE_PREVIEW_WIDTH}px`,
    minWidth: `${INVOICE_PREVIEW_WIDTH}px`,
    maxWidth: `${INVOICE_PREVIEW_WIDTH}px`,
    margin: '0',
    height: 'auto',
    overflow: 'visible',
    transform: 'none',
    boxSizing: 'border-box',
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await waitForImages(clone);
    await waitForLayout();

    const width = INVOICE_PREVIEW_WIDTH;
    const height = Math.max(clone.scrollHeight, clone.offsetHeight, clone.getBoundingClientRect().height);

    const dataUrl = await toJpeg(clone, {
      cacheBust: true,
      pixelRatio: 2,
      quality: 0.92,
      backgroundColor: '#ffffff',
      skipFonts: true,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        margin: '0',
        transform: 'none',
        overflow: 'visible',
      },
    });

    return { dataUrl, width, height };
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function captureInvoiceImage(
  node: HTMLDivElement,
  _options?: { forPrint?: boolean }
): Promise<CaptureResult> {
  return captureFromOffScreenClone(node);
}

export async function generateInvoicePdfData(
  node: HTMLDivElement
): Promise<{ dataUrl: string; height: number }> {
  const { dataUrl, width, height } = await captureFromOffScreenClone(node);

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: [width, height],
  });

  pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);

  return {
    dataUrl: pdf.output('datauristring'),
    height,
  };
}

export async function downloadInvoicePdf(node: HTMLDivElement, filename: string) {
  const { dataUrl } = await generateInvoicePdfData(node);
  downloadDataUrl(dataUrl, filename);
}

export async function downloadInvoiceJpeg(node: HTMLDivElement, filename: string) {
  const { dataUrl } = await captureInvoiceImage(node);
  downloadDataUrl(dataUrl, filename);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}