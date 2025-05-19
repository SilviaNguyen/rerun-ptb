// index.js with fixes and improvements

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const timerBtn = document.getElementById('timerBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const photoGallery = document.getElementById('photoGallery');
const flash = document.getElementById('flash');
const filterOptions = document.querySelectorAll('.filter-option');
const countdown = document.getElementById('countdown');
const collageCanvas = document.createElement('canvas');
const collageCtx = collageCanvas.getContext('2d');
const collageStatus = document.getElementById('collageStatus');

// Global variables
let stream = null;
let currentFilter = 'none';
let photosTaken = 0;
let collagePhotos = [];
let currentCollageMode = {
    totalPhotos: 4,
    columns: 2,
    aspectRatio: 3/4 // Portrait orientation typical for photobooth strips
};
let inCollageMode = false;
let collageColorTheme = 'pink'; // Default theme
const ctx = canvas.getContext('2d');

// Initialize the application
async function init() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;

        // Wait for video to be ready
        video.onloadedmetadata = () => {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Update filter previews once video is loaded
            updateFilterPreviews();
        };

        // Initialize themes - make sure default is selected
        document.querySelector('.theme-option[data-theme="pink"]').classList.add('selected');

    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Could not access camera. Please ensure you have granted camera permissions.');
    }
}

// Update filter preview thumbnails
function updateFilterPreviews() {
    const filters = ['none', 'grayscale', 'sepia', 'invert'];

    filters.forEach(filter => {
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');

        previewCanvas.width = 80;
        previewCanvas.height = 60;

        // Draw video frame to preview canvas
        previewCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
                              0, 0, previewCanvas.width, previewCanvas.height);

        // Apply filter
        if (filter !== 'none') {
            previewCtx.globalCompositeOperation = 'source-over';
            previewCtx.filter = getFilterString(filter);
            previewCtx.drawImage(previewCanvas, 0, 0);
            previewCtx.filter = 'none';
        }

        // Update preview image
        const previewImg = document.getElementById(`preview-${filter}`);
        if (previewImg) { // Check if element exists
            previewImg.src = previewCanvas.toDataURL('image/jpeg');
        }
    });

    // Update previews every second
    setTimeout(updateFilterPreviews, 1000);
}

// Get CSS filter string based on selected filter
function getFilterString(filter) {
    switch(filter) {
        case 'grayscale': return 'grayscale(100%)';
        case 'sepia': return 'sepia(100%)';
        case 'invert': return 'invert(100%)';
        default: return 'none';
    }
}

// Start collage mode
function startCollageMode(totalPhotos, columns) {
    inCollageMode = true;
    collagePhotos = [];

    currentCollageMode = {
        totalPhotos: parseInt(totalPhotos),
        columns: parseInt(columns),
        aspectRatio: 3/4 // Portrait orientation typical for photobooth strips
    };

    // Show collage progress status
    updateCollageStatus();

    // Disable normal photo taking buttons while in collage mode
    toggleCollageMode(true);

    // Add a temporary capture button for collage mode
    addCollageControls();
}

// Add temporary controls for collage capture
function addCollageControls() {
    // Create a container for the collage capture controls
    const collageControlsContainer = document.createElement('div');
    collageControlsContainer.id = 'temporaryCollageControls';
    collageControlsContainer.style.display = 'flex';
    collageControlsContainer.style.justifyContent = 'center';
    collageControlsContainer.style.marginTop = '10px';
    collageControlsContainer.style.gap = '10px';

    // Create capture button
    const collageCaptureBtn = document.createElement('button');
    collageCaptureBtn.textContent = 'Take Photo';
    collageCaptureBtn.addEventListener('click', () => capturePhoto(false));

    // Create timer button
    const collageTimerBtn = document.createElement('button');
    collageTimerBtn.textContent = '3s Timer';
    collageTimerBtn.addEventListener('click', () => capturePhoto(true));

    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel Collage';
    cancelBtn.style.backgroundColor = '#ff4b4b';
    cancelBtn.addEventListener('click', cancelCollage);

    // Add buttons to container
    collageControlsContainer.appendChild(collageCaptureBtn);
    collageControlsContainer.appendChild(collageTimerBtn);
    collageControlsContainer.appendChild(cancelBtn);

    // Add container after the collage status
    if (collageStatus && collageStatus.parentNode) { // Check if collageStatus exists
        collageStatus.parentNode.insertBefore(collageControlsContainer, collageStatus.nextSibling);
    }
}

