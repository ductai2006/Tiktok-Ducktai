const express = require('express');
const path = require('path');
const axios = require('axios');
const { Downloader } = require('@tobyg74/tiktok-api-dl');
const fs = require('fs');

const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API route to get TikTok info
app.get('/api/info', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video TikTok.' });
  }

  try {
    console.log(`[INFO] Fetching metadata for URL: ${videoUrl}`);
    let finalResult = null;
    
    // Try tikwm first
    try {
      const tikwmRes = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: videoUrl, hd: 1 }), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });
      if (tikwmRes.data?.code === 0 && tikwmRes.data?.data) {
        const d = tikwmRes.data.data;
        finalResult = {
          type: d.images ? 'image' : 'video',
          desc: d.title || '',
          author: {
            nickname: d.author?.nickname || '',
            unique_id: d.author?.unique_id || '',
            avatar: d.author?.avatar || ''
          },
          video: d.images ? null : {
            noWatermark: d.hdplay || d.play || '',
            watermark: d.wmplay || '',
            cover: d.cover || ''
          },
          images: d.images || null,
          music: d.music ? { playUrl: d.music } : null,
          statistics: {
            playCount: d.play_count || 0,
            likeCount: d.digg_count || 0,
            commentCount: d.comment_count || 0,
            shareCount: d.share_count || 0
          }
        };
        console.log(`[INFO] tikwm fetch successful`);
      }
    } catch (e) {
      console.log('[INFO] tikwm failed, falling back...', e.message);
    }

    // Fallback to tobyg74 API
    if (!finalResult) {
      let result = await Downloader(videoUrl, { version: 'v1' });
      if (result.status !== 'success') result = await Downloader(videoUrl, { version: 'v2' });
      if (result.status !== 'success') result = await Downloader(videoUrl, { version: 'v3' });
      
      if (result.status === 'success' && result.result) {
        const r = result.result;
        // manually pick out watermark and no watermark
        const downloadAddr = r.video?.downloadAddr || [];
        const playAddr = r.video?.playAddr || [];
        const allUrls = [...downloadAddr, ...playAddr];
        
        const noWatermark = downloadAddr.find(u => !u.includes('watermark=1') && !u.includes('logo_name=')) 
                       || downloadAddr[0] || playAddr[0] || '';
        const watermark = allUrls.find(u => u.includes('watermark=1') || u.includes('logo_name=')) 
                     || downloadAddr[1] || playAddr[0] || '';
                     
        finalResult = {
          type: r.type,
          desc: r.description || r.desc || '',
          author: r.author || {},
          video: r.video ? {
            noWatermark,
            watermark,
            cover: r.video?.cover || ''
          } : null,
          images: r.images || null,
          music: r.music || null,
          statistics: r.statistics || {}
        };
        console.log(`[INFO] fallback fetch successful`);
      } else {
        return res.status(400).json({ error: result.message || 'Không thể tải thông tin video.' });
      }
    }

    return res.json(finalResult);
  } catch (error) {
    console.error('[ERROR] Exception fetching info:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ trong quá trình xử lý link TikTok.' });
  }
});

// Shared helper: proxy a TikTok CDN request with required headers
async function fetchFromCDN(mediaUrl, rangeHeader) {
  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.tiktok.com/'
  };
  if (rangeHeader) reqHeaders['Range'] = rangeHeader;

  return axios({
    method: 'get',
    url: mediaUrl,
    responseType: 'stream',
    headers: reqHeaders,
    // Don't throw on 206 Partial Content
    validateStatus: (s) => s >= 200 && s < 400
  });
}

// API route to STREAM video for in-browser preview (no forced download)
app.get('/api/stream', async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl) return res.status(400).json({ error: 'Missing url parameter.' });

  try {
    const rangeHeader = req.headers['range'];
    const upstream = await fetchFromCDN(mediaUrl, rangeHeader);

    // Forward status (200 or 206) + key headers so browser can seek
    const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    forwardHeaders.forEach(h => {
      const val = upstream.headers[h];
      if (val) res.setHeader(h, val);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status);
    upstream.data.pipe(res);
  } catch (error) {
    console.error('[STREAM ERROR]', error.message);
    res.status(500).json({ error: 'Không thể stream video.' });
  }
});

