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
const flashOverlay    = document.getElementById('flashOverlay');
const takeStripBtn    = document.getElementById('takeStripBtn');
const stripProgress   = document.getElementById('stripProgress');
const colorToggle     = document.getElementById('colorToggle');
const modePhoto       = document.getElementById('modePhoto');
const modeVideo       = document.getElementById('modeVideo');
const framePreviewOverlay = document.getElementById('framePreviewOverlay');
const mosquitoIcon    = document.getElementById('mosquitoIcon');
const bloodSplatter   = document.getElementById('bloodSplatter');
const btnMirror       = document.getElementById('btnMirror');
const btnAspect       = document.getElementById('btnAspect');
const btnRotate       = document.getElementById('btnRotate');
const btnFlip         = document.getElementById('btnFlip');
const mobileDownloadWrap = document.getElementById('mobileDownloadWrap');
const mobileDownloadBtn  = document.getElementById('mobileDownloadBtn');
const openGalleryBtn  = document.getElementById('openGalleryBtn');
const closeGallery    = document.getElementById('closeGallery');
const galleryModal    = document.getElementById('galleryModal');
const galleryGrid     = document.getElementById('galleryGrid');
const galleryEmpty    = document.getElementById('galleryEmpty');
const galleryCount    = document.getElementById('galleryCount');
const onlineStatus    = document.getElementById('onlineStatus');
const onlineText      = document.getElementById('onlineText');

// ── Full View elements
const fullViewModal   = document.getElementById('fullViewModal');
const fullViewImg     = document.getElementById('fullViewImg');
const closeFullView   = document.getElementById('closeFullView');
const fullViewDownloadBtn = document.getElementById('fullViewDownloadBtn');

// ── State ───────────────────────────────────────────────────
let stream        = null;
let mirrored      = true;
let facingMode    = 'user';   // 'user' = front, 'environment' = back
let currentFrame  = 'none';
let currentFilter = 'original';
let isColor       = true;
let capturedImages= [];   // {dataURL} per strip slot (4 each)
let stripsGallery = [];   // full strip data URLs stored in gallery
let isShooting    = false;
let lastStripURL  = null; // most recent strip for mobile download
const TOTAL_SHOTS = 4;
const COUNTDOWN   = 3;    // seconds per shot

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
});

// ── Camera ──────────────────────────────────────────────────
async function startCamera(){
  try {
    // Stop existing stream before restarting
    if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode },
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

// ── Color / B&W toggle ──────────────────────────────────────
colorToggle.addEventListener('change', () => {
  isColor = colorToggle.checked;
  applyVideoFilter();
});

// ── Filters ─────────────────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyVideoFilter();
  });
});

function getCSSFilter(){
  const filters = {
    'original':       '',
    'noir':           'grayscale(1) contrast(1.3)',
    'vintage':        'sepia(0.7) contrast(1.1) brightness(0.95)',
    'high-contrast':  'contrast(2) saturate(1.2)',
    'negative':       'invert(1)',
    'psychedelic':    'hue-rotate(180deg) saturate(3) contrast(1.2)',
    'vivid':          'saturate(2.2) contrast(1.1) brightness(1.05)',
    'dreamy':         'blur(0.8px) brightness(1.15) saturate(1.4) contrast(0.9)',
    'deep-shadow':    'contrast(1.6) brightness(0.75) saturate(0.8)',
    'low-light-boost':'brightness(1.6) contrast(0.9) saturate(0.7)',
  };
  let f = filters[currentFilter] || '';
  if(!isColor) f = 'grayscale(1) ' + f;
  return f.trim();
}

function applyVideoFilter(){
  video.style.filter = getCSSFilter();
}

// ── Mode tabs ────────────────────────────────────────────────
modePhoto.addEventListener('click', () => {
  modePhoto.classList.add('active');
  modeVideo.classList.remove('active');
});
modeVideo.addEventListener('click', () => {
  modeVideo.classList.add('active');
  modePhoto.classList.remove('active');
});

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
  
  // Mosquito death animation
  mosquitoIcon.classList.add('dead');
  bloodSplatter.classList.add('show');
  takeStripBtn.disabled = true;

  // Let animation play shortly
  await sleep(400);

  await startStrip();

  // Reset mosquito
  mosquitoIcon.classList.remove('dead');
  bloodSplatter.classList.remove('show');
});

