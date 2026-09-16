const axios = require('axios');

async function handleFacebook(videoUrl) {
  console.log(`[FACEBOOK] Extracting: ${videoUrl}`);

  const cobaltApis = [
    'https://api.cobalt.tools/api/json',
    'https://co.wuk.sh/api/json',
    'https://cobalt.api.scout.ovh/api/json'
  ];

  for (const apiUrl of cobaltApis) {
    try {
      const res = await axios.post(apiUrl, { url: videoUrl }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (res.data) {
        const d = res.data;
        if (d.status === 'tunnel' || d.status === 'redirect') {
          const mediaUrl = d.url;
          return {
            type: 'video',
            desc: 'Facebook Video / Reels',
            author: { nickname: 'Facebook User', unique_id: 'facebook', avatar: '' },
            video: { noWatermark: mediaUrl, watermark: mediaUrl, cover: '' },
            images: null,
            music: { playUrl: mediaUrl },
            statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
          };
        }
      }
    } catch(e) {}
  }
  return null;
}

module.exports = handleFacebook;
