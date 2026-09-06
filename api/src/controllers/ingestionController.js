const ParserService = require('../services/parserService');
const SanitizerService = require('../services/sanitizerService');
const SchemaTagger = require('../services/schemaTagger');
const TableBuilderService = require('../services/tableBuilderService');

exports.handleIngestion = async (req, res) => {
  try {
    // 0. Validasi File
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File wajib diunggah!' });
    }

    // Step 1: Auto-Parsing
    const rawData = await ParserService.parseFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    // Step 2: Sanitization & Deduplication
    const processedData = SanitizerService.cleanData(rawData);

    // Ambil baris data yang sudah bersih dan sampel untuk AI
    const cleanedRows = processedData.data; // Array dari data bersih
    const sampleRows = cleanedRows.slice(0, 3);

    // Step 3: AI Auto-Tagging & Categorization (Groq / Llama 3)
    const aiAnalysis = await SchemaTagger.autoTagAndCategorize(
      processedData.columns,
      sampleRows
    );

    // Step 4: Dynamic Auto-Create Table & Bulk Insert ke MySQL
    const dbResult = await TableBuilderService.createTableAndInsertData(
      aiAnalysis.suggestedTableName, // 'publication_history'
      aiAnalysis.columnTags,         // { baris_ke: 'numeric', konten_teks: 'text_unstructured' }
      cleanedRows                   // 320 baris data bersih
    );

    // Step 5: Response Akhir Lengkap
    return res.json({
      success: true,
      message: 'Data berhasil di-ingest, dibersihkan, di-tag AI, dan disimpan ke MySQL!',
      summary: {
        filename: req.file.originalname,
        originalRows: processedData.totalOriginal,
        cleanedRows: processedData.totalCleaned,
        duplicatesRemoved: processedData.duplicatesRemoved,
        detectedCategory: aiAnalysis.datasetCategory,
        suggestedTableName: aiAnalysis.suggestedTableName,
        targetTable: dbResult.tableName,
        totalInsertedRows: dbResult.insertedRows
      },
      schema: {
        columns: processedData.columns,
        columnTags: aiAnalysis.columnTags
      },
      sampleData: sampleRows
    });

  } catch (error) {
    console.error("Error during ingestion process:", error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses ingestion data',
      error: error.message
    });
  }
};