const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// VERCEL / SERVERLESS TEMP DIRECTORY
// ======================================================

const TEMP_ROOT = os.tmpdir();

const DOWNLOAD_DIR = path.join(
  TEMP_ROOT,
  'downloads'
);

const FACEBOOK_DOWNLOAD_DIR = path.join(
  TEMP_ROOT,
  'facebook'
);

const FACEBOOK_IMAGE_DIR = path.join(
  FACEBOOK_DOWNLOAD_DIR,
  'images'
);

const FRAMES_DIR = path.join(
  TEMP_ROOT,
  'frames'
);

[
  DOWNLOAD_DIR,
  FACEBOOK_DOWNLOAD_DIR,
  FACEBOOK_IMAGE_DIR,
  FRAMES_DIR
].forEach((dir) => {
  try {
    fs.mkdirSync(dir, {
      recursive: true
    });
  } catch (err) {
    console.error(
      `[INIT ERROR] Cannot create ${dir}:`,
      err.message
    );
  }
});

// ======================================================
// MODULAR API
// ======================================================

const apiEngine = require('./api');

// ======================================================
// EXPRESS
// ======================================================

app.use(express.json({
  limit: '2mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '2mb'
}));

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG_PATH = path.join(
  __dirname,
  'admin-config.json'
);

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
      const data = fs.readFileSync(
        CONFIG_PATH,
        'utf8'
      );

      const parsed = JSON.parse(data);

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
          Array.isArray(parsed.blockedIPs)
            ? parsed.blockedIPs
            : [],

        blockedDevices:
          Array.isArray(parsed.blockedDevices)
            ? parsed.blockedDevices
            : [],

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
      title: 'Website đang bảo trì',
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
    platforms: DEFAULT_PLATFORMS
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

let appConfig = loadConfig();

// ======================================================
// AUTH
// ======================================================

const activeTokens = new Set();

function authMiddleware(req, res, next) {
  const token =
    req.headers['x-admin-token'];

  if (
    !token ||
    !activeTokens.has(token)
  ) {
    return res.status(401).json({
      error:
        'Phiên làm việc không hợp lệ hoặc đã hết hạn.'
    });
  }

  next();
}

// ======================================================
// ACCESS LOG
// ======================================================

const accessLogs = [];
const MAX_LOGS = 500;

