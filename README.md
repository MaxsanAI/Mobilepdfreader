# Mobile PDF Reader

Convert PDFs into a beautiful mobile reading experience — like Kindle or Safari Reader. 100% client-side, no backend, no tracking.

## Features

- **Drag & drop PDF upload** with live processing status
- **PDF.js text & image extraction** → clean, readable HTML
- **Ebook reader** with font size, themes (light/dark/sepia), and reading width controls
- **Search inside book** with highlight navigation
- **Reading progress bar** and estimated reading time
- **Bookmark position** and automatic scroll restoration
- **My Library** — books saved in IndexedDB, available offline
- **Export** — download the converted book as a standalone offline HTML file

## Tech Stack

- Astro + TypeScript
- Tailwind CSS v4
- PDF.js (pdfjs-dist)
- Browser IndexedDB API
- 100% client-side processing — no backend, no database, no auth

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is in `dist/`.

## Deploy to Cloudflare Pages

This project deploys directly from GitHub to Cloudflare Pages — no environment variables, no Wrangler, no Workers.

**Build settings:**
- Build command: `npm run build`
- Build output directory: `dist`
- No environment variables needed

## Project Structure

```
src/
 ├── pages/
 │    ├── index.astro      # Landing page with upload
 │    ├── reader.astro     # Ebook reader
 │    └── library.astro    # My Library
 ├── components/
 │    ├── PDFUploader.astro
 │    ├── ReaderControls.astro
 │    ├── BookCard.astro
 │    └── ProgressBar.astro
 ├── lib/
 │    ├── pdfExtractor.ts    # PDF.js text/image extraction
 │    ├── indexedDB.ts       # IndexedDB CRUD + types
 │    └── readerGenerator.ts # HTML generation, covers, export
 ├── layouts/
 │    └── Layout.astro
 └── styles/
      └── global.css
```

## Privacy

All PDF processing happens entirely in the browser. Files never leave your device.
