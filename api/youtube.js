const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ytDlp = require('youtube-dl-exec');

// ======================================================
// VERCEL / LOCAL TEMP STORAGE
// ======================================================

const DOWNLOAD_DIR = path.join(
  require('os').tmpdir(),
  'downloads'
);

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(
    DOWNLOAD_DIR,
    {
      recursive: true
    }
  );
}

// ======================================================
// YOUTUBE HEADERS
// ======================================================

const YOUTUBE_HEADERS = [
  'referer:https://www.youtube.com/',
  'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
];

// ======================================================
// VIDEO ID
// ======================================================

function extractVideoId(url) {
  try {
    const parsed =
      new URL(url);

    const hostname =
      parsed.hostname
        .toLowerCase();

    // youtube.com/watch?v=
    if (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com'
    ) {
      const v =
        parsed.searchParams.get('v');

      if (v) {
        return v;
      }

      // /shorts/ID
      if (
        parsed.pathname.startsWith(
          '/shorts/'
        )
      ) {
        return parsed.pathname
          .split('/')[2]
          ?.split('?')[0];
      }

      // /embed/ID
      if (
        parsed.pathname.startsWith(
          '/embed/'
        )
      ) {
        return parsed.pathname
          .split('/')[2]
          ?.split('?')[0];
      }

      return null;
    }

    // youtu.be/ID
    if (
      hostname === 'youtu.be' ||
      hostname === 'www.youtu.be'
    ) {
      return parsed.pathname
        .split('/')[1]
        ?.split('?')[0];
    }

    return null;

  } catch {
    return null;
  }
}

// ======================================================
// BASE URL
// ======================================================

