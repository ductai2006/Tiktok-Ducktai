const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

/* ============================================================
 * CONFIG
 * ============================================================
 */

// Windows:
//   python
//
// Linux/Vercel:
//   python3
//
// Có thể override bằng biến môi trường:
//   YT_DLP_PYTHON=python3
const YT_DLP =
  process.env.YT_DLP_PYTHON ||
  (process.platform === 'win32' ? 'python' : 'python3');

// curl:
// Windows -> curl.exe
// Linux/Vercel -> curl
const CURL =
  process.env.CURL_BIN ||
  (process.platform === 'win32' ? 'curl.exe' : 'curl');

// ffmpeg:
// Windows -> ffmpeg
// Linux/Vercel -> ffmpeg
const FFMPEG =
  process.env.FFMPEG_BIN ||
  'ffmpeg';


/* ============================================================
 * COOKIE
 * ============================================================
 *
 * Cookie vẫn nằm trong project:
 *
 * cookies/facebook.txt
 *
 * Không ghi ngược vào cookie trên Vercel.
 * ============================================================
 */

const COOKIE_FILE = path.join(
  process.cwd(),
  'cookies',
  'facebook.txt'
);


/* ============================================================
 * VERCEL / LOCAL TEMP DIRECTORY
 * ============================================================
 *
 * KHÔNG dùng:
 *
 *   path.join(process.cwd(), 'facebook')
 *
 * vì trên Vercel:
 *
 *   /var/task
 *
 * là filesystem chỉ đọc.
 *
 * /tmp là thư mục ghi được trong runtime.
 * ============================================================
 */

const TEMP_DIR = os.tmpdir();

const DOWNLOAD_DIR = path.join(
  TEMP_DIR,
  'facebook'
);

const IMAGE_DIR = path.join(
  DOWNLOAD_DIR,
  'images'
);


/* ============================================================
 * USER AGENT
 * ============================================================
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';


/* ============================================================
 * CREATE TEMP DIRECTORIES
 * ============================================================
 */

function ensureDirectories() {
  try {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(
        DOWNLOAD_DIR,
        {
          recursive: true
        }
      );
    }

    if (!fs.existsSync(IMAGE_DIR)) {
      fs.mkdirSync(
        IMAGE_DIR,
        {
          recursive: true
        }
      );
    }

    return true;
  } catch (error) {
    console.log(
      `[FACEBOOK] Cannot create temp directory: ${error.message}`
    );

    return false;
  }
}

ensureDirectories();


/* ============================================================
 * COMMAND
 * ============================================================
 */

function runCommand(
  command,
  args,
  options = {}
) {
  return new Promise(
    (resolve, reject) => {
      execFile(
        command,
        args,
        {
          maxBuffer:
            100 * 1024 * 1024,

          windowsHide:
            true,

          ...options
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            error.stdout =
              stdout || '';

            error.stderr =
              stderr || '';

            reject(error);

            return;
          }

          resolve({
            stdout:
              stdout || '',

            stderr:
              stderr || ''
          });
        }
      );
    }
  );
}


/* ============================================================
 * YT-DLP
 * ============================================================
 */

function runYtDlp(args) {
  return new Promise(
    (resolve, reject) => {
      console.log(
        `[FACEBOOK] Running: ${YT_DLP} -m yt_dlp ${args.join(' ')}`
      );

      execFile(
        YT_DLP,
        [
          '-m',
          'yt_dlp',
          ...args
        ],
        {
          maxBuffer:
            100 * 1024 * 1024,

          windowsHide:
            true
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            console.log(
              `[FACEBOOK ERROR] yt-dlp exited with code ${error.code}`
            );

            if (stderr) {
              console.log(
                `[FACEBOOK STDERR] ${stderr}`
              );
            }

            if (stdout) {
              console.log(
                `[FACEBOOK STDOUT] ${stdout}`
              );
            }

            reject(error);

            return;
          }

          resolve({
            stdout:
              stdout || '',

            stderr:
              stderr || ''
          });
        }
      );
    }
  );
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function safeName(name) {
  return String(name || '')
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      '_'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .slice(
      0,
      150
    );
}


function getExtension(
  format,
  fallback
) {
  if (
    format &&
    format.ext
  ) {
    return format.ext;
  }

  return fallback;
}


/* ============================================================
 * NUMBER PARSER
 * ============================================================
 */

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const str =
    String(value)
      .replace(/,/g, '')
      .trim();

  const match =
    str.match(
      /(\d+(?:\.\d+)?)([KMB])?/i
    );

  if (!match) {
    return null;
  }

  let number =
    Number(match[1]);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  const suffix =
    String(match[2] || '')
      .toUpperCase();

  if (suffix === 'K') {
    number *= 1000;
  }

  if (suffix === 'M') {
    number *= 1000000;
  }

  if (suffix === 'B') {
    number *= 1000000000;
  }

  return Math.round(number);
}