// Cancel collage mode
function cancelCollage() {
    inCollageMode = false;
    collagePhotos = [];
    toggleCollageMode(false);

    // Remove temporary controls
    const tempControls = document.getElementById('temporaryCollageControls');
    if (tempControls) {
        tempControls.remove();
    }
}

// Update collage status display
function updateCollageStatus() {
    if (collageStatus) { // Check if collageStatus exists
        collageStatus.textContent = `Taking photo ${collagePhotos.length + 1} of ${currentCollageMode.totalPhotos}`;
        collageStatus.style.display = 'block';
    }
}

// Toggle elements based on collage mode
function toggleCollageMode(isCollageMode) {
    const collageControls = document.getElementById('collageControls');
    const normalControls = document.getElementById('normalControls');

    // Remove any existing temporary controls
    const tempControls = document.getElementById('temporaryCollageControls');
    if (tempControls) {
        tempControls.remove();
    }

    if (isCollageMode) {
        if (collageControls) collageControls.style.display = 'none';
        if (normalControls) normalControls.style.display = 'none';
        if (collageStatus) collageStatus.style.display = 'block';
    } else {
        if (collageControls) collageControls.style.display = 'block'; // Or 'flex' if it's a flex container
        if (normalControls) normalControls.style.display = 'flex';
        if (collageStatus) collageStatus.style.display = 'none';
    }
}

// Capture photo with or without timer
function capturePhoto(useTimer = false) {
    if (useTimer) {
        let count = 3;
        if (countdown) { // Check if countdown element exists
            countdown.textContent = count;
            countdown.style.display = 'block';
        }

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                if (countdown) countdown.textContent = count;
            } else {
                clearInterval(countdownInterval);
                if (countdown) countdown.style.display = 'none';
                takeSnapshot();
            }
        }, 1000);
    } else {
        takeSnapshot();
    }
}

// Take the actual snapshot
function takeSnapshot() {
    // Create flash effect
    if (flash) { // Check if flash element exists
       flash.style.opacity = '0.8';
        setTimeout(() => {
            flash.style.opacity = '0';
        }, 100);
    }

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    // Apply selected filter
    if (currentFilter !== 'none') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = getFilterString(currentFilter);
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none'; // Reset filter on main canvas
    }

    // Convert to image data URL
    const imgDataUrl = canvas.toDataURL('image/jpeg');

    if (inCollageMode) {
        // Add to collage collection
        addPhotoToCollage(imgDataUrl);
    } else {
        // Add to regular gallery
        addPhotoToGallery(imgDataUrl);

        // Enable download and clear buttons if this is the first photo
        if (photosTaken === 1) {
            if (downloadBtn) downloadBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
        }
    }
}

// Add photo to collage collection
function addPhotoToCollage(imgDataUrl) {
    collagePhotos.push(imgDataUrl);

    if (collagePhotos.length < currentCollageMode.totalPhotos) {
        // More photos needed for collage
        updateCollageStatus();
    } else {
        // Collage complete, generate it
        generateCollage();

        // Exit collage mode
        inCollageMode = false;
        toggleCollageMode(false);
    }
}

// Generate the final collage
function generateCollage() {
    const { totalPhotos, columns, aspectRatio } = currentCollageMode;
    const rows = Math.ceil(totalPhotos / columns);

    // Set collage dimensions (width based on 800px total width)
    const colWidth = 800 / columns;
    const colHeight = colWidth / aspectRatio;

    collageCanvas.width = 800;
    // *** MODIFICATION: Reduced extra height from 120 to 100 for a tighter fit ***
    collageCanvas.height = colHeight * rows + 100; // Extra space for borders and decoration

    // Fill with background color based on theme
    collageCtx.fillStyle = getThemeColor(collageColorTheme);
    collageCtx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);

    // Add decorative elements (hearts, stars, etc.) based on theme
    addDecorativeElements(collageCtx, collageColorTheme, collageCanvas.width, collageCanvas.height);

    // Draw photos in grid layout
    const photoMargin = 8; // Reduced margin from 10
    const photoWidth = colWidth - (photoMargin * 2);
    const photoHeight = colHeight - (photoMargin * 2);

    // Load all images first
    const imagePromises = collagePhotos.map(src => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    });

    Promise.all(imagePromises).then(images => {
        images.forEach((img, index) => {
            if (index >= totalPhotos) return; // Skip if we have more photos than needed

            const row = Math.floor(index / columns);
            const col = index % columns;
            const x = col * colWidth + photoMargin;
            const y = row * colHeight + photoMargin;

            // Draw white border
            collageCtx.fillStyle = '#FFFFFF';
            collageCtx.fillRect(x, y, photoWidth, photoHeight);

            // Draw photo with a smaller border inside the white border
            const borderWidth = 3; // Reduced border from 5
            // *** MODIFICATION: Calling drawImageCover instead of drawImageProp ***
            drawImageCover(
                collageCtx,
                img,
                x + borderWidth,
                y + borderWidth,
                photoWidth - borderWidth * 2,
                photoHeight - borderWidth * 2
            );
        });

        // Add date at the bottom
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        collageCtx.fillStyle = '#FFFFFF'; // Ensure text color is visible on themes
        collageCtx.font = 'bold 16px Arial'; // Slightly smaller font
        collageCtx.textAlign = 'center';
        collageCtx.fillText(dateStr, collageCanvas.width / 2, collageCanvas.height - 25); // Adjusted Y position

        // Add app name at the bottom
        collageCtx.fillStyle = '#FFFFFF'; // Ensure text color is visible on themes
        collageCtx.font = 'bold 18px Arial'; // Slightly smaller font
        collageCtx.textAlign = 'center';
        collageCtx.fillText("Silvia's Palette", collageCanvas.width / 2, collageCanvas.height - 50); // Adjusted Y position

        // Convert to image data URL and add to gallery
        const collageDataUrl = collageCanvas.toDataURL('image/jpeg');
        addPhotoToGallery(collageDataUrl);
    });
}


