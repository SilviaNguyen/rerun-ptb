// index4.js - Silvia's Palette

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
const normalFilterPreviewImg = document.getElementById('preview-none');
const grayscaleFilterStandalone = document.getElementById('grayscaleFilterStandalone');
const previewGrayscaleImg = document.getElementById('preview-grayscale');

const countdown = document.getElementById('countdown');
const collageStatus = document.getElementById('collageStatus'); // Status text within Grid 5

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
let currentCollageMode = { totalPhotos: 4, columns: 2, aspectRatio: 3/4 };
let inCollageMode = false;
let activeCollageColorTheme = 'pink'; // 'pink' class now maps to Teal color (#028391)
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
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            mainCanvas.width = video.videoWidth;
            mainCanvas.height = video.videoHeight;
            if (liveCollagePreviewCanvas) {
                if (liveCollagePreviewCanvas.offsetWidth > 0 && liveCollagePreviewCanvas.offsetHeight > 0) {
                    liveCollagePreviewCanvas.width = liveCollagePreviewCanvas.offsetWidth;
                    liveCollagePreviewCanvas.height = liveCollagePreviewCanvas.offsetHeight;
                } else { // Fallback if offsetWidth/Height is 0 initially
                    liveCollagePreviewCanvas.width = 300; // Default width
                    liveCollagePreviewCanvas.height = 225; // Default height (4:3)
                }
            }
            updateFilterPreviews();
            updateGrid5Preview(); 
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
        document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('selected'));
        const normalFilterOption = document.querySelector('.filter-option[data-filter="none"]');
        if (normalFilterOption) normalFilterOption.classList.add('selected');

        updateWin95Time();
        setInterval(updateWin95Time, 30000); 

    } catch (err) {
        console.error('Lỗi truy cập camera:', err);
        const appStatusMessage = document.getElementById('appStatusMessage');
        if (appStatusMessage) appStatusMessage.textContent = "Lỗi camera!";
        alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
    }
}

// --- Filter Logic ---
function updateFilterPreviews() {
    if (!video || video.paused || video.ended || video.videoWidth === 0) {
        if (stream) setTimeout(updateFilterPreviews, 1000);
        return;
    }
    if (normalFilterPreviewImg) drawPreview(video, normalFilterPreviewImg, 'none');
    if (previewGrayscaleImg) drawPreview(video, previewGrayscaleImg, 'grayscale(100%)');
    if (stream && !video.paused && !video.ended) setTimeout(updateFilterPreviews, 1000);
}

function drawPreview(sourceVideo, imgElement, filterCSSText) {
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    cvs.width = imgElement.offsetWidth > 0 ? imgElement.offsetWidth : 60;
    cvs.height = imgElement.offsetHeight > 0 ? imgElement.offsetHeight : 45;
    try {
        ctx.filter = filterCSSText === 'none' ? 'none' : filterCSSText;
        ctx.drawImage(sourceVideo, 0, 0, sourceVideo.videoWidth, sourceVideo.videoHeight, 0, 0, cvs.width, cvs.height);
        ctx.filter = 'none';
        imgElement.src = cvs.toDataURL('image/jpeg', 0.8);
    } catch (e) { console.error("Lỗi vẽ preview filter:", filterCSSText, e); }
}

function getFilterCSSText(filterName) {
    return filterName === 'grayscale' ? 'grayscale(100%)' : 'none';
}

function applyFilterToVideo(filterName) {
    currentFilter = filterName;
    if (video) video.style.filter = getFilterCSSText(filterName);
    const normalOpt = document.querySelector('.filter-option[data-filter="none"]');
    if (normalOpt) normalOpt.classList.toggle('selected', filterName === 'none');
    if (grayscaleFilterStandalone) grayscaleFilterStandalone.classList.toggle('selected', filterName === 'grayscale');
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
            // MODIFIED: Use Pixelify Sans for placeholder number
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

    // MODIFIED: Use Pixelify Sans for fallback text
    liveCollagePreviewCtx.font = "bold 16px 'Pixelify Sans', Arial"; 
    liveCollagePreviewCtx.textAlign = "center";
    const message = photosInGalleryCount === 0 ? "No Preview Photo" : "Collage Preview";
    liveCollagePreviewCtx.fillText(message, canvasWidth / 2, canvasHeight / 2);
}


// --- Collage Mode Logic ---
function startCollageMode(totalPhotos, columns) {
    inCollageMode = true;
    collagePhotos = []; 
    currentCollageMode = { totalPhotos: parseInt(totalPhotos), columns: parseInt(columns), aspectRatio: 3/4 };
    updateCollageStatusDisplay();
    toggleCollageCaptureUI(true);
    updateGrid5Preview(); 
}

function cancelCurrentCollage() {
    inCollageMode = false;
    collagePhotos = [];
    toggleCollageCaptureUI(false);
    if (collageStatus) collageStatus.style.display = 'none';
    updateGrid5Preview(); 
}

