const handleTikTok = require('./tiktok');
const handlePinterest = require('./pinterest');
const handleYouTube = require('./youtube');
const handleTwitter = require('./twitter');
const handleInstagram = require('./instagram');
const handleFacebook = require('./facebook');

function detectPlatform(url) {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  return 'unknown';
}

async function extractMedia(url) {
  const platform = detectPlatform(url);
  console.log(`[API ROUTER] Processing platform "${platform}" for URL: ${url}`);

  let data = null;

  if (platform === 'tiktok') {
    data = await handleTikTok(url);
  } else if (platform === 'pinterest') {
    data = await handlePinterest(url);
  } else if (platform === 'youtube') {
    data = await handleYouTube(url);
  } else if (platform === 'x') {
    data = await handleTwitter(url);
  } else if (platform === 'instagram') {
    data = await handleInstagram(url);
  } else if (platform === 'facebook') {
    data = await handleFacebook(url);
  }

  // Cross-fallback attempts if primary platform handler returned null
  if (!data) {
    if (platform === 'pinterest') data = await handlePinterest(url);
    if (!data) data = await handleTikTok(url);
    if (!data) data = await handleYouTube(url);
    if (!data) data = await handleTwitter(url);
    if (!data) data = await handleFacebook(url);
  }

  return { platform, data };
}

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
