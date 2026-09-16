const axios = require('axios');

async function handlePinterest(videoUrl) {
  try {
    console.log(`[PINTEREST] Extracting: ${videoUrl}`);

    // Follow redirects for pin.it short links
    const response = await axios.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 10,
      timeout: 12000
    });

    const html = response.data;
    const cleanHtml = typeof html === 'string' ? html.replace(/\\u002F/g, '/').replace(/\\/g, '') : '';

    let videoUrlExtracted = null;
    let titleExtracted = 'Pinterest Pin';
    let authorName = 'Pinterest User';
    let authorAvatar = 'https://assets.pinterest.com/images/pidgets/pinit_bg_en_rect_red_20.png';
    let coverImage = '';

    // 1. Extract Title & Description
    const ogTitle = html.match(/<meta [^>]*property="og:title" [^>]*content="([^"]+)"/i)?.[1]
                 || html.match(/<title>([^<]+)<\/title>/i)?.[1];
    if (ogTitle && ogTitle.trim() && !ogTitle.includes('Pinterest')) {
      titleExtracted = ogTitle.trim();
    }

    const ogDesc = html.match(/<meta [^>]*property="og:description" [^>]*content="([^"]+)"/i)?.[1]
                || html.match(/<meta [^>]*name="description" [^>]*content="([^"]+)"/i)?.[1];
    if (ogDesc && ogDesc.trim() && titleExtracted === 'Pinterest Pin') {
      titleExtracted = ogDesc.trim();
    }

    // 2. Parse JSON-LD embedded tags (<script type="application/ld+json">)
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const tag of jsonLdMatches) {
        try {
          const jsonText = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          const data = JSON.parse(jsonText);
          if (data) {
            if (data.name && titleExtracted === 'Pinterest Pin') titleExtracted = data.name;
            if (data.video?.contentUrl) videoUrlExtracted = data.video.contentUrl;
            if (data.image) {
              const imgArr = Array.isArray(data.image) ? data.image : [data.image];
              // Only use the first image from JSON-LD as the pin's cover image
              if (!coverImage && imgArr.length > 0) {
                coverImage = typeof imgArr[0] === 'string' ? imgArr[0] : (imgArr[0]?.url || '');
              }
            }
            if (data.creator?.name || data.author?.name) {
              authorName = data.creator?.name || data.author?.name;
            }
            if (data.creator?.image || data.author?.image) {
              authorAvatar = data.creator?.image || data.author?.image;
            }
          }
        } catch (e) {}
      }
    }

    // 3. Extract Video URL (only if pin has a video)
    if (!videoUrlExtracted) {
      const ogVideo = html.match(/<meta [^>]*property="og:video(:secure_url)?" [^>]*content="([^"]+)"/i)?.[2]
                   || html.match(/<meta [^>]*name="og:video" [^>]*content="([^"]+)"/i)?.[1]
                   || html.match(/"video_list":\{"V_720P":\{"url":"([^"]+)"/i)?.[1]
                   || html.match(/"video_list":\{"[^"]+":\{"url":"([^"]+)"/i)?.[1]
                   || html.match(/"contentUrl":"([^"]+\.mp4[^"]*)"/i)?.[1];
      if (ogVideo) {
        videoUrlExtracted = ogVideo.replace(/\\u002F/g, '/');
      } else {
        const vids = cleanHtml.match(/https:\/\/(?:v|i)\.pinimg\.com\/[a-zA-Z0-9_\-\.\/]+\.mp4[a-zA-Z0-9_\-\.\=\?\&]*/gi)
                  || cleanHtml.match(/https:\/\/[a-zA-Z0-9_\-\.\/]+\.mp4[a-zA-Z0-9_\-\.\=\?\&]*/gi) || [];
        const cleanVids = [...new Set(vids)].filter(v => !v.includes('site') && !v.includes('assets') && !v.includes('mjs'));
        if (cleanVids.length > 0) {
          videoUrlExtracted = cleanVids[0];
        }
      }
    }

    // 4. Extract the pin's OG image (the ONE main image for this pin)
    const ogImage = html.match(/<meta [^>]*property="og:image" [^>]*content="([^"]+)"/i)?.[1]
                 || html.match(/<meta [^>]*name="twitter:image" [^>]*content="([^"]+)"/i)?.[1];
    if (ogImage && !coverImage) {
      coverImage = ogImage.replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
    }

    // Keep the 736x quality - originals/ path often returns 404 on many pins
    // 736x is already high resolution enough (up to 1500px wide)
    if (coverImage) {
      // Unescape any encoded slashes
      coverImage = coverImage.replace(/\\u002F/g, '/');
    }

    if (videoUrlExtracted || coverImage) {
      const isVideo = !!videoUrlExtracted;
      return {
        type: isVideo ? 'video' : 'image',
        desc: titleExtracted,
        author: {
          nickname: authorName,
          unique_id: 'pinterest',
          avatar: authorAvatar
        },
        video: isVideo ? {
          noWatermark: videoUrlExtracted,
          watermark: videoUrlExtracted,
          cover: coverImage
        } : null,
        // For images, return a single-item array (this pin has ONE image)
        images: !isVideo ? [coverImage] : null,
        music: isVideo ? { playUrl: videoUrlExtracted, title: titleExtracted } : null,
        statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
      };
    }
  } catch (e) {
    console.error('[PINTEREST SCRAPE ERROR]', e.message);
  }

  // Fallback to Cobalt API
  try {
    const cobaltApis = [
      'https://api.cobalt.tools/api/json',
      'https://api.cobalt.tools',
      'https://cobalt.api.scout.ovh/api/json'
    ];
    for (const apiUrl of cobaltApis) {
      try {
        const res = await axios.post(apiUrl, { url: videoUrl }, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 8000
        });
        if (res.data && (res.data.url || res.data.picker)) {
          const d = res.data;
          const mediaUrl = d.url || (d.picker && d.picker[0]?.url);
          if (mediaUrl) {
            const isVid = d.status === 'tunnel' || mediaUrl.includes('.mp4');
            return {
              type: isVid ? 'video' : 'image',
              desc: 'Pinterest Media',
              author: { nickname: 'Pinterest Pin', unique_id: 'pinterest', avatar: 'https://assets.pinterest.com/images/pidgets/pinit_bg_en_rect_red_20.png' },
              video: isVid ? { noWatermark: mediaUrl, watermark: mediaUrl, cover: '' } : null,
              images: !isVid ? [mediaUrl] : null,
              music: isVid ? { playUrl: mediaUrl, title: 'Pinterest Audio' } : null,
              statistics: { playCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }
            };
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  return null;
}

module.exports = handlePinterest;
