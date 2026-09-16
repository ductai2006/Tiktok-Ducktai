const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ytDlp = require('youtube-dl-exec');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');

// Tạo thư mục downloads nếu chưa có
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Lấy YouTube video ID
 */
function extractVideoId(url) {
  try {
    const parsed = new URL(url);

    // youtube.com/watch?v=xxxx
    if (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'm.youtube.com'
    ) {
      return parsed.searchParams.get('v');
    }

    // youtu.be/xxxx
    if (
      parsed.hostname === 'youtu.be' ||
      parsed.hostname === 'www.youtu.be'
    ) {
      return parsed.pathname.split('/')[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Tạo URL file
 */
function getPublicBaseUrl() {
  return (
    process.env.PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 3000}`
  );
}

/**
 * Download YouTube video (MP4)
 */
async function handleYouTube(videoUrl) {
  console.log(`[YOUTUBE] Processing: ${videoUrl}`);

  if (!videoUrl || typeof videoUrl !== 'string') {
    throw new Error('YouTube URL không hợp lệ');
  }

  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    throw new Error('Không lấy được YouTube Video ID');
  }

  console.log(`[YOUTUBE] Video ID: ${videoId}`);

  const fileName =
    `youtube_${videoId}_${crypto.randomBytes(5).toString('hex')}.mp4`;

  const outputPath = path.join(DOWNLOAD_DIR, fileName);

  try {
    console.log('[YOUTUBE] Getting video information...');

    /*
     * Lấy thông tin video trước
     */
    const info = await ytDlp(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      noPlaylist: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:https://www.youtube.com/',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
      ]
    });

    const title =
      info.title ||
      info.fulltitle ||
      'YouTube Video';

    console.log(`[YOUTUBE] Title: ${title}`);

    console.log('[YOUTUBE] Downloading...');

    await ytDlp(videoUrl, {
      output: outputPath,

      format: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[ext=mp4]/best',

      mergeOutputFormat: 'mp4',

      noPlaylist: true,

      noWarnings: true,

      restrictFilenames: true,

      concurrentFragments: 4,

      retries: 3,

      fragmentRetries: 3,

      extractorRetries: 3,

      socketTimeout: 30,

      addHeader: [
        'referer:https://www.youtube.com/',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
      ]
    });

    /*
     * Kiểm tra file
     */
    if (!fs.existsSync(outputPath)) {
      throw new Error(
        'yt-dlp chạy xong nhưng không tìm thấy file MP4'
      );
    }

    const stats = fs.statSync(outputPath);

    if (stats.size <= 0) {
      fs.unlinkSync(outputPath);
      throw new Error('File MP4 được tạo nhưng dung lượng = 0');
    }

    console.log(
      `[YOUTUBE] Download success: ${fileName} (${Math.round(stats.size / 1024 / 1024)} MB)`
    );

    const baseUrl = getPublicBaseUrl();

    const mediaUrl =
      `${baseUrl}/downloads/${encodeURIComponent(fileName)}`;

    /*
     * Cover
     */
    const cover =
      info.thumbnail ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    /*
     * Author
     */
    const authorName =
      info.uploader ||
      info.channel ||
      info.creator ||
      'YouTube';

    /*
     * Views
     */
    const views =
      Number(info.view_count) ||
      0;

    /*
     * Likes
     */
    const likes =
      Number(info.like_count) ||
      0;

    /*
     * Return format tương thích API TikTok hiện tại
     */
    return {
      type: 'video',

      desc: title,

      author: {
        nickname: authorName,
        unique_id:
          info.channel_id ||
          info.uploader_id ||
          'youtube',

        avatar:
          info.channel_favicon ||
          'https://www.youtube.com/s/desktop/f17ecf45/img/favicon_144x144.png'
      },

      video: {
        noWatermark: mediaUrl,
        watermark: mediaUrl,
        cover: cover
      },

      images: null,

      // music.playUrl is the VIDEO url; audio download is handled separately via /api/youtube-audio
      music: {
        playUrl: null,
        title: title,
        // Store original video URL so we can extract audio server-side
        sourceVideoUrl: videoUrl
      },

      statistics: {
        playCount: views,
        likeCount: likes,
        commentCount: 0,
        shareCount: 0
      },

      /*
       * Thông tin bổ sung
       */
      youtube: {
        videoId: videoId,
        title: title,
        duration: Number(info.duration) || 0,
        uploader: authorName,
        webpageUrl: videoUrl
      },

      /*
       * Thông tin file
       */
      file: {
        name: fileName,
        size: stats.size,
        url: mediaUrl
      }
    };

  } catch (error) {
    console.error('[YOUTUBE ERROR]', error);

    /*
     * Xóa file lỗi nếu có
     */
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch { }
    }

    let message =
      error?.stderr ||
      error?.stdout ||
      error?.message ||
      String(error);

    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }

    console.error(message);

    throw new Error(
      `Không thể tải YouTube: ${message.substring(0, 1000)}`
    );
  }
}

/**
 * Download YouTube audio only (MP3)
 */
async function handleYouTubeAudio(videoUrl) {
  console.log(`[YOUTUBE AUDIO] Processing: ${videoUrl}`);

  if (!videoUrl || typeof videoUrl !== 'string') {
    throw new Error('YouTube URL không hợp lệ');
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Không lấy được YouTube Video ID');
  }

  const fileName =
    `youtube_audio_${videoId}_${crypto.randomBytes(5).toString('hex')}.mp3`;

  const outputPath = path.join(DOWNLOAD_DIR, fileName);

  try {
    console.log('[YOUTUBE AUDIO] Downloading audio only...');

    await ytDlp(videoUrl, {
      output: outputPath,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0, // best quality
      noPlaylist: true,
      noWarnings: true,
      retries: 3,
      addHeader: [
        'referer:https://www.youtube.com/',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
      ]
    });

    // yt-dlp may rename output when converting (adds .mp3 extension)
    let finalPath = outputPath;
    if (!fs.existsSync(finalPath)) {
      // Try without extension conflict
      const altPath = outputPath.replace('.mp3', '') + '.mp3';
      if (fs.existsSync(altPath)) {
        finalPath = altPath;
      } else {
        throw new Error('yt-dlp chạy xong nhưng không tìm thấy file MP3');
      }
    }

    const stats = fs.statSync(finalPath);
    if (stats.size <= 0) {
      fs.unlinkSync(finalPath);
      throw new Error('File MP3 được tạo nhưng dung lượng = 0');
    }

    const finalFileName = path.basename(finalPath);
    const baseUrl = getPublicBaseUrl();
    const audioUrl = `${baseUrl}/downloads/${encodeURIComponent(finalFileName)}`;

    console.log(
      `[YOUTUBE AUDIO] Done: ${finalFileName} (${Math.round(stats.size / 1024)} KB)`
    );

    return { audioUrl, fileName: finalFileName, size: stats.size };

  } catch (error) {
    console.error('[YOUTUBE AUDIO ERROR]', error);

    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch { }
    }

    let message =
      error?.stderr ||
      error?.stdout ||
      error?.message ||
      String(error);

    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }

    throw new Error(
      `Không thể tải audio YouTube: ${message.substring(0, 1000)}`
    );
  }
}

module.exports = handleYouTube;
module.exports.handleYouTubeAudio = handleYouTubeAudio;