function updateCollageStatusDisplay() {
    if (collageStatus) {
        collageStatus.textContent = `Ảnh ${collagePhotos.length + 1} trên ${currentCollageMode.totalPhotos}`;
        collageStatus.style.display = 'block';
    }
}

function toggleCollageCaptureUI(isCapturing) {
    const UIElementsToToggle = document.querySelectorAll(
        '#grid-item-photo-layout button, #grid-item-theme-color .theme-option, #grid-item-custom-background button, #customColorPickerButton'
    );
    if (isCapturing) {
        if (collageStatus) collageStatus.style.display = 'block';
        UIElementsToToggle.forEach(el => el.disabled = true);
        if(captureBtn) captureBtn.disabled = false;
        if(timerBtn) timerBtn.disabled = false;
    } else {
        if (collageStatus) collageStatus.style.display = 'none';
        UIElementsToToggle.forEach(el => el.disabled = false);
    }
}

// --- Photo Capture ---
function capturePhotoWithFlash(useTimer = false) {
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

function executeSnapshot() {
    if (flash) { flash.style.opacity = '0.9'; setTimeout(() => { flash.style.opacity = '0'; }, 120); }
    mainCtx.filter = getFilterCSSText(currentFilter);
    mainCtx.drawImage(video, 0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.filter = 'none';
    const imgDataUrl = mainCanvas.toDataURL('image/jpeg', 0.9);

    if (inCollageMode) {
        if (collagePhotos.length < currentCollageMode.totalPhotos) {
            collagePhotos.push(imgDataUrl);
            updateGrid5Preview(); 
            updateCollageStatusDisplay();

            if (collagePhotos.length === currentCollageMode.totalPhotos) {
                generateAndDisplayCollage();
            }
        }
    } else {
        addPhotoToGalleryDisplay(imgDataUrl); 
        photosInGalleryCount = photoGallery.children.length;
        if (photosInGalleryCount > 0) {
            if (downloadBtn) downloadBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
        }
    }
}

// --- Collage Generation ---
async function generateAndDisplayCollage() {
    const { totalPhotos, columns, aspectRatio } = currentCollageMode;
    let outputCanvasWidth, outputCanvasHeight;
    const textAreaHeight = 100; 

    if (userSelectedCustomBgImage && userSelectedCustomBgImage.complete) {
        outputCanvasWidth = userSelectedCustomBgImage.naturalWidth;
        outputCanvasHeight = userSelectedCustomBgImage.naturalHeight;
        collageOutputCanvas.width = outputCanvasWidth;
        collageOutputCanvas.height = outputCanvasHeight; 
        collageOutputCtx.drawImage(userSelectedCustomBgImage, 0, 0, outputCanvasWidth, outputCanvasHeight);
    } else {
        outputCanvasWidth = 800; 
        const tempRows = Math.ceil(totalPhotos / columns);
        const tempPhotoSlotWidth = outputCanvasWidth / columns; 
        const tempPhotoSlotHeight = tempPhotoSlotWidth / aspectRatio;
        outputCanvasHeight = tempPhotoSlotHeight * tempRows + textAreaHeight;

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
        if (photoSlotWidth * columns > photoGridAreaWidth) {
            photoSlotWidth = photoGridAreaWidth / columns;
            photoSlotHeight = photoSlotWidth / aspectRatio;
        }
    }
    
    const actualPhotoGridWidth = photoSlotWidth * columns;
    const actualPhotoGridHeight = photoSlotHeight * Math.ceil(totalPhotos / columns);

    const gridOffsetX = (photoGridAreaWidth - actualPhotoGridWidth) / 2;
    const gridOffsetY = (photoGridAreaHeight - actualPhotoGridHeight) / 2;
    
    const photoMargin = Math.min(photoSlotWidth, photoSlotHeight) * 0.05; 
    const photoBorderWidth = Math.min(photoSlotWidth, photoSlotHeight) * 0.03; 

    const imageLoadPromises = collagePhotos.map(dataUrl => new Promise((resolve, reject) => {
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

    const currentBgIsDark = userSelectedCustomBgImage ? false : (activeCollageColorTheme === 'pink' || activeCollageColorTheme === 'navy' || activeCollageColorTheme === 'green' || activeCollageColorTheme === 'coral' || activeCollageColorTheme === 'gold');
    const textColor = currentBgIsDark ? '#F6DCAC' : '#01204E';
    const textShadowColor = currentBgIsDark ? 'rgba(1, 32, 78, 0.7)' : 'rgba(250, 169, 104, 0.5)';
    
    collageOutputCtx.textAlign = 'center';
    collageOutputCtx.shadowColor = textShadowColor;
    collageOutputCtx.shadowBlur = 4; 

    const dateTextY = outputCanvasHeight - textAreaHeight + 40; 
    const titleTextY = outputCanvasHeight - textAreaHeight + 80;

    // MODIFIED: Use Pixelify Sans for text on generated collage
    collageOutputCtx.font = `bold ${Math.min(outputCanvasWidth * 0.03, outputCanvasHeight * 0.03, 28)}px 'Pixelify Sans', 'Dancing Script', cursive`; 
    collageOutputCtx.fillStyle = textColor;
    collageOutputCtx.fillText(new Date().toLocaleDateString(), outputCanvasWidth / 2, dateTextY);

    collageOutputCtx.font = `bold ${Math.min(outputCanvasWidth * 0.04, outputCanvasHeight * 0.04, 40)}px 'Pixelify Sans', 'Dancing Script', cursive`; 
    collageOutputCtx.fillStyle = textColor;
    collageOutputCtx.fillText("Silvia's Palette", outputCanvasWidth / 2, titleTextY);

    collageOutputCtx.shadowColor = 'transparent';
    collageOutputCtx.shadowBlur = 0;

    const finalCollageDataUrl = collageOutputCanvas.toDataURL('image/jpeg', 0.9);
    addPhotoToGalleryDisplay(finalCollageDataUrl); 

    photosInGalleryCount = photoGallery.children.length;
    if (photosInGalleryCount > 0) {
        if (downloadBtn) downloadBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
    }
    inCollageMode = false;
    toggleCollageCaptureUI(false);
    updateGrid5Preview();
}

// --- Theme and Color Logic ---
function getThemeColorValue(themeName) {
    if (themeName === 'custom' && themeColorPicker) return themeColorPicker.value;
    const themeColors = {
        'navy': '#01204E',   
        'pink': '#028391',   // Teal - Default
        'blue': '#F6DCAC',   
        'yellow': '#FAA968', 
        'purple': '#F85525', 
        'green': '#004c55',  
        'teal': '#f7803c',   
        'coral': '#7c2a12',  
        'silver': '#ccb089', 
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

    if (userSelectedCustomBgImage) {
        userSelectedCustomBgImage = null;
        if (customBgPreviewImage) customBgPreviewImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E"; 
        if (clearCustomBgBtn) clearCustomBgBtn.style.display = 'none';
    }
    updateGrid5Preview(); 
    console.log(`Chủ đề được đặt thành: ${activeCollageColorTheme}. Màu được áp dụng: ${appliedColor}`);
}

// --- Utility: Draw Image with Cover ---
function drawImageCover(ctx, img, x, y, w, h) {
    if (!ctx || !img || !img.complete || img.naturalWidth === 0 || w <= 0 || h <= 0) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = w / h;
    let sX = 0, sY = 0, sW = img.naturalWidth, sH = img.naturalHeight;
    if (imgRatio > containerRatio) {
        sW = img.naturalHeight * containerRatio;
        sX = (img.naturalWidth - sW) / 2;
    } else if (imgRatio < containerRatio) {
        sH = img.naturalWidth / containerRatio;
        sY = (img.naturalHeight - sH) / 2;
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
    imgEl.addEventListener('click', () => {
        const newTab = window.open();
        if (newTab) {
            newTab.document.body.innerHTML = `<img src="${imgDataUrl}" style="max-width: 100%; max-height: 100vh; margin: auto; display: block; background: #333;">`;
            newTab.document.title = "Xem trước ảnh";
        } else { alert('Vui lòng cho phép pop-up để xem ảnh.'); }
    });
    const deleteBtnEl = document.createElement('div');
    deleteBtnEl.className = 'delete-btn';
    deleteBtnEl.innerHTML = '×';
    deleteBtnEl.title = "Xóa ảnh này";
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
    photoContainer.appendChild(imgEl);
    photoContainer.appendChild(deleteBtnEl);
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
    } else if (galleryItems.length === 1) {
        alert('Ảnh đã được tải xuống. Kiểm tra thư mục tải xuống của bạn.');
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

    const normalFilterButton = document.querySelector('.filter-option[data-filter="none"]');
    if (normalFilterButton) normalFilterButton.addEventListener('click', () => applyFilterToVideo('none'));
    if (grayscaleFilterStandalone) grayscaleFilterStandalone.addEventListener('click', () => applyFilterToVideo('grayscale'));

    const collageLayoutButtonsConfig = {
        'start1x2': { photos: 2, cols: 1 }, 'start1x3': { photos: 3, cols: 1 },
        'start1x4': { photos: 4, cols: 1 }, 'start2x2': { photos: 4, cols: 2 },
        'start2x3': { photos: 6, cols: 2 },
    };
    for (const id in collageLayoutButtonsConfig) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (inCollageMode && (currentCollageMode.totalPhotos !== collageLayoutButtonsConfig[id].photos || currentCollageMode.columns !== collageLayoutButtonsConfig[id].columns)) {
                     if (confirm("Bạn muốn thay đổi layout collage hiện tại? Các ảnh đã chụp cho layout cũ sẽ bị xóa.")) {
                        cancelCurrentCollage(); 
                     } else {
                        return; 
                     }
                } else if (inCollageMode) {
                    return;
                }
                const mode = collageLayoutButtonsConfig[id];
                startCollageMode(mode.photos, mode.cols);
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
            setActiveCollageTheme('pink'); 
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
        resizeObserver.observe(liveCollagePreviewCanvas);
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
