/* ============================================================
   CNTRL M — Digital Photobooth  |  app.js
   ============================================================ */

'use strict';

// ── DOM references ──────────────────────────────────────────
const landingPage     = document.getElementById('landingPage');
const boothPage       = document.getElementById('boothPage');
const enterBtn        = document.getElementById('enterBtn');
const exitBtn         = document.getElementById('exitBtn');
const video           = document.getElementById('video');
const captureCanvas   = document.getElementById('captureCanvas');
const overlayCanvas   = document.getElementById('overlayCanvas');
const countdownOverlay= document.getElementById('countdownOverlay');
const countdownNum    = document.getElementById('countdownNum');
const countdownRing   = document.getElementById('countdownRing');
const flashOverlay    = document.getElementById('flashOverlay');
const takeStripBtn    = document.getElementById('takeStripBtn');
const stripProgress   = document.getElementById('stripProgress');
const mosquitoIcon    = document.getElementById('mosquitoIcon');
const bloodSplatter   = document.getElementById('bloodSplatter');
const btnMirror       = document.getElementById('btnMirror');
const btnAspect       = document.getElementById('btnAspect');
const btnRotate       = document.getElementById('btnRotate');
const btnFlip         = document.getElementById('btnFlip');
const actionBtnsWrap  = document.getElementById('actionBtnsWrap');
const downloadStripBtn= document.getElementById('downloadStripBtn');
const copyStripBtn    = document.getElementById('copyStripBtn');
const openGalleryBtn  = document.getElementById('openGalleryBtn');
const closeGallery    = document.getElementById('closeGallery');
const galleryModal    = document.getElementById('galleryModal');
const galleryGrid     = document.getElementById('galleryGrid');
const galleryEmpty    = document.getElementById('galleryEmpty');
const galleryCount    = document.getElementById('galleryCount');
const onlineStatus    = document.getElementById('onlineStatus');
const onlineText      = document.getElementById('onlineText');
const shotLabel       = document.getElementById('shotLabel');
const framePreviewOverlay = document.getElementById('framePreviewOverlay');
const toast           = document.getElementById('toast');

// ── Full View elements
const fullViewModal      = document.getElementById('fullViewModal');
const fullViewImg        = document.getElementById('fullViewImg');
const closeFullView      = document.getElementById('closeFullView');
const fullViewDownloadBtn= document.getElementById('fullViewDownloadBtn');

// ── State ───────────────────────────────────────────────────
let stream        = null;
let mirrored      = true;
let facingMode    = 'user';
let currentFrame  = 'none';
let currentFilter = 'original';
let capturedImages= [];
let stripsGallery = [];
let isShooting    = false;
let lastStripURL  = null;
const TOTAL_SHOTS = 4;
const COUNTDOWN   = 3;

// ── Online status ───────────────────────────────────────────
function updateOnline(){
  if(navigator.onLine){
    onlineStatus.style.color = '#22cc66';
    onlineText.textContent = 'online';
  } else {
    onlineStatus.style.color = '#ff5555';
    onlineText.textContent = 'offline';
  }
}
updateOnline();
window.addEventListener('online',  updateOnline);
window.addEventListener('offline', updateOnline);

// ── Toast notification ───────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false){
  toast.textContent = msg;
  toast.className = 'toast show' + (isError ? ' error' : '');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ── Enter / Exit booth ──────────────────────────────────────
enterBtn.addEventListener('click', async () => {
  landingPage.style.display = 'none';
  boothPage.style.display   = 'block';
  await startCamera();
});

exitBtn.addEventListener('click', () => {
  stopCamera();
  boothPage.style.display   = 'none';
  landingPage.style.display = '';
  actionBtnsWrap.style.display = 'none';
});

// ── Camera ──────────────────────────────────────────────────
async function startCamera(){
  try {
    if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1920 }, facingMode },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    resizeOverlay();
    applyVideoTransform();
    applyVideoFilter();
  } catch(e){
    alert('Could not access camera. Please allow camera permissions and reload.');
    exitBtn.click();
  }
}

