import express from 'express';
import { load } from 'cheerio';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// 🧭 Site Detector
function detectSite(url) {
  try {
    const hostname = new URL(url).hostname;
    if (/amazon\./i.test(hostname)) return 'Amazon';
    if (/cdiscount\.com/i.test(hostname)) return 'Cdiscount';
    return 'Other';
  } catch {
    return 'Invalid';
  }
}

// 🔍 Amazon Deep Scraper via Puppeteer
async function scrapeAmazonProduct(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
  );

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const data = await page.evaluate(() => {
    const getText = (selector) =>
      document.querySelector(selector)?.textContent?.trim() || null;

    const title = getText("#productTitle");

    const price =
      getText("#corePriceDisplay_desktop_feature_div .a-price") ||
      getText(".a-price") ||
      getText("#corePriceDisplay_mobile_feature_div");

    const bullets = Array.from(
      document.querySelectorAll('#feature-bullets ul li span.a-list-item')
    )
      .map(el => el.textContent.trim().replace(/\s+/g, ' '))
      .filter(txt => txt.length > 20 && !/product/i.test(txt))
      .map(line => '• ' + line)
      .join('\n');

    const image = document.querySelector('img#landingImage')?.src || null;

    return { title, price, description: bullets, image };
  });

  await browser.close();
  return data;
}

// 🛍️ Cdiscount Scraper via Puppeteer
async function scrapeCdiscountProduct(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari"
  );

  await page.setExtraHTTPHeaders({
    'accept-language': 'fr-FR,fr;q=0.9'
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const data = await page.evaluate(() => {
    const getText = (selector) =>
      document.querySelector(selector)?.textContent?.trim() || "";

    const title = getText('h1[itemprop="name"]');
    const price = getText('#DisplayPrice') + "€";
    const description = getText('#ProductSheetAccordion-content-1');
    const info = getText('#ProductSheetAccordion-content-2');
    const image = document.querySelector('#mainImage')?.src || null;

    return { title, price, description, image, info };
  });

  await browser.close();
  return data;
}

// 🌐 Cheerio-based fallback scraping
async function fallbackMetaScraper(url) {
  const headers = { 'User-Agent': 'Mozilla/5.0' };
  const redirectChain = [url];

  const firstResp = await fetch(url, { redirect: 'follow', headers });
  const firstUrl = firstResp.url;
  redirectChain.push(firstUrl);
  let html = await firstResp.text();
  let finalUrl = firstUrl;

  const dl = new URL(firstUrl).searchParams.get('dl');
  if (dl) {
    const decoded = decodeURIComponent(dl);
    const secondResp = await fetch(decoded, { redirect: 'follow', headers });
    html = await secondResp.text();
    finalUrl = secondResp.url;
    redirectChain.push(finalUrl);
  }

  const $ = load(html);

  const meta = {
    title: $('#productTitle').text().trim()
      || $('meta[property="og:title"]').attr('content')
      || $('title').text().trim() || null,
    description: (() => {
      let desc = '';
      $('#feature-bullets ul li span.a-list-item').each((_, el) => {
        const line = $(el).text().replace(/\s+/g, ' ').trim();
        if (line.length > 20 && !/product/i.test(line)) {
          desc += `• ${line}\n`;
        }
      });
      return desc.trim() || $('meta[name="description"]').attr('content') || null;
    })(),
    image: html.match(/"hiRes"\s*:\s*"([^"]+\.jpg)"/i)?.[1]
      || $('meta[property="og:image"]').attr('content')
      || $('img[src*="rukminim2"]').attr('src')
      || null,
    final_url: finalUrl,
    redirect_chain: redirectChain,
    input_url: url
  };

  return meta;
}

app.get('/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing product URL (?url=...)' });

  try {
    const site = detectSite(url);

    if (site === 'Amazon') {
      const data = await scrapeAmazonProduct(url);
      return res.json({ ...data, site, url });
    } else if (site === 'Cdiscount') {
      const data = await scrapeCdiscountProduct(url);
      return res.json({ ...data, site, url });
    } else if (site === 'Other') {
      const data = await fallbackMetaScraper(url);
      return res.json({ ...data, site: 'Generic' });
    } else {
      return res.status(400).json({ error: 'Unsupported or invalid URL' });
    }
  } catch (err) {
    console.error('Scrape error:', err.message);
    return res.status(500).json({ error: 'Failed to scrape', message: err.message });
  }
});

// ✅ Status ping
app.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper is online 🚀' });
});

app.listen(PORT, () => {
  console.log(`🚀 Scraper API running at http://localhost:${PORT}`);
});
