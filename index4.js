// index4.js - Silvia's Palette (với setTransform để đảm bảo text không lật & Beauty Filter)
// DOM Elements
const video = document.getElementById('video');
const mainCanvas = document.getElementById('mainCanvas'); // Hidden canvas for processing
const captureBtn = document.getElementById('captureBtn');
const timerBtn = document.getElementById('timerBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const photoGallery = document.getElementById('photoGallery'); // Main gallery display
const flash = document.getElementById('flash');

// Filter related
const previewNoneMainImg = document.getElementById('preview-none-main'); 
const previewGrayscaleMainImg = document.getElementById('preview-grayscale-main'); 
const previewBeautyMainImg = document.getElementById('preview-beauty-main'); 

const countdown = document.getElementById('countdown');
const collageStatus = document.getElementById('collageStatus'); 

let faceApiLoaded = false;
let faceLandmarkModelLoaded = false

// Grid 5 - Preview Area
const liveCollagePreviewCanvas = document.getElementById('liveCollagePreviewCanvas');
let liveCollagePreviewCtx = null;
if (liveCollagePreviewCanvas) {
    liveCollagePreviewCtx = liveCollagePreviewCanvas.getContext('2d');
}

// Custom Background Elements
const customBgInput = document.getElementById('customBgInput');
const triggerCustomBgInputBtn = document.getElementById('triggerCustomBgInput');
const customBgPreviewImage = document.getElementById('customBgPreviewImage');
const customBgPreviewContainer = document.getElementById('customBgPreviewContainer');
const clearCustomBgBtn = document.getElementById('clearCustomBg');

// Theme Color Picker Elements
const themeColorPicker = document.getElementById('themeColorPicker');
const customColorPickerButton = document.getElementById('customColorPickerButton');

// Collage Output Canvas (created in memory)
const collageOutputCanvas = document.createElement('canvas'); 
const collageOutputCtx = collageOutputCanvas.getContext('2d');

// Global Variables
let stream = null;
let currentFilter = 'none'; 
let photosInGalleryCount = 0;
let collagePhotos = [];
let currentCollageMode = { totalPhotos: 1, columns: 1, aspectRatio: 3/4 };
let inCollageMode = false;
let activeCollageColorTheme = 'pink';
let userSelectedCustomBgImage = null;
const mainCtx = mainCanvas.getContext('2d');

// Slideshow for Grid 5 (when not in collage mode)
let slideshowImageSources = [];
let currentSlideshowIndex = 0;
let slideshowInterval = null;
const SLIDESHOW_INTERVAL_MS = 3000;

// --- Initialization ---
async function init() {
    try {
        const constraints = {
            video: {
                facingMode: 'user',
                width: { min: 1280, ideal: 1920 },
                height: { min: 720, ideal: 1080 }
            },
            audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        const appStatusMessage = document.getElementById('appStatusMessage');
        if (appStatusMessage) appStatusMessage.textContent = "Đang tải model AI...";
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri('./models')
            ]);
            console.log("FaceAPI models loaded successfully.");
            if (appStatusMessage) appStatusMessage.textContent = "Ready";
            faceApiLoaded = true;
            faceLandmarkModelLoaded = true;
        } catch (err) {
            console.error('Lỗi tải FaceAPI models:', err);
            if(appStatusMessage){
                if(err.message.includes('faceLandmark68TinyNet')){
                    appStatusMessage.textContent = 'Error Loading Model AI (Landmark)'
                } else {
                    appStatusMessage.textContent = 'Error Loading Model AI (Dectector)'
                }
            }
            if(!faceapi.nets.tinyFaceDetector.params) faceApiLoaded = false
            if(!faceapi.nets.faceLandmark68TinyNet.params) faceLandmarkModelLoaded = false
        }


        video.onloadedmetadata = () => {
            mainCanvas.width = video.videoWidth;
            mainCanvas.height = video.videoHeight;

            if (liveCollagePreviewCanvas) {
                if (liveCollagePreviewCanvas.offsetWidth > 0 && liveCollagePreviewCanvas.offsetHeight > 0) {
                    liveCollagePreviewCanvas.width = liveCollagePreviewCanvas.offsetWidth;
                    liveCollagePreviewCanvas.height = liveCollagePreviewCanvas.offsetHeight;
                } else {
                    liveCollagePreviewCanvas.width = 300;
                    liveCollagePreviewCanvas.height = 225;
                }
            }
            updateFilterPreviews(); 
        };

        const defaultThemeOption = document.querySelector(`.theme-option[data-theme="${activeCollageColorTheme}"]`);
        if (defaultThemeOption) {
            document.querySelectorAll('.theme-option.selected').forEach(opt => opt.classList.remove('selected'));
            defaultThemeOption.classList.add('selected');
        }
        if (themeColorPicker) {
            const initialColor = getThemeColorValue(activeCollageColorTheme);
            themeColorPicker.value = initialColor;
            if (customColorPickerButton) customColorPickerButton.style.borderColor = initialColor;
        }
        
        applyFilterToVideo('none'); 

        updateWin95Time();
        setInterval(updateWin95Time, 30000);

        const defaultLayoutButton = document.getElementById('start1x1');
        if (defaultLayoutButton) {
            startCollageMode(currentCollageMode.totalPhotos, currentCollageMode.columns, true);
        } else {
            startCollageMode(1, 1, true);
        }

    } catch (err) {
        console.error('Lỗi truy cập camera:', err);
        const appStatusMessage = document.getElementById('appStatusMessage');
        if (appStatusMessage) appStatusMessage.textContent = "Lỗi camera!";
        alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập hoặc thử độ phân giải thấp hơn.');
    }
}

