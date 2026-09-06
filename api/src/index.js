const express = require("express");
const cors = require("cors");

// 1. Import Semua Routes
const authRoutes = require("./routes/authRoutes");
const suratMasukRoutes = require("./routes/suratMasukRoutes");
const suratKeluarRoutes = require("./routes/suratKeluarRoute");
const ingestionRoutes = require("./routes/ingestionRoutes");
const dataRoutes = require("./routes/dataRoutes"); // Route Read Data Baru

const app = express();

// 2. Global Middlewares (Wajib di Atas Sebelum Routes)
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("src/uploads"));

// 3. Register Routes API
app.use("/api/auth", authRoutes);
app.use("/api/surat-masuk", suratMasukRoutes);
app.use("/api/surat-keluar", suratKeluarRoutes);
app.use("/api/ingest", ingestionRoutes); // Route upload & ingest PDF
app.use("/api/data", dataRoutes);         // Route read & dashboard data

// 4. Base Route / Health Check
app.get("/", (req, res) => {
  res.json({
    message: "REST API Arsip & Data Engine berjalan mulus!",
  });
});

module.exports = app;