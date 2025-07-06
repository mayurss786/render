import express from 'express';
import { load } from 'cheerio';

const app = express();

app.get('/scrape', async (req, res) => {
  const { url: inputUrl } = req.query;
  if (!inputUrl) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    // Step 1: Follow initial redirect
    const firstResp = await fetch(inputUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const firstUrl = firstResp.url;
    let html = await firstResp.text();
    let finalUrl = firstUrl;

    // Step 2: Detect and follow ?dl= param if present
    const dlParam = new URL(firstUrl).searchParams.get('dl');
    if (dlParam) {
      const decodedUrl = decodeURIComponent(dlParam);
      const secondResp = await fetch(decodedUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      finalUrl = secondResp.url;
      html = await secondResp.text();
    }

    // Step 3: Extract metadata
    const $ = load(html);
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
      $('img[data-old-hires]').attr('src') ||
      $('img[src*="rukminim2"]').attr('src') ||
      null;

    return res.json({
      input_url: inputUrl,
      redirect_chain: [inputUrl, firstUrl, finalUrl],
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Scraper running on http://localhost:${port}`);
});
