import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import app from "./api/index";

async function startServer() {
  const PORT = 3000;

  console.log("Initializing PinGen Server for environment...");

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PinGen Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