// ── Flip camera (front ↔ back) ───────────────────────────────
btnFlip.addEventListener('click', async () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  btnFlip.classList.toggle('active', facingMode === 'environment');
  await startCamera();
});

function stopCamera(){
  if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
}

function resizeOverlay(){
  overlayCanvas.width  = video.videoWidth  || 640;
  overlayCanvas.height = video.videoHeight || 480;
}

// ── Mirror / Aspect / Rotate ─────────────────────────────────
btnMirror.addEventListener('click', () => {
  mirrored = !mirrored;
  btnMirror.classList.toggle('active', mirrored);
  applyVideoTransform();
});

let rotateAngle = 0;
btnRotate.addEventListener('click', () => {
  rotateAngle = (rotateAngle + 90) % 360;
  applyVideoTransform();
});

function applyVideoTransform(){
  const scaleX = mirrored ? -1 : 1;
  video.style.transform = `scaleX(${scaleX}) rotate(${rotateAngle}deg)`;
}

// ── Filters ─────────────────────────────────────────────────
const filterPillBtns = document.querySelectorAll('.filter-pill-btn');
filterPillBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterPillBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyVideoFilter();
  });
});

function getCSSFilter(){
  const filters = {
    'original':         '',
    'noir':             'grayscale(1) contrast(1.3)',
    'vintage':          'sepia(0.7) contrast(1.1) brightness(0.95)',
    'warm':             'sepia(0.25) saturate(1.5) brightness(1.05) hue-rotate(-10deg)',
    'cool':             'saturate(0.9) brightness(1.05) hue-rotate(180deg) contrast(0.95)',
    'high-contrast':    'contrast(2) saturate(1.2)',
    'psychedelic':      'hue-rotate(180deg) saturate(3) contrast(1.2)',
    'vivid':            'saturate(2.2) contrast(1.1) brightness(1.05)',
    'dreamy':           'blur(0.8px) brightness(1.15) saturate(1.4) contrast(0.9)',
    'deep-shadow':      'contrast(1.6) brightness(0.75) saturate(0.8)',
    'low-light-boost':  'brightness(1.6) contrast(0.9) saturate(0.7)',
  };
  return (filters[currentFilter] || '').trim();
}

function applyVideoFilter(){
  video.style.filter = getCSSFilter();
}

// ── Frame selection ─────────────────────────────────────────
const frameItems = document.querySelectorAll('.frame-item');
frameItems.forEach(btn => {
  btn.addEventListener('click', () => {
    frameItems.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFrame = btn.dataset.frame;
    framePreviewOverlay.dataset.frame = currentFrame;
  });
});

// ── Take strip ───────────────────────────────────────────────
takeStripBtn.addEventListener('click', async () => {
  if(isShooting) return;

  mosquitoIcon.classList.add('dead');
  bloodSplatter.classList.add('show');
  takeStripBtn.disabled = true;

  await sleep(400);
  await startStrip();

  mosquitoIcon.classList.remove('dead');
  bloodSplatter.classList.remove('show');
});

async function startStrip(){
  isShooting = true;
  capturedImages = [];
  takeStripBtn.disabled = true;
  actionBtnsWrap.style.display = 'none';

  // Show progress
  stripProgress.style.display = 'flex';
  for(let i = 0; i < TOTAL_SHOTS; i++){
    const slot = document.getElementById(`sp${i}`);
    slot.innerHTML = `<span class="sp-num">${i+1}</span>`;
    slot.classList.remove('done', 'active');
    document.getElementById(`mf${i}`).innerHTML = '';
  }

  for(let shot = 0; shot < TOTAL_SHOTS; shot++){
    // Mark active slot
    document.getElementById(`sp${shot}`).classList.add('active');

    // Show shot label
    shotLabel.style.display = 'flex';
    shotLabel.textContent = `Shot ${shot + 1} of ${TOTAL_SHOTS}`;

    await runCountdown(COUNTDOWN, shot);
    const dataURL = captureFrame();
    capturedImages.push(dataURL);
    await showFlash();
    updateProgress(shot, dataURL);
    if(shot < TOTAL_SHOTS - 1) await sleep(500);
  }

  shotLabel.style.display = 'none';

  // Build and save the final strip
  const stripDataURL = await buildStrip(capturedImages, currentFrame);
  saveToGallery(stripDataURL);

  // Show action buttons
  lastStripURL = stripDataURL;
  actionBtnsWrap.style.display = 'flex';
  downloadStripBtn.onclick = () => downloadStrip(lastStripURL, stripsGallery.length - 1);
  copyStripBtn.onclick    = () => copyStripToClipboard(lastStripURL);

  isShooting = false;
  takeStripBtn.disabled = false;
}

