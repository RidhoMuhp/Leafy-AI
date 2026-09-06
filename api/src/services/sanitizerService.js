class SanitizerService {
  /**
   * Membersihkan data, sanitasi nama kolom, dan hapus duplikasi
   */
  static cleanData(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { cleanedData: [], columns: [] };
    }

    // 1. Normalisasi Nama Kolom (Huruf kecil, tanpa spasi, tanpa karakter aneh)
    const originalKeys = Object.keys(rawData[0]);
    const keyMap = {};
    
    originalKeys.forEach(key => {
      const cleanKey = key
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '_') // Ganti spasi & simbol dengan '_'
        .replace(/^_+|_+$/g, '');       // Trim underscores
      keyMap[key] = cleanKey || 'column_unnamed';
    });

    // 2. Map data & Sanitasi Nilai (Sanitization)
    const cleanedRows = rawData.map(row => {
      const newRow = {};
      for (const [oldKey, value] of Object.entries(row)) {
        const newKey = keyMap[oldKey];
        
        // Membersihkan string (trim whitespace, handle null/undefined)
        if (typeof value === 'string') {
          newRow[newKey] = value.trim();
        } else if (value === null || value === undefined) {
          newRow[newKey] = null;
        } else {
          newRow[newKey] = value;
        }
      }
      return newRow;
    });

    // 3. Deduplikasi (Hapus baris yang identik)
    const uniqueRows = Array.from(
      new Set(cleanedRows.map(JSON.stringify))
    ).map(JSON.parse);

    return {
      totalOriginal: rawData.length,
      totalCleaned: uniqueRows.length,
      duplicatesRemoved: rawData.length - uniqueRows.length,
      columns: Object.values(keyMap),
      data: uniqueRows
    };
  }
}

module.exports = SanitizerService;