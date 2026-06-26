const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType,
} = require('docx');

async function generateDocx(siteName, entries) {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: siteName.toUpperCase(), bold: true, size: 28, color: '1F3864' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: 'ELECTRICAL INSTALLATION PROJECT – VISUAL DAILY SITE REPORT', bold: true, size: 22, color: '1F3864' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'PowerPlus Technologies Ltd', bold: true, size: 22, color: 'C9A84C' })],
    })
  );

  for (const entry of entries) {
    children.push(
      new Paragraph({
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: 'Date: ' + entry.date, bold: true, size: 26, color: '1F3864' })],
      })
    );

    const textParagraphs = parseFormattedText(entry.formattedText, siteName);
    children.push(...textParagraphs);

    if (entry.photos && entry.photos.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 300, after: 120 },
          children: [new TextRun({ text: 'Site Photos:', bold: true, size: 22, color: '1F3864' })],
        })
      );

      const photoRows = [];
      for (let i = 0; i < entry.photos.length; i += 2) {
        const cells = [];
        for (let j = i; j < Math.min(i + 2, entry.photos.length); j++) {
          const photo   = entry.photos[j];
          const imgType = getImageType(photo.mimeType);
          cells.push(
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: noBorders(),
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      type: imgType,
                      data: photo.buffer,
                      transformation: { width: 310, height: 230 },
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60 },
                  children: [new TextRun({ text: 'Image ' + (j + 1), italics: true, size: 18, color: '666666' })],
                }),
              ],
            })
          );
        }
        if (cells.length === 1) {
          cells.push(new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            children: [new Paragraph({ children: [] })],
          }));
        }
        photoRows.push(new TableRow({ children: cells }));
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders(),
          rows: photoRows,
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 400, after: 100 },
        children: [new TextRun({ text: '─'.repeat(80), color: 'DDDDDD', size: 14 })],
      })
    );
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

function noBorders() {
  const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: n, bottom: n, left: n, right: n, insideH: n, insideV: n };
}

function getImageType(mimeType) {
  if (!mimeType) return 'jpg';
  if (mimeType.includes('png'))  return 'png';
  if (mimeType.includes('gif'))  return 'gif';
  if (mimeType.includes('bmp'))  return 'bmp';
  return 'jpg';
}

function stripMarkdown(text) {
  return text
    .replace(/^#{1,3}\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function parseFormattedText(text, siteName) {
  const paragraphs     = [];
  const lines          = text.split('\n');
  const siteNameUpper  = (siteName || '').toUpperCase();
  let   inImgSection   = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!inImgSection) paragraphs.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      continue;
    }

    const clean = stripMarkdown(trimmed);
    if (!clean) continue;

    // ── Skip clutter ───────────────────────────────────────────────────────
    if (/^(DAILY SITE REPORT|SITE REPORT)$/i.test(clean)) continue;
    if (/^(SITE|DATE|LOCATION|PREPARED BY|OVERSEER|REPORTING PERIOD|REPORT DATE|CONTRACTOR)\s*:/i.test(clean)) continue;
    if (/^(IREME TECHNOLOGIES|POWERPLUS TECHNOLOGIES( LTD)?)$/i.test(clean)) continue;
    if (clean.toUpperCase() === siteNameUpper) continue;
    if (clean.toUpperCase().startsWith(siteNameUpper + ' ')) continue;
    if (/^[-─=*]{3,}$/.test(clean) || clean === '- --' || clean === '--') continue;

    // ── Images section ─────────────────────────────────────────────────────
    if (/^images?\s*:/i.test(clean)) { inImgSection = true;  continue; }
    if (/^(in short|pending work)\s*:/i.test(clean)) inImgSection = false;

    if (/^image\s+\d+\s*:/i.test(clean)) {
      paragraphs.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: clean, italics: true, size: 18, color: '555555' })],
      }));
      continue;
    }

    // ── Section headers ────────────────────────────────────────────────────
    if (/^(work completed|pending work)\s*:/i.test(clean)) {
      paragraphs.push(new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [new TextRun({ text: clean, bold: true, size: 22, color: '1F3864' })],
      }));
      continue;
    }

    // ── In short ───────────────────────────────────────────────────────────
    if (/^in short\s*:/i.test(clean)) {
      const colon = clean.indexOf(':');
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: clean.substring(0, colon + 1) + ' ', bold: true, size: 21 }),
          new TextRun({ text: clean.substring(colon + 1).trim(), size: 21 }),
        ],
      }));
      continue;
    }

    // ── Bullet points ──────────────────────────────────────────────────────
    if (/^[-•]/.test(trimmed)) {
      const content = trimmed.replace(/^[-•]\s*/, '');
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 80, after: 80 },
        children: parseBoldInline(content, 20),
      }));
      continue;
    }

    // ── Body text (task lines etc.) ────────────────────────────────────────
    if (!inImgSection) {
      paragraphs.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        children: parseBoldInline(trimmed, 20),
      }));
    }
  }

  return paragraphs;
}

function parseBoldInline(text, size) {
  size = size || 20;
  const runs  = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: size }));
    } else {
      runs.push(new TextRun({ text: part, size: size }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: text, size: size })];
}

module.exports = { generateDocx };
