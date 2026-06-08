const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const suratMasukRoutes = require("./routes/suratMasukRoutes");
const suratKeluarRoutes = require("./routes/suratKeluarRoute");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("src/uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/surat-masuk", suratMasukRoutes);
app.use("/api/surat-keluar", suratKeluarRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "REST API Arsip berjalan",
  });
});

module.exports = app;