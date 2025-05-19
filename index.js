// index.js with collage functionality fixed

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
        previewImg.src = previewCanvas.toDataURL('image/jpeg');
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
    collageStatus.parentNode.insertBefore(collageControlsContainer, collageStatus.nextSibling);
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
    collageStatus.textContent = `Taking photo ${collagePhotos.length + 1} of ${currentCollageMode.totalPhotos}`;
    collageStatus.style.display = 'block';
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
        collageControls.style.display = 'none';
        normalControls.style.display = 'none';
        collageStatus.style.display = 'block';
    } else {
        collageControls.style.display = 'block';
        normalControls.style.display = 'flex';
        collageStatus.style.display = 'none';
    }
}

// Capture photo with or without timer
function capturePhoto(useTimer = false) {
    if (useTimer) {
        let count = 3;
        countdown.textContent = count;
        countdown.style.display = 'block';
        
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdown.textContent = count;
            } else {
                clearInterval(countdownInterval);
                countdown.style.display = 'none';
                takeSnapshot();
            }
        }, 1000);
    } else {
        takeSnapshot();
    }
}

// Take the actual snapshot
function takeSnapshot() {
    // Play camera shutter sound (could be added)
    
    // Create flash effect
    flash.style.opacity = '0.8';
    setTimeout(() => {
        flash.style.opacity = '0';
    }, 100);
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    
    // Apply selected filter
    if (currentFilter !== 'none') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = getFilterString(currentFilter);
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
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
            downloadBtn.disabled = false;
            clearBtn.disabled = false;
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
    collageCanvas.height = colHeight * rows + 120; // Extra space for borders and decoration
    
    // Fill with background color based on theme
    collageCtx.fillStyle = getThemeColor(collageColorTheme);
    collageCtx.fillRect(0, 0, collageCanvas.width, collageCanvas.height);
    
    // Add decorative elements (hearts, stars, etc.) based on theme
    addDecorativeElements(collageCtx, collageColorTheme, collageCanvas.width, collageCanvas.height);
    
    // Draw photos in grid layout
    const photoWidth = colWidth - 20; // Padding
    const photoHeight = colHeight - 20; // Padding
    
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
            const x = col * colWidth + 10; // 10px margin
            const y = row * colHeight + 10; // 10px margin
            
            // Draw white border
            collageCtx.fillStyle = '#FFFFFF';
            collageCtx.fillRect(x, y, photoWidth, photoHeight);
            
            // Draw photo with 5px inside the white border
            const borderWidth = 5;
            drawImageProp(
                collageCtx, 
                img, 
                x + borderWidth, 
                y + borderWidth, 
                photoWidth - borderWidth*2, 
                photoHeight - borderWidth*2
            );
        });
        
        // Add date at the bottom
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        collageCtx.fillStyle = '#FFFFFF';
        collageCtx.font = '18px Arial';
        collageCtx.textAlign = 'center';
        collageCtx.fillText(dateStr, collageCanvas.width / 2, collageCanvas.height - 30);
        
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
    // Add simple decorations based on theme
    ctx.fillStyle = '#FFFFFF';
    
    // Add some dots/hearts around the border
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 50; // Top area
        
        if (theme === 'pink') {
            drawHeart(ctx, x, y, 10);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        const x2 = Math.random() * width;
        const y2 = height - Math.random() * 50; // Bottom area
        
        if (theme === 'pink') {
            drawHeart(ctx, x2, y2, 10);
        } else {
            ctx.beginPath();
            ctx.arc(x2, y2, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Draw a heart shape
function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    
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

// Utility function to draw image proportionally
function drawImageProp(ctx, img, x, y, w, h) {
    // Calculate dimensions to maintain aspect ratio
    const imgRatio = img.width / img.height;
    const containerRatio = w / h;
    
    let newW, newH, offsetX, offsetY;
    
    if (containerRatio > imgRatio) {
        // Container is wider than image
        newW = h * imgRatio;
        newH = h;
        offsetX = (w - newW) / 2;
        offsetY = 0;
    } else {
        // Container is taller than image
        newW = w;
        newH = w / imgRatio;
        offsetX = 0;
        offsetY = (h - newH) / 2;
    }
    
    ctx.drawImage(img, x + offsetX, y + offsetY, newW, newH);
}

// Add captured photo to gallery
function addPhotoToGallery(imgDataUrl) {
    photosTaken++;
    
    const photoContainer = document.createElement('div');
    photoContainer.className = 'photo-container';
    
    const img = document.createElement('img');
    img.src = imgDataUrl;
    img.className = 'captured-photo';
    img.setAttribute('data-index', photosTaken);
    img.addEventListener('click', () => {
        // Open full size image in new tab/window
        const newTab = window.open();
        newTab.document.body.innerHTML = `<img src="${imgDataUrl}" style="max-width: 100%;">`;
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        photoContainer.remove();
        photosTaken--;
        
        if (photosTaken === 0) {
            downloadBtn.disabled = true;
            clearBtn.disabled = true;
        }
    });
    
    photoContainer.appendChild(img);
    photoContainer.appendChild(deleteBtn);
    
    photoGallery.appendChild(photoContainer);
    
    // Enable download and clear buttons
    downloadBtn.disabled = false;
    clearBtn.disabled = false;
}

// Download all photos as a ZIP file
function downloadAllPhotos() {
    // Since we're not using an external library like JSZip in this example,
    // we'll download the first image directly and recommend a proper solution
    const photos = document.querySelectorAll('.captured-photo');
    
    if (photos.length > 0) {
        const link = document.createElement('a');
        link.href = photos[0].src;
        link.download = `photobooth_${new Date().getTime()}.jpg`;
        link.click();
        
        if (photos.length > 1) {
            alert('Note: For downloading multiple photos at once, a ZIP library like JSZip would be needed. This example only downloads the first photo.');
        }
    }
}

// Clear all photos
function clearAllPhotos() {
    if (confirm('Are you sure you want to clear all photos?')) {
        photoGallery.innerHTML = '';
        photosTaken = 0;
        downloadBtn.disabled = true;
        clearBtn.disabled = true;
    }
}

// Change collage color theme
function changeCollageTheme(theme) {
    collageColorTheme = theme;
    // Update theme selection UI (selected state)
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.theme === theme);
    });
}

// Event Listeners
captureBtn.addEventListener('click', () => capturePhoto(false));
timerBtn.addEventListener('click', () => capturePhoto(true));
downloadBtn.addEventListener('click', downloadAllPhotos);
clearBtn.addEventListener('click', clearAllPhotos);

// Filter selection event listeners
filterOptions.forEach(option => {
    option.addEventListener('click', () => {
        // Remove selected class from all options
        filterOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Update current filter
        currentFilter = option.getAttribute('data-filter');
        
        // Apply filter to video preview (visual feedback only)
        video.style.filter = getFilterString(currentFilter);
    });
});

// Collage button event listeners
document.getElementById('start1x2').addEventListener('click', () => startCollageMode(2, 1));
document.getElementById('start1x3').addEventListener('click', () => startCollageMode(3, 1));
document.getElementById('start1x4').addEventListener('click', () => startCollageMode(4, 1));
document.getElementById('start2x2').addEventListener('click', () => startCollageMode(4, 2));
document.getElementById('start2x3').addEventListener('click', () => startCollageMode(6, 2));

// Theme button event listeners
document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
        changeCollageTheme(option.dataset.theme);
    });
});

// Initialize the app
init();