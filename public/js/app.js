document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tiktokUrlInput = document.getElementById('tiktok-url');
  const btnPaste = document.getElementById('btn-paste');
  const btnAnalyze = document.getElementById('btn-analyze');
  const loadingSkeleton = document.getElementById('loading-skeleton');
  const resultSection = document.getElementById('result-section');
  const toastContainer = document.getElementById('toast-container');

  // Result Card Elements
  const videoCover = document.getElementById('video-cover');
  const previewContainer = document.getElementById('preview-container');
  const previewVideo = document.getElementById('preview-video');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const muteBtn = document.getElementById('mute-btn');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  const authorAvatar = document.getElementById('author-avatar');
  const authorNickname = document.getElementById('author-nickname');
  const authorVerified = document.getElementById('author-verified');
  const authorUsername = document.getElementById('author-username');
  const videoDesc = document.getElementById('video-desc');
  const statLikes = document.getElementById('stat-likes');
  const statComments = document.getElementById('stat-comments');
  const statShares = document.getElementById('stat-shares');
  const statViews = document.getElementById('stat-views');

  // Download Buttons
  const btnDlNoWatermark = document.getElementById('btn-dl-nowatermark');
  const btnDlWatermark = document.getElementById('btn-dl-watermark');
  const btnDlContent = document.getElementById('btn-dl-content');
  const btnDlAudio = document.getElementById('btn-dl-audio');
  const btnDlFrames = document.getElementById('btn-dl-frames');

  // Video Control Buttons
  const btnRewind = document.getElementById('btn-rewind');
  const btnForward = document.getElementById('btn-forward');
  const btnStepBack = document.getElementById('btn-step-back');
  const btnStepForward = document.getElementById('btn-step-forward');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // Frames Section Elements
  const framesSection = document.getElementById('frames-section');
  const framesGrid = document.getElementById('frames-grid');

  // Media Preview Wrappers & Carousel Elements
  const videoPreviewWrapper = document.getElementById('video-preview-wrapper');
  const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
  const imageCounterBadge = document.getElementById('image-counter-badge');
  const imageCarousel = document.getElementById('image-carousel');
  const carouselDots = document.getElementById('carousel-dots');

  // Global variables to store current media urls
  let currentVideoData = null;

  // Fetch System Public Config (Banner, Maintenance & Platforms Check)
  async function checkPublicConfig() {
    try {
      const r = await fetch('/api/public/config');
      if (!r.ok) return;
      const data = await r.json();
      if (data.banner && data.banner.enabled && data.banner.message) {
        showSystemBanner(data.banner.message, data.banner.type || 'info');
      }
      if (data.platforms) {
        renderSupportedPlatforms(data.platforms);
      }
    } catch (e) {}
  }

  function renderSupportedPlatforms(platforms) {
    const container = document.getElementById('supported-platforms-bar');
    if (!container) return;

    const list = platforms || {
      tiktok: { enabled: true, name: 'TikTok' },
      youtube: { enabled: true, name: 'YouTube' },
      pinterest: { enabled: true, name: 'Pinterest' },
      x: { enabled: true, name: 'Twitter / X' },
      instagram: { enabled: true, name: 'Instagram' },
      facebook: { enabled: true, name: 'Facebook' }
    };

    const brandColors = {
      tiktok:    '#ff0050',
      youtube:   '#ff0000',
      pinterest: '#bd081c',
      x:         '#e7e7e7',
      instagram: '#e1306c',
      facebook:  '#1877f2'
    };

    const svgIcons = {
      tiktok:    `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"/></svg>`,
      youtube:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`,
      pinterest: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`,
      x:         `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      instagram: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
      facebook:  `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
    };

    container.innerHTML = Object.keys(list).map(key => {
      const p = list[key];
      const isEnabled = p.enabled !== false;
      const color = brandColors[key] || '#9ca3af';
      const icon = svgIcons[key] || '🌐';
      return `
        <span style="
          background: ${isEnabled ? `${color}12` : 'rgba(239,68,68,0.08)'};
          border: 1px solid ${isEnabled ? `${color}30` : 'rgba(239,68,68,0.25)'};
          color: ${isEnabled ? color : '#f87171'};
          padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
          display: inline-flex; align-items: center; gap: 5px; backdrop-filter: blur(10px);
          transition: all 0.2s;
        " title="${isEnabled ? 'Đang sẵn sàng' : 'Đang bảo trì'}">
          <span style="display:flex;align-items:center">${icon}</span>
          <span>${p.name || key.toUpperCase()}</span>
          ${!isEnabled ? '<small style="font-size:0.65rem;background:rgba(239,68,68,0.2);padding:1px 5px;border-radius:8px;color:#fca5a5">Bảo trì</small>' : ''}
        </span>
      `;
    }).join('');
  }

  function showSystemBanner(message, type) {
    const existing = document.getElementById('system-banner-bar');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'system-banner-bar';
    const bgColors = {
      info: 'rgba(59, 130, 246, 0.95)',
      warning: 'rgba(245, 158, 11, 0.95)',
      success: 'rgba(16, 185, 129, 0.95)',
      error: 'rgba(239, 68, 68, 0.95)'
    };
    const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };
    
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: ${bgColors[type] || bgColors.info}; color: #ffffff;
      padding: 10px 20px; font-size: 0.9rem; font-weight: 600;
      text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(10px);
    `;
    banner.innerHTML = `<span>${icons[type] || '📌'}</span><span>${message}</span>`;
    document.body.prepend(banner);
  }

  checkPublicConfig();

  /* ----------------------------------------------------
     HELPERS
     ---------------------------------------------------- */
  
  // Custom Toast Notification System
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // SVG icons based on type
    const successIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    
    toast.innerHTML = `
      <div class="toast-icon">${type === 'success' ? successIcon : errorIcon}</div>
      <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3.5s
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3500);
  }

  // Proxy external image URLs to avoid CDN hotlink/CORS blocks
  function proxyImg(url) {
    if (!url || typeof url !== 'string') return '';
    // Don't proxy local/same-origin or data URIs or placehold.co
    if (url.startsWith('/') || url.startsWith('data:') || url.includes('placehold.co') || url.includes('localhost')) {
      return url;
    }
    return `/api/proxy-img?url=${encodeURIComponent(url)}`;
  }

  // Format Large Numbers (e.g. 1520000 -> 1.5M, 42100 -> 42.1K)
  function formatNumber(num) {
    if (!num) return '0';
    // Remove formatting characters if string contains letters already
    if (typeof num === 'string' && /[KkMm]/.test(num)) return num;
    
    const val = Number(num);
    if (isNaN(val)) return num;

    if (val >= 1000000) {
      return (val / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return val.toString();
  }

  // Generate safe filename based on author and video description
  function generateFilename(username, desc, extension = 'mp4') {
    const cleanUsername = username ? username.replace('@', '').trim() : 'creator';
    
    // Sanitize description for filesystem
    let cleanDesc = desc || 'video';
    // Remove hashtags, emojis, and special chars
    cleanDesc = cleanDesc.replace(/#\w+/g, '')
                         .replace(/[^\w\s\d\-_]/g, '')
                         .trim()
                         .substring(0, 25);
                         
    // Replace multiple spaces with a single underscore
    cleanDesc = cleanDesc.replace(/\s+/g, '_') || 'video';
    
    return `${cleanUsername}_${cleanDesc}.${extension}`;
  }

  // Validate Media URL format (TikTok, YouTube, Pinterest, Twitter/X, Instagram, Facebook)
  function isValidMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch(e) {
      return false;
    }
  }

  // Update Platform-Tailored UI (Badge & Buttons)
  function updatePlatformUI(platform, data) {
    const badge = document.getElementById('platform-badge');
    
    const platformNames = {
      tiktok: 'TikTok',
      youtube: 'YouTube',
      pinterest: 'Pinterest',
      x: 'Twitter / X',
      instagram: 'Instagram',
      facebook: 'Facebook'
    };
    
    const platformColors = {
      tiktok: { bg: 'rgba(255, 0, 80, 0.15)', border: 'rgba(255, 0, 80, 0.35)', color: '#ff0050' },
      youtube: { bg: 'rgba(255, 0, 0, 0.15)', border: 'rgba(255, 0, 0, 0.35)', color: '#ff0000' },
      pinterest: { bg: 'rgba(189, 8, 28, 0.15)', border: 'rgba(189, 8, 28, 0.35)', color: '#e60023' },
      x: { bg: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.3)', color: '#ffffff' },
      instagram: { bg: 'rgba(225, 48, 108, 0.15)', border: 'rgba(225, 48, 108, 0.35)', color: '#e1306c' },
      facebook: { bg: 'rgba(24, 119, 242, 0.15)', border: 'rgba(24, 119, 242, 0.35)', color: '#1877f2' }
    };

    if (badge) {
      const pName = platformNames[platform] || 'Media';
      const style = platformColors[platform] || { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', color: '#a855f7' };
      badge.innerText = pName;
      badge.style.backgroundColor = style.bg;
      badge.style.borderColor = style.border;
      badge.style.borderStyle = 'solid';
      badge.style.borderWidth = '1px';
      badge.style.color = style.color;
    }

    // Tailor video download action buttons
    const mainTextNoWm = btnDlNoWatermark?.querySelector('.main-text');
    const subTextNoWm = btnDlNoWatermark?.querySelector('.sub-text');

    // Audio button labels
    const btnDlAudioEl = document.getElementById('btn-dl-audio');
    const mainTextAudio = btnDlAudioEl?.querySelector('.main-text');
    const subTextAudio = btnDlAudioEl?.querySelector('.sub-text');

    if (platform === 'tiktok') {
      if (mainTextNoWm) mainTextNoWm.innerText = 'Tải Video Không Logo';
      if (subTextNoWm) subTextNoWm.innerText = 'Độ phân giải cao (MP4)';
      if (btnDlWatermark) btnDlWatermark.style.display = 'flex';
      if (mainTextAudio) mainTextAudio.innerText = 'Tải Nhạc Nền (MP3)';
      if (subTextAudio) subTextAudio.innerText = 'Trích xuất âm thanh gốc';
    } else {
      // YouTube, Pinterest, Twitter/X, Instagram, Facebook -> Hide "Watermark" button
      if (btnDlWatermark) btnDlWatermark.style.display = 'none';
      if (mainTextNoWm) {
        if (platform === 'youtube') mainTextNoWm.innerText = 'Tải Video HD (MP4)';
        else if (platform === 'pinterest') mainTextNoWm.innerText = 'Tải Video Pinterest (MP4)';
        else if (platform === 'x') mainTextNoWm.innerText = 'Tải Video Twitter (MP4)';
        else mainTextNoWm.innerText = 'Tải Video HD (MP4)';
      }
      if (subTextNoWm) subTextNoWm.innerText = 'Bản gốc chất lượng cao';

      // Platform-specific audio button
      if (platform === 'youtube') {
        if (mainTextAudio) mainTextAudio.innerText = 'Tải MP3 (Âm thanh)';
        if (subTextAudio) subTextAudio.innerText = 'Trích xuất audio chất lượng cao';
      } else if (platform === 'x') {
        if (mainTextAudio) mainTextAudio.innerText = 'Tải Âm thanh (MP3)';
        if (subTextAudio) subTextAudio.innerText = 'Trích xuất audio từ video';
      } else if (platform === 'pinterest') {
        if (mainTextAudio) mainTextAudio.innerText = 'Tải Âm thanh';
        if (subTextAudio) subTextAudio.innerText = 'Âm thanh từ video Pinterest';
      } else {
        if (mainTextAudio) mainTextAudio.innerText = 'Tải Nhạc Nền (MP3)';
        if (subTextAudio) subTextAudio.innerText = 'Trích xuất âm thanh gốc';
      }
    }

    // Dynamic button text for images
    const btnDlAllImages = document.getElementById('btn-dl-all-images');
    if (btnDlAllImages) {
      const imgCount = data.images?.length || 0;
      const mainImgText = btnDlAllImages.querySelector('.main-text');
      const subImgText = btnDlAllImages.querySelector('.sub-text');
      if (imgCount > 1) {
        if (mainImgText) mainImgText.innerText = `Tải Tất Cả (${imgCount} Ảnh ZIP)`;
        if (subImgText) subImgText.innerText = 'Trích xuất trọn bộ hình ảnh';
      } else {
        if (mainImgText) mainImgText.innerText = 'Tải Hình Ảnh HD';
        if (subImgText) subImgText.innerText = 'Tải ảnh chất lượng cao gốc';
      }
    }
  }

  /* ----------------------------------------------------
     VIDEO PLAYER CONTROLS
     ---------------------------------------------------- */

  function initVideoPlayer(videoUrl, coverUrl) {
    // Reset player state
    previewContainer.classList.remove('playing');
    videoCover.classList.remove('fade-out');
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.load();

    // Set cover image immediately
    videoCover.src = coverUrl || '';

    // Route video through server proxy to avoid CORS/header restrictions
    if (videoUrl) {
      const proxyUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}`;
      previewVideo.src = proxyUrl;
      previewVideo.load();
    }
  }

  function setPlaying(isPlaying) {
    if (isPlaying) {
      previewContainer.classList.add('playing');
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      // Fade out the cover image
      videoCover.classList.add('fade-out');
      previewVideo.play();
    } else {
      previewContainer.classList.remove('playing');
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      previewVideo.pause();
    }
  }

  function setMuted(isMuted) {
    previewVideo.muted = isMuted;
    iconMuted.style.display = isMuted ? 'block' : 'none';
    iconUnmuted.style.display = isMuted ? 'none' : 'block';
  }

  // Play/pause when clicking overlay
  // --- Video Control Handlers ---
  const FRAME_STEP = 1 / 30; // approx 30fps step

  btnRewind.addEventListener('click', () => {
    previewVideo.currentTime = Math.max(0, previewVideo.currentTime - 5);
  });

  btnForward.addEventListener('click', () => {
    previewVideo.currentTime = previewVideo.currentTime + 5;
  });

  btnStepBack.addEventListener('click', () => {
    previewVideo.currentTime = Math.max(0, previewVideo.currentTime - FRAME_STEP);
  });

  btnStepForward.addEventListener('click', () => {
    previewVideo.currentTime = previewVideo.currentTime + FRAME_STEP;
  });

  // Zoom logic
  let currentZoom = 1;
  const ZOOM_STEP = 0.25;
  const MAX_ZOOM = 3;
  const MIN_ZOOM = 0.5;

  function updateZoom() {
    const transformStr = `scale(${currentZoom})`;
    
    previewVideo.style.transform = transformStr;
    previewVideo.style.transformOrigin = 'center center';
    previewVideo.style.transition = 'transform 0.2s ease';
    
    videoCover.style.transform = transformStr;
    videoCover.style.transformOrigin = 'center center';
    videoCover.style.transition = 'transform 0.2s ease, opacity 0.5s ease';
  }

  btnZoomIn.addEventListener('click', () => {
    if (currentZoom < MAX_ZOOM) {
      currentZoom += ZOOM_STEP;
      updateZoom();
    }
  });

  btnZoomOut.addEventListener('click', () => {
    if (currentZoom > MIN_ZOOM) {
      currentZoom -= ZOOM_STEP;
      updateZoom();
    }
  });

  // Fullscreen logic
  btnFullscreen.addEventListener('click', () => {
    const el = previewContainer;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) { /* Safari */
        el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) { /* IE11 */
        el.msRequestFullscreen();
      } else if (previewVideo.webkitEnterFullscreen) { /* iOS Safari fallback for video element */
        previewVideo.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
      }
    }
  });

  // Frame extraction button
  btnDlFrames.addEventListener('click', async () => {
    if (!currentVideoData) return;
    const playUrl = currentVideoData.video?.noWatermark || currentVideoData.video?.playAddr?.[0];
    if (!playUrl) { showToast('Video URL not available for frame extraction.', 'error'); return; }
    try {
      showToast('Extracting frames, please wait...');
      const response = await fetch(`/api/frames?url=${encodeURIComponent(playUrl)}&fps=1`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to extract frames');
      // Clear previous frames
      framesGrid.innerHTML = '';
      data.frames.forEach((src, index) => {
        const link = document.createElement('a');
        link.href = src;
        link.download = `tiktok-frame-${index + 1}.jpg`;
        link.className = 'frame-link';
        link.title = 'Nhấn để tải ảnh này';
        
        const img = document.createElement('img');
        img.src = src;
        img.className = 'frame-img';
        
        link.appendChild(img);
        framesGrid.appendChild(link);
      });
      framesSection.classList.remove('hidden');
      showToast('Frames extracted successfully!');
    } catch (err) {
      console.error(err);
      showToast('Error extracting frames.', 'error');
    }
  });

  // Existing play/pause handler
  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setPlaying(previewVideo.paused);
  });

  // Toggle play/pause when clicking video area (Only when video wrapper is active)
  previewContainer.addEventListener('click', (e) => {
    if (videoPreviewWrapper && videoPreviewWrapper.classList.contains('hidden')) return;
    if (e.target === previewContainer || e.target === previewVideo || e.target === videoCover) {
      setPlaying(previewVideo.paused);
    }
  });

  // Mute toggle
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMuted(!previewVideo.muted);
  });

  // When the video actually starts playing, make sure state is synced
  previewVideo.addEventListener('play', () => {
    previewContainer.classList.add('playing');
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    videoCover.classList.add('fade-out');
  });

  previewVideo.addEventListener('pause', () => {
    previewContainer.classList.remove('playing');
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  });

  // Start muted by default
  setMuted(true);

  /* ----------------------------------------------------
     EVENT HANDLERS
     ---------------------------------------------------- */

  // Paste from Clipboard API
  btnPaste.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) {
        showToast('Trình duyệt không hỗ trợ đọc clipboard tự động.', 'error');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        tiktokUrlInput.value = text.trim();
        showToast('Đã dán liên kết từ clipboard!');
      } else {
        showToast('Clipboard trống hoặc không có văn bản.', 'error');
      }
    } catch (err) {
      showToast('Không thể dán tự động. Vui lòng nhấn giữ ô nhập và chọn "Dán" (Paste) thủ công.', 'error');
      console.error('Failed to read clipboard:', err);
    }
  });

  // Submit and Analyze URL
  btnAnalyze.addEventListener('click', async () => {
    const url = tiktokUrlInput.value.trim();

    if (!url) {
      showToast('Vui lòng dán liên kết video hoặc hình ảnh.', 'error');
      return;
    }

    if (!isValidMediaUrl(url)) {
      showToast('Đường link không đúng định dạng hợp lệ.', 'error');
      return;
    }

    // Toggle button loading state
    btnAnalyze.disabled = true;
    btnAnalyze.querySelector('.btn-text').classList.add('hidden');
    btnAnalyze.querySelector('.loader').classList.remove('hidden');

    // Reset layout states
    resultSection.classList.add('hidden');
    loadingSkeleton.classList.remove('hidden');

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Xảy ra lỗi khi lấy thông tin video.');
      }

      // Store current data
      currentVideoData = data;
      const platform = data.platform || 'tiktok';

      // Update Platform-Specific UI (Badge, Button text & visibility)
      updatePlatformUI(platform, data);

      // 1. Render Media Preview (Separated functions for Video vs Image)
      const videoDownloadOpts = document.getElementById('video-download-options');
      const imageDownloadOpts = document.getElementById('image-download-options');

      if (data.type === 'image' || (data.images && data.images.length > 0 && !data.video)) {
        // Image Slideshow Post -> Render Image Preview Function
        const imagesList = data.images || [];
        showImagePreview(imagesList);

        if (videoDownloadOpts) videoDownloadOpts.classList.add('hidden');
        if (imageDownloadOpts) imageDownloadOpts.classList.remove('hidden');

        // Hide audio button for pure image posts (Pinterest/Twitter images have no audio)
        if (btnDlAudio) btnDlAudio.style.display = 'none';

        // Populate bottom grid thumbnail downloads
        framesGrid.innerHTML = '';
        imagesList.forEach((src, index) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'frame-link';
          wrapper.title = 'Nhấn để tải ảnh này';
          wrapper.style.cursor = 'pointer';

          wrapper.addEventListener('click', (e) => {
             e.preventDefault();
             downloadImageViaProxy(src, `${platform}-image-${index + 1}.jpg`);
          });

          const img = document.createElement('img');
          img.src = proxyImg(src);
          img.className = 'frame-img';
          img.onerror = () => { img.src = 'https://placehold.co/200x200/12121d/ffffff?text=Ảnh'; img.onerror = null; };

          wrapper.appendChild(img);
          framesGrid.appendChild(wrapper);
        });
        framesSection.classList.remove('hidden');
        btnDlFrames.style.display = 'none';
      } else {
        // Video Post -> Render Video Preview Function
        let rawCover = data.video?.dynamicCover || data.video?.cover;
        const coverUrl = Array.isArray(rawCover) ? rawCover[0] : (typeof rawCover === 'string' && rawCover.length > 5 ? rawCover : 'https://placehold.co/240x426/12121d/ffffff?text=TikFlow');
        const { noWatermark } = getVideoUrls(data.video);
        showVideoPreview(noWatermark, coverUrl);

        if (videoDownloadOpts) videoDownloadOpts.classList.remove('hidden');
        if (imageDownloadOpts) imageDownloadOpts.classList.add('hidden');

        // Restore audio button visibility for video posts
        if (btnDlAudio) btnDlAudio.style.display = 'flex';

        // YouTube: hide frames extraction (server-side frames need local file)
        framesSection.classList.add('hidden');
        btnDlFrames.style.display = platform === 'youtube' ? 'none' : 'flex';
      }

      // 2. Author
      // Platform fallback avatars (stable icons when CDN avatar is unavailable)
      const platformFallbackAvatars = {
        youtube:   'https://www.youtube.com/s/desktop/f17ecf45/img/favicon_144x144.png',
        pinterest: 'https://assets.pinterest.com/images/pidgets/pinit_bg_en_rect_red_20.png',
        x:         'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
        instagram: 'https://placehold.co/100x100/e1306c/ffffff?text=IG',
        facebook:  'https://placehold.co/100x100/1877f2/ffffff?text=FB',
        tiktok:    'https://placehold.co/100x100/ff0050/ffffff?text=TK'
      };
      const rawAvatar = data.author?.avatar || data.author?.avatarMedium?.[0] || data.author?.avatarMedium || data.author?.avatarThumb?.[0] || data.author?.avatarThumb || platformFallbackAvatars[platform] || 'https://placehold.co/100x100/12121d/ffffff?text=Avatar';
      // Route all avatars through server proxy to bypass CDN hotlink protection
      authorAvatar.src = proxyImg(rawAvatar);
      // Add onerror fallback in case proxy also fails
      authorAvatar.onerror = () => { authorAvatar.src = platformFallbackAvatars[platform] || 'https://placehold.co/100x100/12121d/ffffff?text=?'; authorAvatar.onerror = null; };
      authorNickname.innerText = data.author?.nickname || (platform === 'youtube' ? 'YouTube Creator' : (platform === 'pinterest' ? 'Pinterest User' : (platform === 'x' ? 'Twitter User' : 'Tác giả')));
      authorUsername.innerText = `@${data.author?.username || data.author?.unique_id || platform}`;
      
      // Verification badge
      if (data.author?.verified || data.author?.isVerified) {
        authorVerified.classList.remove('hidden');
      } else {
        authorVerified.classList.add('hidden');
      }

      // 3. Description
      videoDesc.innerText = data.desc || 'Không có mô tả.';

      // 4. Stats
      statLikes.innerText = formatNumber(data.statistics?.likeCount);
      statComments.innerText = formatNumber(data.statistics?.commentCount);
      statShares.innerText = formatNumber(data.statistics?.shareCount);
      statViews.innerText = formatNumber(data.statistics?.playCount);

      // Hide loading skeleton and reveal results card
      loadingSkeleton.classList.add('hidden');
      resultSection.classList.remove('hidden');
      showToast('Lấy thông tin thành công!');

    } catch (err) {
      console.error(err);
      loadingSkeleton.classList.add('hidden');
      showToast(err.message, 'error');
    } finally {
      // Restore search button state
      btnAnalyze.disabled = false;
      btnAnalyze.querySelector('.btn-text').classList.remove('hidden');
      btnAnalyze.querySelector('.loader').classList.add('hidden');
    }
  });

  // Proxy Download Operation (Fetches file as blob, and triggers browser save dialog)
  async function triggerDownload(mediaUrl, filename, type, buttonEl) {
    // Mobile detection for download
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    buttonEl.classList.add('downloading');
    const mainText = buttonEl.querySelector('.main-text');
    const originalText = mainText.innerText;
    mainText.innerText = 'Đang chuẩn bị file...';

    try {
      if (isMobile) {
        // On mobile browsers, open a new tab to trigger native download handling
        const dlUrl = `/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}&type=${type}`;
        window.open(dlUrl, '_blank');
      } else {
        const response = await fetch(`/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}&type=${type}`);
        if (!response.ok) throw new Error('Lỗi từ máy chủ tải file.');

        const reader = response.body.getReader();
        const contentLength = response.headers.get('Content-Length');
        let receivedLength = 0;
        let chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedLength += value.length;
          if (contentLength) {
            const percent = Math.round((receivedLength / contentLength) * 100);
            mainText.innerText = `Đang tải: ${percent}%`;
          } else {
            mainText.innerText = 'Đang tải file...';
          }
        }
        const allChunks = new Uint8Array(receivedLength);
        let position = 0;
        for (let chunk of chunks) { allChunks.set(chunk, position); position += chunk.length; }
        const blob = new Blob([allChunks]);
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(downloadUrl);
        showToast('Đã lưu file về thiết bị thành công!');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải file. Vui lòng thử lại.', 'error');
    } finally {
      buttonEl.classList.remove('downloading');
      mainText.innerText = originalText;
    }
  }

  // Helper: download image via server proxy
  async function downloadImageViaProxy(imgUrl, filename) {
    if (!imgUrl) {
      showToast('Đường dẫn ảnh không khả dụng.', 'error');
      return;
    }
    try {
      const response = await fetch(`/api/download?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(filename)}&type=image`);
      if (!response.ok) throw new Error('Server error');
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Image download error:', err);
      showToast('Lỗi tải ảnh. Vui lòng thử lại.', 'error');
    }
  }

  /* ----------------------------------------------------
     SEPARATED MEDIA PREVIEW FUNCTIONS
     ---------------------------------------------------- */

  // Helper to extract No Watermark vs Watermarked URLs from TikTok video metadata
  function getVideoUrls(videoData) {
    if (!videoData) return { noWatermark: '', watermark: '' };

    // Server API already normalized these fields
    let noWatermark = videoData.noWatermark || '';
    let watermark = videoData.watermark || '';

    // Fallback if not normalized (backward compatibility)
    if (!noWatermark) {
      const downloadAddr = videoData.downloadAddr || [];
      const playAddr = videoData.playAddr || [];
      const allUrls = [...downloadAddr, ...playAddr];

      noWatermark = downloadAddr.find(u => !u.includes('watermark=1') && !u.includes('logo_name=')) 
                     || downloadAddr[0] 
                     || playAddr[0] 
                     || '';

      watermark = allUrls.find(u => u.includes('watermark=1') || u.includes('logo_name=')) 
                   || downloadAddr[1] 
                   || playAddr[0] 
                   || '';
    }

    return { noWatermark, watermark };
  }

  // 1. DEDICATED FUNCTION: Show Video Preview
  function showVideoPreview(videoUrl, coverUrl) {
    if (imagePreviewWrapper) imagePreviewWrapper.classList.add('hidden');
    if (videoPreviewWrapper) videoPreviewWrapper.classList.remove('hidden');

    initVideoPlayer(videoUrl, coverUrl);
  }

  // 2. DEDICATED FUNCTION: Show Image Slideshow Preview (TikTok style)
  function showImagePreview(imagesList) {
    // Completely pause and reset video player
    if (previewVideo) {
      previewVideo.pause();
      previewVideo.removeAttribute('src');
    }
    if (videoPreviewWrapper) videoPreviewWrapper.classList.add('hidden');
    if (imagePreviewWrapper) imagePreviewWrapper.classList.remove('hidden');

    renderImageCarousel(imagesList);
  }

  // Render TikTok-style Image Carousel with Swipe, Badge (1/N) & Dots
  function renderImageCarousel(images) {
    if (!imageCarousel || !carouselDots) return;
    imageCarousel.innerHTML = '';
    carouselDots.innerHTML = '';

    if (!images || images.length === 0) {
      if (imageCounterBadge) imageCounterBadge.innerText = '0/0';
      return;
    }

    const total = images.length;
    let currentIndex = 0;

    const updateBadge = (index) => {
      if (imageCounterBadge) {
        imageCounterBadge.innerText = `${index + 1}/${total}`;
      }
    };
    updateBadge(0);

    const track = document.createElement('div');
    track.className = 'carousel-track';

    images.forEach((src) => {
      const img = document.createElement('img');
      img.src = proxyImg(src);
      img.draggable = false;
      img.onerror = () => { img.src = 'https://placehold.co/400x400/12121d/ffffff?text=Ảnh'; img.onerror = null; };
      track.appendChild(img);
    });

    imageCarousel.appendChild(track);

    // Prev / Next Navigation Arrows
    if (total > 1) {
      const prevBtn = document.createElement('div');
      prevBtn.className = 'carousel-nav prev';
      prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';

      const nextBtn = document.createElement('div');
      nextBtn.className = 'carousel-nav next';
      nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

      imageCarousel.appendChild(prevBtn);
      imageCarousel.appendChild(nextBtn);

      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (currentIndex > 0) {
          currentIndex--;
          update();
        }
      });
      prevBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      prevBtn.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });

      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (currentIndex < total - 1) {
          currentIndex++;
          update();
        }
      });
      nextBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      nextBtn.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    }

    // Dots indicator below carousel
    images.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `dot ${idx === 0 ? 'active' : ''}`;
      dot.title = `Ảnh ${idx + 1}`;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = idx;
        update();
      });
      carouselDots.appendChild(dot);
    });

    const update = () => {
      const offset = -(currentIndex * 100);
      track.style.transform = `translateX(${offset}%)`;
      updateBadge(currentIndex);

      const dots = carouselDots.querySelectorAll('.dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
    };

    // Touch Swipe & Drag Handler
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let isSwiping = false;

    const handleStart = (clientX) => {
      startX = clientX;
      isDragging = true;
      isSwiping = false;
      track.style.transition = 'none';
    };

    const handleMove = (clientX) => {
      if (!isDragging) return;
      currentX = clientX;
      const diff = currentX - startX;
      if (Math.abs(diff) > 10) isSwiping = true;
      const width = imageCarousel.clientWidth || 1;
      const basePercent = -(currentIndex * 100);
      const dragPercent = (diff / width) * 100;
      track.style.transform = `translateX(${basePercent + dragPercent}%)`;
    };

    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
      if (!isSwiping) {
        update(); // Reset back if it was just a tap without drag
        startX = 0; currentX = 0;
        return;
      }
      const diff = currentX - startX;
      if (Math.abs(diff) > 40) {
        if (diff < 0 && currentIndex < total - 1) {
          currentIndex++;
        } else if (diff > 0 && currentIndex > 0) {
          currentIndex--;
        }
      }
      update();
      startX = 0;
      currentX = 0;
      isSwiping = false;
    };

    imageCarousel.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true });
    imageCarousel.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true });
    imageCarousel.addEventListener('touchend', handleEnd);

    imageCarousel.addEventListener('mousedown', (e) => handleStart(e.clientX));
    window.addEventListener('mousemove', (e) => handleMove(e.clientX));
    window.addEventListener('mouseup', handleEnd);
  }

  // Hook button clicks to trigger download with proper filenames
  btnDlNoWatermark.addEventListener('click', () => {
    if (!currentVideoData) return;
    const { noWatermark } = getVideoUrls(currentVideoData.video);
    const username = currentVideoData.author?.username || 'creator';
    const filename = generateFilename(username, currentVideoData.desc, 'mp4');
    triggerDownload(noWatermark, filename, 'video', btnDlNoWatermark);
  });

  btnDlWatermark.addEventListener('click', () => {
    if (!currentVideoData) return;
    const { watermark } = getVideoUrls(currentVideoData.video);
    const username = currentVideoData.author?.username || 'creator';
    const filename = generateFilename(username, `${currentVideoData.desc}_watermark`, 'mp4');
    triggerDownload(watermark, filename, 'video', btnDlWatermark);
  });

  btnDlContent.addEventListener('click', () => {
    if (!currentVideoData) return;
    if (currentVideoData.type === 'image' || (currentVideoData.images && currentVideoData.images.length > 0)) {
      if (btnDlAllImages) {
        btnDlAllImages.click();
      } else if (currentVideoData.images && currentVideoData.images.length > 0) {
        const url = tiktokUrlInput.value.trim();
        window.location.href = `/api/download-zip?url=${encodeURIComponent(url)}`;
        showToast(`Đang nén ${currentVideoData.images.length} ảnh thành file ZIP...`);
      }
    } else {
      const { noWatermark } = getVideoUrls(currentVideoData.video);
      const username = currentVideoData.author?.username || 'creator';
      const filename = generateFilename(username, currentVideoData.desc, 'mp4');
      triggerDownload(noWatermark, filename, 'video', btnDlContent);
    }
  });

  btnDlAudio.addEventListener('click', async () => {
    if (!currentVideoData) return;
    const platform = currentVideoData.platform || 'tiktok';

    // YouTube: use server-side yt-dlp MP3 extraction
    if (platform === 'youtube') {
      const sourceUrl = currentVideoData.music?.sourceVideoUrl || currentVideoData.youtube?.webpageUrl;
      const title = currentVideoData.desc || currentVideoData.youtube?.title || 'youtube_audio';
      if (!sourceUrl) {
        showToast('Không tìm được URL gốc để tải MP3.', 'error');
        return;
      }

      btnDlAudio.classList.add('downloading');
      const mainText = btnDlAudio.querySelector('.main-text');
      const originalText = mainText ? mainText.innerText : '';
      if (mainText) mainText.innerText = 'Đang trích xuất MP3...';

      try {
        showToast('Đang trích xuất MP3 từ YouTube, vui lòng chờ...');
        // Call server to extract audio and stream it back
        const dlUrl = `/api/youtube-audio?url=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(title)}`;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.open(dlUrl, '_blank');
        } else {
          if (mainText) mainText.innerText = 'Đang tải MP3...';
          const response = await fetch(dlUrl);
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Lỗi server khi tải MP3');
          }
          const blob = await response.blob();
          const safeTitle = title.replace(/[^\w\s\d\-_]/g, '').trim().substring(0, 50) || 'youtube_audio';
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${safeTitle}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          showToast('Đã tải MP3 thành công!');
        }
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Lỗi khi tải MP3. Vui lòng thử lại.', 'error');
      } finally {
        btnDlAudio.classList.remove('downloading');
        if (mainText) mainText.innerText = originalText;
      }
      return;
    }

    // Other platforms: use existing proxy download
    let rawMusic = currentVideoData.music?.playUrl || currentVideoData.music;
    const musicPlayUrl = Array.isArray(rawMusic) ? rawMusic[0] : rawMusic;
    const username = currentVideoData.author?.username || 'creator';
    const musicTitle = currentVideoData.music?.title || 'sound';
    const filename = generateFilename(username, musicTitle, 'mp3');
    triggerDownload(musicPlayUrl, filename, 'audio', btnDlAudio);
  });

  // Tải hình ảnh (for image posts/slideshows)
  const btnDlAllImages = document.getElementById('btn-dl-all-images');
  if (btnDlAllImages) {
    btnDlAllImages.addEventListener('click', () => {
      if (!currentVideoData || !currentVideoData.images || currentVideoData.images.length === 0) {
        showToast('Không có hình ảnh để tải.', 'error');
        return;
      }
      const imgs = currentVideoData.images;
      const platform = currentVideoData.platform || 'media';
      const username = currentVideoData.author?.username || 'user';
      if (imgs.length === 1) {
        const filename = generateFilename(username, currentVideoData.desc || 'image', 'jpg');
        downloadImageViaProxy(imgs[0], filename);
        showToast('Đang tải hình ảnh HD...');
      } else {
        const url = tiktokUrlInput.value.trim();
        window.location.href = `/api/download-zip?url=${encodeURIComponent(url)}`;
        showToast(`Đang nén file ZIP chứa ${imgs.length} hình ảnh...`);
      }
    });
  }

  // Add touchend listeners for mobile devices on all download buttons
  function addMobileTap(btn, handler) {
    if (!btn) return;
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      handler();
    }, { passive: false });
  }

  addMobileTap(btnDlNoWatermark, () => btnDlNoWatermark.click());
  addMobileTap(btnDlWatermark, () => btnDlWatermark.click());
  if (btnDlContent) addMobileTap(btnDlContent, () => btnDlContent.click());
  if (btnDlAudio) addMobileTap(btnDlAudio, () => btnDlAudio.click());
  if (btnDlAllImages) addMobileTap(btnDlAllImages, () => btnDlAllImages.click());
});