async function startStrip(){
  isShooting = true;
  capturedImages = [];
  takeStripBtn.disabled = true;

  // Show progress bar
  stripProgress.style.display = 'flex';
  for(let i=0;i<TOTAL_SHOTS;i++){
    document.getElementById(`sp${i}`).innerHTML = '';
    document.getElementById(`sp${i}`).classList.remove('done');
    document.getElementById(`mf${i}`).innerHTML = '';
  }

  for(let shot=0; shot<TOTAL_SHOTS; shot++){
    await runCountdown(COUNTDOWN, shot);
    const dataURL = captureFrame();
    capturedImages.push(dataURL);
    await showFlash();
    updateProgress(shot, dataURL);
    // small gap between shots
    if(shot < TOTAL_SHOTS - 1) await sleep(400);
  }

  // Build and save the final strip
  const stripDataURL = await buildStrip(capturedImages, currentFrame);
  saveToGallery(stripDataURL);

  // Show mobile download button
  lastStripURL = stripDataURL;
  mobileDownloadWrap.style.display = 'flex';
  mobileDownloadBtn.onclick = () => downloadStrip(lastStripURL, stripsGallery.length - 1);

  isShooting = false;
  takeStripBtn.disabled = false;
}

// countdown for each shot
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

// flash
function showFlash(){
  return new Promise(resolve => {
    flashOverlay.classList.add('flash');
    setTimeout(() => {
      flashOverlay.classList.remove('flash');
      resolve();
    }, 140);
  });
}

// update the 4-slot progress row + mini strip
function updateProgress(index, dataURL){
  const slot = document.getElementById(`sp${index}`);
  const img  = new Image();
  img.src = dataURL;
  slot.appendChild(img);
  slot.classList.add('done');

  const mf  = document.getElementById(`mf${index}`);
  const img2 = new Image();
  img2.src = dataURL;
  mf.innerHTML = '';
  mf.appendChild(img2);
}

// ── Capture a frame from the video ──────────────────────────
function captureFrame(){
  const vw = video.videoWidth  || 640;
  const vh = video.videoHeight || 480;

  captureCanvas.width  = vw;
  captureCanvas.height = vh;

  const ctx = captureCanvas.getContext('2d');

  // Apply mirror
  if(mirrored){
    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }

  // Apply CSS filter via canvas filter
  ctx.filter = getCSSFilter() || 'none';
  ctx.drawImage(video, 0, 0, vw, vh);

  if(mirrored) ctx.restore();

  return captureCanvas.toDataURL('image/jpeg', 0.92);
}

