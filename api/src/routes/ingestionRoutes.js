const express = require('express');
const router = express.Router();
const multer = require('multer');
const ingestionController = require('../controllers/ingestionController');
const { verifyToken, verifyRole } = require('../middleware/auth');


const upload = multer({ storage: multer.memoryStorage() });

router.post('/', verifyToken, verifyRole(['admin']), upload.single('file'), ingestionController.handleIngestion);

module.exports = router;