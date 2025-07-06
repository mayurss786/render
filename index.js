import express from 'express';
import { load } from 'cheerio';

const app = express();

app.get('/scrape', async (req, res) => {
  const { url: inputUrl } = req.query;

  if (!inputUrl) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    // Step 1: Follow redirects and fetch HTML
    const response = await fetch(inputUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const finalUrl = response.url;
    const html = await response.text();
    const $ = load(html);

    // Step 2: Extract metadata
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text().trim() ||
      null;

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null;

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('img[data-old-hires]').attr('src') || // Amazon fallback
      $('img[src*="rukminim2"]').attr('src') || // Flipkart fallback
      null;

    // Step 3: Return all structured data
    return res.json({
      input_url: inputUrl,
      final_url: finalUrl,
      title,
      description,
      image
    });

  } catch (err) {
    console.error('❌ Scrape error:', err.message);
    return res.status(500).json({
      error: 'Scraping failed',
      message: err.message
    });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Scraper running on http://localhost:${port}`);
});
