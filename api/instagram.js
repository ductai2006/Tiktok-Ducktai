const axios = require('axios');
require('dotenv').config();

/*
 * Instagram downloader
 *
 * Không dùng:
 * - Cobalt
 * - API downloader bên ngoài
 * - Graph API
 *
 * Dùng:
 * - Instagram sessionid
 * - Instagram csrftoken
 * - Instagram API trực tiếp
 */

const SESSIONID = process.env.IG_SESSIONID;
const CSRFTOKEN = process.env.IG_CSRFTOKEN || '';
const DS_USER_ID = process.env.IG_DS_USER_ID || '';

const IG_APP_ID = '936619743392459';

// Instagram shortcode alphabet
const SHORTCODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';


/*
 * ============================================================
 * Lấy shortcode từ URL
 * ============================================================
 */

function extractShortcode(inputUrl) {
  try {
    const url = new URL(inputUrl);

    const parts = url.pathname
      .split('/')
      .filter(Boolean);

    const supported = [
      'p',
      'reel',
      'reels',
      'tv'
    ];

    for (let i = 0; i < parts.length - 1; i++) {
      if (supported.includes(parts[i].toLowerCase())) {
        return parts[i + 1];
      }
    }

    return null;

  } catch (error) {
    return null;
  }
}


/*
 * ============================================================
 * Chuyển Instagram shortcode -> media ID
 * ============================================================
 */

function shortcodeToMediaId(shortcode) {
  let mediaId = BigInt(0);

  for (const char of shortcode) {
    const index = SHORTCODE_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error(
        `Invalid Instagram shortcode character: ${char}`
      );
    }

    mediaId =
      mediaId * BigInt(64) +
      BigInt(index);
  }

  return mediaId.toString();
}


/*
 * ============================================================
 * Headers
 * ============================================================
 */

function getHeaders() {
  const cookies = [
    `sessionid=${SESSIONID}`
  ];

  if (CSRFTOKEN) {
    cookies.push(`csrftoken=${CSRFTOKEN}`);
  }

  if (DS_USER_ID) {
    cookies.push(`ds_user_id=${DS_USER_ID}`);
  }

  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',

    'Accept':
      '*/*',

    'Accept-Language':
      'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',

    'Referer':
      'https://www.instagram.com/',

    'Origin':
      'https://www.instagram.com',

    'X-IG-App-ID':
      IG_APP_ID,

    'X-Requested-With':
      'XMLHttpRequest',

    ...(CSRFTOKEN
      ? {
        'X-CSRFToken': CSRFTOKEN
      }
      : {}),

    'Cookie':
      cookies.join('; ')
  };
}


/*
 * ============================================================
 * Gọi Instagram trực tiếp
 * ============================================================
 */

async function getMediaInfo(mediaId) {
  const url =
    `https://www.instagram.com/api/v1/media/${mediaId}/info/`;

  console.log(
    `[INSTAGRAM] Request: /api/v1/media/${mediaId}/info/`
  );

  const response = await axios.get(url, {
    headers: getHeaders(),

    timeout: 30000,

    validateStatus: () => true
  });

  console.log(
    `[INSTAGRAM] HTTP ${response.status}`
  );

  if (response.status !== 200) {
    let message =
      `Instagram HTTP ${response.status}`;

    if (response.data) {
      try {
        if (response.data.message) {
          message += ` - ${response.data.message}`;
        }

        if (response.data.error_type) {
          message += ` - ${response.data.error_type}`;
        }
      } catch (e) { }
    }

    throw new Error(message);
  }

  if (!response.data) {
    throw new Error(
      'Instagram returned empty response'
    );
  }

  return response.data;
}


/*
 * ============================================================
 * Lấy URL ảnh đại diện
 * ============================================================
 */

function getImageUrl(media) {
  if (
    media &&
    media.image_versions2 &&
    Array.isArray(
      media.image_versions2.candidates
    )
  ) {
    const candidates =
      media.image_versions2.candidates;

    if (candidates.length > 0) {
      /*
       * Candidate đầu tiên thường là bản phù hợp
       * nhất.
       */
      return candidates[0].url || '';
    }
  }

  return '';
}


/*
 * ============================================================
 * Lấy URL video
 * ============================================================
 */

