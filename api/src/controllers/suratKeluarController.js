const db = require("../config/db");

exports.getAll = (req, res) => {
  db.query("SELECT * FROM surat_keluar", (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};

exports.create = (req, res) => {
  const { nomor_surat, tujuan, tanggal_surat, perihal } = req.body;

  const file = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO surat_keluar
    (nomor_surat, tujuan, tanggal_surat, perihal, file)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [nomor_surat, tujuan, tanggal_surat, perihal, file],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Surat keluar berhasil ditambahkan",
      });
    }
  );
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { nomor_surat, tujuan, tanggal_surat, perihal } = req.body;

  const sql = `
    UPDATE surat_keluar
    SET nomor_surat=?, tujuan=?, tanggal_surat=?, perihal=?
    WHERE id=?
  `;

  db.query(
    sql,
    [nomor_surat, tujuan, tanggal_surat, perihal, id],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Data berhasil diupdate",
      });
    }
  );
};

exports.delete = (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM surat_keluar WHERE id=?",
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Data berhasil dihapus",
      });
    }
  );
};