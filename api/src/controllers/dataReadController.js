const DataReadService = require('../services/dataReadService');

/**
 * Controller untuk mendapatkan semua tabel
 */
exports.getTables = async (req, res) => {
  console.log(">>> [LOG 1] Request /api/data/tables MASUK KE CONTROLLER");
  try {
    const tables = await DataReadService.getAllCreatedTables();
    return res.json({
      success: true,
      message: "Berhasil mengambil daftar tabel database",
      totalTables: tables.length,
      tables: tables
    });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar tabel",
      error: error.message
    });
  }
};

/**
 * Controller untuk mendapatkan isi data dari tabel spesifik
 */
exports.getTableDetails = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!tableName) {
      return res.status(400).json({ success: false, message: "Nama tabel wajib diisi" });
    }

    const result = await DataReadService.getTableData(tableName, page, limit);

    return res.json({
      success: true,
      message: `Berhasil mengambil data dari tabel ${tableName}`,
      ...result
    });
  } catch (error) {
    console.error(`Error fetching data for table ${req.params.tableName}:`, error);
    
    // Jika tabel tidak ditemukan di MySQL
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(404).json({
        success: false,
        message: `Tabel '${req.params.tableName}' tidak ditemukan di database.`
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data tabel",
      error: error.message
    });
  }
};