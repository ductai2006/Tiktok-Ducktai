const axios = require('axios');

const PINTEREST_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_AVATAR =
  'https://assets.pinterest.com/images/pidgets/pinit_bg_en_rect_red_20.png';

/* =========================================================
   HELPERS
========================================================= */

function decodeHtml(str) {
  if (!str) return '';

  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/');
}

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return null;

  return decodeHtml(url)
    .replace(/^["']|["']$/g, '')
    .trim();
}

function extractMeta(html, propertyName) {
  if (!html || !propertyName) return null;

  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // property="..."
  let match = html.match(
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    )
  );

  if (match && match[1]) {
    return cleanUrl(match[1]);
  }

  // content="..." property="..."
  match = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      'i'
    )
  );

  if (match && match[1]) {
    return cleanUrl(match[1]);
  }

  // name="..."
  match = html.match(
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    )
  );

  if (match && match[1]) {
    return cleanUrl(match[1]);
  }

  return null;
}

function isPinterestImage(url) {
  if (!url) return false;

  return (
    /^https?:\/\/(?:i|v)\.pinimg\.com\//i.test(url) &&
    /\.(jpg|jpeg|png|webp)(?:[?#]|$)/i.test(url)
  );
}

function isPinterestVideo(url) {
  if (!url) return false;

  return (
    /\.mp4(?:[?#]|$)/i.test(url) ||
    /pinimg\.com\/.*\.mp4/i.test(url)
  );
}

/*
 * Không tự động đổi tất cả URL sang /originals/.
 *
 * Pinterest có nhiều ảnh mà /originals/ không tồn tại.
 * Vì vậy giữ URL thật mà Pinterest trả về.
 */
function normalizeImageUrl(url) {
  if (!url) return null;

  url = cleanUrl(url);

  if (!url) return null;

  // Một số Pinterest URL có các ký tự escape
  url = url
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  return url;
}

/* =========================================================
   TITLE
========================================================= */

function extractTitle(html) {
  let title = extractMeta(html, 'og:title');

  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (titleMatch && titleMatch[1]) {
      title = decodeHtml(titleMatch[1]);
    }
  }

  if (!title) {
    title = extractMeta(html, 'description');
  }

  if (!title) {
    title = 'Pinterest Pin';
  }

  title = title.trim();

  if (!title || /^Pinterest$/i.test(title)) {
    title = 'Pinterest Pin';
  }

  return title;
}

/* =========================================================
   AUTHOR
========================================================= */

function extractAuthor(html) {
  let nickname = 'Pinterest User';
  let avatar = DEFAULT_AVATAR;

  const authorPatterns = [
    /"author":\{"name":"([^"]+)"/i,
    /"creator":\{"name":"([^"]+)"/i,
    /"profileName":"([^"]+)"/i,
    /"fullName":"([^"]+)"/i,
    /"username":"([^"]+)"/i
  ];

  for (const pattern of authorPatterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      nickname = decodeHtml(match[1]);
      break;
    }
  }

  const avatarPatterns = [
    /"profileImage":"([^"]+)"/i,
    /"image_large":"([^"]+)"/i,
    /"image_small":"([^"]+)"/i,
    /"avatar":"([^"]+)"/i
  ];

  for (const pattern of avatarPatterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      avatar = normalizeImageUrl(match[1]);
      break;
    }
  }

  return {
    nickname,
    avatar
  };
}

/* =========================================================
   IMAGE EXTRACTION
========================================================= */

/*
 * QUAN TRỌNG:
 *
 * Hàm này chỉ trả về MỘT ảnh chính.
 *
 * Không còn:
 *
 * html.match(/https:\/\/i\.pinimg\.com\/.../gi)
 *
 * rồi đưa toàn bộ vào images.
 *
 * Đây là nguyên nhân chính khiến 1 ảnh thành nhiều ảnh.
 */
