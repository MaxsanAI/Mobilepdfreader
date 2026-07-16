import type { Book, BookChapter, ReaderSettings } from './indexedDB';
import { DEFAULT_SETTINGS } from './indexedDB';

export function estimateReadingTime(wordCount: number): number {
  const wpm = 220;
  return Math.max(1, Math.ceil(wordCount / wpm));
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min read`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}min` : `${hours}h read`;
}

export function buildReaderHtml(book: Book): string {
  const chapters = book.chapters
    .map((ch, i) => {
      return `<section class="chapter" data-chapter="${i}" id="chapter-${i}">
        <h1 class="chapter-title">${escapeHtml(ch.title)}</h1>
        ${ch.html}
      </section>`;
    })
    .join('\n');

  return `<div class="reader-body">${chapters}</div>`;
}

export function generateCover(book: Book): string {
  // Generate an SVG cover from the title
  const initials = book.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  const colors = [
    ['#2563eb', '#1e40af'],
    ['#0891b2', '#155e75'],
    ['#7c3aed', '#5b21b6'],
    ['#db2777', '#9d174d'],
    ['#ea580c', '#c2410c'],
    ['#16a34a', '#14532d'],
  ];
  const [c1, c2] = colors[
    Math.abs(hashCode(book.title)) % colors.length
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/>
        <stop offset="1" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="240" height="320" fill="url(#g)"/>
    <text x="120" y="160" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${escapeHtml(initials)}</text>
    <text x="120" y="280" font-family="system-ui, sans-serif" font-size="13" fill="rgba(255,255,255,0.85)" text-anchor="middle">${escapeHtml(truncate(book.title, 28))}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function exportBookAsHtml(book: Book): string {
  const settings: ReaderSettings = book.settings || DEFAULT_SETTINGS;
  const readingTime = formatReadingTime(estimateReadingTime(book.wordCount));

  const chaptersHtml = book.chapters
    .map((ch, i) => {
      return `<section class="chapter" id="chapter-${i}">
        <h1>${escapeHtml(ch.title)}</h1>
        ${ch.html}
      </section>`;
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(book.title)}</title>
<style>
  :root {
    --bg: #ffffff;
    --text: #1f2937;
    --fs: ${settings.fontSize}px;
    --w: ${getWidthValue(settings.width)}px;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: ${settings.fontFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'};
    font-size: var(--fs);
    line-height: 1.75;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: var(--w);
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  header {
    text-align: center;
    padding: 2rem 0 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 2rem;
  }
  header h1 { font-size: 1.6em; margin: 0 0 0.3em; }
  header .meta { color: #6b7280; font-size: 0.85em; }
  .chapter { margin-bottom: 3rem; }
  .chapter h1 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  p { margin: 0 0 1.25em; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  @media (max-width: 600px) {
    :root { --w: 100%; }
    .container { padding: 1rem 1rem 3rem; }
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>${escapeHtml(book.title)}</h1>
    <div class="meta">${escapeHtml(book.fileName)} &middot; ${readingTime} &middot; ${book.wordCount.toLocaleString()} words</div>
  </header>
  ${chaptersHtml}
</div>
</body>
</html>`;
}

export function downloadHtmlFile(book: Book): void {
  const html = exportBookAsHtml(book);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${book.title.replace(/[^a-z0-9]/gi, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getWidthValue(width: ReaderSettings['width']): number {
  switch (width) {
    case 'narrow':
      return 480;
    case 'wide':
      return 900;
    default:
      return 680;
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
