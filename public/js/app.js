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

  // Validate TikTok URL format
  function isValidTikTokUrl(url) {
    const pattern = /https:\/\/(?:m|t|www|vm|vt|lite)?\.?tiktok\.com\//i;
    return pattern.test(url);
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
      showToast('Vui lòng nhập hoặc dán link video TikTok.', 'error');
      return;
    }

    if (!isValidTikTokUrl(url)) {
      showToast('Đường link không đúng định dạng video TikTok.', 'error');
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

      // 1. Render Media Preview (Separated functions for Video vs Image)
      const videoDownloadOpts = document.getElementById('video-download-options');
      const imageDownloadOpts = document.getElementById('image-download-options');

      if (data.type === 'image' || (data.images && data.images.length > 0)) {
        // Image Slideshow Post -> Render Image Preview Function
        const imagesList = data.images || [];
        showImagePreview(imagesList);

        if (videoDownloadOpts) videoDownloadOpts.classList.add('hidden');
        if (imageDownloadOpts) imageDownloadOpts.classList.remove('hidden');

        // Populate bottom grid thumbnail downloads
        framesGrid.innerHTML = '';
        imagesList.forEach((src, index) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'frame-link';
          wrapper.title = 'Nhấn để tải ảnh này';
          wrapper.style.cursor = 'pointer';

          wrapper.addEventListener('click', (e) => {
             e.preventDefault();
             downloadImageViaProxy(src, `tiktok-image-${index + 1}.jpg`);
          });

          const img = document.createElement('img');
          img.src = src;
          img.className = 'frame-img';

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

        framesSection.classList.add('hidden');
        btnDlFrames.style.display = 'flex';
      }

      // 2. Author
      authorAvatar.src = data.author?.avatarMedium?.[0] || data.author?.avatarThumb?.[0] || 'https://placehold.co/100x100/12121d/ffffff?text=Avatar';
      authorNickname.innerText = data.author?.nickname || 'Người dùng TikTok';
      authorUsername.innerText = `@${data.author?.username || 'user'}`;
      
      // Verification badge (v1 API does not include verified field, hide by default)
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
      showToast('Lấy thông tin video thành công!');

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
      img.src = src;
      img.draggable = false;
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

  btnDlAudio.addEventListener('click', () => {
    if (!currentVideoData) return;
    let rawMusic = currentVideoData.music?.playUrl || currentVideoData.music;
    const musicPlayUrl = Array.isArray(rawMusic) ? rawMusic[0] : rawMusic;
    const username = currentVideoData.author?.username || 'creator';
    const musicTitle = currentVideoData.music?.title || 'sound';
    const filename = generateFilename(username, musicTitle, 'mp3');
    triggerDownload(musicPlayUrl, filename, 'audio', btnDlAudio);
  });

  // Tải tất cả hình ảnh (for image slideshow posts)
  const btnDlAllImages = document.getElementById('btn-dl-all-images');
  if (btnDlAllImages) {
    btnDlAllImages.addEventListener('click', () => {
      if (!currentVideoData || !currentVideoData.images) {
        showToast('Không có hình ảnh để tải.', 'error');
        return;
      }
      const url = tiktokUrlInput.value.trim();
      window.location.href = `/api/download-zip?url=${encodeURIComponent(url)}`;
      showToast(`Đang nén file ZIP chứa ${currentVideoData.images.length} hình ảnh...`);
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
