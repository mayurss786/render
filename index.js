import express from 'express';
import { load } from 'cheerio'; // ✅ Named import to fix cheerio ES module issue

const app = express();

app.get('/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow'
    });

    const html = await response.text();
    const $ = load(html);

    // 🧠 Smart meta extraction
    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text().trim() ||
      null;

    let description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null;

    let image =
      $('meta[property="og:image"]').attr('content') ||
      $('img[data-old-hires]').attr('src') || // Amazon fallback
      $('img[src*="rukminim2"]').attr('src') || // Flipkart fallback
      null;

    return res.json({
      input_url: url,
      title,
      description,
      image
    });
  } catch (err) {
    console.error('Scraper error:', err.message);
    return res.status(500).json({
      error: 'Scraping failed',
      message: err.message
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Scraper running on http://localhost:${port}`);
});