function getBoundingBoxWithPadding(points, padding = 0, canvasWidth = Infinity, canvasHeight = Infinity) {
    if (!points || points.length === 0) return new faceapi.Rect(0, 0, 0, 0);
    
    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);

    let minX = Math.min(...xCoords);
    let minY = Math.min(...yCoords);
    let maxX = Math.max(...xCoords);
    let maxY = Math.max(...yCoords);

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(canvasWidth, maxX);
    maxY = Math.min(canvasHeight, maxY);

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    return new faceapi.Rect(minX, minY, width, height);
}

// --- Filter Logic ---
function updateFilterPreviews() { 
    if (!video || video.paused || video.ended || video.videoWidth === 0) {
        return;
    }
    if (previewNoneMainImg) drawPreview(video, previewNoneMainImg, getFilterCSSText('none', true));
    if (previewGrayscaleMainImg) drawPreview(video, previewGrayscaleMainImg, getFilterCSSText('grayscale', true));
    if (previewBeautyMainImg) drawPreview(video, previewBeautyMainImg, getFilterCSSText('beauty', true));
}

function drawPreview(sourceVideo, imgElement, filterCSSText) {
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    cvs.width = imgElement.offsetWidth > 0 ? imgElement.offsetWidth : 55; 
    cvs.height = imgElement.offsetHeight > 0 ? imgElement.offsetHeight : 42; 
    try {
        ctx.filter = filterCSSText === 'none' ? 'none' : filterCSSText;
        
        ctx.translate(cvs.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sourceVideo, 0, 0, sourceVideo.videoWidth, sourceVideo.videoHeight, 0, 0, cvs.width, cvs.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.filter = 'none'; 
        
        imgElement.src = cvs.toDataURL('image/jpeg', 0.8);
    } catch (e) { console.error("Lỗi vẽ preview filter:", filterCSSText, e); }
}


function getFilterCSSText(filterName, isForPreview = false) {
    if (filterName === 'grayscale') {
        return 'grayscale(100%)';
    } else if (filterName === 'beauty') {
        if (isForPreview) {
            return 'blur(0.05px) contrast(1.05) saturate(1.15)';
        } else {
            return 'contrast(1.05) saturate(1.15)'; 
        }
    }
    return 'none';
}

function applyFilterToVideo(filterName) { 
    currentFilter = filterName; 
    video.style.filter = getFilterCSSText(filterName, true); 

    document.querySelectorAll('.filter-option[data-filter]').forEach(opt => { 
        opt.classList.toggle('selected', opt.dataset.filter === filterName); 
    });
}


// --- Grid 5 Preview Logic (Combined Slideshow and Live Collage Layout) ---
function updateGrid5Preview() {
    if (!liveCollagePreviewCtx || !liveCollagePreviewCanvas) return;

    if (liveCollagePreviewCanvas.width !== liveCollagePreviewCanvas.offsetWidth || liveCollagePreviewCanvas.height !== liveCollagePreviewCanvas.offsetHeight) {
        if (liveCollagePreviewCanvas.offsetWidth > 0 && liveCollagePreviewCanvas.offsetHeight > 0) {
            liveCollagePreviewCanvas.width = liveCollagePreviewCanvas.offsetWidth;
            liveCollagePreviewCanvas.height = liveCollagePreviewCanvas.offsetHeight;
        }
    }

    if (inCollageMode) {
        drawLiveCollageLayoutPreview();
    } else {
        startGrid5Slideshow();
    }
}

function drawLiveCollageLayoutPreview() {
    if (!liveCollagePreviewCtx || !liveCollagePreviewCanvas) return;
    if (slideshowInterval) clearInterval(slideshowInterval);

    const canvasWidth = liveCollagePreviewCanvas.width;
    const canvasHeight = liveCollagePreviewCanvas.height;
    liveCollagePreviewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (userSelectedCustomBgImage && userSelectedCustomBgImage.complete) {
        try {
            drawImageCover(liveCollagePreviewCtx, userSelectedCustomBgImage, 0, 0, canvasWidth, canvasHeight);
        } catch (e) {
            liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
            liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    } else {
        liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
        liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const { totalPhotos, columns, aspectRatio } = currentCollageMode;
    const rows = Math.ceil(totalPhotos / columns);
    const availableWidth = canvasWidth * 0.9;
    const availableHeight = canvasHeight * 0.9;
    let previewSlotWidth = availableWidth / columns;
    let previewSlotHeight = previewSlotWidth / aspectRatio;

    if (previewSlotHeight * rows > availableHeight) {
        previewSlotHeight = availableHeight / rows;
        previewSlotWidth = previewSlotHeight * aspectRatio;
    }

    const totalLayoutWidth = previewSlotWidth * columns;
    const totalLayoutHeight = previewSlotHeight * rows;
    const offsetX = (canvasWidth - totalLayoutWidth) / 2;
    const offsetY = (canvasHeight - totalLayoutHeight) / 2;
    const slotMargin = Math.min(previewSlotWidth, previewSlotHeight) * 0.05;

    for (let i = 0; i < totalPhotos; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;

        const slotW = previewSlotWidth - (columns > 1 ? slotMargin : 0) ;
        const slotH = previewSlotHeight - (rows > 1 ? slotMargin : 0);

        const x = offsetX + col * (slotW + (columns > 1 ? slotMargin : 0));
        const y = offsetY + row * (slotH + (rows > 1 ? slotMargin : 0));

        if (collagePhotos[i]) {
            const img = new Image();
            img.onload = () => {
                // collagePhotos[i] is already un-flipped. Draw it directly.
                drawImageCover(liveCollagePreviewCtx, img, x, y, slotW, slotH);
            };
            img.src = collagePhotos[i]; 
        } else {
            liveCollagePreviewCtx.fillStyle = "rgba(246, 220, 172, 0.6)";
            liveCollagePreviewCtx.fillRect(x, y, slotW, slotH);
            liveCollagePreviewCtx.strokeStyle = "rgba(1, 32, 78, 0.7)";
            liveCollagePreviewCtx.lineWidth = 2;
            liveCollagePreviewCtx.strokeRect(x, y, slotW, slotH);
            liveCollagePreviewCtx.fillStyle = "#01204E";
            liveCollagePreviewCtx.font = `bold ${Math.min(slotW, slotH) * 0.2}px 'Pixelify Sans', Arial`;
            liveCollagePreviewCtx.textAlign = "center";
            liveCollagePreviewCtx.textBaseline = "middle";
            liveCollagePreviewCtx.fillText((i + 1).toString(), x + slotW / 2, y + slotH / 2);
        }
    }
}


function startGrid5Slideshow() {
    if (!liveCollagePreviewCtx || !liveCollagePreviewCanvas) return;
    if (slideshowInterval) clearInterval(slideshowInterval);

    const galleryImages = photoGallery.querySelectorAll('.captured-photo');
    slideshowImageSources = Array.from(galleryImages).map(img => img.src).reverse();

    const canvasWidth = liveCollagePreviewCanvas.width;
    const canvasHeight = liveCollagePreviewCanvas.height;
    liveCollagePreviewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (slideshowImageSources.length > 0) {
        currentSlideshowIndex = 0;
        drawCurrentImageInSlideshow();
        if (slideshowImageSources.length > 1) {
            slideshowInterval = setInterval(() => {
                currentSlideshowIndex = (currentSlideshowIndex + 1) % slideshowImageSources.length;
                drawCurrentImageInSlideshow();
            }, SLIDESHOW_INTERVAL_MS);
        }
    } else {
        drawGrid5FallbackBackground(canvasWidth, canvasHeight);
    }
}

function drawCurrentImageInSlideshow() {
    if (!liveCollagePreviewCtx || slideshowImageSources.length === 0) return;
    const canvasWidth = liveCollagePreviewCanvas.width;
    const canvasHeight = liveCollagePreviewCanvas.height;
    liveCollagePreviewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (userSelectedCustomBgImage && userSelectedCustomBgImage.complete) {
        try {
            drawImageCover(liveCollagePreviewCtx, userSelectedCustomBgImage, 0, 0, canvasWidth, canvasHeight);
        } catch (e) {
            liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
            liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    } else {
        liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
        liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const imgSrc = slideshowImageSources[currentSlideshowIndex];
    const img = new Image();
    img.onload = () => {
        drawImageCover(liveCollagePreviewCtx, img, 0, 0, canvasWidth, canvasHeight);
    };
    img.onerror = () => {
        console.error("Lỗi tải ảnh cho slideshow:", imgSrc);
    };
    img.src = imgSrc;
}

function drawGrid5FallbackBackground(canvasWidth, canvasHeight) {
    if (!liveCollagePreviewCtx) return;
    liveCollagePreviewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (userSelectedCustomBgImage && userSelectedCustomBgImage.complete) {
        try {
            drawImageCover(liveCollagePreviewCtx, userSelectedCustomBgImage, 0, 0, canvasWidth, canvasHeight);
        } catch (e) {
            liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
            liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    } else {
        liveCollagePreviewCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
        liveCollagePreviewCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const bgColor = userSelectedCustomBgImage ? '#FFFFFF' : getThemeColorValue(activeCollageColorTheme);
    const isDarkBg = bgColor.startsWith('#0') || bgColor === 'navy' || bgColor === '#028391' || bgColor === '#01204E' || bgColor === '#004c55' || bgColor === '#7c2a12' || bgColor === '#4c6a8d';
    liveCollagePreviewCtx.fillStyle = isDarkBg ? "#F6DCAC" : "#01204E";

    liveCollagePreviewCtx.font = "bold 16px 'Pixelify Sans', Arial";
    liveCollagePreviewCtx.textAlign = "center";
    const message = photosInGalleryCount === 0 ? "Chưa có ảnh nào" : "Xem trước Ảnh/Collage";
    liveCollagePreviewCtx.fillText(message, canvasWidth / 2, canvasHeight / 2);
}


// --- Collage Mode Logic ---
function startCollageMode(totalPhotos, columns, isInitialLoad = false) {
    const newMode = { totalPhotos: parseInt(totalPhotos), columns: parseInt(columns), aspectRatio: 3/4 };
    let shouldClearPhotos = false;

    if (isInitialLoad) {
        shouldClearPhotos = true;
    } else {
        const modeChanged = currentCollageMode.totalPhotos !== newMode.totalPhotos || currentCollageMode.columns !== newMode.columns;
        if (modeChanged) {
            if (collagePhotos.length > 0) {
                if (confirm("Bạn muốn thay đổi layout collage hiện tại? Các ảnh đã chụp cho layout cũ sẽ bị xóa.")) {
                    shouldClearPhotos = true;
                } else {
                    const prevLayoutButton = document.querySelector(`.layout-icon-button[data-photos="${currentCollageMode.totalPhotos}"][data-cols="${currentCollageMode.columns}"]`);
                    if (prevLayoutButton) {
                        document.querySelectorAll('.layout-icon-button.selected').forEach(btn => btn.classList.remove('selected'));
                        prevLayoutButton.classList.add('selected');
                    }
                    return;
                }
            } else {
                shouldClearPhotos = true;
            }
        } else {
            shouldClearPhotos = false;
        }
    }

    if (shouldClearPhotos) {
        collagePhotos = [];
    }

    inCollageMode = true;
    currentCollageMode = newMode;

    document.querySelectorAll('.layout-icon-button.selected').forEach(btn => btn.classList.remove('selected'));
    const currentLayoutButton = document.querySelector(`.layout-icon-button[data-photos="${currentCollageMode.totalPhotos}"][data-cols="${currentCollageMode.columns}"]`);
    if (currentLayoutButton) {
        currentLayoutButton.classList.add('selected');
    }

    updateCollageStatusDisplay();
    toggleCollageCaptureUI(true);
    updateGrid5Preview();
}


function cancelCurrentCollage() {
    inCollageMode = false;
    collagePhotos = [];
    const defaultLayoutButton = document.getElementById('start1x1');
    if (defaultLayoutButton) {
        const defaultTotal = parseInt(defaultLayoutButton.dataset.photos);
        const defaultCols = parseInt(defaultLayoutButton.dataset.cols);
        startCollageMode(defaultTotal, defaultCols, true);
    } else {
        currentCollageMode = { totalPhotos: 1, columns: 1, aspectRatio: 3/4 };
        toggleCollageCaptureUI(false);
        if (collageStatus) collageStatus.style.display = 'none';
        updateGrid5Preview();
    }
}

function updateCollageStatusDisplay() {
    if (collageStatus) {
        if (inCollageMode && currentCollageMode.totalPhotos > 0) {
            collageStatus.textContent = `Ảnh ${collagePhotos.length + 1} / ${currentCollageMode.totalPhotos}`;
            collageStatus.style.display = 'block';
        } else {
            collageStatus.style.display = 'none';
        }
    }
}


function toggleCollageCaptureUI(isCapturingMode) {
    const layoutButtons = document.querySelectorAll('#grid-item-photo-layout button');
    const themeControls = document.querySelectorAll('#grid-item-theme-color .theme-option, #grid-item-custom-background button, #customColorPickerButton');
    const collageInProgressWithPhotos = isCapturingMode && collagePhotos.length > 0 && collagePhotos.length < currentCollageMode.totalPhotos;

    layoutButtons.forEach(btn => {
        btn.disabled = collageInProgressWithPhotos;
    });
    themeControls.forEach(el => el.disabled = collageInProgressWithPhotos);

    const canCaptureMore = isCapturingMode && currentCollageMode.totalPhotos > 0 && collagePhotos.length < currentCollageMode.totalPhotos;
    if(captureBtn) captureBtn.disabled = !canCaptureMore;
    if(timerBtn) timerBtn.disabled = !canCaptureMore;

    if (isCapturingMode && currentCollageMode.totalPhotos > 0) {
        if (collageStatus) collageStatus.style.display = 'block';
    } else {
        if (collageStatus) collageStatus.style.display = 'none';
    }
}

// --- Photo Capture ---
function capturePhotoWithFlash(useTimer = false) {
    if (!inCollageMode || !currentCollageMode.totalPhotos || collagePhotos.length >= currentCollageMode.totalPhotos) {
        toggleCollageCaptureUI(inCollageMode);
        return;
    }

    if (useTimer) {
        let count = 3;
        if (countdown) { countdown.textContent = count; countdown.style.display = 'block'; }
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) { if (countdown) countdown.textContent = count; }
            else { clearInterval(countdownInterval); if (countdown) countdown.style.display = 'none'; executeSnapshot(); }
        }, 1000);
    } else {
        executeSnapshot();
    }
}

function drawImageContain(ctx, img, x, y, w, h, padding = 0) {
    if (!ctx || !img || (!img.complete && !img.src) || (img.naturalWidth || img.width) === 0 || w <= 0 || h <= 0) return;
    
    const imgNaturalWidth = img.naturalWidth || img.width;
    const imgNaturalHeight = img.naturalHeight || img.height;

    const targetW = w - 2 * padding;
    const targetH = h - 2 * padding;
    if (targetW <= 0 || targetH <= 0) return;

    const imgRatio = imgNaturalWidth / imgNaturalHeight;
    const containerRatio = targetW / targetH;
    let drawW, drawH, drawX, drawY;

    if (imgRatio > containerRatio) {
        drawW = targetW;
        drawH = targetW / imgRatio;
    } else {
        drawH = targetH;
        drawW = targetH * imgRatio;
    }
    drawX = x + padding + (targetW - drawW) / 2;
    drawY = y + padding + (targetH - drawH) / 2;
    ctx.drawImage(img, 0, 0, imgNaturalWidth, imgNaturalHeight, drawX, drawY, drawW, drawH);
}


async function executeSnapshot() {
    if (!stream || !video || video.readyState < video.HAVE_ENOUGH_DATA) {
        console.error("Video stream not ready for snapshot.");
        return;
    }
    if (flash) { flash.style.opacity = '0.9'; setTimeout(() => { flash.style.opacity = '0'; }, 120); }

    const originalVideoStyleFilter = video.style.filter;
    video.style.filter = 'none'; 

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.save();
    mainCtx.translate(mainCanvas.width, 0);
    mainCtx.scale(-1, 1);
    mainCtx.drawImage(video, 0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.restore(); 
    
    if (currentFilter === 'beauty') {
        const globalBeautyEffects = getFilterCSSText('beauty', false); 
        if (globalBeautyEffects && globalBeautyEffects !== 'none') {
            const tempCopyCanvas = document.createElement('canvas');
            tempCopyCanvas.width = mainCanvas.width;
            tempCopyCanvas.height = mainCanvas.height;
            const tempCopyCtx = tempCopyCanvas.getContext('2d');
            tempCopyCtx.drawImage(mainCanvas, 0, 0); 
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            mainCtx.filter = globalBeautyEffects;
            mainCtx.drawImage(tempCopyCanvas, 0, 0); 
            mainCtx.filter = 'none';
        }

        if (faceApiLoaded && faceLandmarkModelLoaded && faceapi.nets.tinyFaceDetector.params && faceapi.nets.faceLandmark68TinyNet.params) {
            try {
                const detections = await faceapi.detectAllFaces(mainCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);

                if (detections && detections.length > 0) {
                    const skinSmoothBlurAmount = 'blur(2px)'; 
                    for (const detection of detections) {
                        const overallFaceBox = detection.detection.box; 
                        const landmarks = detection.landmarks;

                        const leftEyePoints = landmarks.getLeftEye();
                        const rightEyePoints = landmarks.getRightEye();
                        const mouthPoints = landmarks.getMouth(); 
                        const nosePoints = landmarks.getNose();

                        const featurePadding = overallFaceBox.width * 0.02; 
                        const featureBoxesData = [];

                        if (leftEyePoints.length) featureBoxesData.push({ type: 'leftEye', points: leftEyePoints });
                        if (rightEyePoints.length) featureBoxesData.push({ type: 'rightEye', points: rightEyePoints });
                        if (mouthPoints.length) featureBoxesData.push({ type: 'mouth', points: mouthPoints });
                        if (nosePoints.length) featureBoxesData.push({ type: 'nose', points: nosePoints });

                        const originalFeatureCanvases = featureBoxesData.map(data => {
                            const box = getBoundingBoxWithPadding(data.points, featurePadding, mainCanvas.width, mainCanvas.height);
                            const canvas = document.createElement('canvas');
                            canvas.width = box.width;
                            canvas.height = box.height;
                            const ctx = canvas.getContext('2d');
                            if (box.width > 0 && box.height > 0) {
                                ctx.drawImage(mainCanvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
                            }
                            return { canvas, box };
                        });
                        
                        const blurPadding = overallFaceBox.width * 0.15; 
                        const blurBox = getBoundingBoxWithPadding(
                            [
                                { x: overallFaceBox.x, y: overallFaceBox.y },
                                { x: overallFaceBox.x + overallFaceBox.width, y: overallFaceBox.y + overallFaceBox.height }
                            ], 
                            blurPadding, mainCanvas.width, mainCanvas.height
                        );
                        
                        if (blurBox.width > 0 && blurBox.height > 0) {
                            const tempFaceCanvas = document.createElement('canvas');
                            tempFaceCanvas.width = blurBox.width;
                            tempFaceCanvas.height = blurBox.height;
                            const tempFaceCtx = tempFaceCanvas.getContext('2d');
                            tempFaceCtx.drawImage(mainCanvas, blurBox.x, blurBox.y, blurBox.width, blurBox.height, 0, 0, blurBox.width, blurBox.height);
                            
                            mainCtx.filter = skinSmoothBlurAmount;
                            mainCtx.drawImage(tempFaceCanvas, 0, 0, blurBox.width, blurBox.height, blurBox.x, blurBox.y, blurBox.width, blurBox.height);
                            mainCtx.filter = 'none';
                        }

                        for (const { canvas: featureCanvas, box: featureDrawBox } of originalFeatureCanvases) {
                            if (featureCanvas.width > 0 && featureCanvas.height > 0) {
                                mainCtx.drawImage(featureCanvas, 0, 0, featureCanvas.width, featureCanvas.height, featureDrawBox.x, featureDrawBox.y, featureDrawBox.width, featureDrawBox.height);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi nhận diện khuôn mặt hoặc landmarks:", error);
                const fallbackBlur = getFilterCSSText('beauty', true); 
                if (fallbackBlur && fallbackBlur !== 'none') {
                    const tempCopy = document.createElement('canvas'); tempCopy.width=mainCanvas.width; tempCopy.height=mainCanvas.height;
                    const tempCtxCopy = tempCopy.getContext('2d'); tempCtxCopy.drawImage(mainCanvas,0,0);
                    mainCtx.clearRect(0,0,mainCanvas.width, mainCanvas.height);
                    mainCtx.filter = fallbackBlur; 
                    mainCtx.drawImage(tempCopy,0,0);
                    mainCtx.filter = 'none';
                }
            }
        } else {
            console.warn("FaceAPI models (detector hoặc landmarks) chưa sẵn sàng. Sử dụng beauty filter đơn giản hơn.");
            const fallbackBlur = getFilterCSSText('beauty', true);
            if (fallbackBlur && fallbackBlur !== 'none') {
                const tempCopy = document.createElement('canvas'); tempCopy.width=mainCanvas.width; tempCopy.height=mainCanvas.height;
                const tempCtxCopy = tempCopy.getContext('2d'); tempCtxCopy.drawImage(mainCanvas,0,0);
                mainCtx.clearRect(0,0,mainCanvas.width, mainCanvas.height);
                mainCtx.filter = fallbackBlur;
                mainCtx.drawImage(tempCopy,0,0);
                mainCtx.filter = 'none';
            }
        }
    } else if (currentFilter !== 'none') {
        const filterCSSToApply = getFilterCSSText(currentFilter, false); 
        if (filterCSSToApply !== 'none') {
            const tempCopyCanvas = document.createElement('canvas');
            tempCopyCanvas.width = mainCanvas.width;
            tempCopyCanvas.height = mainCanvas.height;
            const tempCopyCtx = tempCopyCanvas.getContext('2d');
            tempCopyCtx.drawImage(mainCanvas, 0, 0); 
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            mainCtx.filter = filterCSSToApply;
            mainCtx.drawImage(tempCopyCanvas, 0, 0); 
            mainCtx.filter = 'none';
        }
    }
    
    video.style.filter = originalVideoStyleFilter; 
    const rawPhotoDataUrl = mainCanvas.toDataURL('image/jpeg', 0.95); 
    
    if (inCollageMode && collagePhotos.length < currentCollageMode.totalPhotos) {
        collagePhotos.push(rawPhotoDataUrl);
        updateGrid5Preview(); 
        updateCollageStatusDisplay();
        toggleCollageCaptureUI(true);

        if (collagePhotos.length === currentCollageMode.totalPhotos) {
            generateAndDisplayCollage(); 
        }
    }
}

// --- Collage Generation ---
async function generateAndDisplayCollage() {
    const { totalPhotos, columns, aspectRatio } = currentCollageMode;
    if (collagePhotos.length < totalPhotos) {
        return;
    }

    let outputCanvasWidth, outputCanvasHeight;
    const textAreaHeight = (totalPhotos === 1 && columns === 1) ? 80 : 100;

    if (userSelectedCustomBgImage && userSelectedCustomBgImage.complete) {
        outputCanvasWidth = userSelectedCustomBgImage.naturalWidth;
        outputCanvasHeight = userSelectedCustomBgImage.naturalHeight;
        collageOutputCanvas.width = outputCanvasWidth;
        collageOutputCanvas.height = outputCanvasHeight;
        collageOutputCtx.drawImage(userSelectedCustomBgImage, 0, 0, outputCanvasWidth, outputCanvasHeight);
    } else {
        if (totalPhotos === 1 && columns === 1) {
            const singlePhotoWidth = 800; 
            outputCanvasWidth = singlePhotoWidth;
            outputCanvasHeight = Math.round(singlePhotoWidth / aspectRatio) + textAreaHeight;
        } else {
            outputCanvasWidth = 1200; 
            const tempRows = Math.ceil(totalPhotos / columns);
            let tempPhotoSlotWidth = outputCanvasWidth / columns;
            let tempPhotoSlotHeight = tempPhotoSlotWidth / aspectRatio;
            outputCanvasHeight = tempPhotoSlotHeight * tempRows + textAreaHeight;
        }

        collageOutputCanvas.width = outputCanvasWidth;
        collageOutputCanvas.height = outputCanvasHeight;
        collageOutputCtx.fillStyle = getThemeColorValue(activeCollageColorTheme);
        collageOutputCtx.fillRect(0, 0, outputCanvasWidth, outputCanvasHeight);
    }

    const photoGridAreaWidth = outputCanvasWidth;
    const photoGridAreaHeight = outputCanvasHeight - textAreaHeight;
    let photoSlotWidth = photoGridAreaWidth / columns;
    let photoSlotHeight = photoSlotWidth / aspectRatio;

    if (photoSlotHeight * Math.ceil(totalPhotos / columns) > photoGridAreaHeight) {
        photoSlotHeight = photoGridAreaHeight / Math.ceil(totalPhotos / columns);
        photoSlotWidth = photoSlotHeight * aspectRatio;
    }
    if (photoSlotWidth * columns > photoGridAreaWidth) {
        photoSlotWidth = photoGridAreaWidth / columns;
        photoSlotHeight = photoSlotWidth / aspectRatio;
    }

    const actualPhotoGridWidth = photoSlotWidth * columns;
    const actualPhotoGridHeight = photoSlotHeight * Math.ceil(totalPhotos / columns);
    const gridOffsetX = (photoGridAreaWidth - actualPhotoGridWidth) / 2;
    const gridOffsetY = (photoGridAreaHeight - actualPhotoGridHeight) / 2;
    const photoMargin = Math.min(photoSlotWidth, photoSlotHeight) * 0.05;
    const photoBorderWidth = Math.min(photoSlotWidth, photoSlotHeight) * 0.03;

    const imageLoadPromises = collagePhotos.slice(0, totalPhotos).map(dataUrl => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img); 
        img.onerror = (err) => { console.error("Lỗi tải ảnh cho collage", err); reject(err); };
        img.src = dataUrl; 
    }));

    try {
        const loadedImages = await Promise.all(imageLoadPromises);
        for (let i = 0; i < loadedImages.length; i++) {
            if (i >= totalPhotos) break;
            const img = loadedImages[i]; 
            const row = Math.floor(i / columns);
            const col = i % columns;

            const contentWidth = photoSlotWidth - 2 * photoMargin;
            const contentHeight = photoSlotHeight - 2 * photoMargin;
            const slotX = gridOffsetX + col * photoSlotWidth;
            const slotY = gridOffsetY + row * photoSlotHeight;
            const photoX = slotX + photoMargin + photoBorderWidth;
            const photoY = slotY + photoMargin + photoBorderWidth;
            const photoDisplayWidth = contentWidth - 2 * photoBorderWidth;
            const photoDisplayHeight = contentHeight - 2 * photoBorderWidth;

            collageOutputCtx.fillStyle = '#FFFFFF';
            collageOutputCtx.fillRect(slotX + photoMargin, slotY + photoMargin, contentWidth, contentHeight);

            if (img && photoDisplayWidth > 0 && photoDisplayHeight > 0) {
                drawImageCover(collageOutputCtx, img, photoX, photoY, photoDisplayWidth, photoDisplayHeight);
            }
        }
    } catch (error) {
        console.error("Lỗi tải một hoặc nhiều ảnh cho collage:", error);
    }
    
    collageOutputCtx.setTransform(1, 0, 0, 1, 0, 0); 

    const currentBgIsDark = userSelectedCustomBgImage ? false : (activeCollageColorTheme === 'pink' || activeCollageColorTheme === 'navy' || activeCollageColorTheme === 'green' || activeCollageColorTheme === 'coral' || activeCollageColorTheme === 'gold');
    const textColor = currentBgIsDark ? '#F6DCAC' : '#01204E';
    const textShadowColor = currentBgIsDark ? 'rgba(1, 32, 78, 0.7)' : 'rgba(250, 169, 104, 0.5)';
    
    collageOutputCtx.textAlign = 'center';
    collageOutputCtx.shadowColor = textShadowColor;
    collageOutputCtx.shadowBlur = 4;

    const dateTextY = outputCanvasHeight - (textAreaHeight / 2) - (totalPhotos === 1 ? 10 : 15);
    const titleTextY = outputCanvasHeight - (textAreaHeight / 2) + (totalPhotos === 1 ? 20 : 25);

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`; 

    collageOutputCtx.font = `bold ${Math.min(outputCanvasWidth * 0.03, textAreaHeight * 0.3, (totalPhotos === 1 ? 28 : 32))}px 'Courier New', Courier, monospace`;
    collageOutputCtx.fillStyle = textColor;
    collageOutputCtx.fillText(formattedDate, outputCanvasWidth / 2, dateTextY);

    collageOutputCtx.font = `bold ${Math.min(outputCanvasWidth * 0.04, textAreaHeight * 0.4, (totalPhotos === 1 ? 38 : 44))}px 'Dancing Script', cursive`;
    collageOutputCtx.fillStyle = textColor;
    collageOutputCtx.fillText("Silvia's Palette", outputCanvasWidth / 2, titleTextY);

    collageOutputCtx.shadowColor = 'transparent';
    collageOutputCtx.shadowBlur = 0;
    
    const finalCollageDataUrl = collageOutputCanvas.toDataURL('image/jpeg', 0.95);
    addPhotoToGalleryDisplay(finalCollageDataUrl); 

    photosInGalleryCount = photoGallery.children.length;
    if (photosInGalleryCount > 0) {
        if (downloadBtn) downloadBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
    }
    
    collagePhotos = []; 
    updateCollageStatusDisplay();
    toggleCollageCaptureUI(true); 
    updateGrid5Preview(); 
}

// --- Theme and Color Logic ---
function getThemeColorValue(themeName) {
    if (themeName === 'custom' && themeColorPicker) return themeColorPicker.value;
    const themeColors = {
        'navy': '#01204E', 'pink': '#028391', 'blue': '#F6DCAC',
        'yellow': '#FAA968', 'purple': '#F85525', 'green': '#004c55',
        'teal': '#f7803c', 'coral': '#7c2a12', 'silver': '#ccb089',
        'gold': '#4c6a8d'
    };
    return themeColors[themeName] || themeColors.pink;
}

function setActiveCollageTheme(themeName, customColorValue = null) {
    activeCollageColorTheme = customColorValue !== null ? 'custom' : themeName;
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.theme === themeName && customColorValue === null);
    });
    const appliedColor = customColorValue !== null ? customColorValue : getThemeColorValue(themeName);
    if (themeColorPicker) themeColorPicker.value = appliedColor;
    if (customColorPickerButton) customColorPickerButton.style.borderColor = appliedColor;

    updateGrid5Preview();
}

// --- Utility: Draw Image with Cover ---
function drawImageCover(ctx, img, x, y, w, h) {
    if (!ctx || !img || (!img.complete && typeof img.src === 'undefined' && !(img instanceof HTMLCanvasElement)) || (img.naturalWidth || img.width) === 0 || w <= 0 || h <= 0) {
        return;
    }
    const imgNaturalWidth = img.naturalWidth || img.width;
    const imgNaturalHeight = img.naturalHeight || img.height;
    if (imgNaturalWidth === 0 || imgNaturalHeight === 0) return;

    const imgRatio = imgNaturalWidth / imgNaturalHeight;
    const containerRatio = w / h;
    let sX = 0, sY = 0, sW = imgNaturalWidth, sH = imgNaturalHeight;

    if (imgRatio > containerRatio) { 
        sW = imgNaturalHeight * containerRatio;
        sX = (imgNaturalWidth - sW) / 2;
    } else if (imgRatio < containerRatio) { 
        sH = imgNaturalWidth / containerRatio;
        sY = (imgNaturalHeight - sH) / 2;
    }
    ctx.drawImage(img, sX, sY, sW, sH, x, y, w, h);
}

// --- Gallery Management ---
function addPhotoToGalleryDisplay(imgDataUrl) {
    const photoContainer = document.createElement('div');
    photoContainer.className = 'photo-container';
    
    const imgEl = document.createElement('img');
    imgEl.src = imgDataUrl; 
    imgEl.className = 'captured-photo';
    imgEl.alt = "Ảnh đã chụp hoặc Collage";
    // Removed: imgEl.addEventListener('click', () => { ... view logic ... });

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'photo-actions';

    // View Button
    const viewBtnEl = document.createElement('button');
    viewBtnEl.className = 'view-btn win95-button';
    viewBtnEl.innerHTML = 'Xem'; // "View"
    viewBtnEl.title = "Xem ảnh này"; // "View this photo"
    viewBtnEl.type = "button";
    viewBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const newTab = window.open();
        if (newTab) {
            newTab.document.body.style.margin = '0'; 
            newTab.document.body.style.backgroundColor = '#333'; 
            newTab.document.body.innerHTML = `<img src="${imgDataUrl}" style="max-width: 100%; max-height: 100vh; margin: auto; display: block;">`;
            newTab.document.title = "Xem trước ảnh";
        } else { 
            alert('Vui lòng cho phép pop-up để xem ảnh.'); 
        }
    });
    
    // Delete Button
    const deleteBtnEl = document.createElement('button'); 
    deleteBtnEl.className = 'delete-btn win95-button';
    deleteBtnEl.innerHTML = 'Xóa'; 
    deleteBtnEl.title = "Xóa ảnh này"; // "Delete this photo"
    deleteBtnEl.type = "button";
    deleteBtnEl.addEventListener('click', (e) => {
        e.stopPropagation(); 
        photoContainer.remove();
        photosInGalleryCount = photoGallery.children.length;
        if (photosInGalleryCount === 0) {
            if (downloadBtn) downloadBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;
        }
        updateGrid5Preview(); 
    });

    actionsContainer.appendChild(viewBtnEl);
    actionsContainer.appendChild(deleteBtnEl);
    
    photoContainer.appendChild(imgEl);
    photoContainer.appendChild(actionsContainer);

    if (photoGallery) photoGallery.prepend(photoContainer); 
    photosInGalleryCount = photoGallery.children.length;
    if (photosInGalleryCount > 0) {
        if (downloadBtn) downloadBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
    }
    updateGrid5Preview(); 
}


async function downloadAllPhotos() {
    const galleryItems = photoGallery.querySelectorAll('.captured-photo');
    if (galleryItems.length === 0) {
        alert('Không có ảnh nào trong thư viện để tải xuống.');
        return;
    }

    for (let i = 0; i < galleryItems.length; i++) {
        const photoImg = galleryItems[i];
        try {
            const response = await fetch(photoImg.src);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `silvia_palette_${timestamp}_${i + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            if (galleryItems.length > 1 && i < galleryItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300)); 
            }
        } catch (error) {
            console.error("Lỗi khi tải ảnh:", error);
            alert(`Đã có lỗi khi tải ảnh thứ ${i+1}. Vui lòng thử lại.`);
        }
    }
    if (galleryItems.length > 1) {
        alert('Đã bắt đầu tải xuống nhiều ảnh. Kiểm tra thư mục tải xuống của bạn.');
    }
}


function clearAllPhotos() {
    if (photoGallery.children.length === 0) return;
    if (confirm('Bạn có chắc muốn xóa tất cả ảnh khỏi thư viện không?')) {
        if (photoGallery) photoGallery.innerHTML = '';
        photosInGalleryCount = 0;
        if (downloadBtn) downloadBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
        updateGrid5Preview(); 
    }
}

// --- Status Bar Time ---
function updateWin95Time() {
    const timeField = document.getElementById('currentTime');
    if (timeField) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeField.textContent = `${hours}:${minutes}`;
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() { 
    if (captureBtn) captureBtn.addEventListener('click', () => capturePhotoWithFlash(false));
    if (timerBtn) timerBtn.addEventListener('click', () => capturePhotoWithFlash(true));
    if (downloadBtn) downloadBtn.addEventListener('click', downloadAllPhotos);
    if (clearBtn) clearBtn.addEventListener('click', clearAllPhotos);

    document.querySelectorAll('.filter-option[data-filter]').forEach(button => { 
        button.addEventListener('click', () => { 
            applyFilterToVideo(button.dataset.filter); 
        });
    });

    const collageLayoutButtonsConfig = {
        'start1x1': { photos: 1, cols: 1 }, 'start1x2': { photos: 2, cols: 1 }, 
        'start1x3': { photos: 3, cols: 1 }, 'start1x4': { photos: 4, cols: 1 }, 
        'start2x2': { photos: 4, cols: 2 }, 'start2x3': { photos: 6, cols: 2 },
    };
    for (const id in collageLayoutButtonsConfig) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.dataset.photos = collageLayoutButtonsConfig[id].photos;
            btn.dataset.cols = collageLayoutButtonsConfig[id].cols;
            btn.addEventListener('click', (e) => {
                const selectedButton = e.currentTarget;
                const newLayoutPhotos = parseInt(selectedButton.dataset.photos);
                const newLayoutCols = parseInt(selectedButton.dataset.cols);
                startCollageMode(newLayoutPhotos, newLayoutCols, false);
            });
        }
    }

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => setActiveCollageTheme(option.dataset.theme));
    });

    if (customColorPickerButton && themeColorPicker) {
        customColorPickerButton.addEventListener('click', () => themeColorPicker.click());
    }
    if (themeColorPicker) {
        themeColorPicker.addEventListener('input', function() {
            setActiveCollageTheme('custom', this.value);
            document.querySelectorAll('.theme-option.selected').forEach(opt => opt.classList.remove('selected'));
            if (customColorPickerButton) customColorPickerButton.style.borderColor = this.value;
        });
        themeColorPicker.addEventListener('change', function() { 
            setActiveCollageTheme('custom', this.value);
            document.querySelectorAll('.theme-option.selected').forEach(opt => opt.classList.remove('selected'));
            if (customColorPickerButton) customColorPickerButton.style.borderColor = this.value;
        });
    }

    if (triggerCustomBgInputBtn) triggerCustomBgInputBtn.addEventListener('click', () => customBgInput.click());
    if (customBgPreviewContainer) customBgPreviewContainer.addEventListener('click', () => customBgInput.click()); 
    if (customBgInput) {
        customBgInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = () => {
                        userSelectedCustomBgImage = img;
                        if (customBgPreviewImage) customBgPreviewImage.src = e.target.result;
                        if (clearCustomBgBtn) clearCustomBgBtn.style.display = 'inline-block';
                        activeCollageColorTheme = 'custom_bg'; 
                        document.querySelectorAll('.theme-option.selected').forEach(opt => opt.classList.remove('selected'));
                        if (customColorPickerButton) customColorPickerButton.style.borderColor = '#ccc'; 
                        updateGrid5Preview();
                    };
                    img.onerror = () => alert("Lỗi tải ảnh.");
                    img.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
            customBgInput.value = null; 
        });
    }
    if (clearCustomBgBtn) {
        clearCustomBgBtn.addEventListener('click', () => {
            userSelectedCustomBgImage = null;
            if (customBgPreviewImage) customBgPreviewImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";
            clearCustomBgBtn.style.display = 'none';
            const defaultTheme = document.querySelector('.theme-option[data-theme="pink"]') || document.querySelector('.theme-option');
            if (defaultTheme) setActiveCollageTheme(defaultTheme.dataset.theme);
            else setActiveCollageTheme('pink'); 
        });
    }

    if (liveCollagePreviewCanvas) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target.offsetWidth > 0 && entry.target.offsetHeight > 0) {
                    if (liveCollagePreviewCanvas.width !== entry.target.offsetWidth || liveCollagePreviewCanvas.height !== entry.target.offsetHeight) {
                        liveCollagePreviewCanvas.width = entry.target.offsetWidth;
                        liveCollagePreviewCanvas.height = entry.target.offsetHeight;
                        updateGrid5Preview();
                    }
                }
            }
        });
        setTimeout(() => { 
            if (liveCollagePreviewCanvas.offsetParent !== null) { 
                 resizeObserver.observe(liveCollagePreviewCanvas);
            }
        }, 100);
    }
}

// --- Start the app ---
document.addEventListener('DOMContentLoaded', () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        init(); 
        setupEventListeners(); 
    } else {
        alert("Camera không khả dụng hoặc không được trình duyệt hỗ trợ.");
        const appStatusMessage = document.getElementById('appStatusMessage');
        if (appStatusMessage) appStatusMessage.textContent = "Không có camera!";
    }
});