// ── Countdown ────────────────────────────────────────────────
function runCountdown(secs, shotIndex){
  return new Promise(resolve => {
    countdownOverlay.style.display = 'flex';
    let remaining = secs;

    const tick = () => {
      countdownNum.style.animation = 'none';
      countdownNum.offsetHeight; // reflow
      countdownNum.style.animation = '';
      countdownNum.textContent = remaining;

      if(remaining <= 0){
        countdownOverlay.style.display = 'none';
        resolve();
        return;
      }
      remaining--;
      setTimeout(tick, 1000);
    };
    tick();
  });
}

// ── Flash ────────────────────────────────────────────────────
function showFlash(){
  return new Promise(resolve => {
    flashOverlay.classList.add('flash');
    setTimeout(() => {
      flashOverlay.classList.remove('flash');
      resolve();
    }, 140);
  });
}

// ── Progress update ──────────────────────────────────────────
function updateProgress(index, dataURL){
  const slot = document.getElementById(`sp${index}`);
  const img  = new Image();
  img.src = dataURL;
  slot.innerHTML = '';
  slot.appendChild(img);
  slot.classList.remove('active');
  slot.classList.add('done');

  const mf   = document.getElementById(`mf${index}`);
  const img2 = new Image();
  img2.src = dataURL;
  mf.innerHTML = '';
  mf.appendChild(img2);
}

// ── Capture frame ────────────────────────────────────────────
function captureFrame(){
  const vw = video.videoWidth  || 640;
  const vh = video.videoHeight || 480;
  const scale = window.devicePixelRatio || 1;

  captureCanvas.width  = vw * scale;
  captureCanvas.height = vh * scale;

  const ctx = captureCanvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if(mirrored){
    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = getCSSFilter() || 'none';
  ctx.drawImage(video, 0, 0, vw, vh);

  if(mirrored) ctx.restore();

  return captureCanvas.toDataURL('image/png', 1.0);
}

// ── Build photo strip ────────────────────────────────────────
async function buildStrip(images, frame){
  const scale = window.devicePixelRatio || 1;
  const STRIP_W = 320;
  const PAD     = 16;
  const GAP     = 12;
  const FOOTER  = 60;
  
  const PHOTO_W = STRIP_W - (PAD * 2);
  const PHOTO_H = PHOTO_W * (3 / 4);

  const totalH = PAD + (PHOTO_H * 4) + (GAP * 3) + FOOTER;

  const sc = document.createElement('canvas');
  sc.width  = STRIP_W * scale;
  sc.height = totalH * scale;
  const ctx = sc.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw Strip Background
  ctx.fillStyle = '#C6FF3D';
  ctx.beginPath();
  roundRect(ctx, 0, 0, STRIP_W, totalH, 12);
  ctx.fill();

  // Load images
  const imgs = await Promise.all(images.map(loadImage));

  // 2. Draw 4 stacked images
  for(let i = 0; i < imgs.length; i++){
    const x = PAD;
    const y = PAD + i * (PHOTO_H + GAP);

    ctx.save();
    
    // Draw image clipped with 8px rounded corners
    ctx.beginPath();
    roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 8);
    ctx.clip();

    // object-fit: cover for perfect 4:3
    const imgRatio = imgs[i].width / imgs[i].height;
    const boxRatio = PHOTO_W / PHOTO_H;
    let sW, sH, sX, sY;
    if(imgRatio > boxRatio){
      sH = imgs[i].height;
      sW = sH * boxRatio;
      sY = 0;
      sX = (imgs[i].width - sW) / 2;
    } else {
      sW = imgs[i].width;
      sH = sW / boxRatio;
      sX = 0;
      sY = (imgs[i].height - sH) / 2;
    }

    ctx.drawImage(imgs[i], sX, sY, sW, sH, x, y, PHOTO_W, PHOTO_H);
    ctx.restore();

    // 3. Draw 4px solid inner border
    ctx.save();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const halfBorder = 2; // 4/2
    roundRect(ctx, x + halfBorder, y + halfBorder, PHOTO_W - 4, PHOTO_H - 4, 8 - halfBorder);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Draw Bottom Branding
  ctx.fillStyle = '#111111';
  ctx.font = '600 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = "CNTRL M ✦ DIGITAL PHOTOBOOTH".split('').join(String.fromCharCode(8202));
  
  const textY = totalH - (FOOTER / 2);
  ctx.fillText(text, STRIP_W / 2, textY);

  return sc.toDataURL('image/png', 1.0);
}

function loadImage(src){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.src = src;
  });
}