function getClientIP(req) {
  const forwarded =
    req.headers['x-forwarded-for'];

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

// ======================================================
// SECURITY / LOGGING / MAINTENANCE
// ======================================================

app.use((req, res, next) => {
  const rawIP =
    getClientIP(req);

  const cleanIP =
    rawIP.replace(
      /^::ffff:/,
      ''
    );

  const ua =
    req.headers['user-agent'] || '';

  // ACCESS LOG
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

  // IP BLOCK
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
      `[SECURITY] Blocked IP attempt: ${cleanIP}`
    );

    return res.status(403).json({
      error:
        'Địa chỉ IP của bạn đã bị chặn truy cập.'
    });
  }

  // DEVICE BLOCK
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
      `[SECURITY] Blocked Device attempt: UA "${ua}"`
    );

    return res.status(403).json({
      error:
        'Thiết bị/Trình duyệt của bạn đã bị chặn truy cập.'
    });
  }

  // MAINTENANCE
  const isAdminRoute =
    req.url.startsWith('/admin') ||
    req.url.startsWith('/api/admin');

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
      req.url.startsWith('/api/')
    ) {
      return res.status(503).json({
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
      return res.status(503).send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${appConfig.maintenance.title || 'Website đang bảo trì'}</title>
<style>
body {
  font-family: Arial, sans-serif;
  background:#07071a;
  color:#f3f4f6;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:100vh;
  margin:0;
  padding:20px;
  text-align:center;
}
.card {
  background:rgba(18,18,29,.85);
  border:1px solid rgba(255,255,255,.1);
  border-radius:20px;
  padding:40px;
  max-width:480px;
}
.icon {
  font-size:3rem;
  margin-bottom:16px;
}
h1 {
  color:#a855f7;
}
p {
  color:#9ca3af;
  line-height:1.6;
}
.time {
  display:inline-block;
  background:rgba(168,85,247,.15);
  color:#a855f7;
  padding:6px 14px;
  border-radius:20px;
}
</style>
</head>
<body>
<div class="card">
<div class="icon">🛠️</div>
<h1>${appConfig.maintenance.title || 'Website đang bảo trì'}</h1>
<p>${appConfig.maintenance.message || 'Chúng tôi đang bảo trì hệ thống. Vui lòng quay lại sau.'}</p>
${appConfig.maintenance.estimatedTime
          ? `<div class="time">⏱ Dự kiến: ${appConfig.maintenance.estimatedTime}</div>`
          : ''
        }
</div>
</body>
</html>
`);
    }
  }

  next();
});

// ======================================================
// STATIC PUBLIC
// ======================================================

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

// ======================================================
// MIME
// ======================================================

function getMimeType(filePath) {
  const ext =
    path.extname(
      filePath
    ).toLowerCase();

  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',

    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',

    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };

  return (
    mimeTypes[ext] ||
    'application/octet-stream'
  );
}

// ======================================================
// NORMAL DOWNLOAD
// /downloads/file.mp4
// ======================================================

app.use(
  '/downloads',
  express.static(
    DOWNLOAD_DIR,
    {
      acceptRanges: true,

      fallthrough: false,

      setHeaders: (res, filePath) => {
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
          getMimeType(filePath)
        );
      }
    }
  )
);

// ======================================================
// FACEBOOK
// ======================================================

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
          getMimeType(filePath)
        );
      }
    }
  )
);

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
          getMimeType(filePath)
        );
      }
    }
  )
);

// ======================================================
// FRAMES
// /temp/uuid/frame-001.jpg
// ======================================================

app.get(
  '/temp/:uid/:file',
  (req, res) => {
    const uid =
      req.params.uid;

    const file =
      req.params.file;

    const root =
      path.resolve(
        FRAMES_DIR,
        uid
      );

    const filePath =
      path.resolve(
        root,
        file
      );

    if (
      filePath !== root &&
      !filePath.startsWith(
        root + path.sep
      )
    ) {
      return res.status(400).end();
    }

    if (
      !fs.existsSync(filePath)
    ) {
      return res.status(404).end();
    }

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
      'image/jpeg'
    );

    res.sendFile(
      filePath
    );
  }
);

// ======================================================
// PUBLIC CONFIG
// ======================================================

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

// ======================================================
// ADMIN LOGIN
// ======================================================

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

      activeTokens.add(token);

      return res.json({
        token,
        success: true
      });
    }

    return res.status(401).json({
      error:
        'Mật khẩu không chính xác.'
    });
  }
);

// ======================================================
// ADMIN CONFIG
// ======================================================

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

// ======================================================
// ADMIN MAINTENANCE
// ======================================================

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

    saveConfig(appConfig);

    res.json({
      success: true,
      maintenance:
        appConfig.maintenance
    });
  }
);

// ======================================================
// ADMIN BANNER
// ======================================================

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

    saveConfig(appConfig);

    res.json({
      success: true,
      banner:
        appConfig.banner
    });
  }
);

// ======================================================
// ADMIN PLATFORMS
// ======================================================

app.post(
  '/api/admin/platforms',
  authMiddleware,
  (req, res) => {
    const {
      platforms
    } = req.body;

    if (
      platforms &&
      typeof platforms === 'object'
    ) {
      appConfig.platforms =
        platforms;

      saveConfig(appConfig);
    }

    res.json({
      success: true,
      platforms:
        appConfig.platforms
    });
  }
);

// ======================================================
// ADMIN IP BLOCK
// ======================================================

app.post(
  '/api/admin/ip/block',
  authMiddleware,
  (req, res) => {
    const {
      ip,
      reason
    } = req.body;

    if (!ip) {
      return res.status(400).json({
        error:
          'Vui lòng cung cấp địa chỉ IP.'
      });
    }

    const exists =
      appConfig.blockedIPs.some(
        (item) =>
          (
            typeof item === 'string'
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

      saveConfig(appConfig);
    }

    res.json({
      success: true,
      blockedIPs:
        appConfig.blockedIPs
    });
  }
);

// ======================================================
// ADMIN IP UNBLOCK
// ======================================================

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
            typeof item === 'string'
              ? item
              : item.ip
          ) !== ip
      );

    saveConfig(appConfig);

    res.json({
      success: true,
      blockedIPs:
        appConfig.blockedIPs
    });
  }
);

// ======================================================
// ADMIN DEVICE BLOCK
// ======================================================

app.post(
  '/api/admin/device/block',
  authMiddleware,
  (req, res) => {
    const {
      pattern,
      reason
    } = req.body;

    if (!pattern) {
      return res.status(400).json({
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

    saveConfig(appConfig);

    res.json({
      success: true,
      blockedDevices:
        appConfig.blockedDevices
    });
  }
);

// ======================================================
// ADMIN DEVICE UNBLOCK
// ======================================================

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
      appConfig.blockedDevices.length
    ) {
      appConfig.blockedDevices.splice(
        index,
        1
      );

      saveConfig(appConfig);
    }

    res.json({
      success: true,

      blockedDevices:
        appConfig.blockedDevices
    });
  }
);

// ======================================================
// ADMIN LOGS
// ======================================================

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

// ======================================================
// ADMIN PASSWORD
// ======================================================

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
      return res.status(400).json({
        error:
          'Vui lòng cung cấp đầy đủ thông tin.'
      });
    }

    if (
      currentPassword !==
      appConfig.adminPassword
    ) {
      return res.status(400).json({
        error:
          'Mật khẩu hiện tại không đúng.'
      });
    }

    if (
      newPassword.length < 6
    ) {
      return res.status(400).json({
        error:
          'Mật khẩu mới phải có ít nhất 6 ký tự.'
      });
    }

    appConfig.adminPassword =
      newPassword;

    saveConfig(appConfig);

    activeTokens.clear();

    res.json({
      success: true,

      message:
        'Đã đổi mật khẩu thành công.'
    });
  }
);

// ======================================================
// MEDIA INFO
// ======================================================

app.get(
  '/api/info',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    if (!videoUrl) {
      return res.status(400).json({
        error:
          'Vui lòng cung cấp đường dẫn video hoặc hình ảnh.'
      });
    }

    const platform =
      apiEngine.detectPlatform(
        videoUrl
      );

    const pConfig =
      appConfig.platforms?.[
      platform
      ];

    if (
      pConfig &&
      pConfig.enabled === false
    ) {
      return res.status(503).json({
        error:
          `Tính năng tải từ ${pConfig.name ||
          platform.toUpperCase()
          } hiện đang bảo trì. Vui lòng quay lại sau.`
      });
    }

    try {
      const result =
        await apiEngine.extractMedia(
          videoUrl
        );

      if (
        result &&
        result.data
      ) {
        return res.json({
          platform:
            result.platform,

          ...result.data
        });
      }

      return res.status(400).json({
        error:
          'Không thể lấy dữ liệu từ liên kết này. Vui lòng kiểm tra lại link hoặc thử lại sau.'
      });

    } catch (error) {
      console.error(
        '[ERROR] Exception fetching info:',
        error
      );

      return res.status(500).json({
        error:
          'Lỗi máy chủ trong quá trình xử lý đường dẫn.'
      });
    }
  }
);

// ======================================================
// LOCAL FILE RESOLVER
// ======================================================

function resolveLocalFile(mediaUrl) {
  if (
    typeof mediaUrl !== 'string'
  ) {
    return null;
  }

  let pathname =
    mediaUrl;

  try {
    if (
      mediaUrl.startsWith('http://') ||
      mediaUrl.startsWith('https://')
    ) {
      const parsed =
        new URL(mediaUrl);

      pathname =
        parsed.pathname;
    } else {
      pathname =
        mediaUrl.split('?')[0];
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

  // /downloads/...
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
      type: 'download',
      relativePath,
      filePath
    };
  }

  // /download/...
  if (
    pathname.startsWith(
      'download/'
    )
  ) {
    const relative =
      pathname.substring(
        'download/'.length
      );

    // /download/facebook/...
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
        type: 'facebook',
        relativePath,
        filePath
      };
    }

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
      type: 'download',
      relativePath: relative,
      filePath
    };
  }

  // /facebook/...
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
      type: 'facebook',
      relativePath,
      filePath
    };
  }

  return null;
}

// ======================================================
// FETCH CDN / LOCAL
// ======================================================

async function fetchFromCDN(
  mediaUrl,
  rangeHeader
) {
  const local =
    resolveLocalFile(
      mediaUrl
    );

  // ====================================================
  // LOCAL FILE
  // ====================================================

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

    if (!stat.isFile()) {
      throw new Error(
        'Đường dẫn không phải file'
      );
    }

    const fileSize =
      stat.size;

    let start = 0;
    let end = fileSize - 1;
    let status = 200;

    if (rangeHeader) {
      const match =
        rangeHeader.match(
          /bytes=(\d*)-(\d*)/
        );

      if (match) {
        if (match[1]) {
          start =
            parseInt(
              match[1],
              10
            );
        }

        if (match[2]) {
          end =
            parseInt(
              match[2],
              10
            );
        }

        if (
          start >= fileSize
        ) {
          const error =
            new Error(
              'Range Not Satisfiable'
            );

          error.status = 416;

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

        if (end < start) {
          const error =
            new Error(
              'Range Not Satisfiable'
            );

          error.status = 416;

          error.headers = {
            'Content-Range':
              `bytes */${fileSize}`
          };

          throw error;
        }

        status = 206;
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

    console.log(
      `[LOCAL STREAM] ${local.type}: ${local.filePath}`
    );

    return {
      status,

      headers: {
        'content-type':
          getMimeType(
            local.filePath
          ),

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

      data: stream
    };
  }

  // ====================================================
  // REMOTE CDN
  // ====================================================

  let referer =
    'https://www.google.com/';

  let origin = null;

  const extraHeaders = {};

  try {
    const hostname =
      new URL(
        mediaUrl
      ).hostname.toLowerCase();

    if (
      hostname.includes(
        'pinimg.com'
      ) ||
      hostname.includes(
        'pinterest.com'
      )
    ) {
      referer =
        'https://www.pinterest.com/';

      origin =
        'https://www.pinterest.com';

      extraHeaders[
        'Sec-Fetch-Dest'
      ] = 'image';

      extraHeaders[
        'Sec-Fetch-Mode'
      ] = 'no-cors';

      extraHeaders[
        'Sec-Fetch-Site'
      ] = 'cross-site';
    }

    else if (
      hostname.includes('tiktok') ||
      hostname.includes('tiktokcdn')
    ) {
      referer =
        'https://www.tiktok.com/';

      origin =
        'https://www.tiktok.com';
    }

    else if (
      hostname.includes('twimg.com') ||
      hostname.includes('pbs.twimg.com') ||
      hostname.includes('video.twimg.com') ||
      hostname.includes('twitter.com') ||
      hostname.includes('x.com')
    ) {
      referer =
        'https://twitter.com/';

      origin =
        'https://twitter.com';

      extraHeaders[
        'Sec-Fetch-Dest'
      ] = 'video';

      extraHeaders[
        'Sec-Fetch-Mode'
      ] = 'cors';

      extraHeaders[
        'Sec-Fetch-Site'
      ] = 'same-site';
    }

    else if (
      hostname.includes('ytimg.com') ||
      hostname.includes('youtube.com') ||
      hostname.includes('googlevideo.com')
    ) {
      referer =
        'https://www.youtube.com/';

      origin =
        'https://www.youtube.com';
    }

    else if (
      hostname.includes('cdninstagram.com') ||
      hostname.includes('instagram.com')
    ) {
      referer =
        'https://www.instagram.com/';

      origin =
        'https://www.instagram.com';
    }

    else if (
      hostname.includes('fbcdn.net') ||
      hostname.includes('facebook.com')
    ) {
      referer =
        'https://www.facebook.com/';

      origin =
        'https://www.facebook.com';
    }
  } catch { }

  const reqHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',

    Referer: referer,

    Accept: '*/*',

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
    method: 'get',

    url: mediaUrl,

    responseType: 'stream',

    headers: reqHeaders,

    maxRedirects: 5,

    timeout: 60000,

    validateStatus: (s) =>
      s >= 200 && s < 400
  });
}

// ======================================================
// IMAGE PROXY
// ======================================================

app.get(
  '/api/proxy-img',
  async (req, res) => {
    const imgUrl =
      req.query.url;

    if (!imgUrl) {
      return res.status(400).end();
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

      upstream.data.pipe(res);

    } catch (e) {
      const transparent =
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        );

      res.setHeader(
        'Content-Type',
        'image/png'
      );

      res.status(200).send(
        transparent
      );
    }
  }
);

// ======================================================
// VIDEO STREAM
// ======================================================

app.get(
  '/api/stream',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    if (!mediaUrl) {
      return res.status(400).json({
        error:
          'Missing url parameter.'
      });
    }

    try {
      const upstream =
        await fetchFromCDN(
          mediaUrl,
          req.headers.range
        );

      const headers =
        upstream.headers || {};

      const contentType =
        headers[
        'content-type'
        ] ||
        'video/mp4';

      const contentLength =
        headers[
        'content-length'
        ];

      const contentRange =
        headers[
        'content-range'
        ];

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      res.setHeader(
        'Accept-Ranges',
        headers[
        'accept-ranges'
        ] || 'bytes'
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
        upstream.status || 200
      );

      upstream.data.on(
        'error',
        (err) => {
          console.error(
            '[STREAM PIPE ERROR]',
            err.message
          );

          if (!res.headersSent) {
            res.status(500).json({
              error:
                'Lỗi đọc video.'
            });
          } else {
            res.destroy(err);
          }
        }
      );

      upstream.data.pipe(res);

    } catch (error) {
      console.error(
        '[STREAM ERROR]',
        error.message
      );

      if (
        error.status === 416
      ) {
        if (error.headers) {
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

      return res.status(500).json({
        error:
          'Không thể stream video.',

        detail:
          error.message
      });
    }
  }
);

// ======================================================
// FORCE DOWNLOAD
// ======================================================

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
      return res.status(400).json({
        error:
          'Vui lòng cung cấp link media.'
      });
    }

    try {
      const mimeType =
        type === 'audio'
          ? 'audio/mpeg'
          : type === 'image'
            ? 'image/jpeg'
            : 'video/mp4';

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

      upstream.data.pipe(res);

    } catch (error) {
      console.error(
        '[DOWNLOAD ERROR]',
        error.message
      );

      return res.status(500).json({
        error:
          'Tải file thất bại. Có thể link tải đã hết hạn, vui lòng thử lấy lại link.'
      });
    }
  }
);

// ======================================================
// AUDIO
// ======================================================

app.get(
  '/api/audio',
  async (req, res) => {
    const mediaUrl =
      req.query.url;

    if (!mediaUrl) {
      return res.status(400).json({
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
        'attachment; filename*=UTF-8\'\'audio.mp3'
      );

      res.setHeader(
        'Content-Type',
        'audio/mpeg'
      );

      upstream.data.pipe(res);

    } catch (error) {
      console.error(
        '[AUDIO ERROR]',
        error.message
      );

      res.status(500).json({
        error:
          'Không thể tải audio.'
      });
    }
  }
);

// ======================================================
// YOUTUBE AUDIO
// ======================================================

app.get(
  '/api/youtube-audio',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    const title =
      req.query.title ||
      'youtube_audio';

    if (!videoUrl) {
      return res.status(400).json({
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
      } = require(
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
        return res.status(404).json({
          error:
            'File audio không tìm thấy.'
        });
      }

      const safeTitle =
        String(title)
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

      stream.on(
        'error',
        (err) => {
          console.error(
            '[YOUTUBE AUDIO STREAM ERROR]',
            err.message
          );

          if (!res.headersSent) {
            res.status(500).json({
              error:
                'Lỗi đọc file audio.'
            });
          } else {
            res.destroy(err);
          }
        }
      );

      stream.pipe(res);

      stream.on(
        'close',
        () => {
          setTimeout(
            () => {
              try {
                if (
                  fs.existsSync(
                    filePath
                  )
                ) {
                  fs.unlinkSync(
                    filePath
                  );
                }
              } catch { }
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

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            `Không thể trích xuất audio: ${error.message.substring(0, 200)}`
        });
      }
    }
  }
);

// ======================================================
// DOWNLOAD IMAGE ZIP
// ======================================================

app.get(
  '/api/download-zip',
  async (req, res) => {
    const videoUrl =
      req.query.url;

    if (!videoUrl) {
      return res.status(400).json({
        error:
          'Missing url parameter.'
      });
    }

    try {
      const result =
        await apiEngine.extractMedia(
          videoUrl
        );

      const images =
        result?.data?.images || [];

      if (
        images.length === 0
      ) {
        return res.status(400).json({
          error:
            'Không tìm thấy hình ảnh nào để tải.'
        });
      }

      const JSZip =
        require('jszip');

      const zip =
        new JSZip();

      await Promise.all(
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
                chunks.push(chunk);
              }

              zip.file(
                `image_${index + 1}.jpg`,
                Buffer.concat(chunks)
              );

            } catch (err) {
              console.error(
                `Failed to fetch image ${index + 1}:`,
                err.message
              );
            }
          }
        )
      );

      const zipBuffer =
        await zip.generateAsync({
          type: 'nodebuffer'
        });

      res.setHeader(
        'Content-Disposition',
        'attachment; filename*=UTF-8\'\'images.zip'
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

      res.status(500).json({
        error:
          'Lỗi nén file hình ảnh.'
      });
    }
  }
);

// ======================================================
// EXTRACT FRAMES
// ======================================================

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
      return res.status(400).json({
        error:
          'Missing url parameter.'
      });
    }

    const uid =
      uuidv4();

    const outDir =
      path.join(
        FRAMES_DIR,
        uid
      );

    try {
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

          videoStream.data.on(
            'error',
            reject
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

      const outputPattern =
        path.join(
          outDir,
          'frame-%03d.jpg'
        );

      await new Promise(
        (
          resolve,
          reject
        ) => {
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
              resolve
            )
            .on(
              'error',
              reject
            )
            .run();
        }
      );

      try {
        fs.unlinkSync(
          tempVideoPath
        );
      } catch { }

      const files =
        fs.readdirSync(
          outDir
        )
          .filter(
            (f) =>
              f.endsWith('.jpg')
          )
          .sort();

      const frameUrls =
        files.map(
          (file) =>
            `/temp/${uid}/${encodeURIComponent(file)}`
        );

      return res.json({
        frames:
          frameUrls
      });

    } catch (error) {
      console.error(
        '[FRAMES ERROR]',
        error.message
      );

      try {
        fs.rmSync(
          outDir,
          {
            recursive: true,
            force: true
          }
        );
      } catch { }

      return res.status(500).json({
        error:
          'Không thể trích xuất khung hình.',
        detail:
          error.message
      });
    }
  }
);

// ======================================================
// CLEANUP /tmp
// ======================================================

function cleanupOldFiles(
  rootDir,
  maxAgeMs
) {
  if (
    !fs.existsSync(rootDir)
  ) {
    return;
  }

  const now =
    Date.now();

  let entries = [];

  try {
    entries =
      fs.readdirSync(
        rootDir
      );
  } catch {
    return;
  }

  for (
    const entry of entries
  ) {
    const entryPath =
      path.join(
        rootDir,
        entry
      );

    try {
      const stat =
        fs.statSync(
          entryPath
        );

      if (
        now - stat.mtimeMs >
        maxAgeMs
      ) {
        fs.rmSync(
          entryPath,
          {
            recursive: true,
            force: true
          }
        );

        console.log(
          `[CLEANUP] Removed ${entryPath}`
        );
      }
    } catch (err) {
      console.error(
        '[CLEANUP ERROR]',
        err.message
      );
    }
  }
}

setInterval(
  () => {
    cleanupOldFiles(
      DOWNLOAD_DIR,
      30 * 60 * 1000
    );

    cleanupOldFiles(
      FACEBOOK_DOWNLOAD_DIR,
      30 * 60 * 1000
    );

    cleanupOldFiles(
      FRAMES_DIR,
      10 * 60 * 1000
    );
  },
  5 * 60 * 1000
);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {
    console.error(
      '[GLOBAL ERROR]',
      err
    );

    if (
      res.headersSent
    ) {
      return next(err);
    }

    res.status(500).json({
      error:
        'Lỗi máy chủ.',
      detail:
        err.message
    });
  }
);

// ======================================================
// START SERVER
// ======================================================

const HOST =
  '0.0.0.0';

if (
  process.env.VERCEL !== '1'
) {
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
        `LAN: http://192.168.100.103:${PORT}`
      );

      console.log(
        `[STORAGE] ${DOWNLOAD_DIR}`
      );

      console.log(
        `[FACEBOOK] ${FACEBOOK_DOWNLOAD_DIR}`
      );
    }
  );
}

// ======================================================
// VERCEL / COMMONJS EXPORT
// ======================================================

module.exports = app;
