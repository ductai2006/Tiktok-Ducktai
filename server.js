const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const downloadDir = path.join(os.tmpdir(), 'downloads');

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// Import modular API router
const apiEngine = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// CONFIGURATION & ADMIN AUTH STORE
// ==========================================

const CONFIG_PATH = path.join(__dirname, 'admin-config.json');

const DEFAULT_PLATFORMS = {
  tiktok: {
    enabled: true,
    name: 'TikTok'
  },

  youtube: {
    enabled: true,
    name: 'YouTube'
  },

  pinterest: {
    enabled: true,
    name: 'Pinterest'
  },

  x: {
    enabled: true,
    name: 'Twitter / X'
  },

  instagram: {
    enabled: true,
    name: 'Instagram'
  },

  facebook: {
    enabled: true,
    name: 'Facebook'
  }
};


function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data =
        fs.readFileSync(
          CONFIG_PATH,
          'utf8'
        );

      const parsed =
        JSON.parse(data);

      return {
        adminPassword:
          parsed.adminPassword ||
          'ducktai2006',

        maintenance:
          parsed.maintenance || {
            enabled: false,
            title: 'Website đang bảo trì',
            message:
              'Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt hơn. Vui lòng quay lại sau.',
            estimatedTime: ''
          },

        banner:
          parsed.banner || {
            enabled: false,
            message:
              'Chào mừng đến với TikFlow!',
            type: 'info'
          },

        blockedIPs:
          parsed.blockedIPs || [],

        blockedDevices:
          parsed.blockedDevices || [],

        platforms:
          parsed.platforms ||
          DEFAULT_PLATFORMS
      };
    }
  } catch (err) {
    console.error(
      '[CONFIG ERROR] Failed to load config:',
      err.message
    );
  }

  return {
    adminPassword:
      'ducktai2006',

    maintenance: {
      enabled: false,
      title:
        'Website đang bảo trì',
      message:
        'Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt hơn. Vui lòng quay lại sau.',
      estimatedTime: ''
    },

    banner: {
      enabled: false,
      message:
        'Chào mừng đến với TikFlow!',
      type: 'info'
    },

    blockedIPs: [],
    blockedDevices: [],
    platforms:
      DEFAULT_PLATFORMS
  };
}


function saveConfig(config) {
  try {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        config,
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.error(
      '[CONFIG ERROR] Failed to save config:',
      err.message
    );
  }
}


let appConfig =
  loadConfig();


// ==========================================
// IN-MEMORY AUTH TOKENS
// ==========================================

const activeTokens =
  new Set();


function authMiddleware(
  req,
  res,
  next
) {
  const token =
    req.headers[
    'x-admin-token'
    ];

  if (
    !token ||
    !activeTokens.has(token)
  ) {
    return res
      .status(401)
      .json({
        error:
          'Phiên làm việc không hợp lệ hoặc đã hết hạn.'
      });
  }

  next();
}


// ==========================================
// ACCESS LOGS
// ==========================================

const accessLogs = [];
const MAX_LOGS = 500;