// ── Frame rendering helpers ──────────────────────────────────

function drawStripBg(ctx, w, h, frame){
  const bg = {
    'none':    '#ffffff',
    'minimal': '#f5f5f0',
    'polaroid':'#fdfdfd',
    'neon':    '#0a0a0f',
    'classic': '#1a1208',
    'brutal':  '#111111',
    'cntrlm':  '#d4f542',
  }[frame] || '#ffffff';

  if(frame === 'neon'){
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0a1f');
    grad.addColorStop(1, '#0f0520');
    ctx.fillStyle = grad;
  } else if(frame === 'classic'){
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a1e0a');
    grad.addColorStop(1, '#1a1208');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, w, h);

  // Strip border
  if(frame === 'brutal'){
    ctx.strokeStyle = '#d4f542';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  } else if(frame === 'neon'){
    ctx.shadowColor = '#ff3cac';
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = '#ff3cac';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.shadowBlur = 0;
  } else if(frame !== 'none'){
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, w, h);
  }
}

function applyFrameStyle(ctx, x, y, w, h, frame, index){
  if(frame === 'brutal'){
    ctx.fillStyle = '#d4f542';
    ctx.fillRect(x + 4, y + 4, w, h);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.001)';
    ctx.fillRect(x, y, w, h);
  }
}

function drawFrameOverlay(ctx, x, y, w, h, frame, index){
  if(frame === 'polaroid'){
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  } else if(frame === 'neon'){
    ctx.shadowColor = '#d4f542';
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = '#d4f542';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if(frame === 'classic'){
    ctx.strokeStyle = '#c8a84b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  } else if(frame === 'cntrlm'){
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
  } else if(frame === 'brutal'){
    ctx.strokeStyle = '#111';
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(x, y, w, h);
  }
}

function getFrameRadius(frame){
  return { 'minimal': 8, 'polaroid': 4, 'cntrlm': 2, 'none': 2 }[frame] || 0;
}

function drawStripFooter(ctx, w, y, h, frame){
  const textColor = {
    'neon':    '#ff3cac',
    'classic': '#c8a84b',
    'brutal':  '#d4f542',
    'cntrlm':  '#111111',
  }[frame] || '#888888';

  // Timestamp — March 2026
  const now   = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year  = now.getFullYear();
  const ts    = `${month} ${year}`;

  ctx.fillStyle    = textColor;
  ctx.font         = '600 24px "Space Grotesk", sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CNTRL M  ✦  DIGITAL PHOTOBOOTH', w / 2, y + h * 0.38);

  ctx.font         = '400 18px "Space Grotesk", sans-serif';
  ctx.globalAlpha  = 0.6;
  ctx.fillText(ts, w / 2, y + h * 0.72);
  ctx.globalAlpha  = 1;
}

