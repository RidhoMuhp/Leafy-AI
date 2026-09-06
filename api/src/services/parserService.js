const xlsx = require('xlsx');
const PDFParser = require('pdf2json');
const mammoth = require('mammoth'); // Install: npm install mammoth

class ParserService {
  /**
   * Helper internal untuk membungkus pdf2json dengan Promise
   */
  static async extractPdfText(fileBuffer) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1); // 1 = text-only mode

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(new Error(errData.parserError));
      });

      pdfParser.on('pdfParser_dataReady', () => {
        const rawText = pdfParser.getRawTextContent();
        const lines = rawText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map((text, idx) => ({ baris_ke: idx + 1, konten_teks: decodeURIComponent(text) }));
        
        resolve(lines);
      });

      pdfParser.parseBuffer(fileBuffer);
    });
  }

  /**
   * Parsing file menjadi Array/Object Terstruktur
   */
  static async parseFile(fileBuffer, mimeType = '', fileName = '') {
    let rawData = [];
    const lowerFileName = fileName.toLowerCase();

    // 1. Handling Excel (.xlsx, .xls) & CSV
    if (
      mimeType.includes('spreadsheetml') || 
      mimeType.includes('excel') || 
      mimeType.includes('csv') ||
      lowerFileName.endsWith('.csv') ||
      lowerFileName.endsWith('.xlsx') ||
      lowerFileName.endsWith('.xls')
    ) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } 
    // 2. Handling Word (.docx)
    else if (
      mimeType.includes('wordprocessingml') || 
      lowerFileName.endsWith('.docx') || 
      lowerFileName.endsWith('.doc')
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const lines = result.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((text, idx) => ({ baris_ke: idx + 1, konten_teks: text }));
      rawData = lines;
    }
    // 3. Handling JSON File
    else if (mimeType.includes('json') || lowerFileName.endsWith('.json')) {
      const parsed = JSON.parse(fileBuffer.toString('utf-8'));
      rawData = Array.isArray(parsed) ? parsed : [parsed];
    } 
    // 4. Handling Plain Text (.txt, .md)
    else if (mimeType.includes('text/plain') || lowerFileName.endsWith('.txt') || lowerFileName.endsWith('.md')) {
      const lines = fileBuffer.toString('utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((text, idx) => ({ baris_ke: idx + 1, konten_teks: text }));
      rawData = lines;
    }
    // 5. Handling PDF / Jurnal
    else if (mimeType.includes('pdf') || lowerFileName.endsWith('.pdf')) {
      rawData = await this.extractPdfText(fileBuffer);
    } 
    else {
      throw new Error('Format file tidak didukung! Gunakan Excel, Word, CSV, JSON, TXT, atau PDF.');
    }

    return rawData;
  }

  /**
   * HELPER KHUSUS BASE KNOWLEDGE (RAG):
   * Mengubah hasil parsing file menjadi string polos murni agar siap disimpan di MySQL / Vector DB
   */
  static async parseToPlainText(fileBuffer, mimeType = '', fileName = '') {
    const parsedData = await this.parseFile(fileBuffer, mimeType, fileName);

    // Jika data berupa baris teks (PDF, Word, TXT)
    if (Array.isArray(parsedData) && parsedData[0]?.konten_teks) {
      return parsedData.map(item => item.konten_teks).join('\n');
    }

    // Jika data berupa JSON / Excel Tabular
    return JSON.stringify(parsedData, null, 2);
  }
}

module.exports = ParserService;