function extractPinterestMainImage(html) {
  let image = null;

  // -------------------------------------------------------
  // 1. OG IMAGE
  // -------------------------------------------------------

  image = extractMeta(html, 'og:image');

  if (image && isPinterestImage(image)) {
    console.log('[PINTEREST] Main image from og:image');
    return normalizeImageUrl(image);
  }

  // -------------------------------------------------------
  // 2. TWITTER IMAGE
  // -------------------------------------------------------

  image = extractMeta(html, 'twitter:image');

  if (image && isPinterestImage(image)) {
    console.log('[PINTEREST] Main image from twitter:image');
    return normalizeImageUrl(image);
  }

  // -------------------------------------------------------
  // 3. JSON-LD
  // -------------------------------------------------------

  const jsonLdMatches = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  );

  if (jsonLdMatches) {
    for (const tag of jsonLdMatches) {
      try {
        const jsonText = tag
          .replace(/<script[^>]*>/i, '')
          .replace(/<\/script>/i, '')
          .trim();

        if (!jsonText) continue;

        const data = JSON.parse(jsonText);

        const objects = Array.isArray(data) ? data : [data];

        for (const item of objects) {
          if (!item) continue;

          // image: "url"
          if (typeof item.image === 'string') {
            image = normalizeImageUrl(item.image);

            if (image && isPinterestImage(image)) {
              console.log('[PINTEREST] Main image from JSON-LD');
              return image;
            }
          }

          // image: []
          if (Array.isArray(item.image)) {
            for (const img of item.image) {
              let candidate = null;

              if (typeof img === 'string') {
                candidate = img;
              } else if (img && typeof img === 'object') {
                candidate = img.url || img.contentUrl;
              }

              candidate = normalizeImageUrl(candidate);

              if (candidate && isPinterestImage(candidate)) {
                console.log('[PINTEREST] Main image from JSON-LD array');
                return candidate;
              }
            }
          }

          // image object
          if (item.image && typeof item.image === 'object') {
            image = normalizeImageUrl(
              item.image.url || item.image.contentUrl
            );

            if (image && isPinterestImage(image)) {
              console.log('[PINTEREST] Main image from JSON-LD object');
              return image;
            }
          }
        }
      } catch (err) {
        // JSON-LD không hợp lệ thì bỏ qua
      }
    }
  }

  // -------------------------------------------------------
  // 4. Pinterest-specific "image" fields
  // -------------------------------------------------------

  const specificPatterns = [
    /"orig":"(https?:\/\/[^"]+)"/i,
    /"originals":\{"url":"(https?:\/\/[^"]+)"/i,
    /"original":"(https?:\/\/[^"]+)"/i,
    /"imageUrl":"(https?:\/\/[^"]+)"/i,
    /"image_url":"(https?:\/\/[^"]+)"/i
  ];

  for (const pattern of specificPatterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      image = normalizeImageUrl(match[1]);

      if (image && isPinterestImage(image)) {
        console.log('[PINTEREST] Main image from Pinterest data');
        return image;
      }
    }
  }

  // -------------------------------------------------------
  // 5. FALLBACK: chỉ lấy URL ảnh Pinterest ĐẦU TIÊN
  // -------------------------------------------------------

  const directImageMatch = html.match(
    /https?:\/\/i\.pinimg\.com\/[^"'\\<>\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\<>\s]*)?/i
  );

  if (directImageMatch && directImageMatch[0]) {
    image = normalizeImageUrl(directImageMatch[0]);

    if (image) {
      console.log('[PINTEREST] Main image from direct pinimg URL');
      return image;
    }
  }

  return null;
}

/* =========================================================
   VIDEO EXTRACTION
========================================================= */

