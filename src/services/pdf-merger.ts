'use server';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Merges multiple PDF and image files into a single PDF document.
 * If a file is corrupt or unsupported, an error page is inserted in its place.
 * @param files An array of file objects, each with a dataUri, mimeType, and optional name.
 * @returns A Base64 encoded string of the merged PDF data URI.
 */
export async function mergeFiles(
  files: { dataUri: string; mimeType: string; name?: string }[]
): Promise<string> {
  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);

  for (const file of files) {
    try {
      if (file.mimeType === 'application/pdf') {
        const pdfBytes = Buffer.from(file.dataUri.split(',')[1], 'base64');
        const pdf = await PDFDocument.load(pdfBytes, {
          // This option may help with some slightly malformed PDFs.
          ignoreEncryption: true,
        });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      } else if (file.mimeType.startsWith('image/')) {
        const imageBytes = Buffer.from(file.dataUri.split(',')[1], 'base64');
        let image;
        if (file.mimeType === 'image/png') {
            image = await mergedPdf.embedPng(imageBytes);
        } else if (file.mimeType === 'image/jpeg' || file.mimeType === 'image/jpg') {
            image = await mergedPdf.embedJpg(imageBytes);
        } else {
            throw new Error(`Unsupported image type: ${file.mimeType}`);
        }
        
        const page = mergedPdf.addPage();
        const { width, height } = image.scale(1);
        
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const scale = Math.min(pageWidth / width, pageHeight / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        page.drawImage(image, { x, y, width: scaledWidth, height: scaledHeight });
      } else {
          throw new Error(`Unsupported file type: ${file.mimeType}`);
      }
    } catch (e: any) {
        console.error(`Could not process file. Error: ${e.message}`);
        const page = mergedPdf.addPage();
        const { width, height } = page.getSize();
        const fileNameText = file.name ? `File: ${file.name}` : 'A source file';
        const errorText = `Error: Could not process this file. It may be corrupt or an unsupported format.`;
        
        page.drawText(fileNameText, {
            x: 50,
            y: height - 50,
            font,
            size: 14,
            color: rgb(1, 0, 0), // Red
        });
        page.drawText(errorText, {
            x: 50,
            y: height - 80,
            font,
            size: 12,
            color: rgb(0, 0, 0),
        });
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  const mergedPdfBase64 = Buffer.from(mergedPdfBytes).toString('base64');
  return `data:application/pdf;base64,${mergedPdfBase64}`;
}
