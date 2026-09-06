const db = require('../config/db');
const util = require('util');

// Mengubah db.query callback biasa menjadi Promise async/await
const query = util.promisify(db.query).bind(db);

class DataReadService {
  /**
   * Mengambil semua daftar tabel kustom
   */
  static async getAllCreatedTables() {
    const sql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY create_time DESC;
    `;
    
    // Gunakan helper query yang sudah di-promisify
    const rows = await query(sql);
    
    // Format response agar hanya mengembalikan array nama tabel
    const tableNames = rows.map(row => row.TABLE_NAME || row.table_name);
    return tableNames;
  }

  /**
   * Mengambil data dari tabel tertentu lengkap dengan pagination & total records
   */
  static async getTableData(tableName, page = 1, limit = 20) {
    // Sanitasi nama tabel sederhana
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const limitNum = parseInt(limit);
    const offsetNum = (parseInt(page) - 1) * limitNum;

    // 1. Query Total Baris Data
    const countQuery = `SELECT COUNT(*) AS total FROM \`${safeTableName}\``;
    const countResult = await query(countQuery);
    const totalRows = countResult[0].total;

    // 2. Query Data dengan Limit dan Offset
    const dataQuery = `
      SELECT * FROM \`${safeTableName}\` 
      LIMIT ? OFFSET ?
    `;
    const dataRows = await query(dataQuery, [limitNum, offsetNum]);

    return {
      tableName: safeTableName,
      pagination: {
        currentPage: parseInt(page),
        limit: limitNum,
        totalRows: totalRows,
        totalPages: Math.ceil(totalRows / limitNum)
      },
      data: dataRows
    };
  }
}

module.exports = DataReadService;