function extractPinterestVideo(html) {
  let video = null;

  // -------------------------------------------------------
  // 1. OG VIDEO
  // -------------------------------------------------------

  video =
    extractMeta(html, 'og:video:secure_url') ||
    extractMeta(html, 'og:video');

  if (video && isPinterestVideo(video)) {
    console.log('[PINTEREST] Video from og:video');
    return cleanUrl(video);
  }

  // -------------------------------------------------------
  // 2. contentUrl
  // -------------------------------------------------------

  const contentUrlPatterns = [
    /"contentUrl":"(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /"contentUrl":"(https?:\/\/[^"]+)"/i
  ];

  for (const pattern of contentUrlPatterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      video = cleanUrl(match[1]);

      if (video && isPinterestVideo(video)) {
        console.log('[PINTEREST] Video from contentUrl');
        return video;
      }
    }
  }

  // -------------------------------------------------------
  // 3. video_list
  // -------------------------------------------------------

  const videoListPatterns = [
    /"video_list":\{[^}]*"url":"(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /"video_list":\{[\s\S]*?"url":"(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /"url":"(https?:\/\/v\.pinimg\.com\/[^"]+\.mp4[^"]*)"/i
  ];

  for (const pattern of videoListPatterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      video = cleanUrl(match[1]);

      if (video && isPinterestVideo(video)) {
        console.log('[PINTEREST] Video from video_list');
        return video;
      }
    }
  }

  // -------------------------------------------------------
  // 4. Direct MP4
  // -------------------------------------------------------

  const directVideoMatch = html.match(
    /https?:\/\/(?:v|i)\.pinimg\.com\/[^"'\\<>\s]+?\.mp4(?:\?[^"'\\<>\s]*)?/i
  );

  if (directVideoMatch && directVideoMatch[0]) {
    video = cleanUrl(directVideoMatch[0]);

    if (video) {
      console.log('[PINTEREST] Video from direct pinimg URL');
      return video;
    }
  }

  return null;
}

/* =========================================================
   MAIN HANDLER
========================================================= */

async function handlePinterest(videoUrl) {
  console.log(`[PINTEREST] Processing: ${videoUrl}`);

  let html = '';

  try {
    // -----------------------------------------------------
    // Follow Pinterest redirects
    // -----------------------------------------------------

    const response = await axios.get(videoUrl, {
      headers: {
        'User-Agent': PINTEREST_UA,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      maxRedirects: 10,
      timeout: 15000,
      validateStatus: status => status >= 200 && status < 400
    });

    html = typeof response.data === 'string'
      ? response.data
      : '';

    console.log(
      `[PINTEREST] HTML received: ${html.length} bytes`
    );

    if (!html) {
      throw new Error('Pinterest returned empty HTML');
    }

    // -----------------------------------------------------
    // Extract metadata
    // -----------------------------------------------------

    const title = extractTitle(html);

    const authorData = extractAuthor(html);

    // -----------------------------------------------------
    // Extract VIDEO and IMAGE separately
    // -----------------------------------------------------

    const videoUrlExtracted = extractPinterestVideo(html);

    const mainImage = extractPinterestMainImage(html);

    console.log(
      `[PINTEREST] Video found: ${videoUrlExtracted ? 'YES' : 'NO'}`
    );

    console.log(
      `[PINTEREST] Image found: ${mainImage ? 'YES' : 'NO'}`
    );

    // -----------------------------------------------------
    // VIDEO PIN
    // -----------------------------------------------------

    if (videoUrlExtracted) {
      console.log('[PINTEREST] Returning VIDEO');

      return {
        type: 'video',

        desc: title,

        author: {
          nickname: authorData.nickname,
          unique_id: 'pinterest',
          avatar: authorData.avatar
        },

        video: {
          noWatermark: videoUrlExtracted,
          watermark: videoUrlExtracted,
          cover: mainImage || ''
        },

        /*
         * Giữ cover nhưng KHÔNG dùng nó làm danh sách ảnh
         * để tránh frontend hiểu nhầm là Image Pin.
         */
        images: null,

        music: {
          playUrl: videoUrlExtracted,
          title: title
        },

        statistics: {
          playCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0
        }
      };
    }

    // -----------------------------------------------------
    // IMAGE PIN
    // -----------------------------------------------------

    if (mainImage) {
      console.log('[PINTEREST] Returning IMAGE');
      console.log(`[PINTEREST] Image URL: ${mainImage}`);

      return {
        type: 'image',

        desc: title,

        author: {
          nickname: authorData.nickname,
          unique_id: 'pinterest',
          avatar: authorData.avatar
        },

        video: null,

        /*
         * QUAN TRỌNG:
         * Chỉ có đúng 1 ảnh.
         */
        images: [mainImage],

        music: null,

        statistics: {
          playCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0
        }
      };
    }

    console.log('[PINTEREST] No media found from Pinterest HTML');

  } catch (e) {
    console.error(
      '[PINTEREST SCRAPE ERROR]',
      e.message
    );
  }

  /* =======================================================
     COBALT FALLBACK
  ======================================================= */

  console.log('[PINTEREST] Trying Cobalt fallback...');

  const cobaltApis = [
    'https://api.cobalt.tools/api/json',
    'https://api.cobalt.tools',
    'https://cobalt.api.scout.ovh/api/json'
  ];

  for (const apiUrl of cobaltApis) {
    try {
      console.log(
        `[PINTEREST] Cobalt: ${apiUrl}`
      );

      const res = await axios.post(
        apiUrl,
        {
          url: videoUrl
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': PINTEREST_UA
          },
          timeout: 10000
        }
      );

      if (!res.data) continue;

      const d = res.data;

      let mediaUrl = null;

      if (d.url) {
        mediaUrl = d.url;
      } else if (
        Array.isArray(d.picker) &&
        d.picker.length > 0
      ) {
        mediaUrl = d.picker[0]?.url || null;
      }

      if (!mediaUrl) continue;

      mediaUrl = cleanUrl(mediaUrl);

      if (!mediaUrl) continue;

      const isVid =
        d.status === 'tunnel' ||
        isPinterestVideo(mediaUrl) ||
        /\.mp4/i.test(mediaUrl);

      if (isVid) {
        console.log(
          '[PINTEREST] Cobalt returned VIDEO'
        );

        return {
          type: 'video',

          desc: 'Pinterest Media',

          author: {
            nickname: 'Pinterest Pin',
            unique_id: 'pinterest',
            avatar: DEFAULT_AVATAR
          },

          video: {
            noWatermark: mediaUrl,
            watermark: mediaUrl,
            cover: ''
          },

          images: null,

          music: {
            playUrl: mediaUrl,
            title: 'Pinterest Audio'
          },

          statistics: {
            playCount: 0,
            likeCount: 0,
            commentCount: 0,
            shareCount: 0
          }
        };
      }

      // Cobalt trả về IMAGE
      console.log(
        '[PINTEREST] Cobalt returned IMAGE'
      );

      return {
        type: 'image',

        desc: 'Pinterest Media',

        author: {
          nickname: 'Pinterest Pin',
          unique_id: 'pinterest',
          avatar: DEFAULT_AVATAR
        },

        video: null,

        /*
         * Cobalt cũng chỉ trả 1 ảnh.
         */
        images: [mediaUrl],

        music: null,

        statistics: {
          playCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0
        }
      };

    } catch (e) {
      console.error(
        `[PINTEREST] Cobalt failed: ${apiUrl} - ${e.message}`
      );
    }
  }

  console.error(
    '[PINTEREST] Unable to extract media'
  );

  return null;
}

module.exports = handlePinterest;