/* ============================================================
 * DECODE FACEBOOK VALUE
 * ============================================================
 */

function decodeFacebookValue(value) {
  if (!value) {
    return null;
  }

  let result =
    String(value);

  try {
    result =
      result
        .replace(
          /&amp;/g,
          '&'
        )
        .replace(
          /&quot;/g,
          '"'
        )
        .replace(
          /&#039;/g,
          "'"
        )
        .replace(
          /&#x27;/g,
          "'"
        )
        .replace(
          /\\u0025/g,
          '%'
        )
        .replace(
          /\\u0026/g,
          '&'
        )
        .replace(
          /\\u003D/gi,
          '='
        )
        .replace(
          /\\u002F/gi,
          '/'
        )
        .replace(
          /\\\//g,
          '/'
        );
  } catch (_) { }

  return result;
}


/* ============================================================
 * GET META FROM HTML
 * ============================================================
 */

function extractMetaContent(
  html,
  names
) {
  if (!html) {
    return null;
  }

  for (
    const name of names
  ) {
    const escaped =
      name.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

    const patterns = [
      new RegExp(
        `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        'i'
      ),

      new RegExp(
        `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        'i'
      ),

      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
        'i'
      ),

      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`,
        'i'
      )
    ];

    for (
      const regex of patterns
    ) {
      const match =
        html.match(regex);

      if (
        match &&
        match[1]
      ) {
        return decodeFacebookValue(
          match[1]
        );
      }
    }
  }

  return null;
}


/* ============================================================
 * FACEBOOK METADATA
 * ============================================================
 */

function extractFacebookMetadata(
  html
) {
  const metadata = {
    title: null,

    description: null,

    author: {
      name: null,
      id: null,
      avatar: null
    },

    statistics: {
      likes: null,
      comments: null,
      shares: null,
      views: null
    }
  };

  if (!html) {
    return metadata;
  }


  /* TITLE */

  metadata.title =
    extractMetaContent(
      html,
      [
        'og:title',
        'twitter:title'
      ]
    );


  /* DESCRIPTION */

  metadata.description =
    extractMetaContent(
      html,
      [
        'og:description',
        'description',
        'twitter:description'
      ]
    );


  /* AVATAR */

  metadata.author.avatar =
    extractMetaContent(
      html,
      [
        'profile:image',
        'og:image'
      ]
    );


  /* AUTHOR */

  metadata.author.name =
    extractMetaContent(
      html,
      [
        'author',
        'og:site_name'
      ]
    );


  /* JSON NAME */

  const namePatterns = [
    /"actor"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i,

    /"owner"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i,

    /"profile_name"\s*:\s*"([^"]+)"/i,

    /"author_name"\s*:\s*"([^"]+)"/i,

    /"actor_name"\s*:\s*"([^"]+)"/i
  ];

  for (
    const regex of namePatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.author.name =
        decodeFacebookValue(
          match[1]
        );

      break;
    }
  }


  /* UID */

  const idPatterns = [
    /"actor"\s*:\s*\{[\s\S]{0,500}?"id"\s*:\s*"(\d+)"/i,

    /"owner"\s*:\s*\{[\s\S]{0,500}?"id"\s*:\s*"(\d+)"/i,

    /"profile_id"\s*:\s*"(\d+)"/i,

    /"author_id"\s*:\s*"(\d+)"/i,

    /"actor_id"\s*:\s*"(\d+)"/i,

    /"owner_id"\s*:\s*"(\d+)"/i
  ];

  for (
    const regex of idPatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.author.id =
        match[1];

      break;
    }
  }


  /* AVATAR FALLBACK */

  if (
    !metadata.author.avatar
  ) {
    const avatarPatterns = [
      /"profile_picture"\s*:\s*\{[\s\S]{0,300}?"uri"\s*:\s*"([^"]+)"/i,

      /"profile_pic"\s*:\s*"([^"]+)"/i,

      /"avatar_url"\s*:\s*"([^"]+)"/i,

      /"profile_image_url"\s*:\s*"([^"]+)"/i
    ];

    for (
      const regex of avatarPatterns
    ) {
      const match =
        html.match(regex);

      if (
        match &&
        match[1]
      ) {
        metadata.author.avatar =
          decodeFacebookValue(
            match[1]
          );

        break;
      }
    }
  }


  /* LIKES */

  const likePatterns = [
    /"like_count"\s*:\s*(\d+)/i,

    /"reaction_count"\s*:\s*(\d+)/i,

    /"total_reactions"\s*:\s*(\d+)/i,

    /"reaction_count"\s*:\s*\{[\s\S]{0,300}?"count"\s*:\s*(\d+)/i
  ];

  for (
    const regex of likePatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.statistics.likes =
        parseNumber(
          match[1]
        );

      break;
    }
  }


  /* COMMENTS */

  const commentPatterns = [
    /"comment_count"\s*:\s*(\d+)/i,

    /"comments_count"\s*:\s*(\d+)/i,

    /"total_comments"\s*:\s*(\d+)/i,

    /"comment_count"\s*:\s*\{[\s\S]{0,300}?"count"\s*:\s*(\d+)/i
  ];

  for (
    const regex of commentPatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.statistics.comments =
        parseNumber(
          match[1]
        );

      break;
    }
  }


  /* SHARES */

  const sharePatterns = [
    /"share_count"\s*:\s*(\d+)/i,

    /"shares_count"\s*:\s*(\d+)/i,

    /"reshare_count"\s*:\s*(\d+)/i,

    /"share_count"\s*:\s*\{[\s\S]{0,300}?"count"\s*:\s*(\d+)/i
  ];

  for (
    const regex of sharePatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.statistics.shares =
        parseNumber(
          match[1]
        );

      break;
    }
  }


  /* VIEWS */

  const viewPatterns = [
    /"view_count"\s*:\s*(\d+)/i,

    /"video_view_count"\s*:\s*(\d+)/i,

    /"play_count"\s*:\s*(\d+)/i,

    /"plays"\s*:\s*(\d+)/i,

    /"views"\s*:\s*(\d+)/i,

    /"view_count"\s*:\s*\{[\s\S]{0,300}?"count"\s*:\s*(\d+)/i
  ];

  for (
    const regex of viewPatterns
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      metadata.statistics.views =
        parseNumber(
          match[1]
        );

      break;
    }
  }

  return metadata;
}


/* ============================================================
 * FACEBOOK HTML
 * ============================================================
 */

async function fetchFacebookHTML(
  videoUrl
) {
  if (
    !fs.existsSync(
      COOKIE_FILE
    )
  ) {
    console.log(
      '[FACEBOOK] Cookie file not found for HTML metadata'
    );

    return '';
  }

  try {
    const args = [
      '-L',

      '--silent',

      '--show-error',

      '--max-time',
      '40',

      '--retry',
      '2',

      '-A',
      USER_AGENT,

      /*
       * CHỈ ĐỌC COOKIE.
       *
       * Không dùng:
       * -c COOKIE_FILE
       *
       * vì Vercel không cho ghi vào /var/task.
       */
      '-b',
      COOKIE_FILE,

      videoUrl
    ];

    const result =
      await runCommand(
        CURL,
        args
      );

    return (
      result.stdout || ''
    );
  } catch (error) {
    console.log(
      `[FACEBOOK] HTML request failed: ${error.message}`
    );

    return '';
  }
}


/* ============================================================
 * MERGE METADATA
 * ============================================================
 */

function mergeMetadata(
  info,
  htmlMetadata
) {
  info =
    info || {};

  htmlMetadata =
    htmlMetadata || {};

  const htmlAuthor =
    htmlMetadata.author || {};

  const htmlStats =
    htmlMetadata.statistics || {};


  const author = {
    name:
      info.uploader ||
      info.channel ||
      info.creator ||
      info.author ||
      info.uploader_name ||
      htmlAuthor.name ||
      null,

    id:
      info.uploader_id ||
      info.channel_id ||
      info.creator_id ||
      info.author_id ||
      htmlAuthor.id ||
      null,

    avatar:
      info.uploader_avatar ||
      info.channel_thumbnail ||
      info.avatar_url ||
      info.thumbnail ||
      htmlAuthor.avatar ||
      null
  };


  const statistics = {
    likes:
      parseNumber(
        info.like_count ??
        info.likes ??
        info.reaction_count ??
        htmlStats.likes
      ),

    comments:
      parseNumber(
        info.comment_count ??
        info.comments ??
        info.comments_count ??
        htmlStats.comments
      ),

    shares:
      parseNumber(
        info.repost_count ??
        info.share_count ??
        info.shares ??
        info.shares_count ??
        htmlStats.shares
      ),

    views:
      parseNumber(
        info.view_count ??
        info.views ??
        info.play_count ??
        info.video_view_count ??
        htmlStats.views
      )
  };


  return {
    title:
      info.title ||
      htmlMetadata.title ||
      null,

    description:
      info.description ||
      htmlMetadata.description ||
      null,

    author,

    statistics
  };
}


/* ============================================================
 * FORMAT SELECTORS
 * ============================================================
 */

function getBestVideo(
  formats
) {
  const videos =
    formats.filter(
      (f) => {
        return (
          f &&
          f.url &&
          f.vcodec &&
          f.vcodec !== 'none'
        );
      }
    );

  videos.sort(
    (a, b) => {
      const heightA =
        Number(
          a.height || 0
        );

      const heightB =
        Number(
          b.height || 0
        );

      if (
        heightA !== heightB
      ) {
        return (
          heightB -
          heightA
        );
      }

      return (
        Number(
          b.tbr || 0
        ) -
        Number(
          a.tbr || 0
        )
      );
    }
  );

  return (
    videos[0] ||
    null
  );
}


function getBestAudio(
  formats
) {
  const audios =
    formats.filter(
      (f) => {
        return (
          f &&
          f.url &&
          f.acodec &&
          f.acodec !== 'none'
        );
      }
    );

  audios.sort(
    (a, b) => {
      return (
        Number(
          b.abr ||
          b.tbr ||
          0
        ) -
        Number(
          a.abr ||
          a.tbr ||
          0
        )
      );
    }
  );

  return (
    audios[0] ||
    null
  );
}


function getProgressiveVideo(
  formats
) {
  const videos =
    formats.filter(
      (f) => {
        return (
          f &&
          f.url &&
          f.vcodec &&
          f.vcodec !== 'none' &&
          f.acodec &&
          f.acodec !== 'none'
        );
      }
    );

  videos.sort(
    (a, b) => {
      const heightA =
        Number(
          a.height || 0
        );

      const heightB =
        Number(
          b.height || 0
        );

      if (
        heightA !== heightB
      ) {
        return (
          heightB -
          heightA
        );
      }

      return (
        Number(
          b.tbr || 0
        ) -
        Number(
          a.tbr || 0
        )
      );
    }
  );

  return (
    videos[0] ||
    null
  );
}


/* ============================================================
 * IMAGE COLLECTOR
 * ============================================================
 */

function collectImages(
  info
) {
  const result = [];
  const seen = new Set();

  function add(url) {
    if (
      !url ||
      typeof url !== 'string'
    ) {
      return;
    }

    if (
      !url.startsWith(
        'http://'
      ) &&
      !url.startsWith(
        'https://'
      )
    ) {
      return;
    }

    if (
      seen.has(url)
    ) {
      return;
    }

    seen.add(url);
    result.push(url);
  }


  function walk(value) {
    if (!value) {
      return;
    }

    if (
      typeof value === 'string'
    ) {
      return;
    }

    if (
      Array.isArray(value)
    ) {
      for (
        const item of value
      ) {
        walk(item);
      }

      return;
    }

    if (
      typeof value !== 'object'
    ) {
      return;
    }


    if (
      value.url &&
      typeof value.url === 'string' &&
      (
        value.ext === 'jpg' ||
        value.ext === 'jpeg' ||
        value.ext === 'png' ||
        value.ext === 'webp' ||
        String(
          value.mime_type || ''
        ).startsWith(
          'image/'
        )
      )
    ) {
      add(
        value.url
      );
    }


    if (
      typeof value.url === 'string' &&
      (
        value.width ||
        value.height
      ) &&
      !value.vcodec &&
      !value.acodec
    ) {
      add(
        value.url
      );
    }


    if (
      Array.isArray(
        value.thumbnails
      )
    ) {
      for (
        const thumb of value.thumbnails
      ) {
        if (
          thumb &&
          thumb.url
        ) {
          add(
            thumb.url
          );
        }
      }
    }


    for (
      const key of [
        'images',
        'photos',
        'thumbnails',
        'children',
        'entries',
        'playlist'
      ]
    ) {
      if (
        value[key]
      ) {
        walk(
          value[key]
        );
      }
    }
  }


  walk(info);

  return result;
}


/* ============================================================
 * HTML IMAGE EXTRACTION
 * ============================================================
 */

async function extractImagesFromFacebookPage(
  videoUrl
) {
  console.log(
    '[FACEBOOK] Trying HTML image extraction...'
  );

  const html =
    await fetchFacebookHTML(
      videoUrl
    );

  if (!html) {
    return [];
  }

  const images = [];
  const seen = new Set();

  function addImage(url) {
    if (!url) {
      return;
    }

    let decoded =
      decodeFacebookValue(
        url
      );

    if (
      !decoded.startsWith(
        'http://'
      ) &&
      !decoded.startsWith(
        'https://'
      )
    ) {
      return;
    }

    if (
      !/\.(jpg|jpeg|png|webp)(?:[?#&]|$)/i.test(
        decoded
      ) &&
      !decoded.includes(
        'scontent'
      ) &&
      !decoded.includes(
        'fbcdn'
      )
    ) {
      return;
    }

    if (
      seen.has(decoded)
    ) {
      return;
    }

    seen.add(decoded);
    images.push(decoded);
  }


  const ogImageRegex =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi;

  let match;

  while (
    (match =
      ogImageRegex.exec(html)) !== null
  ) {
    addImage(
      match[1]
    );
  }


  const imageMetaRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:image:url|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;

  while (
    (match =
      imageMetaRegex.exec(html)) !== null
  ) {
    addImage(
      match[1]
    );
  }


  const fbUrlRegex =
    /https?:\\?\/\\?\/[^"'\\\s<>]+(?:scontent|fbcdn)[^"'\\\s<>]*/gi;

  while (
    (match =
      fbUrlRegex.exec(html)) !== null
  ) {
    addImage(
      match[0]
    );
  }


  console.log(
    `[FACEBOOK] HTML image candidates: ${images.length}`
  );

  return images.slice(
    0,
    20
  );
}


/* ============================================================
 * DOWNLOAD DIRECT
 * ============================================================
 */

function downloadDirect(
  url,
  outputPath,
  label
) {
  return new Promise(
    (resolve, reject) => {
      const args = [
        '-L',

        '--fail',

        '--retry',
        '3',

        '--retry-delay',
        '1',

        '--connect-timeout',
        '30',

        '--max-time',
        '600',

        '-A',
        USER_AGENT
      ];


      /*
       * Cookie chỉ được đọc.
       */
      if (
        fs.existsSync(
          COOKIE_FILE
        )
      ) {
        args.push(
          '-b',
          COOKIE_FILE
        );
      }


      args.push(
        '-o',
        outputPath,
        url
      );


      console.log(
        `[FACEBOOK] Downloading ${label} directly...`
      );


      execFile(
        CURL,
        args,
        {
          maxBuffer:
            20 * 1024 * 1024,

          windowsHide:
            true
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            console.log(
              `[FACEBOOK] curl ${label} failed`
            );

            if (stderr) {
              console.log(
                `[FACEBOOK CURL ERROR] ${stderr}`
              );
            }

            reject(error);

            return;
          }


          if (
            !fs.existsSync(
              outputPath
            )
          ) {
            reject(
              new Error(
                `Downloaded file does not exist: ${outputPath}`
              )
            );

            return;
          }


          const stat =
            fs.statSync(
              outputPath
            );


          if (
            stat.size <= 0
          ) {
            reject(
              new Error(
                `Downloaded file is empty: ${outputPath}`
              )
            );

            return;
          }


          resolve(
            outputPath
          );
        }
      );
    }
  );
}


/* ============================================================
 * IMAGE DOWNLOAD
 * ============================================================
 */

async function downloadImageLocally(
  imageUrl,
  index,
  baseName
) {
  const filename =
    `${baseName}_${index}.jpg`;

  const outputPath =
    path.join(
      IMAGE_DIR,
      filename
    );


  try {
    await downloadDirect(
      imageUrl,
      outputPath,
      `image ${index}`
    );


    return {
      filename,

      localPath:
        outputPath,

      url:
        `/facebook/images/${encodeURIComponent(
          filename
        )}`
    };
  } catch (error) {
    console.log(
      `[FACEBOOK] Image ${index} download failed: ${error.message}`
    );

    return null;
  }
}


/* ============================================================
 * FFMPEG
 * ============================================================
 */

function mergeVideoAudio(
  videoPath,
  audioPath,
  outputPath
) {
  return new Promise(
    (resolve, reject) => {
      const args = [
        '-y',

        '-i',
        videoPath,

        '-i',
        audioPath,

        '-map',
        '0:v:0',

        '-map',
        '1:a:0',

        '-c:v',
        'copy',

        '-c:a',
        'aac',

        '-movflags',
        '+faststart',

        outputPath
      ];


      console.log(
        '[FACEBOOK] FFmpeg merging video + audio...'
      );


      execFile(
        FFMPEG,
        args,
        {
          maxBuffer:
            30 * 1024 * 1024,

          windowsHide:
            true
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            console.log(
              '[FACEBOOK] FFmpeg merge failed'
            );

            if (stderr) {
              console.log(
                `[FACEBOOK FFMPEG ERROR] ${stderr}`
              );
            }

            reject(error);

            return;
          }


          if (
            !fs.existsSync(
              outputPath
            )
          ) {
            reject(
              new Error(
                'FFmpeg output file does not exist'
              )
            );

            return;
          }


          resolve(
            outputPath
          );
        }
      );
    }
  );
}


/* ============================================================
 * PUBLIC URL
 * ============================================================
 */

function makePublicUrl(
  filename
) {
  return (
    `/facebook/${encodeURIComponent(
      filename
    )}`
  );
}


/* ============================================================
 * BUILD RESPONSE
 * ============================================================
 */

function buildResponse({
  info,
  metadata,
  type,
  title,
  description,
  localPath,
  localFile,
  filename,
  hasAudio,
  images,
  audioUrl
}) {
  const finalTitle =
    title ??
    metadata.title ??
    info?.title ??
    null;


  const finalDescription =
    description ??
    metadata.description ??
    info?.description ??
    null;


  const author =
    metadata.author || {
      name: null,
      id: null,
      avatar: null
    };


  const statistics =
    metadata.statistics || {
      likes: null,
      comments: null,
      shares: null,
      views: null
    };


  const result = {
    platform:
      'facebook',

    type,

    title:
      finalTitle,

    description:
      finalDescription,


    author: {
      name:
        author.name ||
        null,

      id:
        author.id ||
        null,

      uid:
        author.id ||
        null,

      avatar:
        author.avatar ||
        null
    },


    statistics: {
      likes:
        statistics.likes ??
        null,

      comments:
        statistics.comments ??
        null,

      shares:
        statistics.shares ??
        null,

      views:
        statistics.views ??
        null
    },


    likes:
      statistics.likes ??
      null,

    comments:
      statistics.comments ??
      null,

    shares:
      statistics.shares ??
      null,

    views:
      statistics.views ??
      null,


    uid:
      author.id ||
      null,

    username:
      author.name ||
      null,

    avatar:
      author.avatar ||
      null,


    duration:
      info?.duration ||
      null,


    images:
      images ||
      [],


    hasAudio:
      Boolean(hasAudio)
  };


  if (
    localPath
  ) {
    result.localPath =
      localPath;

    result.localFile =
      localFile ||
      localPath;

    result.filename =
      filename;


    result.video = {
      noWatermark:
        makePublicUrl(
          filename
        ),

      watermark:
        makePublicUrl(
          filename
        ),

      url:
        makePublicUrl(
          filename
        )
    };


    result.audio = {
      url:
        audioUrl ||
        makePublicUrl(
          filename
        )
    };
  }


  return result;
}


/* ============================================================
 * HANDLE FACEBOOK
 * ============================================================
 */

async function handleFacebook(
  videoUrl
) {
  console.log(
    `[FACEBOOK] Processing: ${videoUrl}`
  );


  /*
   * Đảm bảo /tmp/facebook tồn tại
   * mỗi lần function được gọi.
   */
  ensureDirectories();


  /* ==========================================================
   * COOKIE
   * ==========================================================
   */

  if (
    !fs.existsSync(
      COOKIE_FILE
    )
  ) {
    console.log(
      `[FACEBOOK] Cookie file not found: ${COOKIE_FILE}`
    );
  } else {
    console.log(
      '[FACEBOOK] Cookie file loaded'
    );
  }


  /* ==========================================================
   * YT-DLP INFO
   * ==========================================================
   */

  let info = null;


  try {
    const args = [
      '--cookies',
      COOKIE_FILE,

      '--dump-single-json',

      '--skip-download',

      '--no-playlist',

      '--no-warnings',

      '--user-agent',
      USER_AGENT,

      videoUrl
    ];


    const result =
      await runYtDlp(
        args
      );


    if (
      result.stdout &&
      result.stdout.trim() &&
      result.stdout.trim() !== 'null'
    ) {
      try {
        info =
          JSON.parse(
            result.stdout.trim()
          );
      } catch (jsonError) {
        console.log(
          '[FACEBOOK] Cannot parse yt-dlp JSON'
        );
      }
    }
  } catch (error) {
    console.log(
      '[FACEBOOK] yt-dlp information extraction failed'
    );

    if (
      error.stderr
    ) {
      console.log(
        `[FACEBOOK] yt-dlp error: ${error.stderr}`
      );
    }
  }


  /* ==========================================================
   * FACEBOOK HTML METADATA
   * ==========================================================
   */

  console.log(
    '[FACEBOOK] Extracting Facebook HTML metadata...'
  );


  let htmlMetadata = {
    title: null,

    description: null,

    author: {
      name: null,
      id: null,
      avatar: null
    },

    statistics: {
      likes: null,
      comments: null,
      shares: null,
      views: null
    }
  };


  try {
    const html =
      await fetchFacebookHTML(
        videoUrl
      );


    if (html) {
      htmlMetadata =
        extractFacebookMetadata(
          html
        );


      console.log(
        `[FACEBOOK] HTML Author: ${htmlMetadata.author.name ||
        'Unknown'
        }`
      );


      console.log(
        `[FACEBOOK] HTML UID: ${htmlMetadata.author.id ||
        'Unknown'
        }`
      );


      console.log(
        `[FACEBOOK] HTML Avatar: ${htmlMetadata.author.avatar
          ? 'FOUND'
          : 'NOT FOUND'
        }`
      );


      console.log(
        `[FACEBOOK] HTML Likes: ${htmlMetadata.statistics.likes ??
        'Unknown'
        }`
      );


      console.log(
        `[FACEBOOK] HTML Comments: ${htmlMetadata.statistics.comments ??
        'Unknown'
        }`
      );


      console.log(
        `[FACEBOOK] HTML Shares: ${htmlMetadata.statistics.shares ??
        'Unknown'
        }`
      );


      console.log(
        `[FACEBOOK] HTML Views: ${htmlMetadata.statistics.views ??
        'Unknown'
        }`
      );
    }
  } catch (error) {
    console.log(
      `[FACEBOOK] Metadata extraction failed: ${error.message}`
    );
  }


  /* ==========================================================
   * MERGE
   * ==========================================================
   */

  const metadata =
    mergeMetadata(
      info,
      htmlMetadata
    );


  console.log(
    `[FACEBOOK] FINAL NAME: ${metadata.author.name ||
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL UID: ${metadata.author.id ||
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL AVATAR: ${metadata.author.avatar
      ? 'FOUND'
      : 'NOT FOUND'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL LIKES: ${metadata.statistics.likes ??
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL COMMENTS: ${metadata.statistics.comments ??
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL SHARES: ${metadata.statistics.shares ??
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] FINAL VIEWS: ${metadata.statistics.views ??
    'Unknown'
    }`
  );


  /* ==========================================================
   * NO YT-DLP
   * ==========================================================
   */

  if (!info) {
    console.log(
      '[FACEBOOK] No yt-dlp information'
    );


    const fallbackImages =
      await extractImagesFromFacebookPage(
        videoUrl
      );


    if (
      fallbackImages.length > 0
    ) {
      const baseName =
        `facebook_image_${crypto
          .randomBytes(8)
          .toString('hex')}`;


      const downloadedImages = [];


      for (
        let i = 0;
        i < fallbackImages.length;
        i++
      ) {
        const downloaded =
          await downloadImageLocally(
            fallbackImages[i],
            i + 1,
            baseName
          );


        if (downloaded) {
          downloadedImages.push(
            downloaded
          );
        }
      }


      if (
        downloadedImages.length > 0
      ) {
        return buildResponse({
          info: {},

          metadata,

          type:
            'image',

          title:
            metadata.title,

          description:
            metadata.description,

          images:
            downloadedImages.map(
              item =>
                item.url
            ),

          hasAudio:
            false
        });
      }
    }


    console.log(
      '[FACEBOOK] Failed to extract information'
    );


    return null;
  }


  /* ==========================================================
   * BASIC INFO
   * ==========================================================
   */

  const formats =
    Array.isArray(
      info.formats
    )
      ? info.formats
      : [];


  console.log(
    `[FACEBOOK] Title: ${info.title ||
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] ID: ${info.id ||
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] Uploader: ${info.uploader ||
    'Unknown'
    }`
  );


  console.log(
    `[FACEBOOK] Duration: ${info.duration ||
    0
    }s`
  );


  console.log(
    `[FACEBOOK] Formats: ${formats.length
    }`
  );


  /* ==========================================================
   * IMAGES
   * ==========================================================
   */

  let images =
    collectImages(
      info
    );


  if (
    images.length > 0
  ) {
    console.log(
      `[FACEBOOK] Found ${images.length} image(s) from yt-dlp`
    );
  }


  /* ==========================================================
   * PROGRESSIVE
   * ==========================================================
   */

  const progressive =
    getProgressiveVideo(
      formats
    );


  if (progressive) {
    console.log(
      `[FACEBOOK] Progressive video: ${progressive.format_id}`
    );


    const filename =
      `facebook_${info.id ||
      crypto.randomBytes(4).toString('hex')
      }_${crypto.randomBytes(8).toString('hex')
      }.mp4`;


    const outputPath =
      path.join(
        DOWNLOAD_DIR,
        filename
      );


    try {
      await downloadDirect(
        progressive.url,
        outputPath,
        'progressive video'
      );


      console.log(
        `[FACEBOOK] Download success: ${filename}`
      );


      return buildResponse({
        info,

        metadata,

        type:
          'video',

        title:
          metadata.title,

        description:
          metadata.description,

        localPath:
          outputPath,

        localFile:
          outputPath,

        filename,

        hasAudio:
          true,

        images
      });
    } catch (error) {
      console.log(
        `[FACEBOOK] Progressive download failed: ${error.message}`
      );
    }
  }


  /* ==========================================================
   * VIDEO + AUDIO
   * ==========================================================
   */

  const videoFormat =
    getBestVideo(
      formats
    );


  const audioFormat =
    getBestAudio(
      formats
    );


  if (
    videoFormat &&
    audioFormat
  ) {
    console.log(
      '[FACEBOOK] Video and audio are separate'
    );


    const random =
      crypto
        .randomBytes(8)
        .toString('hex');


    const baseName =
      `facebook_${info.id ||
      'video'
      }_${random}`;


    const videoExt =
      getExtension(
        videoFormat,
        'mp4'
      );


    const audioExt =
      getExtension(
        audioFormat,
        'm4a'
      );


    const videoPath =
      path.join(
        DOWNLOAD_DIR,
        `${baseName}_video.${videoExt}`
      );


    const audioPath =
      path.join(
        DOWNLOAD_DIR,
        `${baseName}_audio.${audioExt}`
      );


    const outputFilename =
      `${baseName}.mp4`;


    const outputPath =
      path.join(
        DOWNLOAD_DIR,
        outputFilename
      );


    try {
      await downloadDirect(
        videoFormat.url,
        videoPath,
        'video'
      );


      await downloadDirect(
        audioFormat.url,
        audioPath,
        'audio'
      );


      console.log(
        '[FACEBOOK] Both streams downloaded'
      );


      await mergeVideoAudio(
        videoPath,
        audioPath,
        outputPath
      );


      try {
        if (
          fs.existsSync(
            videoPath
          )
        ) {
          fs.unlinkSync(
            videoPath
          );
        }


        if (
          fs.existsSync(
            audioPath
          )
        ) {
          fs.unlinkSync(
            audioPath
          );
        }
      } catch (_) { }


      const sizeMB =
        (
          fs.statSync(
            outputPath
          ).size /
          1024 /
          1024
        ).toFixed(2);


      console.log(
        `[FACEBOOK] Download success: ${outputFilename} (${sizeMB} MB)`
      );


      return buildResponse({
        info,

        metadata,

        type:
          'video',

        title:
          metadata.title,

        description:
          metadata.description,

        localPath:
          outputPath,

        localFile:
          outputPath,

        filename:
          outputFilename,

        hasAudio:
          true,

        images
      });
    } catch (error) {
      console.log(
        `[FACEBOOK] Direct stream download/merge failed: ${error.message}`
      );


      for (
        const file of [
          videoPath,
          audioPath,
          outputPath
        ]
      ) {
        try {
          if (
            fs.existsSync(file)
          ) {
            fs.unlinkSync(file);
          }
        } catch (_) { }
      }
    }
  }


  /* ==========================================================
   * VIDEO ONLY
   * ==========================================================
   */

  if (videoFormat) {
    console.log(
      '[FACEBOOK] Only video stream available'
    );


    const filename =
      `facebook_${info.id ||
      'video'
      }_${crypto.randomBytes(8).toString('hex')
      }.mp4`;


    const outputPath =
      path.join(
        DOWNLOAD_DIR,
        filename
      );


    try {
      await downloadDirect(
        videoFormat.url,
        outputPath,
        'video'
      );


      console.log(
        `[FACEBOOK] Video download success: ${filename}`
      );


      return buildResponse({
        info,

        metadata,

        type:
          'video',

        title:
          metadata.title,

        description:
          metadata.description,

        localPath:
          outputPath,

        localFile:
          outputPath,

        filename,

        hasAudio:
          false,

        images
      });
    } catch (error) {
      console.log(
        `[FACEBOOK] Video download failed: ${error.message}`
      );
    }
  }


  /* ==========================================================
   * IMAGE FALLBACK
   * ==========================================================
   */

  if (
    images.length === 0
  ) {
    console.log(
      '[FACEBOOK] No images from yt-dlp, trying HTML...'
    );


    images =
      await extractImagesFromFacebookPage(
        videoUrl
      );
  }


  if (
    images.length > 0
  ) {
    console.log(
      `[FACEBOOK] Found ${images.length} image(s)`
    );


    const baseName =
      `facebook_${info.id ||
      'image'
      }_${crypto
        .randomBytes(8)
        .toString('hex')
      }`;


    const downloadedImages = [];


    for (
      let i = 0;
      i < images.length;
      i++
    ) {
      const downloaded =
        await downloadImageLocally(
          images[i],
          i + 1,
          baseName
        );


      if (downloaded) {
        downloadedImages.push(
          downloaded
        );
      }
    }


    if (
      downloadedImages.length > 0
    ) {
      return buildResponse({
        info,

        metadata,

        type:
          'image',

        title:
          metadata.title ||
          metadata.description,

        description:
          metadata.description,

        images:
          downloadedImages.map(
            item =>
              item.url
          ),

        hasAudio:
          false
      });
    }


    return buildResponse({
      info,

      metadata,

      type:
        'image',

      title:
        metadata.title ||
        metadata.description,

      description:
        metadata.description,

      images,

      hasAudio:
        false
    });
  }


  /* ==========================================================
   * NO MEDIA
   * ==========================================================
   */

  console.log(
    '[FACEBOOK] No downloadable media found'
  );


  return null;
}


/* ============================================================
 * EXPORT
 * ============================================================
 */

module.exports =
  handleFacebook;