// Get theme background color
function getThemeColor(theme) {
    const themeColors = {
        'pink': '#FFC0CB',
        'blue': '#ADD8E6',
        'yellow': '#FFFACD',
        'purple': '#E6E6FA',
        'green': '#90EE90'
    };
    return themeColors[theme] || themeColors.pink;
}

// Add decorative elements based on theme
function addDecorativeElements(ctx, theme, width, height) {
    // Different decoration styles per theme
    switch(theme) {
        case 'pink':
            addHeartDecorations(ctx, width, height);
            break;
        case 'blue':
            addStarDecorations(ctx, width, height);
            break;
        case 'yellow':
            addSunDecorations(ctx, width, height);
            break;
        case 'purple':
            addFlowerDecorations(ctx, width, height);
            break;
        case 'green':
            addLeafDecorations(ctx, width, height);
            break;
        default:
            addHeartDecorations(ctx, width, height);
    }
}

// Heart decorations for pink theme
function addHeartDecorations(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF'; // Keep decorations white for contrast
    for (let i = 0; i < 15; i++) { // Reduced number of decorations
        const x = Math.random() * width;
        const y = Math.random() * 40; // Top area, slightly smaller
        drawHeart(ctx, x, y, 12); // Slightly smaller hearts

        const x2 = Math.random() * width;
        const y2 = height - (Math.random() * 40) - 70; // Bottom area, above text
        drawHeart(ctx, x2, y2, 12);
    }
}

// Star decorations for blue theme
function addStarDecorations(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 40;
        drawStar(ctx, x, y, 5, 8, 4); // Smaller stars

        const x2 = Math.random() * width;
        const y2 = height - (Math.random() * 40) - 70;
        drawStar(ctx, x2, y2, 5, 8, 4);
    }
}

// Sun decorations for yellow theme
function addSunDecorations(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 10; i++) { // Fewer suns
        const x = Math.random() * width;
        const y = Math.random() * 40;
        drawSun(ctx, x, y, 10); // Smaller suns

        const x2 = Math.random() * width;
        const y2 = height - (Math.random() * 40) - 70;
        drawSun(ctx, x2, y2, 10);
    }
}

// Flower decorations for purple theme
function addFlowerDecorations(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF'; // Petal color
    const centerColor = getThemeColor('purple'); // Center color matching theme for contrast
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 40;
        drawFlower(ctx, x, y, 8, centerColor); // Smaller flowers

        const x2 = Math.random() * width;
        const y2 = height - (Math.random() * 40) - 70;
        drawFlower(ctx, x2, y2, 8, centerColor);
    }
}

// Leaf decorations for green theme
function addLeafDecorations(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF'; // Leaf color
    const veinColor = getThemeColor('green'); // Vein color matching theme for contrast
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 40;
        drawLeaf(ctx, x, y, 12, veinColor); // Smaller leaves

        const x2 = Math.random() * width;
        const y2 = height - (Math.random() * 40) - 70;
        drawLeaf(ctx, x2, y2, 12, veinColor);
    }
}


