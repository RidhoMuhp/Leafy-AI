const db = require("../config/db");

exports.getAll = (req, res) => {
  db.query("SELECT * FROM surat_masuk", (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};

exports.create = (req, res) => {
  const { nomor_surat, pengirim, tanggal_surat, perihal } = req.body;

  const file = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO surat_masuk
    (nomor_surat, pengirim, tanggal_surat, perihal, file)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [nomor_surat, pengirim, tanggal_surat, perihal, file],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Surat masuk berhasil ditambahkan",
      });
    }
  );
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { nomor_surat, pengirim, tanggal_surat, perihal } = req.body;

  const sql = `
    UPDATE surat_masuk
    SET nomor_surat=?, pengirim=?, tanggal_surat=?, perihal=?
    WHERE id=?
  `;

  db.query(
    sql,
    [nomor_surat, pengirim, tanggal_surat, perihal, id],
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
    "DELETE FROM surat_masuk WHERE id=?",
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