function getClientIP(req) {
  const forwarded =
    req.headers[
    'x-forwarded-for'
    ];

  if (forwarded) {
    return forwarded
      .split(',')[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}


// ==========================================
// SECURITY / LOGGING / MAINTENANCE
// ==========================================

app.use(
  (req, res, next) => {
    const rawIP =
      getClientIP(req);

    const cleanIP =
      rawIP.replace(
        /^::ffff:/,
        ''
      );

    const ua =
      req.headers[
      'user-agent'
      ] || '';

    // --------------------------------------
    // ACCESS LOG
    // --------------------------------------

    if (
      !req.url.match(
        /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i
      )
    ) {
      accessLogs.unshift({
        time:
          new Date().toISOString(),

        ip: cleanIP,

        method:
          req.method,

        url:
          req.originalUrl ||
          req.url,

        ua
      });

      if (
        accessLogs.length >
        MAX_LOGS
      ) {
        accessLogs.pop();
      }
    }


    // --------------------------------------
    // IP BLOCKING
    // --------------------------------------

    const isIPBlocked =
      appConfig.blockedIPs.some(
        (item) => {
          const blockedIP =
            typeof item === 'string'
              ? item
              : item.ip;

          return (
            blockedIP ===
            cleanIP
          );
        }
      );

    if (isIPBlocked) {
      console.log(
        `[SECURITY] Blocked IP attempt: ${cleanIP} on ${req.url}`
      );

      return res
        .status(403)
        .json({
          error:
            'Địa chỉ IP của bạn đã bị chặn truy cập.'
        });
    }


    // --------------------------------------
    // DEVICE BLOCKING
    // --------------------------------------

    const isDeviceBlocked =
      appConfig.blockedDevices.some(
        (item) => {
          const pattern =
            typeof item === 'string'
              ? item
              : item.pattern;

          if (!pattern) {
            return false;
          }

          return ua
            .toLowerCase()
            .includes(
              pattern.toLowerCase()
            );
        }
      );

    if (isDeviceBlocked) {
      console.log(
        `[SECURITY] Blocked Device attempt: UA "${ua}" on ${req.url}`
      );

      return res
        .status(403)
        .json({
          error:
            'Thiết bị/Trình duyệt của bạn đã bị chặn truy cập.'
        });
    }


    // --------------------------------------
    // MAINTENANCE
    // --------------------------------------

    const isAdminRoute =
      req.url.startsWith(
        '/admin'
      ) ||
      req.url.startsWith(
        '/api/admin'
      );

    const isPublicConfigRoute =
      req.url.startsWith(
        '/api/public/config'
      );

    if (
      appConfig.maintenance?.enabled &&
      !isAdminRoute &&
      !isPublicConfigRoute
    ) {
      if (
        req.url.startsWith(
          '/api/'
        )
      ) {
        return res
          .status(503)
          .json({
            maintenance: true,

            title:
              appConfig.maintenance.title,

            message:
              appConfig.maintenance.message,

            estimatedTime:
              appConfig.maintenance.estimatedTime
          });
      }

      if (
        req.accepts('html')
      ) {
        return res
          .status(503)
          .send(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>
    ${appConfig.maintenance.title || 'Website đang bảo trì'}
  </title>

  <link
    href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap"
    rel="stylesheet"
  >

  <style>
    body {
      font-family: 'Be Vietnam Pro', sans-serif;
      background: #07071a;
      color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }

    .card {
      background: rgba(18, 18, 29, 0.85);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 40px;
      max-width: 480px;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    h1 {
      font-size: 1.6rem;
      color: #a855f7;
      margin-bottom: 12px;
    }

    p {
      color: #9ca3af;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .time {
      display: inline-block;
      background: rgba(168,85,247,0.15);
      color: #a855f7;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.85rem;
    }
  </style>
</head>

<body>
  <div class="card">

    <div class="icon">
      🛠️
    </div>

    <h1>
      ${appConfig.maintenance.title || 'Website đang bảo trì'}
    </h1>

    <p>
      ${appConfig.maintenance.message || 'Chúng tôi đang bảo trì hệ thống. Vui lòng quay lại sau.'}
    </p>

    ${appConfig.maintenance.estimatedTime
              ? `<div class="time">
            ⏱ Dự kiến:
            ${appConfig.maintenance.estimatedTime}
          </div>`
              : ''
            }

  </div>
</body>
</html>
        `);
      }
    }

    next();
  }
);


// ==========================================
// STATIC PUBLIC
// ==========================================

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);


// ==========================================
// DOWNLOAD DIRECTORIES
// ==========================================

// ------------------------------------------
// NORMAL DOWNLOAD
// ------------------------------------------

const DOWNLOAD_DIR =
  path.join(
    __dirname,
    'downloads'
  );

if (
  !fs.existsSync(
    DOWNLOAD_DIR
  )
) {
  fs.mkdirSync(
    DOWNLOAD_DIR,
    {
      recursive: true
    }
  );
}


// ------------------------------------------
// FACEBOOK DOWNLOAD
// ------------------------------------------

const FACEBOOK_DOWNLOAD_DIR =
  path.join(
    __dirname,
    'facebook'
  );

if (
  !fs.existsSync(
    FACEBOOK_DOWNLOAD_DIR
  )
) {
  fs.mkdirSync(
    FACEBOOK_DOWNLOAD_DIR,
    {
      recursive: true
    }
  );
}


// ------------------------------------------
// FACEBOOK IMAGES
// ------------------------------------------

const FACEBOOK_IMAGE_DIR =
  path.join(
    FACEBOOK_DOWNLOAD_DIR,
    'images'
  );

if (
  !fs.existsSync(
    FACEBOOK_IMAGE_DIR
  )
) {
  fs.mkdirSync(
    FACEBOOK_IMAGE_DIR,
    {
      recursive: true
    }
  );
}


// ==========================================
// MIME TYPE
// ==========================================

function getMimeType(
  filePath
) {
  const ext =
    path.extname(
      filePath
    ).toLowerCase();

  const mimeTypes = {
    '.mp4':
      'video/mp4',

    '.m4v':
      'video/mp4',

    '.webm':
      'video/webm',

    '.mov':
      'video/quicktime',

    '.avi':
      'video/x-msvideo',

    '.mkv':
      'video/x-matroska',

    '.mp3':
      'audio/mpeg',

    '.m4a':
      'audio/mp4',

    '.wav':
      'audio/wav',

    '.ogg':
      'audio/ogg',

    '.jpg':
      'image/jpeg',

    '.jpeg':
      'image/jpeg',

    '.png':
      'image/png',

    '.webp':
      'image/webp',

    '.gif':
      'image/gif'
  };

  return (
    mimeTypes[ext] ||
    'application/octet-stream'
  );
}


// ==========================================
// SERVE NORMAL DOWNLOAD FILES
// ==========================================

app.use(
  '/downloads',
  express.static(
    DOWNLOAD_DIR,
    {
      acceptRanges: true,

      fallthrough: false,

      setHeaders: (res) => {
        res.setHeader(
          'Access-Control-Allow-Origin',
          '*'
        );

        res.setHeader(
          'Cache-Control',
          'public, max-age=3600'
        );
      }
    }
  )
);


// ==========================================
// SERVE FACEBOOK FILES
//
// /facebook/file.mp4
//
// /facebook/images/file.jpg
// ==========================================

app.use(
  '/facebook',
  express.static(
    FACEBOOK_DOWNLOAD_DIR,
    {
      acceptRanges: true,

      fallthrough: false,

      setHeaders: (
        res,
        filePath
      ) => {
        res.setHeader(
          'Access-Control-Allow-Origin',
          '*'
        );

        res.setHeader(
          'Cache-Control',
          'public, max-age=3600'
        );

        res.setHeader(
          'Content-Type',
          getMimeType(
            filePath
          )
        );
      }
    }
  )
);


// ==========================================
// COMPATIBILITY ROUTES
//
// Facebook handler có thể trả:
//
// /download/facebook/file.mp4
//
// Vì vậy phải hỗ trợ URL này.
// ==========================================

app.use(
  '/download/facebook',
  express.static(
    FACEBOOK_DOWNLOAD_DIR,
    {
      acceptRanges: true,

      fallthrough: false,

      setHeaders: (
        res,
        filePath
      ) => {
        res.setHeader(
          'Access-Control-Allow-Origin',
          '*'
        );

        res.setHeader(
          'Cache-Control',
          'public, max-age=3600'
        );

        res.setHeader(
          'Content-Type',
          getMimeType(
            filePath
          )
        );
      }
    }
  )
);


// ==========================================
// PUBLIC API
// ==========================================

app.get(
  '/api/public/config',
  (req, res) => {
    res.json({
      maintenance:
        appConfig.maintenance,

      banner:
        appConfig.banner,

      platforms:
        appConfig.platforms ||
        DEFAULT_PLATFORMS
    });
  }
);


// ==========================================
// ADMIN LOGIN
// ==========================================

app.post(
  '/api/admin/login',
  (req, res) => {
    const {
      password
    } = req.body;

    if (
      password &&
      password ===
      appConfig.adminPassword
    ) {
      const token =
        crypto
          .randomBytes(32)
          .toString('hex');

      activeTokens.add(
        token
      );

      return res.json({
        token,
        success: true
      });
    }

    return res
      .status(401)
      .json({
        error:
          'Mật khẩu không chính xác.'
      });
  }
);


// ==========================================
// ADMIN CONFIG
// ==========================================

app.get(
  '/api/admin/config',
  authMiddleware,
  (req, res) => {
    const safeConfig = {
      ...appConfig
    };

    delete safeConfig.adminPassword;

    res.json(
      safeConfig
    );
  }
);


// ==========================================
// ADMIN MAINTENANCE
// ==========================================

app.post(
  '/api/admin/maintenance',
  authMiddleware,
  (req, res) => {
    const {
      enabled,
      title,
      message,
      estimatedTime
    } = req.body;

    appConfig.maintenance = {
      enabled: !!enabled,

      title:
        title ||
        'Website đang bảo trì',

      message:
        message || '',

      estimatedTime:
        estimatedTime || ''
    };

    saveConfig(
      appConfig
    );

    res.json({
      success: true,

      maintenance:
        appConfig.maintenance
    });
  }
);


// ==========================================
// ADMIN BANNER
// ==========================================

app.post(
  '/api/admin/banner',
  authMiddleware,
  (req, res) => {
    const {
      enabled,
      message,
      type
    } = req.body;

    appConfig.banner = {
      enabled: !!enabled,

      message:
        message || '',

      type:
        type || 'info'
    };

    saveConfig(
      appConfig
    );

    res.json({
      success: true,

      banner:
        appConfig.banner
    });
  }
);


// ==========================================
// ADMIN PLATFORMS
// ==========================================

app.post(
  '/api/admin/platforms',
  authMiddleware,
  (req, res) => {
    const {
      platforms
    } = req.body;

    if (
      platforms &&
      typeof platforms ===
      'object'
    ) {
      appConfig.platforms =
        platforms;

      saveConfig(
        appConfig
      );
    }

    res.json({
      success: true,

      platforms:
        appConfig.platforms
    });
  }
);


// ==========================================
// ADMIN IP BLOCK
// ==========================================

app.post(
  '/api/admin/ip/block',
  authMiddleware,
  (req, res) => {
    const {
      ip,
      reason
    } = req.body;

    if (!ip) {
      return res
        .status(400)
        .json({
          error:
            'Vui lòng cung cấp địa chỉ IP.'
        });
    }

    const exists =
      appConfig.blockedIPs.some(
        (item) =>
          (
            typeof item ===
              'string'
              ? item
              : item.ip
          ) === ip
      );

    if (!exists) {
      appConfig.blockedIPs.push({
        ip,

        reason:
          reason ||
          'Bị chặn bởi Admin',

        addedAt:
          new Date().toISOString()
      });

      saveConfig(
        appConfig
      );
    }

    res.json({
      success: true,

      blockedIPs:
        appConfig.blockedIPs
    });
  }
);


// ==========================================
// ADMIN IP UNBLOCK
// ==========================================

app.delete(
  '/api/admin/ip/:ip',
  authMiddleware,
  (req, res) => {
    const ip =
      decodeURIComponent(
        req.params.ip
      );

    appConfig.blockedIPs =
      appConfig.blockedIPs.filter(
        (item) =>
          (
            typeof item ===
              'string'
              ? item
              : item.ip
          ) !== ip
      );

    saveConfig(
      appConfig
    );

    res.json({
      success: true,

      blockedIPs:
        appConfig.blockedIPs
    });
  }
);


// ==========================================
// ADMIN DEVICE BLOCK
// ==========================================

app.post(
  '/api/admin/device/block',
  authMiddleware,
  (req, res) => {
    const {
      pattern,
      reason
    } = req.body;

    if (!pattern) {
      return res
        .status(400)
        .json({
          error:
            'Vui lòng cung cấp pattern thiết bị.'
        });
    }

    appConfig.blockedDevices.push({
      pattern,

      reason:
        reason ||
        'Bị chặn bởi Admin',

      addedAt:
        new Date().toISOString()
    });

    saveConfig(
      appConfig
    );

    res.json({
      success: true,

      blockedDevices:
        appConfig.blockedDevices
    });
  }
);


// ==========================================
// ADMIN DEVICE UNBLOCK
// ==========================================

app.delete(
  '/api/admin/device/:index',
  authMiddleware,
  (req, res) => {
    const index =
      parseInt(
        req.params.index,
        10
      );

    if (
      !isNaN(index) &&
      index >= 0 &&
      index <
      appConfig
        .blockedDevices
        .length
    ) {
      appConfig.blockedDevices.splice(
        index,
        1
      );

      saveConfig(
        appConfig
      );
    }

    res.json({
      success: true,

      blockedDevices:
        appConfig.blockedDevices
    });
  }
);


// ==========================================
// ADMIN LOGS
// ==========================================

app.get(
  '/api/admin/logs',
  authMiddleware,
  (req, res) => {
    res.json({
      logs:
        accessLogs
    });
  }
);


// ==========================================
// ADMIN PASSWORD
// ==========================================

app.post(
  '/api/admin/password',
  authMiddleware,
  (req, res) => {
    const {
      currentPassword,
      newPassword
    } = req.body;

    if (
      !currentPassword ||
      !newPassword
    ) {
      return res
        .status(400)
        .json({
          error:
            'Vui lòng cung cấp đầy đủ thông tin.'
        });
    }

    if (
      currentPassword !==
      appConfig.adminPassword
    ) {
      return res
        .status(400)
        .json({
          error:
            'Mật khẩu hiện tại không đúng.'
        });
    }

    if (
      newPassword.length <
      6
    ) {
      return res
        .status(400)
        .json({
          error:
            'Mật khẩu mới phải có ít nhất 6 ký tự.'
        });
    }

    appConfig.adminPassword =
      newPassword;

    saveConfig(
      appConfig
    );

    activeTokens.clear();

    res.json({
      success: true,

      message:
        'Đã đổi mật khẩu thành công.'
    });
  }
);


// ==========================================
// MEDIA INFO
// ==========================================

app.get(
  '/api/info',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    if (!videoUrl) {
      return res
        .status(400)
        .json({
          error:
            'Vui lòng cung cấp đường dẫn video hoặc hình ảnh.'
        });
    }

    const platform =
      apiEngine.detectPlatform(
        videoUrl
      );

    const pConfig =
      appConfig
        .platforms?.[
      platform
      ];

    if (
      pConfig &&
      pConfig.enabled === false
    ) {
      const pName =
        pConfig.name ||
        platform.toUpperCase();

      return res
        .status(503)
        .json({
          error:
            `Tính năng tải từ ${pName} hiện đang bảo trì. Vui lòng quay lại sau.`
        });
    }

    try {
      const {
        platform,
        data
      } =
        await apiEngine.extractMedia(
          videoUrl
        );

      if (data) {
        const responsePayload =
          Object.assign(
            {
              platform
            },
            data
          );

        return res.json(
          responsePayload
        );
      }

      return res
        .status(400)
        .json({
          error:
            'Không thể lấy dữ liệu từ liên kết này. Vui lòng kiểm tra lại link hoặc thử lại sau.'
        });

    } catch (error) {
      console.error(
        '[ERROR] Exception fetching info:',
        error
      );

      return res
        .status(500)
        .json({
          error:
            'Lỗi máy chủ trong quá trình xử lý đường dẫn.'
        });
    }
  }
);


// ==========================================
// LOCAL FILE RESOLVER
//
// Hỗ trợ:
//
// /downloads/file.mp4
// /download/file.mp4
// /facebook/file.mp4
// /download/facebook/file.mp4
//
// Đây là phần quan trọng sửa lỗi Facebook.
// ==========================================

function resolveLocalFile(
  mediaUrl
) {
  if (
    typeof mediaUrl !==
    'string'
  ) {
    return null;
  }

  let pathname =
    mediaUrl;

  try {
    if (
      mediaUrl.startsWith(
        'http://'
      ) ||
      mediaUrl.startsWith(
        'https://'
      )
    ) {
      const parsed =
        new URL(
          mediaUrl
        );

      pathname =
        parsed.pathname;
    } else {
      pathname =
        mediaUrl.split(
          '?'
        )[0];
    }
  } catch {
    return null;
  }

  try {
    pathname =
      decodeURIComponent(
        pathname
      );
  } catch {
    throw new Error(
      'URL local không hợp lệ'
    );
  }

  pathname =
    pathname.replace(
      /^\/+/,
      ''
    );


  // ========================================
  // /downloads/...
  // ========================================

  if (
    pathname.startsWith(
      'downloads/'
    )
  ) {
    const relativePath =
      pathname.substring(
        'downloads/'.length
      );

    const filePath =
      path.resolve(
        DOWNLOAD_DIR,
        relativePath
      );

    const root =
      path.resolve(
        DOWNLOAD_DIR
      );

    if (
      filePath === root ||
      !filePath.startsWith(
        root + path.sep
      )
    ) {
      throw new Error(
        'Đường dẫn downloads không hợp lệ'
      );
    }

    return {
      type:
        'download',

      relativePath,

      filePath
    };
  }


  // ========================================
  // /download/...
  //
  // Tương thích URL cũ.
  // ========================================

  if (
    pathname.startsWith(
      'download/'
    )
  ) {
    const relative =
      pathname.substring(
        'download/'.length
      );


    // --------------------------------------
    // /download/facebook/...
    // --------------------------------------

    if (
      relative.startsWith(
        'facebook/'
      )
    ) {
      const relativePath =
        relative.substring(
          'facebook/'.length
        );

      const filePath =
        path.resolve(
          FACEBOOK_DOWNLOAD_DIR,
          relativePath
        );

      const root =
        path.resolve(
          FACEBOOK_DOWNLOAD_DIR
        );

      if (
        filePath === root ||
        !filePath.startsWith(
          root + path.sep
        )
      ) {
        throw new Error(
          'Đường dẫn Facebook không hợp lệ'
        );
      }

      return {
        type:
          'facebook',

        relativePath,

        filePath
      };
    }


    // --------------------------------------
    // /download/...
    // --------------------------------------

    const filePath =
      path.resolve(
        DOWNLOAD_DIR,
        relative
      );

    const root =
      path.resolve(
        DOWNLOAD_DIR
      );

    if (
      filePath === root ||
      !filePath.startsWith(
        root + path.sep
      )
    ) {
      throw new Error(
        'Đường dẫn download không hợp lệ'
      );
    }

    return {
      type:
        'download',

      relativePath:
        relative,

      filePath
    };
  }


  // ========================================
  // /facebook/...
  // ========================================

  if (
    pathname.startsWith(
      'facebook/'
    )
  ) {
    const relativePath =
      pathname.substring(
        'facebook/'.length
      );

    const filePath =
      path.resolve(
        FACEBOOK_DOWNLOAD_DIR,
        relativePath
      );

    const root =
      path.resolve(
        FACEBOOK_DOWNLOAD_DIR
      );

    if (
      filePath === root ||
      !filePath.startsWith(
        root + path.sep
      )
    ) {
      throw new Error(
        'Đường dẫn Facebook không hợp lệ'
      );
    }

    return {
      type:
        'facebook',

      relativePath,

      filePath
    };
  }


  return null;
}


// ==========================================
// CDN / LOCAL STREAM
// ==========================================

async function fetchFromCDN(
  mediaUrl,
  rangeHeader
) {
  // ========================================
  // LOCAL FILE
  // ========================================

  const local =
    resolveLocalFile(
      mediaUrl
    );

  if (local) {
    if (
      !fs.existsSync(
        local.filePath
      )
    ) {
      throw new Error(
        `Không tìm thấy file local: ${local.type}/${local.relativePath}`
      );
    }

    const stat =
      fs.statSync(
        local.filePath
      );

    if (
      !stat.isFile()
    ) {
      throw new Error(
        'Đường dẫn không phải file'
      );
    }

    const fileSize =
      stat.size;

    let start = 0;

    let end =
      fileSize - 1;

    let status = 200;


    // --------------------------------------
    // RANGE
    // --------------------------------------

    if (
      rangeHeader
    ) {
      const match =
        rangeHeader.match(
          /bytes=(\d*)-(\d*)/
        );

      if (match) {
        if (
          match[1]
        ) {
          start =
            parseInt(
              match[1],
              10
            );
        }

        if (
          match[2]
        ) {
          end =
            parseInt(
              match[2],
              10
            );
        } else {
          end =
            fileSize - 1;
        }

        if (
          start >= fileSize
        ) {
          const error =
            new Error(
              'Range Not Satisfiable'
            );

          error.status =
            416;

          error.headers = {
            'Content-Range':
              `bytes */${fileSize}`
          };

          throw error;
        }

        end =
          Math.min(
            end,
            fileSize - 1
          );

        if (
          end < start
        ) {
          const error =
            new Error(
              'Range Not Satisfiable'
            );

          error.status =
            416;

          error.headers = {
            'Content-Range':
              `bytes */${fileSize}`
          };

          throw error;
        }

        status =
          206;
      }
    }


    const contentLength =
      end - start + 1;


    const stream =
      fs.createReadStream(
        local.filePath,
        {
          start,
          end
        }
      );


    const contentType =
      getMimeType(
        local.filePath
      );


    console.log(
      `[LOCAL STREAM] ${local.type}: ${local.filePath}`
    );


    return {
      status,

      headers: {
        'content-type':
          contentType,

        'content-length':
          contentLength,

        ...(status === 206
          ? {
            'content-range':
              `bytes ${start}-${end}/${fileSize}`
          }
          : {}),

        'accept-ranges':
          'bytes'
      },

      data:
        stream
    };
  }


  // ========================================
  // REMOTE CDN
  // ========================================

  let referer =
    'https://www.google.com/';

  let origin =
    null;

  let extraHeaders =
    {};


  try {
    const parsedHost =
      new URL(
        mediaUrl
      ).hostname;


    // --------------------------------------
    // PINTEREST
    // --------------------------------------

    if (
      parsedHost.includes(
        'pinimg.com'
      ) ||
      parsedHost.includes(
        'pinterest.com'
      )
    ) {
      referer =
        'https://www.pinterest.com/';

      origin =
        'https://www.pinterest.com';

      extraHeaders[
        'Sec-Fetch-Dest'
      ] =
        'image';

      extraHeaders[
        'Sec-Fetch-Mode'
      ] =
        'no-cors';

      extraHeaders[
        'Sec-Fetch-Site'
      ] =
        'cross-site';
    }


    // --------------------------------------
    // TIKTOK
    // --------------------------------------

    else if (
      parsedHost.includes(
        'tiktok'
      ) ||
      parsedHost.includes(
        'tiktokcdn'
      )
    ) {
      referer =
        'https://www.tiktok.com/';

      origin =
        'https://www.tiktok.com';
    }


    // --------------------------------------
    // TWITTER / X
    // --------------------------------------

    else if (
      parsedHost.includes(
        'twimg.com'
      ) ||
      parsedHost.includes(
        'pbs.twimg.com'
      ) ||
      parsedHost.includes(
        'video.twimg.com'
      ) ||
      parsedHost.includes(
        'twitter.com'
      ) ||
      parsedHost.includes(
        'x.com'
      )
    ) {
      referer =
        'https://twitter.com/';

      origin =
        'https://twitter.com';

      extraHeaders[
        'Sec-Fetch-Dest'
      ] =
        'video';

      extraHeaders[
        'Sec-Fetch-Mode'
      ] =
        'cors';

      extraHeaders[
        'Sec-Fetch-Site'
      ] =
        'same-site';
    }


    // --------------------------------------
    // YOUTUBE
    // --------------------------------------

    else if (
      parsedHost.includes(
        'ytimg.com'
      ) ||
      parsedHost.includes(
        'youtube.com'
      ) ||
      parsedHost.includes(
        'googlevideo.com'
      )
    ) {
      referer =
        'https://www.youtube.com/';

      origin =
        'https://www.youtube.com';
    }


    // --------------------------------------
    // INSTAGRAM
    // --------------------------------------

    else if (
      parsedHost.includes(
        'cdninstagram.com'
      ) ||
      parsedHost.includes(
        'instagram.com'
      )
    ) {
      referer =
        'https://www.instagram.com/';

      origin =
        'https://www.instagram.com';
    }


    // --------------------------------------
    // FACEBOOK
    // --------------------------------------

    else if (
      parsedHost.includes(
        'fbcdn.net'
      ) ||
      parsedHost.includes(
        'facebook.com'
      )
    ) {
      referer =
        'https://www.facebook.com/';

      origin =
        'https://www.facebook.com';
    }

  } catch (e) {
    // Không làm gì nếu URL không parse được
  }


  const reqHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

    Referer:
      referer,

    Accept:
      '*/*',

    'Accept-Language':
      'en-US,en;q=0.9',

    ...extraHeaders
  };


  if (origin) {
    reqHeaders.Origin =
      origin;
  }


  if (rangeHeader) {
    reqHeaders.Range =
      rangeHeader;
  }


  return axios({
    method:
      'get',

    url:
      mediaUrl,

    responseType:
      'stream',

    headers:
      reqHeaders,

    maxRedirects:
      5,

    validateStatus:
      (s) =>
        s >= 200 &&
        s < 400
  });
}


// ==========================================
// IMAGE PROXY
// ==========================================

app.get(
  '/api/proxy-img',
  async (req, res) => {
    const imgUrl =
      req.query.url;

    if (!imgUrl) {
      return res
        .status(400)
        .end();
    }

    try {
      const upstream =
        await fetchFromCDN(
          imgUrl
        );

      const ct =
        upstream.headers?.[
        'content-type'
        ] ||
        upstream.headers?.[
        'Content-Type'
        ] ||
        'image/jpeg';

      res.setHeader(
        'Content-Type',
        ct
      );

      res.setHeader(
        'Cache-Control',
        'public, max-age=86400'
      );

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );


      if (
        upstream.headers?.[
        'content-length'
        ]
      ) {
        res.setHeader(
          'Content-Length',
          upstream.headers[
          'content-length'
          ]
        );
      }


      upstream.data.pipe(
        res
      );

    } catch (e) {
      const transparent1x1 =
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'image/png'
      );

      res
        .status(200)
        .send(
          transparent1x1
        );
    }
  }
);


// ==========================================
// VIDEO STREAM
// ==========================================

app.get(
  '/api/stream',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    if (!mediaUrl) {
      return res
        .status(400)
        .json({
          error:
            'Missing url parameter.'
        });
    }


    try {
      const rangeHeader =
        req.headers.range;

      const upstream =
        await fetchFromCDN(
          mediaUrl,
          rangeHeader
        );


      const headers =
        upstream.headers ||
        {};


      const contentType =
        headers[
        'content-type'
        ] ||
        headers[
        'Content-Type'
        ] ||
        'video/mp4';


      const contentLength =
        headers[
        'content-length'
        ] ||
        headers[
        'Content-Length'
        ];


      const contentRange =
        headers[
        'content-range'
        ] ||
        headers[
        'Content-Range'
        ];


      const acceptRanges =
        headers[
        'accept-ranges'
        ] ||
        headers[
        'Accept-Ranges'
        ] ||
        'bytes';


      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      res.setHeader(
        'Accept-Ranges',
        acceptRanges
      );

      res.setHeader(
        'Content-Type',
        contentType
      );


      if (contentLength) {
        res.setHeader(
          'Content-Length',
          contentLength
        );
      }


      if (contentRange) {
        res.setHeader(
          'Content-Range',
          contentRange
        );
      }


      res.status(
        upstream.status ||
        200
      );


      upstream.data.on(
        'error',
        (err) => {
          console.error(
            '[STREAM PIPE ERROR]',
            err.message
          );

          if (
            !res.headersSent
          ) {
            res
              .status(500)
              .json({
                error:
                  'Lỗi đọc video.'
              });
          } else {
            res.destroy(
              err
            );
          }
        }
      );


      upstream.data.pipe(
        res
      );

    } catch (error) {
      console.error(
        '[STREAM ERROR]',
        error.message
      );


      if (
        error.status ===
        416
      ) {
        if (
          error.headers
        ) {
          Object.entries(
            error.headers
          ).forEach(
            ([key, value]) => {
              res.setHeader(
                key,
                value
              );
            }
          );
        }

        return res
          .status(416)
          .end();
      }


      return res
        .status(500)
        .json({
          error:
            'Không thể stream video.',

          detail:
            error.message
        });
    }
  }
);


// ==========================================
// FORCE DOWNLOAD
// ==========================================

app.get(
  '/api/download',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    const filename =
      req.query.filename ||
      'media_file.mp4';

    const type =
      req.query.type ||
      'video';


    if (!mediaUrl) {
      return res
        .status(400)
        .json({
          error:
            'Vui lòng cung cấp link media.'
        });
    }


    try {
      console.log(
        `[DOWNLOAD] Proxying download for: ${mediaUrl.substring(0, 60)}...`
      );


      const mimeType =
        type === 'audio'
          ? 'audio/mpeg'
          : (
            type === 'image'
              ? 'image/jpeg'
              : 'video/mp4'
          );


      const upstream =
        await fetchFromCDN(
          mediaUrl
        );


      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );


      res.setHeader(
        'Content-Type',
        mimeType
      );


      if (
        upstream.headers[
        'content-length'
        ]
      ) {
        res.setHeader(
          'Content-Length',
          upstream.headers[
          'content-length'
          ]
        );
      }


      upstream.data.pipe(
        res
      );

    } catch (error) {
      console.error(
        '[DOWNLOAD ERROR]',
        error.message
      );

      return res
        .status(500)
        .json({
          error:
            'Tải file thất bại. Có thể link tải đã hết hạn, vui lòng thử lấy lại link.'
        });
    }
  }
);


// ==========================================
// AUDIO
// ==========================================

app.get(
  '/api/audio',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    if (!mediaUrl) {
      return res
        .status(400)
        .json({
          error:
            'Missing url parameter.'
        });
    }


    try {
      const upstream =
        await fetchFromCDN(
          mediaUrl
        );


      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''audio.mp3`
      );

      res.setHeader(
        'Content-Type',
        'audio/mpeg'
      );


      upstream.data.pipe(
        res
      );

    } catch (error) {
      console.error(
        '[AUDIO ERROR]',
        error.message
      );

      res
        .status(500)
        .json({
          error:
            'Không thể tải audio.'
        });
    }
  }
);


// ==========================================
// YOUTUBE AUDIO
// ==========================================

app.get(
  '/api/youtube-audio',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    const title =
      req.query.title ||
      'youtube_audio';


    if (!videoUrl) {
      return res
        .status(400)
        .json({
          error:
            'Missing url parameter.'
        });
    }


    try {
      console.log(
        `[YOUTUBE AUDIO] Extracting MP3 from: ${videoUrl}`
      );


      const {
        handleYouTubeAudio
      } =
        require(
          './api/youtube'
        );


      const result =
        await handleYouTubeAudio(
          videoUrl
        );


      const filePath =
        path.join(
          DOWNLOAD_DIR,
          result.fileName
        );


      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              'File audio không tìm thấy.'
          });
      }


      const safeTitle =
        title
          .replace(
            /[^a-zA-Z0-9\u00C0-\u024F\s\-_]/g,
            ''
          )
          .trim()
          .substring(
            0,
            80
          ) ||
        'youtube_audio';


      const filename =
        `${safeTitle}.mp3`;


      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );


      res.setHeader(
        'Content-Type',
        'audio/mpeg'
      );


      res.setHeader(
        'Content-Length',
        result.size
      );


      const stream =
        fs.createReadStream(
          filePath
        );


      stream.pipe(
        res
      );


      stream.on(
        'end',
        () => {
          setTimeout(
            () => {
              try {
                fs.unlinkSync(
                  filePath
                );
              } catch (e) { }
            },
            5000
          );
        }
      );

    } catch (error) {
      console.error(
        '[YOUTUBE AUDIO ERROR]',
        error.message
      );

      res
        .status(500)
        .json({
          error:
            `Không thể trích xuất audio: ${error.message.substring(0, 200)}`
        });
    }
  }
);


