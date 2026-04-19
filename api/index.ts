import express from "express";
import * as cheerio from "cheerio";
import path from "path";

const app = express();
app.use(express.json());

// API: Scrape blog content
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    const h1Text = $("h1").first().text()?.trim();
    const articleTitle = $("article h1").first().text()?.trim() || $(".post-title").first().text()?.trim() || $(".entry-title").first().text()?.trim();
    const metaTitle = $('meta[property="og:title"]').attr("content") || $('meta[name="twitter:title"]').attr("content") || $("title").text();
    
    let title = articleTitle || h1Text || metaTitle;
    if (title && (title.includes(" | ") || title.includes(" - "))) {
        const parts = title.includes(" | ") ? title.split(" | ") : title.split(" - ");
        title = parts.sort((a, b) => b.length - a.length)[0].trim();
    }

    let image = $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || $('link[rel="image_src"]').attr("href");
    if (!image) {
      $("img").each((_, el) => {
        const src = $(el).attr("src");
        if (src && (src.startsWith("http") || src.startsWith("//"))) {
          image = src;
          return false;
        }
      });
    }

    if (image && !image.startsWith("http")) {
      const baseUrl = new URL(url);
      image = new URL(image, baseUrl.origin).href;
    }

    res.json({ title: title?.trim(), image: image, url: url });
  } catch (error: any) {
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
    res.status(500).send("Proxy error");
  }
});

export default app;