function getVideoUrl(media) {
  if (
    media &&
    Array.isArray(media.video_versions) &&
    media.video_versions.length > 0
  ) {
    /*
     * Chọn video có kích thước lớn nhất.
     */

    const videos =
      media.video_versions
        .filter(
          item =>
            item &&
            typeof item.url === 'string' &&
            item.url.startsWith('http')
        )
        .sort((a, b) => {
          const aSize =
            (Number(a.width) || 0) *
            (Number(a.height) || 0);

          const bSize =
            (Number(b.width) || 0) *
            (Number(b.height) || 0);

          return bSize - aSize;
        });

    if (videos.length > 0) {
      return videos[0].url;
    }
  }

  return '';
}


/*
 * ============================================================
 * VIDEO
 * ============================================================
 */

function makeVideoResult(media) {
  const videoUrl =
    getVideoUrl(media);

  const cover =
    getImageUrl(media);

  if (!videoUrl) {
    return null;
  }

  const username =
    media.user &&
      media.user.username
      ? media.user.username
      : 'instagram';

  const fullname =
    media.user &&
      media.user.full_name
      ? media.user.full_name
      : username;

  console.log(
    `[INSTAGRAM] TYPE = VIDEO`
  );

  console.log(
    `[INSTAGRAM] Video URL found`
  );

  return {
    type: 'video',

    desc:
      media.caption &&
        media.caption.text
        ? media.caption.text
        : 'Instagram Video',

    author: {
      nickname: fullname,
      unique_id: username,

      avatar:
        media.user &&
          (
            media.user.profile_pic_url ||
            media.user.profile_pic_url_hd
          )
          ? (
            media.user.profile_pic_url_hd ||
            media.user.profile_pic_url
          )
          : ''
    },

    video: {
      noWatermark: videoUrl,
      watermark: videoUrl,
      cover: cover
    },

    images: null,

    music: {
      playUrl: videoUrl
    },

    statistics: {
      playCount:
        Number(
          media.play_count ||
          media.view_count ||
          0
        ),

      likeCount:
        Number(
          media.like_count ||
          0
        ),

      commentCount:
        Number(
          media.comment_count ||
          0
        ),

      shareCount: 0
    }
  };
}


/*
 * ============================================================
 * IMAGE
 * ============================================================
 */

function makeImageResult(media) {
  const imageUrl =
    getImageUrl(media);

  if (!imageUrl) {
    return null;
  }

  const username =
    media.user &&
      media.user.username
      ? media.user.username
      : 'instagram';

  const fullname =
    media.user &&
      media.user.full_name
      ? media.user.full_name
      : username;

  console.log(
    `[INSTAGRAM] TYPE = IMAGE`
  );

  return {
    type: 'image',

    desc:
      media.caption &&
        media.caption.text
        ? media.caption.text
        : 'Instagram Photo',

    author: {
      nickname: fullname,
      unique_id: username,

      avatar:
        media.user &&
          (
            media.user.profile_pic_url ||
            media.user.profile_pic_url_hd
          )
          ? (
            media.user.profile_pic_url_hd ||
            media.user.profile_pic_url
          )
          : ''
    },

    video: null,

    images: [
      imageUrl
    ],

    music: null,

    statistics: {
      playCount: 0,

      likeCount:
        Number(
          media.like_count ||
          0
        ),

      commentCount:
        Number(
          media.comment_count ||
          0
        ),

      shareCount: 0
    }
  };
}


/*
 * ============================================================
 * CAROUSEL
 * ============================================================
 */