// Draw a heart shape
function drawHeart(ctx, x, y, size) {
    ctx.save();
    // ctx.fillStyle = '#FFFFFF'; // Already set in addHeartDecorations

    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(
        x, y,
        x - size / 2, y,
        x - size / 2, y + size / 4
    );
    ctx.bezierCurveTo(
        x - size / 2, y + size / 2,
        x, y + size * 3/4,
        x, y + size
    );
    ctx.bezierCurveTo(
        x, y + size * 3/4,
        x + size / 2, y + size / 2,
        x + size / 2, y + size / 4
    );
    ctx.bezierCurveTo(
        x + size / 2, y,
        x, y,
        x, y + size / 4
    );
    ctx.fill();
    ctx.restore();
}

// Draw a star shape
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;
    // ctx.fillStyle = '#FFFFFF'; // Already set in addStarDecorations

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

// Draw a sun shape
function drawSun(ctx, x, y, size) {
    ctx.save();
    // ctx.fillStyle = '#FFFFFF'; // Already set in addSunDecorations

    // Draw the main circle
    ctx.beginPath();
    ctx.arc(x, y, size/2, 0, Math.PI * 2);
    ctx.fill();

    // Draw the rays
    ctx.strokeStyle = '#FFFFFF'; // Rays color
    ctx.lineWidth = size/4;
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const rayStartX = x + Math.cos(angle) * (size/2 + 2); // Start rays slightly outside the circle
        const rayStartY = y + Math.sin(angle) * (size/2 + 2);
        const rayEndX = x + Math.cos(angle) * (size * 0.8); // Shorter rays
        const rayEndY = y + Math.sin(angle) * (size * 0.8);

        ctx.beginPath();
        ctx.moveTo(rayStartX, rayStartY);
        ctx.lineTo(rayEndX, rayEndY);
        ctx.stroke();
    }
    ctx.restore();
}

// Draw a flower shape
function drawFlower(ctx, x, y, size, centerColor) {
    ctx.save();
    // ctx.fillStyle = '#FFFFFF'; // Petal color, already set in addFlowerDecorations

    // Draw petals
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const petalX = x + Math.cos(angle) * (size * 0.6); // Petals offset from center
        const petalY = y + Math.sin(angle) * (size * 0.6);

        ctx.beginPath();
        ctx.arc(petalX, petalY, size/2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw center
    ctx.beginPath();
    ctx.arc(x, y, size/2.5, 0, Math.PI * 2); // Smaller center
    ctx.fillStyle = centerColor; // Use provided center color
    ctx.fill();

    ctx.restore();
}

// Draw a leaf shape
function drawLeaf(ctx, x, y, size, veinColor) {
    ctx.save();
    // ctx.fillStyle = '#FFFFFF'; // Leaf color, set in addLeafDecorations

    ctx.beginPath();
    ctx.moveTo(x, y);

    // Draw the leaf shape using bezier curves
    ctx.quadraticCurveTo(
        x + size * 0.8, y - size * 0.7, // Adjusted control points for shape
        x + size, y
    );
    ctx.quadraticCurveTo(
        x + size * 0.8, y + size * 0.7, // Adjusted control points for shape
        x, y
    );
    ctx.fill();

    // Draw the center vein
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size * 0.7, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = veinColor; // Use provided vein color
    ctx.stroke();

    ctx.restore();
}


// *** NEW FUNCTION: drawImageCover to fill by cropping ***
function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const containerRatio = w / h;
    let sX = 0, sY = 0, sW = img.width, sH = img.height;

    if (imgRatio > containerRatio) { // Image is wider than container slot
        sW = img.height * containerRatio;
        sX = (img.width - sW) / 2;
    } else if (imgRatio < containerRatio) { // Image is taller than container slot
        sH = img.width / containerRatio;
        sY = (img.height - sH) / 2;
    }
    ctx.drawImage(img, sX, sY, sW, sH, x, y, w, h);
}


// Add captured photo to gallery
function addPhotoToGallery(imgDataUrl) {
    photosTaken++;

    const photoContainer = document.createElement('div');
    photoContainer.className = 'photo-container';

    const img = document.createElement('img');
    img.src = imgDataUrl;
    img.className = 'captured-photo';
    img.setAttribute('data-index', photosTaken); // Keep this if used elsewhere
    img.addEventListener('click', () => {
        // Open full size image in new tab/window
        const newTab = window.open();
        if (newTab) {
            newTab.document.body.innerHTML = `<img src="${imgDataUrl}" style="max-width: 100%; max-height: 100vh; margin: auto; display: block;">`;
        } else {
            alert('Please allow pop-ups for this site to view the image.');
        }
    });

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click on image when deleting
        photoContainer.remove();
        photosTaken--;

        // Update local storage if you implement it
        // updateStoredPhotos(); // Example if you add this

        if (photosTaken === 0) {
            if (downloadBtn) downloadBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;
        }
    });

    photoContainer.appendChild(img);
    photoContainer.appendChild(deleteBtn);

    if (photoGallery) { // Check if photoGallery exists
        photoGallery.appendChild(photoContainer);
    }


    // Enable download and clear buttons
    if (downloadBtn) downloadBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

