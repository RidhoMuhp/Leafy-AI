const express = require("express");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.json({
      success: true,
      service: "leafy-node-orchestrator",
      status: "ready",
    });
  });

  return app;
}

module.exports = { createApp };