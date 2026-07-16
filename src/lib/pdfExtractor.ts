import type { BookChapter, BookImage } from './indexedDB';

export interface ExtractionResult {
  chapters: BookChapter[];
  images: BookImage[];
  wordCount: number;
  title?: string;
  author?: string;
}

export interface ProgressCallback {
  (status: string, progress: number): void;
}

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
  fontName?: string;
};

type LineItem = {
  text: string;
  y: number;
  x: number;
  height: number;
  fontSize: number;
  width: number;
};

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // Use the bundled worker via URL import for Vite compatibility
  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

export async function extractPdf(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ExtractionResult> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const meta = await pdf.getMetadata().catch(() => null);
  const info = (meta?.info as Record<string, unknown>) ?? {};
  const title = (info.Title as string) || undefined;
  const author = (info.Author as string) || undefined;

  const chapters: BookChapter[] = [];
  const images: BookImage[] = [];
  let wordCount = 0;

  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress('Extracting text...', pageNum / numPages);
    }
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = textContent.items as TextItem[];
    const lines = buildLines(items);

    // Extract images from the page
    try {
      const ops = await page.getOperatorList();
      const OPS = pdfjs.OPS;
      const imgIdx = ops.fnArray.indexOf(OPS.paintImageXObject);
      if (imgIdx !== -1) {
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === OPS.paintImageXObject) {
            const imgName = ops.argsArray[i][0];
            try {
              const imgObj = await new Promise<{
                width: number;
                height: number;
                data: Uint8ClampedArray;
                kind: number;
              }>((resolve, reject) => {
                page.objs.get(imgName, (obj: unknown) => {
                  if (obj && typeof obj === 'object' && 'data' in obj) {
                    resolve(obj as typeof imgObj);
                  } else {
                    reject(new Error('no img'));
                  }
                });
              });
              const dataUrl = imageToDataUrl(imgObj);
              if (dataUrl) {
                images.push({ id: `p${pageNum}-img${i}`, dataUrl });
              }
            } catch {
              // skip image
            }
          }
        }
      }
    } catch {
      // skip image extraction
    }

    const chapter = buildChapter(pageNum, lines);
    chapters.push(chapter);
    wordCount += chapter.html
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  }

  return { chapters, images, wordCount, title, author };
}

function imageToDataUrl(img: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  kind: number;
}): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // PDF.js ImageKind: 1 = grayscale, 2 = RGB
    if (img.kind === 1) {
      const imageData = ctx.createImageData(img.width, img.height);
      for (let i = 0; i < img.data.length; i++) {
        const v = img.data[i];
        imageData.data[i * 4] = v;
        imageData.data[i * 4 + 1] = v;
        imageData.data[i * 4 + 2] = v;
        imageData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    } else {
      const imageData = ctx.createImageData(img.width, img.height);
      imageData.data.set(img.data);
      ctx.putImageData(imageData, 0, 0);
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function buildLines(items: TextItem[]): LineItem[] {
  const lineMap = new Map<number, LineItem[]>();

  for (const item of items) {
    if (!item.str || item.str.trim() === '') continue;
    const transform = item.transform;
    const x = transform[4];
    const y = Math.round(transform[5]);
    const fontSize = Math.hypot(transform[2], transform[3]);
    const height = item.height || fontSize;

    const key = y;
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key)!.push({
      text: item.str,
      y,
      x,
      height,
      fontSize,
      width: item.width,
    });
  }

  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
  const lines: LineItem[] = [];

  for (const y of sortedYs) {
    const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
    const mergedText = parts.map((p) => p.text).join('');
    const avgHeight =
      parts.reduce((sum, p) => sum + p.height, 0) / parts.length;
    const avgFontSize =
      parts.reduce((sum, p) => sum + p.fontSize, 0) / parts.length;
    lines.push({
      text: mergedText,
      y,
      x: parts[0].x,
      height: avgHeight,
      fontSize: avgFontSize,
      width: parts.reduce((sum, p) => sum + p.width, 0),
    });
  }

  return lines;
}

function buildChapter(pageNum: number, lines: LineItem[]): BookChapter {
  if (lines.length === 0) {
    return { title: `Page ${pageNum}`, html: '' };
  }

  // Detect the dominant font size (body text)
  const fontSizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 10;

  const paragraphs: string[] = [];
  let currentPara = '';
  let prevY: number | null = null;
  let prevFontSize = medianFontSize;

  for (const line of lines) {
    const isHeading = line.fontSize > medianFontSize * 1.4;
    const isNewParagraph =
      prevY === null ||
      Math.abs(line.y - prevY) > line.height * 2.5 ||
      line.x > 60; // indented or big gap

    // Flush current paragraph if we hit a heading
    if (isHeading && currentPara.trim()) {
      paragraphs.push(currentPara.trim());
      currentPara = '';
    }

    if (isHeading) {
      const level = line.fontSize > medianFontSize * 1.8 ? 'h1' : 'h2';
      paragraphs.push(`<${level}>${escapeHtml(line.text.trim())}</${level}>`);
      prevY = line.y;
      prevFontSize = line.fontSize;
      continue;
    }

    if (isNewParagraph && currentPara.trim()) {
      paragraphs.push(currentPara.trim());
      currentPara = '';
    }

    // Join hyphenated line breaks
    let text = line.text;
    if (currentPara.endsWith('-') && /^[a-z]/i.test(text)) {
      currentPara = currentPara.slice(0, -1) + text;
    } else {
      currentPara = currentPara
        ? currentPara + (currentPara.endsWith(' ') ? '' : ' ') + text
        : text;
    }

    prevY = line.y;
    prevFontSize = line.fontSize;
  }

  if (currentPara.trim()) {
    paragraphs.push(currentPara.trim());
  }

  // Clean up multiple spaces
  const html = paragraphs
    .map((p) => {
      if (p.startsWith('<h')) return p;
      return `<p>${p.replace(/\s+/g, ' ').trim()}</p>`;
    })
    .join('\n');

  // Try to find a title from the first heading
  const titleMatch = paragraphs.find((p) => p.startsWith('<h1>'));
  const title = titleMatch
    ? titleMatch.replace(/<\/?h1>/g, '').trim()
    : `Page ${pageNum}`;

  return { title, html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