function roundRect(ctx, x, y, w, h, r){
  r = r || 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Gallery ──────────────────────────────────────────────────
function saveToGallery(dataURL){
  stripsGallery.unshift({ dataURL, ts: Date.now() });
  galleryCount.textContent = stripsGallery.length;
  try { localStorage.setItem('cntrlm_gallery', JSON.stringify(stripsGallery)); } catch(e){}
}

function loadGalleryFromStorage(){
  try {
    const raw = localStorage.getItem('cntrlm_gallery');
    if(raw) stripsGallery = JSON.parse(raw);
    galleryCount.textContent = stripsGallery.length;
  } catch(e){}
}
loadGalleryFromStorage();

openGalleryBtn.addEventListener('click', openGallery);
closeGallery.addEventListener('click',  () => galleryModal.style.display = 'none');
galleryModal.addEventListener('click',  e => { if(e.target === galleryModal) galleryModal.style.display = 'none'; });

closeFullView.addEventListener('click', () => fullViewModal.style.display = 'none');
fullViewModal.addEventListener('click', e => { if(e.target === fullViewModal) fullViewModal.style.display = 'none'; });

function openGallery(){
  galleryGrid.innerHTML = '';

  if(stripsGallery.length === 0){
    galleryGrid.appendChild(galleryEmpty);
    galleryModal.style.display = 'flex';
    return;
  }

  stripsGallery.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const img = document.createElement('img');
    img.src = item.dataURL;
    img.alt = `Strip ${idx + 1}`;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      fullViewImg.src = item.dataURL;
      fullViewDownloadBtn.onclick = () => downloadStrip(item.dataURL, idx);
      fullViewModal.style.display = 'flex';
    });

    const actions = document.createElement('div');
    actions.className = 'gallery-card-actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'gallery-action-btn primary';
    downloadBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>
      </svg> Download`;
    downloadBtn.addEventListener('click', () => downloadStrip(item.dataURL, idx));

    const delBtn = document.createElement('button');
    delBtn.className = 'gallery-action-btn';
    delBtn.innerHTML = '✕ Delete';
    delBtn.addEventListener('click', () => {
      stripsGallery.splice(idx, 1);
      try { localStorage.setItem('cntrlm_gallery', JSON.stringify(stripsGallery)); } catch(e){}
      galleryCount.textContent = stripsGallery.length;
      openGallery();
    });

    actions.appendChild(downloadBtn);
    actions.appendChild(delBtn);
    card.appendChild(img);
    card.appendChild(actions);
    galleryGrid.appendChild(card);
  });

  galleryModal.style.display = 'flex';
}

// ── Download ─────────────────────────────────────────────────
function downloadStrip(dataURL, idx){
  const a    = document.createElement('a');
  a.href     = dataURL;
  a.download = `cntrlm-strip-${idx + 1}-${Date.now()}.png`;
  a.click();
}

// ── Clipboard copy ────────────────────────────────────────────
async function copyStripToClipboard(dataURL){
  try {
    // Convert data URL → blob
    const res  = await fetch(dataURL);
    const blob = await res.blob();

    if(navigator.clipboard && window.ClipboardItem){
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      showToast('✓ Copied to clipboard!');
    } else {
      // Fallback: trigger download with a message
      showToast('Clipboard not supported — saving download instead', true);
      downloadStrip(dataURL, stripsGallery.length - 1);
    }
  } catch(e){
    showToast('Could not copy — try downloading instead', true);
  }
}

// ── Utilities ─────────────────────────────────────────────────
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ── Theme System ─────────────────────────────────────────────
const btnDark = document.getElementById('btnDark');
const btnLight = document.getElementById('btnLight');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    btnDark.classList.add('active');
    btnLight.classList.remove('active');
  } else {
    btnLight.classList.add('active');
    btnDark.classList.remove('active');
  }
}

const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(savedTheme);

btnDark.addEventListener('click', () => setTheme('dark'));
btnLight.addEventListener('click', () => setTheme('light'));
