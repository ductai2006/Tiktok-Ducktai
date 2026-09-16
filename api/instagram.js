const axios = require('axios');

async function handleInstagram(videoUrl) {
  console.log(`[INSTAGRAM] Extracting: ${videoUrl}`);

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
            desc: 'Instagram Reels / Video',
            author: { nickname: 'Instagram Creator', unique_id: 'instagram', avatar: '' },
            video: { noWatermark: mediaUrl, watermark: mediaUrl, cover: '' },
            images: null,
            music: { playUrl: mediaUrl },
            statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
          };
        } else if (d.status === 'picker' && d.picker) {
          const imgs = d.picker.filter(p => p.type === 'photo').map(p => p.url);
          const vids = d.picker.filter(p => p.type === 'video').map(p => p.url);

          if (vids.length > 0) {
            return {
              type: 'video',
              desc: 'Instagram Video',
              author: { nickname: 'Instagram Creator', unique_id: 'instagram', avatar: '' },
              video: { noWatermark: vids[0], watermark: vids[0], cover: imgs[0] || '' },
              images: null,
              music: { playUrl: vids[0] },
              statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
            };
          } else if (imgs.length > 0) {
            return {
              type: 'image',
              desc: 'Instagram Photo',
              author: { nickname: 'Instagram Creator', unique_id: 'instagram', avatar: '' },
              video: null,
              images: imgs,
              music: null,
              statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
            };
          }
        }
      }
    } catch(e) {}
  }
  return null;
}

module.exports = handleInstagram;