// Download all photos as a ZIP file
async function downloadAllPhotos() {
    const photos = document.querySelectorAll('.captured-photo');

    if (photos.length === 0) {
        alert('No photos to download.');
        return;
    }

    if (photos.length === 1) {
        // If only one photo, download it directly
        const link = document.createElement('a');
        link.href = photos[0].src;
        link.download = `silvia_palette_${new Date().getTime()}.jpg`;
        link.click();
    } else if (photos.length > 1) {
        // For multiple photos, you'd typically use a library like JSZip.
        // For now, this will download them individually or prompt the user.
        alert('Multiple photos detected. This function currently downloads the first photo. To download all as a zip, a ZIP library would be needed.');
        // Fallback to downloading the first one for now or implement JSZip
        const link = document.createElement('a');
        link.href = photos[0].src; // Or iterate and download all, which might be blocked by browser
        link.download = `silvia_palette_photo_${new Date().getTime()}.jpg`;
        link.click();

        // Example JSZip (requires including the library):
        /*
        if (typeof JSZip === 'undefined') {
            alert('JSZip library is not loaded. Cannot create a zip file.');
            return;
        }
        try {
            const zip = new JSZip();
            Array.from(photos).forEach((photo, index) => {
                const imgData = photo.src.split(',')[1];
                zip.file(`photo_${index + 1}.jpg`, imgData, {base64: true});
            });
            zip.generateAsync({type: 'blob'}).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `silvia_palette_all_${new Date().getTime()}.zip`;
                link.click();
                URL.revokeObjectURL(link.href); // Clean up
            });
        } catch (error) {
            console.error('Error creating zip file:', error);
            alert('There was an error creating the zip file.');
        }
        */
    }
}

// Clear all photos
function clearAllPhotos() {
    if (confirm('Are you sure you want to clear all photos?')) {
        if (photoGallery) photoGallery.innerHTML = '';
        photosTaken = 0;
        if (downloadBtn) downloadBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
        // updateStoredPhotos(); // Example if you add local storage
    }
}

// Change collage color theme
function changeCollageTheme(theme) {
    collageColorTheme = theme; // This updates the global variable for the next collage

    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.theme === theme);
    });

    console.log(`Theme changed to: ${theme}. This will apply to the next collage generated.`);
}

// Check if the camera is available
function checkCameraAvailability() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera access is not supported by your browser. Please try using Chrome, Firefox, or Edge.');
        return false;
    }
    return true;
}

// Event Listeners (ensure elements exist before adding listeners)
if (captureBtn) captureBtn.addEventListener('click', () => capturePhoto(false));
if (timerBtn) timerBtn.addEventListener('click', () => capturePhoto(true));
if (downloadBtn) downloadBtn.addEventListener('click', downloadAllPhotos);
if (clearBtn) clearBtn.addEventListener('click', clearAllPhotos);

// Filter selection event listeners
filterOptions.forEach(option => {
    option.addEventListener('click', () => {
        filterOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        currentFilter = option.getAttribute('data-filter');
        video.style.filter = getFilterString(currentFilter);
    });
});

// Collage button event listeners
const start1x2Btn = document.getElementById('start1x2');
const start1x3Btn = document.getElementById('start1x3');
const start1x4Btn = document.getElementById('start1x4');
const start2x2Btn = document.getElementById('start2x2');
const start2x3Btn = document.getElementById('start2x3');

if (start1x2Btn) start1x2Btn.addEventListener('click', () => startCollageMode(2, 1));
if (start1x3Btn) start1x3Btn.addEventListener('click', () => startCollageMode(3, 1));
if (start1x4Btn) start1x4Btn.addEventListener('click', () => startCollageMode(4, 1));
if (start2x2Btn) start2x2Btn.addEventListener('click', () => startCollageMode(4, 2));
if (start2x3Btn) start2x3Btn.addEventListener('click', () => startCollageMode(6, 2));


// Theme button event listeners
document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
        changeCollageTheme(option.dataset.theme);
    });
});

// Check camera availability before initializing
if (checkCameraAvailability()) {
    init();
}