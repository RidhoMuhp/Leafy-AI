const db = require('../config/db'); // Pastikan path ke file koneksi DB kamu sesuai

class TableBuilderService {
  /**
   * Konversi tag AI ke tipe data SQL MySQL
   */
  static mapTagToMySQLType(tag) {
    switch (tag?.toLowerCase()) {
      case 'numeric':
      case 'integer':
        return 'INT';
      case 'float':
      case 'decimal':
        return 'DECIMAL(10,2)';
      case 'date':
      case 'datetime':
        return 'DATETIME';
      case 'text_unstructured':
      case 'text_long':
        return 'LONGTEXT';
      case 'category':
      case 'text_short':
      default:
        return 'VARCHAR(255)';
    }
  }

  /**
   * Eksekusi Otomatis Create Table & Bulk Insert Data
   */
  static async createTableAndInsertData(tableName, columnTags, dataRows) {
    if (!dataRows || dataRows.length === 0) {
      throw new Error("Data kosong, tidak ada baris yang bisa dimasukkan ke database.");
    }

    const columns = Object.keys(dataRows[0]);
    
    // 1. Susun Query DDL (CREATE TABLE IF NOT EXISTS)
    const columnDefinitions = columns.map(col => {
      const tag = columnTags[col] || 'text';
      const sqlType = this.mapTagToMySQLType(tag);
      return `\`${col}\` ${sqlType}`;
    });

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        ${columnDefinitions.join(', ')},
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    // 2. Buat Tabel di MySQL
    await db.query(createTableQuery);

    // 3. Susun Query & Formatting untuk Bulk Insert
    const insertQuery = `
      INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
      VALUES ?
    `;

    // Mengubah array of objects [{baris_ke: 1, konten_teks: '...'}, ...] menjadi array of arrays [[1, '...'], ...]
    const values = dataRows.map(row => columns.map(col => row[col] ?? null));

    // 4. Eksekusi Bulk Insert
    const [result] = await db.query(insertQuery, [values]);

    return {
      tableName,
      insertedRows: result.affectedRows,
      status: 'SUCCESS'
    };
  }
}

module.exports = TableBuilderService;