// API route to download files via proxy (forces download dialogue & avoids CORS)
// Existing download endpoint (kept for backward compatibility)
app.get('/api/download', async (req, res) => {
  const mediaUrl = req.query.url;
  const filename = req.query.filename || 'tiktok-video.mp4';
  const type = req.query.type || 'video';

  if (!mediaUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link media.' });
  }

  try {
    console.log(`[DOWNLOAD] Proxying download for url: ${mediaUrl.substring(0, 50)}...`);
    const mimeType = type === 'audio' ? 'audio/mpeg' : (type === 'image' ? 'image/jpeg' : 'video/mp4');
    const upstream = await fetchFromCDN(mediaUrl);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', mimeType);
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    upstream.data.pipe(res);
  } catch (error) {
    console.error('[DOWNLOAD ERROR] Exception proxying download:', error.message);
    return res.status(500).json({ error: 'Tải file thất bại. Có thể link tải đã hết hạn, vui lòng thử lấy lại link.' });
  }
});

// New endpoint: download audio only (forces MP3)
app.get('/api/audio', async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl) return res.status(400).json({ error: 'Missing url parameter.' });

  try {
    const upstream = await fetchFromCDN(mediaUrl);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''audio.mp3`);
    res.setHeader('Content-Type', 'audio/mpeg');
    upstream.data.pipe(res);
  } catch (error) {
    console.error('[AUDIO ERROR]', error.message);
    res.status(500).json({ error: 'Không thể tải audio.' });
  }
});

// New endpoint: Download all images as ZIP
app.get('/api/download-zip', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url parameter.' });

  try {
    let images = [];
    try {
      const tikwmRes = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: videoUrl, hd: 1 }), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });
      if (tikwmRes.data?.code === 0 && tikwmRes.data?.data?.images) {
        images = tikwmRes.data.data.images;
      }
    } catch (e) { }

    if (!images.length) {
      const fallback = await Downloader(videoUrl, { version: 'v1' });
      if (fallback.status === 'success' && fallback.result?.images) {
        images = fallback.result.images;
      }
    }
    
    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'Không tìm thấy hình ảnh nào để tải.' });
    }
    
    const JSZip = require('jszip');
    const zip = new JSZip();
    
    // fetch all images
    const promises = images.map(async (imgUrl, index) => {
      try {
        const response = await fetchFromCDN(imgUrl);
        const chunks = [];
        for await (const chunk of response.data) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        zip.file(`tiktok_image_${index + 1}.jpg`, buffer);
      } catch (err) {
        console.error(`Failed to fetch image ${index+1}:`, err.message);
      }
    });
    
    await Promise.all(promises);
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''tiktok_images.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch(error) {
    console.error('[ZIP ERROR]', error);
    res.status(500).json({ error: 'Lỗi nén file hình ảnh.' });
  }
});

// New endpoint: extract frames as images
app.get('/api/frames', async (req, res) => {
  const mediaUrl = req.query.url;
  const fps = parseInt(req.query.fps) || 1; // default 1 frame per second
  if (!mediaUrl) return res.status(400).json({ error: 'Missing url parameter.' });

  const uid = uuidv4();
  const outDir = path.join(__dirname, 'public', 'temp', uid);
  fs.mkdirSync(outDir, { recursive: true });

  const outputPattern = path.join(outDir, 'frame-%03d.jpg');
  // Use ffmpeg to pull from URL and extract frames
  ffmpeg(mediaUrl)
    .inputOptions([
      '-headers',
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nReferer: https://www.tiktok.com/\r\n'
    ])
    .outputOptions([`-vf fps=${fps}`, '-t 15'])
    .output(outputPattern)
    .on('end', () => {
      // Collect file names
      const files = fs.readdirSync(outDir).map(f => `/temp/${uid}/${f}`);
      res.json({ frames: files });
    })
    .on('error', (err) => {
      console.error('[FRAMES ERROR]', err.message);
      res.status(500).json({ error: 'Failed to extract frames.' });
    })
    .run();
});

// Cleanup old temp folders (older than 10 minutes)
setInterval(() => {
  const tempRoot = path.join(__dirname, 'public', 'temp');
  if (!fs.existsSync(tempRoot)) return;
  const now = Date.now();
  fs.readdirSync(tempRoot).forEach(folder => {
    const folderPath = path.join(tempRoot, folder);
    const stats = fs.statSync(folderPath);
    if (now - stats.mtimeMs > 10 * 60 * 1000) {
      fs.rmdirSync(folderPath, { recursive: true });
      console.log(`[CLEANUP] Removed temp folder ${folder}`);
    }
  });
}, 5 * 60 * 1000); // every 5 minutes

const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server is running`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`LAN:   http://192.168.100.103:${PORT}`);
});