// ── Build a photo strip (4 images stacked) ───────────────────
async function buildStrip(images, frame){
  const STRIP_W   = 400;
  const PHOTO_H   = 280;
  const GAP       = 10;
  const PAD_V     = 20;
  const PAD_H     = 20;
  const FOOTER    = 40;

  const totalH = PAD_V + TOTAL_SHOTS * PHOTO_H + (TOTAL_SHOTS-1)*GAP + PAD_V + FOOTER;

  const sc = document.createElement('canvas');
  sc.width  = STRIP_W;
  sc.height = totalH;
  const ctx = sc.getContext('2d');

  // Background per frame
  drawStripBg(ctx, sc.width, sc.height, frame);

  // Load all images
  const imgs = await Promise.all(images.map(loadImage));

  // Draw each photo
  for(let i=0; i<imgs.length; i++){
    const y = PAD_V + i*(PHOTO_H + GAP);
    const iw = STRIP_W - PAD_H*2;

    // Photo border / style per frame
    ctx.save();
    applyFrameStyle(ctx, PAD_H, y, iw, PHOTO_H, frame, i);
    ctx.restore();

    // Draw image clipped
    ctx.save();
    roundRect(ctx, PAD_H, y, iw, PHOTO_H, getFrameRadius(frame));
    ctx.clip();
    
    // Prevent stretching by simulating object-fit: cover
    const imgAR = imgs[i].width / imgs[i].height;
    const boxAR = iw / PHOTO_H;
    let sW, sH, sX, sY;
    if(imgAR > boxAR){
      sH = imgs[i].height;
      sW = sH * boxAR;
      sY = 0;
      sX = (imgs[i].width - sW) / 2;
    } else {
      sW = imgs[i].width;
      sH = sW / boxAR;
      sX = 0;
      sY = (imgs[i].height - sH) / 2;
    }
    
    ctx.drawImage(imgs[i], sX, sY, sW, sH, PAD_H, y, iw, PHOTO_H);
    ctx.restore();

    // Frame decorations on top
    drawFrameOverlay(ctx, PAD_H, y, iw, PHOTO_H, frame, i);
  }

  // Footer label
  drawStripFooter(ctx, sc.width, sc.height - FOOTER, FOOTER, frame);

  return sc.toDataURL('image/jpeg', 0.95);
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
    'none':        '#ffffff',
    'minimal':     '#f5f5f0',
    'polaroid':    '#fdfdfd',
    'neon':        '#0a0a0f',
    'classic':     '#1a1208',
    'brutal':      '#111111',
    'cntrlm':      '#d4f542',
  }[frame] || '#ffffff';

  if(frame === 'neon'){
    const grad = ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,'#0a0a1f');
    grad.addColorStop(1,'#0f0520');
    ctx.fillStyle = grad;
  } else if(frame === 'classic'){
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#2a1e0a');
    grad.addColorStop(1,'#1a1208');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0,0,w,h);

  // Border
  if(frame === 'brutal'){
    ctx.strokeStyle = '#d4f542';
    ctx.lineWidth = 4;
    ctx.strokeRect(2,2,w-4,h-4);
  } else if(frame === 'neon'){
    ctx.shadowColor = '#ff3cac';
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = '#ff3cac';
    ctx.lineWidth = 2;
    ctx.strokeRect(4,4,w-8,h-8);
    ctx.shadowBlur = 0;
  } else if(frame !== 'none'){
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0,0,w,h);
  }
}

function applyFrameStyle(ctx, x, y, w, h, frame, index){
  // Shadow behind photo
  if(frame === 'polaroid' || frame === 'minimal' || frame === 'none'){
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur  = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  } else if(frame === 'brutal'){
    ctx.fillStyle = '#d4f542';
    ctx.fillRect(x+4, y+4, w, h);
  }
}

function drawFrameOverlay(ctx, x, y, w, h, frame, index){
  if(frame === 'polaroid'){
    // White border bottom (polaroid look) — already handled by padding
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x,y,w,h);
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
    ctx.strokeRect(x-3, y-3, w+6, h+6);
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
  return { 'minimal':6, 'dreamy':8, 'cntrlm':2, 'none':0 }[frame] || 0;
}

function drawStripFooter(ctx, w, y, h, frame){
  const textColor = {
    'neon':    '#ff3cac',
    'classic': '#c8a84b',
    'brutal':  '#d4f542',
    'cntrlm':  '#111111',
  }[frame] || '#888888';

  ctx.fillStyle   = textColor;
  ctx.font        = '500 13px "Space Grotesk", sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'middle';
  ctx.fillText('CNTRL M  ✦  DIGITAL PHOTOBOOTH', w/2, y + h/2);
}

function roundRect(ctx, x, y, w, h, r){
  r = r || 0;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

// ── Gallery ──────────────────────────────────────────────────
function saveToGallery(dataURL){
  stripsGallery.unshift({ dataURL, ts: Date.now() });
  galleryCount.textContent = stripsGallery.length;
  // Persist
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
    img.alt = `Strip ${idx+1}`;

    const actions = document.createElement('div');
    actions.className = 'gallery-card-actions';

    // Click image to open Full View
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      fullViewImg.src = item.dataURL;
      fullViewDownloadBtn.onclick = () => downloadStrip(item.dataURL, idx);
      fullViewModal.style.display = 'flex';
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'gallery-action-btn primary';
    downloadBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Download
    `;
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

function downloadStrip(dataURL, idx){
  const a    = document.createElement('a');
  a.href     = dataURL;
  a.download = `cntrlm-strip-${idx+1}-${Date.now()}.jpg`;
  a.click();
}

// ── Utilities ────────────────────────────────────────────────
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
