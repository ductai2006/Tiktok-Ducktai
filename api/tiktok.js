const axios = require('axios');
const { Downloader } = require('@tobyg74/tiktok-api-dl');

async function handleTikTok(videoUrl) {
  let finalResult = null;
  try {
    const tikwmRes = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: videoUrl, hd: 1 }), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    if (tikwmRes.data?.code === 0 && tikwmRes.data?.data) {
      const d = tikwmRes.data.data;
      finalResult = {
        type: d.images ? 'image' : 'video',
        desc: d.title || '',
        author: {
          nickname: d.author?.nickname || 'TikTok User',
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
    }
  } catch (e) {}

  if (!finalResult) {
    try {
      let result = await Downloader(videoUrl, { version: 'v1' });
      if (result.status !== 'success') result = await Downloader(videoUrl, { version: 'v2' });
      if (result.status !== 'success') result = await Downloader(videoUrl, { version: 'v3' });
      
      if (result.status === 'success' && result.result) {
        const r = result.result;
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
      }
    } catch(e) {}
  }
  return finalResult;
}

module.exports = handleTikTok;
