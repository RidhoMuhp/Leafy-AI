const express = require('express');
const router = express.Router();
const dataReadController = require('../controllers/dataReadController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// Route 1: Ambil semua daftar tabel
router.get('/tables', verifyToken, verifyRole(['admin', 'staff']), dataReadController.getTables);

// Route 2: Ambil isi data dari tabel tertentu (contoh: /api/data/tables/academic_publications?page=1&limit=10)
router.get('/tables/:tableName', verifyToken, verifyRole(['admin', 'staff']), dataReadController.getTableDetails);

module.exports = router;