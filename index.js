import express from 'express';
import { load } from 'cheerio';

const app = express();

// 🧠 Amazon-specific metadata extraction
function extractAmazonMeta(html) {
  const $ = load(html);

  const title = $('#productTitle').text().trim()
    || $('meta[property="og:title"]').attr('content')
    || $('title').text().trim()
    || null;

  const hiRes = html.match(/"hiRes"\s*:\s*"([^"]+\.jpg)"/i);
  const image = hiRes?.[1]
    || $('meta[property="og:image"]').attr('content')
    || null;

  let description = '';
  $('#feature-bullets ul li span.a-list-item').each((_, el) => {
    const line = $(el).text().replace(/\s+/g, ' ').trim();
    if (line.length > 20 && !/product/i.test(line)) {
      description += `• ${line}\n`;
    }
  });

  return {
    title,
    image,
    description: description.trim()
  };
}

// 🧩 Main scrape route
app.get('/scrape', async (req, res) => {
  const { url: inputUrl } = req.query;
  if (!inputUrl) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    const redirectChain = [inputUrl];

    // ➤ Step 1: Follow shortened URL (e.g., bitly, earnkaro)
    const firstRes = await fetch(inputUrl, { redirect: 'follow', headers });
    const firstUrl = firstRes.url;
    redirectChain.push(firstUrl);
    let html = await firstRes.text();
    let finalUrl = firstUrl;

    // ➤ Step 2: If ?dl= is present, follow it to the true destination
    const dl = new URL(firstUrl).searchParams.get('dl');
    if (dl) {
      const decoded = decodeURIComponent(dl);
      const secondRes = await fetch(decoded, { redirect: 'follow', headers });
      html = await secondRes.text();
      finalUrl = secondRes.url;
      redirectChain.push(finalUrl);
    }

    // ➤ Step 3: Detect domain and extract metadata
    let meta;
    if (/amazon\.(in|com)/i.test(finalUrl)) {
      meta = extractAmazonMeta(html);
    } else {
      const $ = load(html);
      meta = {
        title: $('meta[property="og:title"]').attr('content')
          || $('title').text().trim() || null,
        description: $('meta[name="description"]').attr('content')
          || $('meta[property="og:description"]').attr('content') || null,
        image: $('meta[property="og:image"]').attr('content')
          || $('img[src*="rukminim2"]').attr('src')
          || null
      };
    }

    // ➤ Return full structured output
    return res.json({
      input_url: inputUrl,
      redirect_chain: redirectChain,
      final_url: finalUrl,
      ...meta
    });

  } catch (err) {
    console.error('❌ Scrape error:', err);
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
