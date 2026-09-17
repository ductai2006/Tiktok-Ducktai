const handleTikTok = require('./tiktok');
const handlePinterest = require('./pinterest');
const handleYouTube = require('./youtube');
const handleTwitter = require('./twitter');
const handleInstagram = require('./instagram');
const handleFacebook = require('./facebook');


/* ============================================================
 * DETECT PLATFORM
 * ============================================================
 */

function detectPlatform(url) {
  if (!url || typeof url !== 'string') {
    return 'unknown';
  }

  const u = url.trim().toLowerCase();


  // TikTok
  if (
    u.includes('tiktok.com') ||
    u.includes('vm.tiktok.com') ||
    u.includes('vt.tiktok.com')
  ) {
    return 'tiktok';
  }


  // YouTube
  if (
    u.includes('youtube.com') ||
    u.includes('youtu.be')
  ) {
    return 'youtube';
  }


  // Pinterest
  if (
    u.includes('pinterest.com') ||
    u.includes('pin.it')
  ) {
    return 'pinterest';
  }


  // Twitter / X
  if (
    u.includes('twitter.com') ||
    u.includes('x.com')
  ) {
    return 'x';
  }


  // Instagram
  if (
    u.includes('instagram.com') ||
    u.includes('instagr.am')
  ) {
    return 'instagram';
  }


  // Facebook
  if (
    u.includes('facebook.com') ||
    u.includes('fb.watch') ||
    u.includes('fb.com')
  ) {
    return 'facebook';
  }


  return 'unknown';
}


/* ============================================================
 * RUN HANDLER
 * ============================================================
 */

async function runHandler(name, handler, url) {
  try {
    console.log(
      `[API ROUTER] Calling ${name} handler`
    );

    const data = await handler(url);


    if (!data) {
      console.log(
        `[API ROUTER] ${name} returned no data`
      );

      return null;
    }


    console.log(
      `[API ROUTER] ${name} handler succeeded`
    );

    return data;

  } catch (error) {
    console.error(
      `[API ROUTER] ${name} handler failed:`,
      error && error.message
        ? error.message
        : error
    );

    return null;
  }
}


/* ============================================================
 * EXTRACT MEDIA
 * ============================================================
 */

async function extractMedia(url) {
  const platform = detectPlatform(url);


  console.log(
    `[API ROUTER] Processing platform "${platform}" for URL: ${url}`
  );


  /* ==========================================================
   * UNKNOWN PLATFORM
   * ==========================================================
   */

  if (platform === 'unknown') {
    console.log(
      '[API ROUTER] Unknown platform'
    );

    return {
      platform: 'unknown',
      data: null
    };
  }


  let data = null;


  /* ==========================================================
   * CALL ONLY CORRECT HANDLER
   *
   * Không fallback nền tảng này sang nền tảng khác.
   * ==========================================================
   */

  switch (platform) {

    /* --------------------------------------------------------
     * TIKTOK
     * --------------------------------------------------------
     */

    case 'tiktok':
      data = await runHandler(
        'TikTok',
        handleTikTok,
        url
      );
      break;


    /* --------------------------------------------------------
     * PINTEREST
     * --------------------------------------------------------
     */

    case 'pinterest':
      data = await runHandler(
        'Pinterest',
        handlePinterest,
        url
      );
      break;


    /* --------------------------------------------------------
     * YOUTUBE
     * --------------------------------------------------------
     */

    case 'youtube':
      data = await runHandler(
        'YouTube',
        handleYouTube,
        url
      );
      break;


    /* --------------------------------------------------------
     * TWITTER / X
     * --------------------------------------------------------
     */

    case 'x':
      data = await runHandler(
        'Twitter/X',
        handleTwitter,
        url
      );
      break;


    /* --------------------------------------------------------
     * INSTAGRAM
     * --------------------------------------------------------
     */

    case 'instagram':
      data = await runHandler(
        'Instagram',
        handleInstagram,
        url
      );
      break;


    /* --------------------------------------------------------
     * FACEBOOK
     * --------------------------------------------------------
     */

    case 'facebook':
      data = await runHandler(
        'Facebook',
        handleFacebook,
        url
      );
      break;
  }


  /* ==========================================================
   * NO MEDIA
   * ==========================================================
   */

  if (!data) {
    console.log(
      `[API ROUTER] No media found for ${platform}`
    );
  }


  /* ==========================================================
   * RETURN
   * ==========================================================
   */

  return {
    platform,
    data
  };
}


/* ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = {
  detectPlatform,
  extractMedia,

  handleTikTok,
  handlePinterest,
  handleYouTube,
  handleTwitter,
  handleInstagram,
  handleFacebook
};