function makeCarouselResult(media) {
  const children =
    Array.isArray(media.carousel_media)
      ? media.carousel_media
      : [];

  if (children.length === 0) {
    return null;
  }

  const videos = [];
  const images = [];

  for (const item of children) {
    const videoUrl =
      getVideoUrl(item);

    if (
      Number(item.media_type) === 2 &&
      videoUrl
    ) {
      videos.push({
        url: videoUrl,
        cover: getImageUrl(item)
      });

      continue;
    }

    const imageUrl =
      getImageUrl(item);

    if (imageUrl) {
      images.push(imageUrl);
    }
  }

  console.log(
    `[INSTAGRAM] TYPE = CAROUSEL`
  );

  console.log(
    `[INSTAGRAM] Carousel videos: ${videos.length}`
  );

  console.log(
    `[INSTAGRAM] Carousel images: ${images.length}`
  );


  /*
   * Nếu carousel có video:
   *
   * trả về video đầu tiên để router hiện tại
   * của project có thể xử lý giống video bình thường.
   */

  if (videos.length > 0) {
    return {
      type: 'video',

      desc: 'Instagram Carousel Video',

      author: {
        nickname:
          media.user &&
            media.user.full_name
            ? media.user.full_name
            : 'Instagram Creator',

        unique_id:
          media.user &&
            media.user.username
            ? media.user.username
            : 'instagram',

        avatar:
          media.user &&
            (
              media.user.profile_pic_url_hd ||
              media.user.profile_pic_url
            )
            ? (
              media.user.profile_pic_url_hd ||
              media.user.profile_pic_url
            )
            : ''
      },

      video: {
        noWatermark: videos[0].url,
        watermark: videos[0].url,
        cover: videos[0].cover || ''
      },

      images:
        images.length > 0
          ? images
          : null,

      music: {
        playUrl: videos[0].url
      },

      statistics: {
        playCount:
          Number(media.play_count || 0),

        likeCount:
          Number(media.like_count || 0),

        commentCount:
          Number(media.comment_count || 0),

        shareCount: 0
      }
    };
  }


  /*
   * Carousel chỉ có ảnh
   */

  if (images.length > 0) {
    return {
      type: 'image',

      desc: 'Instagram Carousel',

      author: {
        nickname:
          media.user &&
            media.user.full_name
            ? media.user.full_name
            : 'Instagram Creator',

        unique_id:
          media.user &&
            media.user.username
            ? media.user.username
            : 'instagram',

        avatar:
          media.user &&
            (
              media.user.profile_pic_url_hd ||
              media.user.profile_pic_url
            )
            ? (
              media.user.profile_pic_url_hd ||
              media.user.profile_pic_url
            )
            : ''
      },

      video: null,

      images: images,

      music: null,

      statistics: {
        playCount: 0,

        likeCount:
          Number(media.like_count || 0),

        commentCount:
          Number(media.comment_count || 0),

        shareCount: 0
      }
    };
  }

  return null;
}


/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function handleInstagram(instagramUrl) {
  console.log(
    `[INSTAGRAM] Processing: ${instagramUrl}`
  );

  if (!SESSIONID) {
    console.log(
      '[INSTAGRAM ERROR] IG_SESSIONID chưa được cấu hình'
    );

    return null;
  }

  const shortcode =
    extractShortcode(instagramUrl);

  if (!shortcode) {
    console.log(
      '[INSTAGRAM ERROR] Không lấy được shortcode'
    );

    return null;
  }

  console.log(
    `[INSTAGRAM] Shortcode: ${shortcode}`
  );

  let mediaId;

  try {
    mediaId =
      shortcodeToMediaId(shortcode);
  } catch (error) {
    console.log(
      '[INSTAGRAM ERROR] Shortcode invalid:',
      error.message
    );

    return null;
  }

  console.log(
    `[INSTAGRAM] Media ID: ${mediaId}`
  );

  try {
    const response =
      await getMediaInfo(mediaId);

    /*
     * Endpoint có thể trả:
     *
     * {
     *   items: [...]
     * }
     */

    const items =
      Array.isArray(response.items)
        ? response.items
        : [];

    if (items.length === 0) {
      console.log(
        '[INSTAGRAM] Không có media items'
      );

      return null;
    }

    const media = items[0];

    console.log(
      `[INSTAGRAM] media_type: ${media.media_type}`
    );

    /*
     * ========================================================
     * 1 = IMAGE
     * 2 = VIDEO
     * 8 = CAROUSEL
     * ========================================================
     */

    if (Number(media.media_type) === 2) {
      return makeVideoResult(media);
    }

    if (Number(media.media_type) === 1) {
      return makeImageResult(media);
    }

    if (Number(media.media_type) === 8) {
      return makeCarouselResult(media);
    }

    /*
     * Một số response có thể không có media_type
     * nhưng vẫn có video_versions.
     */

    if (
      Array.isArray(media.video_versions) &&
      media.video_versions.length > 0
    ) {
      console.log(
        '[INSTAGRAM] video_versions detected'
      );

      return makeVideoResult(media);
    }

    if (
      Array.isArray(
        media.image_versions2 &&
        media.image_versions2.candidates
      ) &&
      media.image_versions2.candidates.length > 0
    ) {
      console.log(
        '[INSTAGRAM] image_versions2 detected'
      );

      return makeImageResult(media);
    }

    console.log(
      '[INSTAGRAM] Không xác định được loại media'
    );

    return null;

  } catch (error) {
    console.log(
      '[INSTAGRAM ERROR]',
      error.message
    );

    if (error.response) {
      console.log(
        '[INSTAGRAM] HTTP:',
        error.response.status
      );
    }

    return null;
  }
}

module.exports = handleInstagram;
