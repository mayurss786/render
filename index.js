import express from 'express';
import cheerio from 'cheerio';
const app = express();

app.get('/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract basic meta
    const title = $('title').text() || null;
    const description = $('meta[name="description"]').attr('content') || null;
    const image = $('meta[property="og:image"]').attr('content') || null;

    res.json({ title, description, image });
  } catch (err) {
    res.status(500).json({ error: 'Scrape failed', message: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Scraper running on port ${port}`));