function getPublicBaseUrl() {
  if (
    process.env.PUBLIC_URL
  ) {
    return process.env.PUBLIC_URL
      .replace(/\/+$/, '');
  }

  if (
    process.env.VERCEL_URL
  ) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT || 3000
    }`;
}

// ======================================================
// CLEANUP
// ======================================================

function removeFile(filePath) {
  try {
    if (
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }
  } catch { }
}

// ======================================================
// YOUTUBE VIDEO
// ======================================================

async function handleYouTube(videoUrl) {
  console.log(
    `[YOUTUBE] Processing: ${videoUrl}`
  );

  if (
    !videoUrl ||
    typeof videoUrl !== 'string'
  ) {
    throw new Error(
      'YouTube URL không hợp lệ'
    );
  }

  const videoId =
    extractVideoId(
      videoUrl
    );

  if (!videoId) {
    throw new Error(
      'Không lấy được YouTube Video ID'
    );
  }

  console.log(
    `[YOUTUBE] Video ID: ${videoId}`
  );

  const fileName =
    `youtube_${videoId}_${crypto.randomBytes(5).toString('hex')}.mp4`;

  const outputPath =
    path.join(
      DOWNLOAD_DIR,
      fileName
    );

  try {
    // ==================================================
    // INFO
    // ==================================================

    console.log(
      '[YOUTUBE] Getting video information...'
    );

    const info =
      await ytDlp(
        videoUrl,
        {
          dumpSingleJson: true,

          noWarnings: true,

          skipDownload: true,

          noPlaylist: true,

          preferFreeFormats: true,

          addHeader:
            YOUTUBE_HEADERS,

          socketTimeout: 30,

          retries: 3,

          extractorRetries: 3
        }
      );

    const title =
      info.title ||
      info.fulltitle ||
      'YouTube Video';

    console.log(
      `[YOUTUBE] Title: ${title}`
    );

    // ==================================================
    // DOWNLOAD
    // ==================================================

    console.log(
      `[YOUTUBE] Output: ${outputPath}`
    );

    console.log(
      '[YOUTUBE] Downloading...'
    );

    await ytDlp(
      videoUrl,
      {
        output:
          outputPath,

        format:
          'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[ext=mp4]/best',

        mergeOutputFormat:
          'mp4',

        noPlaylist:
          true,

        noWarnings:
          true,

        restrictFilenames:
          true,

        concurrentFragments:
          4,

        retries:
          3,

        fragmentRetries:
          3,

        extractorRetries:
          3,

        socketTimeout:
          30,

        addHeader:
          YOUTUBE_HEADERS
      }
    );

    // ==================================================
    // CHECK FILE
    // ==================================================

    if (
      !fs.existsSync(
        outputPath
      )
    ) {
      throw new Error(
        'yt-dlp chạy xong nhưng không tìm thấy file MP4'
      );
    }

    const stats =
      fs.statSync(
        outputPath
      );

    if (
      !stats.isFile() ||
      stats.size <= 0
    ) {
      removeFile(
        outputPath
      );

      throw new Error(
        'File MP4 được tạo nhưng dung lượng không hợp lệ'
      );
    }

    console.log(
      `[YOUTUBE] Download success: ${fileName} (${Math.round(stats.size / 1024 / 1024)} MB)`
    );

    // ==================================================
    // PUBLIC URL
    // ==================================================

    const baseUrl =
      getPublicBaseUrl();

    const mediaUrl =
      `${baseUrl}/downloads/${encodeURIComponent(fileName)}`;

    // ==================================================
    // METADATA
    // ==================================================

    const cover =
      info.thumbnail ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const authorName =
      info.uploader ||
      info.channel ||
      info.creator ||
      'YouTube';

    const channelId =
      info.channel_id ||
      info.uploader_id ||
      'youtube';

    const views =
      Number(
        info.view_count
      ) || 0;

    const likes =
      Number(
        info.like_count
      ) || 0;

    const comments =
      Number(
        info.comment_count
      ) || 0;

    const duration =
      Number(
        info.duration
      ) || 0;

    // ==================================================
    // RESPONSE
    // ==================================================

    return {
      type: 'video',

      desc: title,

      author: {
        nickname:
          authorName,

        unique_id:
          channelId,

        avatar:
          info.channel_favicon ||
          info.avatar ||
          'https://www.youtube.com/s/desktop/f17ecf45/img/favicon_144x144.png'
      },

      video: {
        noWatermark:
          mediaUrl,

        watermark:
          mediaUrl,

        cover:
          cover
      },

      images: null,

      music: {
        playUrl: null,

        title:
          title,

        sourceVideoUrl:
          videoUrl
      },

      statistics: {
        playCount:
          views,

        likeCount:
          likes,

        commentCount:
          comments,

        shareCount:
          0
      },

      youtube: {
        videoId:
          videoId,

        title:
          title,

        duration:
          duration,

        uploader:
          authorName,

        channelId:
          channelId,

        webpageUrl:
          videoUrl
      },

      file: {
        name:
          fileName,

        size:
          stats.size,

        url:
          mediaUrl
      }
    };

  } catch (error) {
    console.error(
      '[YOUTUBE ERROR]',
      error
    );

    removeFile(
      outputPath
    );

    let message =
      error?.stderr ||
      error?.stdout ||
      error?.message ||
      String(error);

    if (
      typeof message !== 'string'
    ) {
      try {
        message =
          JSON.stringify(
            message
          );
      } catch {
        message =
          String(message);
      }
    }

    console.error(
      message
    );

    throw new Error(
      `Không thể tải YouTube: ${message.substring(0, 1000)}`
    );
  }
}

// ======================================================
// YOUTUBE AUDIO MP3
// ======================================================

async function handleYouTubeAudio(
  videoUrl
) {
  console.log(
    `[YOUTUBE AUDIO] Processing: ${videoUrl}`
  );

  if (
    !videoUrl ||
    typeof videoUrl !== 'string'
  ) {
    throw new Error(
      'YouTube URL không hợp lệ'
    );
  }

  const videoId =
    extractVideoId(
      videoUrl
    );

  if (!videoId) {
    throw new Error(
      'Không lấy được YouTube Video ID'
    );
  }

  const baseName =
    `youtube_audio_${videoId}_${crypto.randomBytes(5).toString('hex')}`;

  const outputPath =
    path.join(
      DOWNLOAD_DIR,
      `${baseName}.mp3`
    );

  try {
    console.log(
      `[YOUTUBE AUDIO] Output: ${outputPath}`
    );

    await ytDlp(
      videoUrl,
      {
        output:
          outputPath,

        format:
          'bestaudio[ext=m4a]/bestaudio/best',

        extractAudio:
          true,

        audioFormat:
          'mp3',

        audioQuality:
          0,

        noPlaylist:
          true,

        noWarnings:
          true,

        retries:
          3,

        fragmentRetries:
          3,

        extractorRetries:
          3,

        socketTimeout:
          30,

        addHeader:
          YOUTUBE_HEADERS
      }
    );

    // ==================================================
    // FIND OUTPUT
    // ==================================================

    let finalPath =
      outputPath;

    if (
      !fs.existsSync(
        finalPath
      )
    ) {
      const altPath =
        path.join(
          DOWNLOAD_DIR,
          `${baseName}.mp3`
        );

      if (
        fs.existsSync(
          altPath
        )
      ) {
        finalPath =
          altPath;
      } else {
        throw new Error(
          'yt-dlp chạy xong nhưng không tìm thấy file MP3'
        );
      }
    }

    const stats =
      fs.statSync(
        finalPath
      );

    if (
      !stats.isFile() ||
      stats.size <= 0
    ) {
      removeFile(
        finalPath
      );

      throw new Error(
        'File MP3 được tạo nhưng dung lượng không hợp lệ'
      );
    }

    const finalFileName =
      path.basename(
        finalPath
      );

    console.log(
      `[YOUTUBE AUDIO] Done: ${finalFileName} (${Math.round(stats.size / 1024)} KB)`
    );

    return {
      audioUrl:
        `${getPublicBaseUrl()}/downloads/${encodeURIComponent(finalFileName)}`,

      fileName:
        finalFileName,

      size:
        stats.size
    };

  } catch (error) {
    console.error(
      '[YOUTUBE AUDIO ERROR]',
      error
    );

    removeFile(
      outputPath
    );

    let message =
      error?.stderr ||
      error?.stdout ||
      error?.message ||
      String(error);

    if (
      typeof message !== 'string'
    ) {
      message =
        JSON.stringify(message);
    }

    throw new Error(
      `Không thể tải audio YouTube: ${message.substring(0, 1000)}`
    );
  }
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
  handleYouTube;

module.exports.handleYouTubeAudio =
  handleYouTubeAudio;