import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  console.log("Initializing PinGen Server...");

  // API: Scrape blog content
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    console.log(`[Scrape Request] URL: ${url}`);
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title with extreme priority for specific blog headline patterns
      const h1Text = $("h1").first().text()?.trim();
      const articleTitle = $("article h1").first().text()?.trim() || $(".post-title").first().text()?.trim() || $(".entry-title").first().text()?.trim();
      
      const metaTitle = 
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text();
        
      // Logic: If we found a specific article/post title, it's usually better than the meta title (which often has site name)
      let title = articleTitle || h1Text || metaTitle;
      
      // Clean up common separators if title is clearly "Main Title | Site Name"
      if (title && (title.includes(" | ") || title.includes(" - "))) {
          const parts = title.includes(" | ") ? title.split(" | ") : title.split(" - ");
          // Pick the longest part as it's likely the actual headline
          title = parts.sort((a, b) => b.length - a.length)[0].trim();
      }

      // Extract featured image
      let image =
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        $('link[rel="image_src"]').attr("href");

      if (!image) {
        $("img").each((_, el) => {
          const src = $(el).attr("src");
          if (src && (src.startsWith("http") || src.startsWith("//"))) {
            image = src;
            return false;
          }
        });
      }

      if (image && !image.startsWith("http") && !image.startsWith("//")) {
        try {
          image = new URL(image, url).href;
        } catch (e) {
          console.error("[URL Resolution Error]", e);
        }
      } else if (image && image.startsWith("//")) {
        image = `https:${image}`;
      }

      console.log(`[Scrape Success] Title: ${title?.substring(0, 30)}...`);
      res.json({
        title: title?.trim(),
        image: image,
        url: url,
      });
    } catch (error: any) {
      console.error("[Scrape Error]", error.message);
      res.status(500).json({ error: error.message || "Failed to scrape" });
    }
  });

  // API: Proxy image
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("No URL provided");

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[Proxy Error]", error);
      res.status(500).send("Proxy error");
    }
  });

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
