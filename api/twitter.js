const axios = require('axios');

async function handleTwitter(videoUrl) {
  console.log(`[TWITTER] Extracting: ${videoUrl}`);

  const match = videoUrl.match(/status\/(\d+)/);
  if (!match) return null;
  const statusId = match[1];

  // Strategy 1: VxTwitter / FixTweet APIs with Twitterbot UA (bypasses Cloudflare bot protection)
  const endpoints = [
    `https://api.vxtwitter.com/status/${statusId}`,
    `https://api.fxtwitter.com/status/${statusId}`,
    `https://api.vxtwitter.com/i/status/${statusId}`,
    `https://api.fxtwitter.com/i/status/${statusId}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, {
        headers: {
          'User-Agent': 'Twitterbot/1.0',
          'Accept': 'application/json'
        },
        timeout: 6000
      });

      let d = res.data;
      if (typeof d === 'string' && d.trim().startsWith('{')) {
        try { d = JSON.parse(d); } catch(e) {}
      }

      if (d && typeof d === 'object' && !d.error) {
        const tweetObj = d.tweet || d;
        const media = tweetObj.media_extended || tweetObj.media?.all || [];
        const videos = media.filter(m => m.type === 'video' || m.type === 'gif');
        const photos = media.filter(m => m.type === 'image' || m.type === 'photo');

        const nickname = tweetObj.user_name || tweetObj.author?.name || 'Twitter / X User';
        const username = tweetObj.user_screen_name || tweetObj.author?.screen_name || 'twitter';
        const avatar = tweetObj.user_profile_image_url || tweetObj.author?.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
        const desc = tweetObj.text || 'Twitter / X Post';
        const stats = {
          playCount: Number(tweetObj.views) || 0,
          likeCount: Number(tweetObj.likes) || 0,
          commentCount: Number(tweetObj.replies) || 0,
          shareCount: Number(tweetObj.retweets) || 0
        };

        if (videos.length > 0) {
          const videoObj = videos[0];
          const vidUrl = videoObj.url;
          return {
            type: 'video',
            desc: desc,
            author: { nickname, unique_id: username, username, avatar },
            video: {
              noWatermark: vidUrl,
              watermark: vidUrl,
              cover: videoObj.thumbnail_url || tweetObj.mediaURLs?.[0] || ''
            },
            images: null,
            music: { playUrl: vidUrl, title: desc },
            statistics: stats
          };
        } else if (photos.length > 0 || (tweetObj.mediaURLs && tweetObj.mediaURLs.length > 0)) {
          const imgs = photos.length > 0 ? photos.map(p => p.url) : tweetObj.mediaURLs;
          return {
            type: 'image',
            desc: desc,
            author: { nickname, unique_id: username, username, avatar },
            video: null,
            images: imgs,
            music: null,
            statistics: stats
          };
        } else {
          // Pure text tweet fallback
          return {
            type: 'text',
            desc: desc,
            author: { nickname, unique_id: username, username, avatar },
            video: null,
            images: null,
            music: null,
            statistics: stats
          };
        }
      }
    } catch (e) {}
  }

  // Strategy 2: Cobalt API Fallback
  const cobaltApis = [
    'https://api.cobalt.tools/api/json',
    'https://api.cobalt.tools'
  ];

  for (const apiUrl of cobaltApis) {
    try {
      const res = await axios.post(apiUrl, { url: videoUrl }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 6000
      });
      if (res.data && res.data.url) {
        return {
          type: 'video',
          desc: 'Twitter / X Media',
          author: { nickname: 'Twitter User', unique_id: 'twitter', avatar: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' },
          video: { noWatermark: res.data.url, watermark: res.data.url, cover: '' },
          images: null,
          music: { playUrl: res.data.url, title: 'Twitter Audio' },
          statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
        };
      }
    } catch(e) {}
  }

  // Strategy 3: yt-dlp metadata extraction fallback for Twitter media
  try {
    const ytDlp = require('youtube-dl-exec');
    const info = await ytDlp(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      noPlaylist: true
    });
    if (info) {
      const vidUrl = info.url || (info.formats && info.formats.length > 0 && info.formats[info.formats.length - 1]?.url);
      if (vidUrl) {
        return {
          type: 'video',
          desc: info.title || info.fulltitle || 'Twitter / X Video',
          author: {
            nickname: info.uploader || info.channel || 'Twitter User',
            unique_id: info.uploader_id || 'twitter',
            avatar: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
          },
          video: {
            noWatermark: vidUrl,
            watermark: vidUrl,
            cover: info.thumbnail || ''
          },
          images: null,
          music: { playUrl: vidUrl, title: info.title || 'Twitter Audio' },
          statistics: {
            playCount: Number(info.view_count) || 0,
            likeCount: Number(info.like_count) || 0,
            commentCount: Number(info.comment_count) || 0,
            shareCount: Number(info.repost_count) || 0
          }
        };
      }
    }
  } catch (e) {}

  return null;
}

module.exports = handleTwitter;


