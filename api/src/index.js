const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const ingestionRoutes = require("./routes/ingestionRoutes");
const dataRoutes = require("./routes/dataRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/ingest", ingestionRoutes);
app.use("/api/data", dataRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Leafy AI API is running",
  });
});

module.exports = app;