// ==========================================
// DOWNLOAD IMAGE ZIP
// ==========================================

app.get(
  '/api/download-zip',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    if (!videoUrl) {
      return res
        .status(400)
        .json({
          error:
            'Missing url parameter.'
        });
    }


    try {
      let images = [];


      const {
        data
      } =
        await apiEngine.extractMedia(
          videoUrl
        );


      if (
        data?.images
      ) {
        images =
          data.images;
      }


      if (
        !images ||
        images.length === 0
      ) {
        return res
          .status(400)
          .json({
            error:
              'Không tìm thấy hình ảnh nào để tải.'
          });
      }


      const JSZip =
        require(
          'jszip'
        );


      const zip =
        new JSZip();


      const promises =
        images.map(
          async (
            imgUrl,
            index
          ) => {
            try {
              const response =
                await fetchFromCDN(
                  imgUrl
                );


              const chunks = [];


              for await (
                const chunk of
                response.data
              ) {
                chunks.push(
                  chunk
                );
              }


              const buffer =
                Buffer.concat(
                  chunks
                );


              zip.file(
                `image_${index + 1}.jpg`,
                buffer
              );

            } catch (err) {
              console.error(
                `Failed to fetch image ${index + 1}:`,
                err.message
              );
            }
          }
        );


      await Promise.all(
        promises
      );


      const zipBuffer =
        await zip.generateAsync({
          type:
            'nodebuffer'
        });


      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''images.zip`
      );


      res.setHeader(
        'Content-Type',
        'application/zip'
      );


      res.setHeader(
        'Content-Length',
        zipBuffer.length
      );


      res.send(
        zipBuffer
      );

    } catch (error) {
      console.error(
        '[ZIP ERROR]',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Lỗi nén file hình ảnh.'
        });
    }
  }
);


// ==========================================
// EXTRACT FRAMES
// ==========================================

app.get(
  '/api/frames',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    const fps =
      parseInt(
        req.query.fps,
        10
      ) || 1;


    if (!mediaUrl) {
      return res
        .status(400)
        .json({
          error:
            'Missing url parameter.'
        });
    }


    const uid =
      uuidv4();


    const outDir =
      path.join(
        __dirname,
        'public',
        'temp',
        uid
      );


    fs.mkdirSync(
      outDir,
      {
        recursive: true
      }
    );


    const tempVideoPath =
      path.join(
        outDir,
        'input.mp4'
      );


    try {
      const videoStream =
        await fetchFromCDN(
          mediaUrl
        );


      await new Promise(
        (
          resolve,
          reject
        ) => {
          const writeStream =
            fs.createWriteStream(
              tempVideoPath
            );


          videoStream.data.pipe(
            writeStream
          );


          writeStream.on(
            'finish',
            resolve
          );


          writeStream.on(
            'error',
            reject
          );
        }
      );

    } catch (err) {
      console.error(
        '[FRAMES ERROR] Failed to download video:',
        err.message
      );


      return res
        .status(500)
        .json({
          error:
            'Không thể tải video để trích xuất khung hình.'
        });
    }


    const outputPattern =
      path.join(
        outDir,
        'frame-%03d.jpg'
      );


    ffmpeg(
      tempVideoPath
    )
      .outputOptions([
        `-vf fps=${fps}`,
        '-t 15',
        '-q:v 2'
      ])

      .output(
        outputPattern
      )

      .on(
        'end',
        () => {
          try {
            fs.unlinkSync(
              tempVideoPath
            );
          } catch (e) { }


          const files =
            fs.readdirSync(
              outDir
            )
              .filter(
                (f) =>
                  f.endsWith(
                    '.jpg'
                  )
              )
              .sort()
              .map(
                (f) =>
                  `/temp/${uid}/${f}`
              );


          res.json({
            frames:
              files
          });
        }
      )

      .on(
        'error',
        (err) => {
          console.error(
            '[FRAMES ERROR]',
            err.message
          );


          if (
            !res.headersSent
          ) {
            res
              .status(500)
              .json({
                error:
                  'Failed to extract frames.'
              });
          }
        }
      )

      .run();
  }
);


// ==========================================
// CLEANUP TEMP
// ==========================================

setInterval(
  () => {
    const tempRoot =
      path.join(
        __dirname,
        'public',
        'temp'
      );


    if (
      !fs.existsSync(
        tempRoot
      )
    ) {
      return;
    }


    const now =
      Date.now();


    fs.readdirSync(
      tempRoot
    ).forEach(
      (folder) => {
        const folderPath =
          path.join(
            tempRoot,
            folder
          );


        try {
          const stats =
            fs.statSync(
              folderPath
            );


          if (
            now -
            stats.mtimeMs >
            10 * 60 * 1000
          ) {
            fs.rmSync(
              folderPath,
              {
                recursive: true,
                force: true
              }
            );


            console.log(
              `[CLEANUP] Removed temp folder ${folder}`
            );
          }

        } catch (error) {
          console.log(
            `[CLEANUP] Could not remove ${folder}: ${error.message}`
          );
        }
      }
    );
  },
  5 * 60 * 1000
);


// ==========================================
// START SERVER
// ==========================================

const HOST =
  '0.0.0.0';


app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      'Server is running'
    );

    console.log(
      `Local: http://localhost:${PORT}`
    );

    console.log(
      `LAN:   http://192.168.100.103:${PORT}`
    );
  }
);