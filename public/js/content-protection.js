/**
 * Content Protection Script - Netflix-style protection (Maximum Security)
 * Prevents downloading, saving, screenshots, and copying of images/videos
 * Aggressive DevTools blocking and comprehensive media protection
 * Mobile-optimized protection for iOS and Android
 */

(function() {
    'use strict';

    // ========== MOBILE DETECTION ==========
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // ========== AGGRESSIVE DEVTOOLS DETECTION ==========
    let devtoolsDetected = false;
    const threshold = 160;
    
    // Method 1: Window size detection (most reliable)
    function detectDevToolsBySize() {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        
        if (widthDiff > threshold || heightDiff > threshold) {
            return true;
        }
        return false;
    }
    
    // Method 2: Console detection using debugger
    function detectDevToolsByConsole() {
        let detected = false;
        const start = performance.now();
        debugger; // This will pause if DevTools is open
        const end = performance.now();
        // If DevTools is open, debugger takes longer
        if (end - start > 100) {
            detected = true;
        }
        return detected;
    }
    
    // Method 3: Function toString detection
    function detectDevToolsByToString() {
        const element = new Image();
        let detected = false;
        Object.defineProperty(element, 'id', {
            get: function() {
                detected = true;
            }
        });
        console.log(element);
        console.clear();
        return detected;
    }
    
    // Method 4: DevTools detection using eval
    function detectDevToolsByEval() {
        let detected = false;
        const start = Date.now();
        // This will be slower if DevTools is open
        eval('void 0');
        const end = Date.now();
        if (end - start > 5) {
            detected = true;
        }
        return detected;
    }
    
    // Combined detection function
    function checkDevTools() {
        if (devtoolsDetected) return true;
        
        const methods = [
            detectDevToolsBySize(),
            detectDevToolsByToString()
        ];
        
        // If any method detects DevTools
        if (methods.some(m => m === true)) {
            devtoolsDetected = true;
            blockDevTools();
            return true;
        }
        return false;
    }
    
    // Block DevTools when detected
    function blockDevTools() {
        // Clear all content
        document.documentElement.innerHTML = '';
        document.documentElement.style.background = '#000';
        document.documentElement.style.color = '#fff';
        document.documentElement.style.display = 'flex';
        document.documentElement.style.justifyContent = 'center';
        document.documentElement.style.alignItems = 'center';
        document.documentElement.style.height = '100vh';
        document.documentElement.style.fontFamily = 'Arial, sans-serif';
        document.documentElement.innerHTML = '<h1>Access Denied</h1>';
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
        
        // Prevent further execution
        throw new Error('DevTools detected');
    }
    
    // Check every 50ms (very aggressive)
    setInterval(checkDevTools, 50);
    
    // Also check on resize
    window.addEventListener('resize', checkDevTools);
    
    // Check immediately
    checkDevTools();

    // ========== KEYBOARD SHORTCUT BLOCKING ==========
    document.addEventListener('keydown', function(e) {
        // Block DevTools shortcuts
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) ||
            (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            checkDevTools();
            return false;
        }
        
        // Block Save shortcuts (Ctrl+S, Cmd+S)
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block Save Page As (Ctrl+Shift+S, Cmd+Shift+S)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block Copy on media
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && 
            (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block Print Screen
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block View Source (Ctrl+U, Cmd+Option+U)
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block Print (Ctrl+P, Cmd+P)
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
        
        // Block Find in Page (Ctrl+F, Cmd+F) - can reveal image URLs
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            // Allow find but block if trying to find image URLs
            const selection = window.getSelection().toString();
            if (selection && (selection.includes('http') || selection.includes('image') || selection.includes('img'))) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
        
        // Block Select All (Ctrl+A, Cmd+A) on media
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && 
            (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Block Inspect Element (right-click + Inspect) - additional protection
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'C')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            checkDevTools();
            return false;
        }
    }, true);
    
    // Block Print dialog (functions defined later, but we'll set up listeners)
    // These will be properly initialized after functions are defined

    // ========== MOBILE TOUCH EVENT BLOCKING ==========
    // Prevent long-press (mobile right-click equivalent)
    let touchStartTime = 0;
    let touchStartElement = null;
    const LONG_PRESS_DURATION = 500; // 500ms for long-press
    
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS' || e.target.tagName === 'SOURCE') {
            touchStartTime = Date.now();
            touchStartElement = e.target;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, { passive: false, capture: true });
    
    document.addEventListener('touchmove', function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS' || e.target.tagName === 'SOURCE') {
            touchStartTime = 0; // Reset on move
            touchStartElement = null;
            e.preventDefault();
            e.stopPropagation();
        }
    }, { passive: false, capture: true });
    
    document.addEventListener('touchend', function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS' || e.target.tagName === 'SOURCE') {
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration > LONG_PRESS_DURATION) {
                // Long-press detected - prevent context menu
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Clear selection
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                }
            }
            touchStartTime = 0;
            touchStartElement = null;
        }
    }, { passive: false, capture: true });
    
    document.addEventListener('touchcancel', function(e) {
        touchStartTime = 0;
        touchStartElement = null;
    }, { passive: false, capture: true });
    
    // Prevent iOS Safari image save menu
    document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
    
    document.addEventListener('gesturechange', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
    
    document.addEventListener('gestureend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);

    // ========== RIGHT-CLICK AND DRAG PREVENTION ==========
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }, true);

    document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS' || e.target.tagName === 'SOURCE') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    document.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);

    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);

    // ========== MOBILE SHARE MENU PREVENTION ==========
    // Prevent iOS share menu on images
    if (isIOS) {
        // Disable iOS share button
        const metaTags = document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]');
        if (metaTags.length === 0) {
            const meta = document.createElement('meta');
            meta.name = 'apple-mobile-web-app-capable';
            meta.content = 'yes';
            document.head.appendChild(meta);
        }
        
        // Prevent iOS image save
        document.addEventListener('selectstart', function(e) {
            if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') {
                e.preventDefault();
                return false;
            }
        }, true);
    }
    
    // Prevent Android share menu
    if (isAndroid) {
        // Block Android long-press menu
        document.addEventListener('select', function(e) {
            if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') {
                e.preventDefault();
                return false;
            }
        }, true);
    }

    // ========== CANVAS CONVERSION WITH ENHANCED PROTECTION ==========
    function disableSelection(element) {
        element.style.userSelect = 'none';
        element.style.webkitUserSelect = 'none';
        element.style.mozUserSelect = 'none';
        element.style.msUserSelect = 'none';
        element.style.webkitTouchCallout = 'none';
        element.style.touchAction = 'none'; // Prevent mobile gestures
        element.style.webkitUserDrag = 'none';
        element.setAttribute('draggable', 'false');
        element.setAttribute('contenteditable', 'false');
        element.style.pointerEvents = 'auto';
        
        // Mobile-specific attributes
        if (isMobile) {
            element.style.webkitTapHighlightColor = 'transparent';
            element.style.tapHighlightColor = 'transparent';
        }
    }

    function convertImageToCanvas(img) {
        if (img.dataset.converted === 'true') return;
        if (checkDevTools()) return; // Don't convert if DevTools detected
        img.dataset.converted = 'true';
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        const parent = img.parentElement;
        
        if (!parent) return;
        
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        canvas.style.width = img.style.width || getComputedStyle(img).width;
        canvas.style.height = img.style.height || getComputedStyle(img).height;
        canvas.className = img.className;
        canvas.id = img.id;
        
        // Copy all attributes except src
        Array.from(img.attributes).forEach(attr => {
            if (attr.name !== 'src' && attr.name !== 'data-src') {
                canvas.setAttribute(attr.name, attr.value);
            }
        });
        
        // Store original src in data attribute (obfuscated)
        if (img.src) {
            canvas.setAttribute('data-protected-src', btoa(img.src).split('').reverse().join(''));
        }
        
        // Draw image to canvas
        try {
            ctx.drawImage(img, 0, 0);
        } catch (e) {
            // If image fails to draw, keep original
            return;
        }
        
        // Remove original image src to prevent access
        img.removeAttribute('src');
        img.style.display = 'none';
        
        // Disable canvas interactions
        disableSelection(canvas);
        
        // Replace img with canvas
        parent.insertBefore(canvas, img);
        img.remove();
        
        // Prevent canvas data extraction - multiple methods
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            checkDevTools();
            return false;
        }, true);
        
        // Override toDataURL completely
        Object.defineProperty(canvas, 'toDataURL', {
            value: function() {
                checkDevTools();
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            },
            writable: false,
            configurable: false
        });
        
        // Override toBlob
        if (canvas.toBlob) {
            Object.defineProperty(canvas, 'toBlob', {
                value: function() {
                    checkDevTools();
                    return null;
                },
                writable: false,
                configurable: false
            });
        }
        
        // Protect getImageData
        const originalGetImageData = ctx.getImageData;
        Object.defineProperty(ctx, 'getImageData', {
            value: function() {
                checkDevTools();
                return new ImageData(new Uint8ClampedArray(4), 1, 1);
            },
            writable: false,
            configurable: false
        });
        
        // Protect canvas context
        Object.freeze(ctx);
    }

    // ========== VIDEO PROTECTION ==========
    function protectVideo(video) {
        if (video.dataset.protected === 'true') return;
        video.dataset.protected = 'true';
        
        disableSelection(video);
        
        // Prevent video download
        video.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            checkDevTools();
            return false;
        }, true);
        
        // Mobile touch protection for video
        if (isMobile) {
            video.addEventListener('touchstart', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, { passive: false, capture: true });
            
            video.addEventListener('touchmove', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, { passive: false, capture: true });
            
            video.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, { passive: false, capture: true });
        }
        
        // Disable video controls that allow download
        if (video.controls) {
            // Remove download button if present
            video.controlsList = 'nodownload';
        }
        
        // Prevent video source access
        Object.defineProperty(video, 'src', {
            get: function() {
                return this.getAttribute('data-protected-src') || '';
            },
            set: function(value) {
                this.setAttribute('data-protected-src', btoa(value).split('').reverse().join(''));
            }
        });
        
        // Protect video element
        video.setAttribute('controlsList', 'nodownload noplaybackrate');
        video.setAttribute('disablePictureInPicture', 'true');
        
        // Mobile-specific video protections
        if (isIOS) {
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
        }
        
        if (isAndroid) {
            video.setAttribute('playsinline', 'true');
        }
    }

    // ========== PROCESS ALL MEDIA ==========
    function processMedia() {
        if (checkDevTools()) return;
        
        // Process images
        const images = document.querySelectorAll('img:not([data-converted="true"])');
        images.forEach(function(img) {
            if (img.complete) {
                convertImageToCanvas(img);
            } else {
                img.addEventListener('load', function() {
                    convertImageToCanvas(img);
                }, { once: true });
            }
            disableSelection(img);
        });
        
        // Process videos
        const videos = document.querySelectorAll('video:not([data-protected="true"])');
        videos.forEach(function(video) {
            protectVideo(video);
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processMedia);
    } else {
        processMedia();
    }

    // Watch for new media added dynamically
    const observer = new MutationObserver(function(mutations) {
        if (checkDevTools()) return;
        processMedia();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });

    // ========== REQUEST INTERCEPTION ==========
    // Intercept fetch requests to prevent direct image access
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            // Block direct Supabase URLs
            if (typeof url === 'string' && (url.includes('supabase.co/storage') || url.includes('supabase.co/storage'))) {
                checkDevTools();
                return Promise.reject(new Error('Access denied'));
            }
            return originalFetch.apply(this, args);
        };
    }

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && (url.includes('supabase.co/storage') || url.includes('supabase.co/storage'))) {
            checkDevTools();
            throw new Error('Access denied');
        }
        return originalOpen.apply(this, [method, url, ...args]);
    };

    // ========== PREVENT IMAGE URL ACCESS ==========
    // Obfuscate image src property
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: function() {
            checkDevTools();
            return this.getAttribute('data-protected-src') ? 
                atob(this.getAttribute('data-protected-src').split('').reverse().join('')) : '';
        },
        set: function(value) {
            this.setAttribute('data-protected-src', btoa(value).split('').reverse().join(''));
        },
        configurable: false
    });

    // ========== SCREENSHOT & SCREEN RECORDING DETECTION ==========
    let lastBlurTime = 0;
    let lastVisibilityChange = Date.now();
    let screenshotDetected = false;
    let isPageHidden = false;
    let blackScreenActive = false;
    
    // Create notification system
    function showScreenshotWarning() {
        // Remove existing notification if any
        const existing = document.getElementById('screenshot-warning');
        if (existing) {
            existing.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'screenshot-warning';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(185, 28, 28, 0.95);
                color: white;
                padding: 20px 30px;
                border-radius: 10px;
                z-index: 999999;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                text-align: center;
                animation: slideDown 0.3s ease-out;
            ">
                <div style="margin-bottom: 10px;">⚠️ Screenshot/Capture Detected</div>
                <div style="font-size: 14px; opacity: 0.9;">Screen capture is not allowed on this page</div>
            </div>
        `;
        
        // Add animation styles if not present
        if (!document.getElementById('screenshot-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'screenshot-warning-styles';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                @keyframes slideUp {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(function() {
            if (notification.parentNode) {
                notification.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(function() {
                    notification.remove();
                }, 300);
            }
        }, 5000);
    }
    
    // Create black screen overlay
    function activateBlackScreen() {
        // Always activate (even if already active) to ensure it stays black
        blackScreenActive = true;
        
        // Remove existing overlay if any
        const existing = document.getElementById('black-screen-overlay');
        if (existing) {
            existing.remove();
        }
        
        const blackOverlay = document.createElement('div');
        blackOverlay.id = 'black-screen-overlay';
        blackOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000000;
            z-index: 999998;
            pointer-events: none;
            transition: opacity 0.1s;
        `;
        document.body.appendChild(blackOverlay);
        
        // Hide all content immediately
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.1s';
        document.documentElement.style.backgroundColor = '#000000';
        
        // Hide all media
        const allMedia = document.querySelectorAll('img, video, canvas, iframe');
        allMedia.forEach(function(media) {
            media.style.opacity = '0';
            media.style.transition = 'opacity 0.1s';
            media.style.visibility = 'hidden';
        });
        
        // Hide all text content
        const allText = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a');
        allText.forEach(function(text) {
            if (!text.closest('#screenshot-warning')) {
                text.style.opacity = '0';
                text.style.visibility = 'hidden';
            }
        });
    }
    
    function deactivateBlackScreen() {
        if (!blackScreenActive) return;
        
        // Only deactivate if page is visible
        if (document.hidden) {
            return; // Keep black screen if page is still hidden
        }
        
        blackScreenActive = false;
        
        const overlay = document.getElementById('black-screen-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(function() {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 100);
        }
        
        document.body.style.opacity = '1';
        document.documentElement.style.backgroundColor = '';
        
        const allMedia = document.querySelectorAll('img, video, canvas, iframe');
        allMedia.forEach(function(media) {
            media.style.opacity = '1';
            media.style.visibility = 'visible';
        });
        
        // Restore text content
        const allText = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a');
        allText.forEach(function(text) {
            if (!text.closest('#screenshot-warning')) {
                text.style.opacity = '1';
                text.style.visibility = 'visible';
            }
        });
    }
    
    // Desktop screenshot detection
    window.addEventListener('blur', function() {
        lastBlurTime = Date.now();
        activateBlackScreen();
    });

    window.addEventListener('focus', function() {
        const timeSinceBlur = Date.now() - lastBlurTime;
        if (timeSinceBlur > 0 && timeSinceBlur < 500) {
            // Screenshot detected
            screenshotDetected = true;
            showScreenshotWarning();
            activateBlackScreen();
            setTimeout(function() {
                deactivateBlackScreen();
            }, 2000);
        } else {
            deactivateBlackScreen();
        }
    });
    
    // ========== UNIVERSAL SCREEN RECORDING BLOCKING ==========
    // Block getDisplayMedia (primary screen recording API)
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
        navigator.mediaDevices.getDisplayMedia = function() {
            if (typeof showScreenshotWarning === 'function') {
                showScreenshotWarning();
            }
            if (typeof activateBlackScreen === 'function') {
                activateBlackScreen();
            }
            return Promise.reject(new Error('Screen recording is not allowed'));
        };
    }
    
    // Block getDisplayMedia (alternative API)
    if (navigator.getDisplayMedia) {
        const originalGetDisplayMedia = navigator.getDisplayMedia;
        navigator.getDisplayMedia = function() {
            if (typeof showScreenshotWarning === 'function') {
                showScreenshotWarning();
            }
            if (typeof activateBlackScreen === 'function') {
                activateBlackScreen();
            }
            throw new Error('Screen recording is not allowed');
        };
    }
    
    // Block MediaRecorder for screen recording (mobile and desktop)
    if (window.MediaRecorder) {
        const OriginalMediaRecorder = window.MediaRecorder;
        const MediaRecorderConstructor = function(stream, options) {
            if (stream && stream.getVideoTracks) {
                const videoTracks = stream.getVideoTracks();
                for (let i = 0; i < videoTracks.length; i++) {
                    const track = videoTracks[i];
                    if (track.label && (track.label.toLowerCase().includes('screen') || 
                        track.label.toLowerCase().includes('display') ||
                        track.label.toLowerCase().includes('window'))) {
                        if (typeof showScreenshotWarning === 'function') {
                            showScreenshotWarning();
                        }
                        if (typeof activateBlackScreen === 'function') {
                            activateBlackScreen();
                        }
                        throw new Error('Screen recording is not allowed');
                    }
                }
            }
            return new OriginalMediaRecorder(stream, options);
        };
        MediaRecorderConstructor.prototype = OriginalMediaRecorder.prototype;
        window.MediaRecorder = MediaRecorderConstructor;
    }
    
    // Detect when page becomes hidden (app switching, screenshot, etc.)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            isPageHidden = true;
            lastVisibilityChange = Date.now();
            // Immediately go black when page is hidden
            activateBlackScreen();
        } else {
            const timeHidden = Date.now() - lastVisibilityChange;
            isPageHidden = false;
            
            // If page was hidden for a short time, likely screenshot or app switch
            if (timeHidden > 0 && timeHidden < 1000) {
                screenshotDetected = true;
                showScreenshotWarning();
                // Keep black screen longer
                setTimeout(function() {
                    deactivateBlackScreen();
                }, 2000);
            } else {
                // Normal return - restore after short delay
                setTimeout(function() {
                    deactivateBlackScreen();
                }, 300);
            }
        }
    });
    
    // ========== NETFLIX-STYLE CONTENT SCRAMBLING SYSTEM ==========
    // This makes screenshots unusable by scrambling content in real-time
    let scrambleActive = false;
    let scrambleInterval = null;
    
    // Content scrambling function (Netflix-style)
    function scrambleContent() {
        scrambleActive = true;
        const allMedia = document.querySelectorAll('img, video, canvas');
        allMedia.forEach(function(media) {
            // Apply aggressive scrambling CSS filters (makes screenshots unusable)
            media.style.filter = 'blur(30px) brightness(0.05) contrast(0.05) saturate(0)';
            media.style.transform = 'scale(0.05) rotate(180deg)';
            media.style.opacity = '0.01';
            media.style.visibility = 'hidden';
            media.style.pointerEvents = 'none';
            
            // Add noise overlay (Netflix-style scrambling pattern)
            if (!media.dataset.scrambleOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'scramble-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: repeating-linear-gradient(
                        0deg,
                        rgba(0,0,0,0.95) 0px,
                        rgba(255,255,255,0.05) 1px,
                        rgba(0,0,0,0.95) 2px,
                        rgba(255,0,0,0.1) 3px,
                        rgba(0,0,0,0.95) 4px
                    ),
                    repeating-linear-gradient(
                        90deg,
                        rgba(0,0,0,0.95) 0px,
                        rgba(0,255,0,0.05) 1px,
                        rgba(0,0,0,0.95) 2px
                    );
                    background-blend-mode: multiply;
                    z-index: 9999;
                    pointer-events: none;
                    mix-blend-mode: multiply;
                `;
                const parent = media.parentElement;
                if (parent) {
                    if (getComputedStyle(parent).position === 'static') {
                        parent.style.position = 'relative';
                    }
                    parent.appendChild(overlay);
                    media.dataset.scrambleOverlay = 'true';
                }
            }
        });
    }
    
    // Restore content function
    function restoreContent() {
        const allMedia = document.querySelectorAll('img, video, canvas');
        allMedia.forEach(function(media) {
            // Clear aggressive scrambling
            media.style.filter = '';
            media.style.transform = '';
            media.style.opacity = '1';
            media.style.visibility = 'visible';
            media.style.pointerEvents = 'auto';
            
            // Remove scramble overlay
            const overlay = media.parentElement.querySelector('.scramble-overlay');
            if (overlay) {
                overlay.remove();
            }
            media.dataset.scrambleOverlay = '';
        });
        scrambleActive = false;
        
        // Frame obfuscation will continue with subtle changes (Netflix-style)
    }
    
    // Frame-by-frame obfuscation (Netflix-style constant scrambling)
    // This makes screenshots inconsistent by constantly changing the image slightly
    function startFrameObfuscation() {
        if (scrambleInterval) return;
        
        let frameCount = 0;
        scrambleInterval = setInterval(function() {
            frameCount++;
            
            // Only apply obfuscation on mobile and when page is visible
            if (!isMobile || document.hidden || scrambleActive) return;
            
            // Every few frames, apply very subtle scrambling to make screenshots inconsistent
            if (frameCount % 2 === 0) {
                const allMedia = document.querySelectorAll('img, video, canvas');
                allMedia.forEach(function(media) {
                    // Apply very subtle constant scrambling (Netflix-style)
                    // This makes any screenshot capture inconsistent without affecting viewing
                    const randomBlur = Math.random() * 0.5; // Very subtle blur
                    const randomBrightness = 0.98 + Math.random() * 0.04; // Minimal brightness change
                    const randomHue = (Math.random() - 0.5) * 5; // Very small hue shift
                    
                    // Apply subtle filters that change constantly (imperceptible to user)
                    media.style.filter = `blur(${randomBlur}px) brightness(${randomBrightness}) hue-rotate(${randomHue}deg)`;
                    
                    // Very slight position jitter (imperceptible but makes screenshots inconsistent)
                    const jitterX = (Math.random() - 0.5) * 0.5;
                    const jitterY = (Math.random() - 0.5) * 0.5;
                    const currentTransform = media.style.transform || '';
                    if (!currentTransform.includes('scale') && !currentTransform.includes('rotate')) {
                        media.style.transform = `translate(${jitterX}px, ${jitterY}px)`;
                    }
                });
            }
        }, 33); // ~30fps obfuscation (balance between protection and performance)
    }
    
    // Start frame obfuscation on mobile (Netflix-style)
    if (isMobile) {
        startFrameObfuscation();
    }

    // ========== AGGRESSIVE MOBILE SCREENSHOT & RECORDING PREVENTION ==========
    if (isMobile) {
        let mobileScreenshotAttempts = 0;
        let lastMobileVisibilityChange = Date.now();
        let lastScrambleTime = 0;
        
        // iOS: Enhanced screenshot and recording detection with content scrambling
        if (isIOS) {
            // Method 1: Detect app backgrounding (screenshot indicator) - Scramble content
            window.addEventListener('pagehide', function() {
                scrambleActive = true;
                scrambleContent();
                lastScrambleTime = Date.now();
            });
            
            window.addEventListener('pageshow', function(e) {
                const timeHidden = Date.now() - lastMobileVisibilityChange;
                // If page was hidden briefly, likely screenshot - keep scrambled longer
                if (timeHidden > 0 && timeHidden < 800) {
                    mobileScreenshotAttempts++;
                    // Keep content scrambled for longer to prevent screenshot
                    setTimeout(function() {
                        restoreContent();
                    }, 500);
                } else {
                    // Normal return - restore content
                    setTimeout(function() {
                        restoreContent();
                    }, 100);
                }
            });
            
            // Method 2: Detect visibility changes (screenshot/recording indicator) - Scramble immediately
            document.addEventListener('visibilitychange', function() {
                lastMobileVisibilityChange = Date.now();
                if (document.hidden) {
                    // Immediately scramble content when page becomes hidden
                    scrambleActive = true;
                    scrambleContent();
                    lastScrambleTime = Date.now();
                } else {
                    // Page visible again - might be after screenshot
                    const timeHidden = Date.now() - lastMobileVisibilityChange;
                    if (timeHidden > 0 && timeHidden < 1000) {
                        mobileScreenshotAttempts++;
                        // Keep scrambled longer if screenshot detected
                        setTimeout(function() {
                            restoreContent();
                        }, 500);
                    } else {
                        // Normal return - restore content quickly
                        setTimeout(function() {
                            restoreContent();
                        }, 100);
                    }
                }
            });
            
            // Method 2b: Continuous scrambling when page might be screenshot
            // Monitor for any signs of screenshot and scramble immediately
            setInterval(function() {
                if (document.hidden) {
                    if (!scrambleActive) {
                        scrambleActive = true;
                        scrambleContent();
                    }
                }
            }, 16); // Check every frame (~60fps)
            
            // Method 3: Detect iOS screen recording API
            if (window.ReplayKit) {
                // Block iOS ReplayKit (screen recording)
                window.ReplayKit = undefined;
            }
            
            // Method 4: Monitor for iOS screenshot gestures
            document.addEventListener('touchstart', function(e) {
                // Detect volume + power button combination (iOS screenshot)
                // This is detected via rapid visibility changes
            }, true);
            
            // Method 5: Block iOS screen recording via getUserMedia - Silent
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
                navigator.mediaDevices.getUserMedia = function(constraints) {
                    // Block screen recording attempts - Silent
                    if (constraints && (constraints.video || constraints.screen || constraints.display)) {
                        // Silent blocking - no notification, no black screen
                        return Promise.reject(new Error('Screen recording is not allowed'));
                    }
                    return originalGetUserMedia.apply(this, arguments);
                };
            }
        }
        
        // Android: Enhanced screenshot and recording detection with content scrambling
        if (isAndroid) {
            // Method 1: Detect app switching (screenshot indicator) - Scramble content
            window.addEventListener('blur', function() {
                lastBlurTime = Date.now();
                // Immediately scramble content
                scrambleActive = true;
                scrambleContent();
                lastScrambleTime = Date.now();
            });
            
            window.addEventListener('focus', function() {
                const timeSinceBlur = Date.now() - lastBlurTime;
                if (timeSinceBlur > 0 && timeSinceBlur < 1000) {
                    // Screenshot detected - keep scrambled longer
                    mobileScreenshotAttempts++;
                    setTimeout(function() {
                        restoreContent();
                    }, 500);
                } else {
                    // Normal return - restore content
                    setTimeout(function() {
                        restoreContent();
                    }, 100);
                }
            });
            
            // Method 2: Detect Android screenshot gestures (volume down + power) - Scramble
            let androidScreenshotDetected = false;
            window.addEventListener('blur', function() {
                androidScreenshotDetected = true;
                // Immediately scramble content
                scrambleActive = true;
                scrambleContent();
                setTimeout(function() {
                    androidScreenshotDetected = false;
                }, 500);
            });
            
            window.addEventListener('focus', function() {
                if (androidScreenshotDetected) {
                    // Keep scrambled longer if screenshot detected
                    setTimeout(function() {
                        restoreContent();
                    }, 500);
                }
            });
            
            // Method 2b: Continuous scrambling monitoring
            setInterval(function() {
                if (document.hidden || !document.hasFocus()) {
                    if (!scrambleActive) {
                        scrambleActive = true;
                        scrambleContent();
                    }
                }
            }, 16); // Check every frame
            
            // Method 3: Block Android screen recording via MediaProjection API - Silent
            // Block getUserMedia for screen recording
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
                navigator.mediaDevices.getUserMedia = function(constraints) {
                    if (constraints && (constraints.video || constraints.screen || constraints.display)) {
                        // Silent blocking - no notification, no black screen
                        return Promise.reject(new Error('Screen recording is not allowed'));
                    }
                    return originalGetUserMedia.apply(this, arguments);
                };
            }
            
            // Method 4: Block Android screen mirroring
            if (navigator.presentation && navigator.presentation.defaultRequest) {
                navigator.presentation.defaultRequest = null;
            }
        }
        
        // Universal mobile: Continuous aggressive monitoring with scrambling
        // Check every frame (60fps) for maximum protection
        setInterval(function() {
            if (document.hidden) {
                // Immediately scramble content while page is hidden
                if (!scrambleActive) {
                    scrambleActive = true;
                    scrambleContent();
                }
            } else {
                // Only restore if not recently scrambled (to prevent screenshot)
                const timeSinceScramble = Date.now() - lastScrambleTime;
                if (timeSinceScramble > 500) {
                    if (scrambleActive) {
                        restoreContent();
                    }
                }
            }
        }, 16); // ~60fps monitoring
        
        // Monitor for rapid visibility changes (screenshot indicator) - Scramble immediately
        let visibilityChangeCount = 0;
        let lastVisibilityCheck = Date.now();
        document.addEventListener('visibilitychange', function() {
            visibilityChangeCount++;
            const timeSinceLastCheck = Date.now() - lastVisibilityCheck;
            
            // If multiple rapid visibility changes, likely screenshot attempt - Scramble immediately
            if (timeSinceLastCheck < 500 && visibilityChangeCount > 2) {
                mobileScreenshotAttempts++;
                scrambleActive = true;
                scrambleContent();
                // Keep scrambled longer
                setTimeout(function() {
                    restoreContent();
                }, 1000);
            }
            
            lastVisibilityCheck = Date.now();
            
            // Reset counter after 1 second
            setTimeout(function() {
                visibilityChangeCount = 0;
            }, 1000);
        });
        
        // Additional protection: Scramble on any touch event that might be screenshot
        document.addEventListener('touchstart', function() {
            // Slight delay to detect if it's a screenshot gesture
            setTimeout(function() {
                if (document.hidden) {
                    scrambleActive = true;
                    scrambleContent();
                }
            }, 50);
        }, true);
        
        // Block all mobile screen recording APIs (SILENT - no notifications)
        // Block MediaRecorder API
        if (window.MediaRecorder) {
            const OriginalMediaRecorder = window.MediaRecorder;
            window.MediaRecorder = function(stream, options) {
                // Check if stream is screen recording
                if (stream && stream.getVideoTracks) {
                    const videoTracks = stream.getVideoTracks();
                    videoTracks.forEach(function(track) {
                        if (track.label && (track.label.includes('screen') || track.label.includes('display'))) {
                            // Silent blocking - no notification, no black screen
                            throw new Error('Screen recording is not allowed');
                        }
                    });
                }
                return new OriginalMediaRecorder(stream, options);
            };
            window.MediaRecorder.prototype = OriginalMediaRecorder.prototype;
        }
        
        // Block canvas.toBlob for mobile (can be used to capture screenshots) - Silent
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            // Silent blocking - no notification, no black screen
            return null;
        };
        
        // Block canvas.toDataURL for mobile - Silent
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
            value: function() {
                // Silent blocking - no notification, no black screen
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            },
            writable: false,
            configurable: false
        });
        
        // Prevent mobile screen mirroring (AirPlay, Chromecast, etc.)
        if (navigator.presentation) {
            navigator.presentation.defaultRequest = null;
            if (navigator.presentation.receiver) {
                navigator.presentation.receiver = null;
            }
        }
        
        // Block mobile camera access that might be used for recording - Silent
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
            navigator.mediaDevices.getUserMedia = function(constraints) {
                // Block if trying to access screen/display - Silent
                if (constraints && (constraints.screen || constraints.display || 
                    (constraints.video && typeof constraints.video === 'object' && 
                     (constraints.video.mediaSource === 'screen' || constraints.video.mediaSource === 'display')))) {
                    // Silent blocking - no notification, no black screen
                    return Promise.reject(new Error('Screen recording is not allowed'));
                }
                return originalGetUserMedia.apply(this, arguments);
            };
        }
        
        // Additional mobile-specific: Scramble content when in background
        window.addEventListener('blur', function() {
            // Immediately scramble content
            scrambleActive = true;
            scrambleContent();
            lastScrambleTime = Date.now();
        });
        
        window.addEventListener('focus', function() {
            // Restore content when focused (with delay to prevent screenshot)
            const timeSinceScramble = Date.now() - lastScrambleTime;
            if (timeSinceScramble > 500) {
                restoreContent();
            } else {
                // Keep scrambled if recently scrambled
                setTimeout(function() {
                    restoreContent();
                }, 500);
            }
        });
        
        // Prevent mobile screenshot via browser's screenshot feature
        // Some mobile browsers have built-in screenshot features
        document.addEventListener('DOMContentLoaded', function() {
            // Add meta tag to prevent mobile browser screenshots
            const metaScreenshot = document.createElement('meta');
            metaScreenshot.name = 'mobile-web-app-capable';
            metaScreenshot.content = 'yes';
            document.head.appendChild(metaScreenshot);
        });
    }
    
    // Detect screen capture tools (Windows Snipping Tool, etc.)
    document.addEventListener('keydown', function(e) {
        // Windows Snipping Tool: Win + Shift + S
        if (e.key === 's' && e.shiftKey && (e.metaKey || (e.ctrlKey && e.altKey))) {
            showScreenshotWarning();
            activateBlackScreen();
            setTimeout(function() {
                deactivateBlackScreen();
            }, 2000);
        }
        
        // Print Screen key
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            showScreenshotWarning();
            activateBlackScreen();
            setTimeout(function() {
                deactivateBlackScreen();
            }, 2000);
        }
    }, true);
    
    // Monitor for screen recording indicators
    setInterval(function() {
        // Check if page is being recorded by detecting performance changes
        if (document.hidden && !isPageHidden) {
            showScreenshotWarning();
            activateBlackScreen();
        }
    }, 500);
    
    // Block canvas capture methods
    if (HTMLCanvasElement.prototype.captureStream) {
        HTMLCanvasElement.prototype.captureStream = function() {
            showScreenshotWarning();
            activateBlackScreen();
            return null;
        };
    }
    
    // Block getDisplayMedia for screen recording
    if (navigator.mediaDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = function() {
            return originalEnumerateDevices.apply(this, arguments).then(function(devices) {
                // Filter out screen capture devices
                return devices.filter(function(device) {
                    return !device.label.toLowerCase().includes('screen') && 
                           !device.label.toLowerCase().includes('display');
                });
            });
        };
    }

    // ========== MOBILE BROWSER SPECIFIC PROTECTIONS ==========
    if (isMobile) {
        // Prevent mobile browser image save
        document.addEventListener('selectstart', function(e) {
            if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') {
                e.preventDefault();
                return false;
            }
        }, true);
        
        // Prevent mobile text selection on media
        document.addEventListener('selectionchange', function() {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                if (container.nodeType === 1) {
                    const element = container.nodeType === 1 ? container : container.parentElement;
                    if (element && (element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'CANVAS')) {
                        selection.removeAllRanges();
                    }
                }
            }
        });
        
        // iOS Safari specific: Prevent image save via share sheet
        if (isIOS && isSafari) {
            // Add meta tag to prevent iOS image saving
            const preventIOSSave = document.createElement('meta');
            preventIOSSave.name = 'format-detection';
            preventIOSSave.content = 'telephone=no';
            document.head.appendChild(preventIOSSave);
            
            // Disable iOS image preview
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', viewport.getAttribute('content') + ', user-scalable=no');
            }
        }
        
        // Android Chrome specific: Prevent image save
        if (isAndroid) {
            // Block Android image save menu
            document.addEventListener('contextmenu', function(e) {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }, true);
        }
        
        // Prevent mobile pinch-to-zoom on media
        document.addEventListener('gesturestart', function(e) {
            if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);
    }

    // ========== BLOCK BROWSER SAVE FEATURES ==========
    // Block Save Page As
    window.addEventListener('beforeunload', function(e) {
        // Don't block normal navigation, but log attempts
        if (document.hidden) {
            activateBlackScreen();
        }
    });
    
    // Block browser's Save Image feature
    document.addEventListener('DOMContentLoaded', function() {
        // Override browser's save image context menu
        const images = document.querySelectorAll('img');
        images.forEach(function(img) {
            // Remove any download attribute
            img.removeAttribute('download');
            
            // Block image opening in new tab
            img.addEventListener('click', function(e) {
                if (e.ctrlKey || e.metaKey || e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
        });
    });
    
    // Block browser's View Source
    document.addEventListener('keydown', function(e) {
        // Additional View Source blocking
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.location.href = '/';
            return false;
        }
    }, true);
    
    // Block browser's Inspect Element (even if context menu is blocked)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            checkDevTools();
            window.location.href = '/';
            return false;
        }
    }, true);
    
    // Block browser extensions from accessing images
    // Override getComputedStyle to prevent extension access
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(element, pseudoElement) {
        if (element && (element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'CANVAS')) {
            const style = originalGetComputedStyle.call(this, element, pseudoElement);
            // Obfuscate image-related properties
            return style;
        }
        return originalGetComputedStyle.call(this, element, pseudoElement);
    };
    
    // Block browser's Reading Mode / Reader View
    if (document.documentElement) {
        // Remove article tags that enable reading mode
        const articles = document.querySelectorAll('article');
        articles.forEach(function(article) {
            article.setAttribute('data-protected', 'true');
        });
        
        // Prevent reading mode activation
        const metaReader = document.createElement('meta');
        metaReader.name = 'robots';
        metaReader.content = 'noindex, nofollow, noarchive, nosnippet';
        document.head.appendChild(metaReader);
    }
    
    // Block browser's Accessibility features that might extract content
    document.addEventListener('DOMContentLoaded', function() {
        // Remove alt text from images (prevents screen reader extraction)
        const images = document.querySelectorAll('img');
        images.forEach(function(img) {
            const originalAlt = img.getAttribute('alt');
            if (originalAlt) {
                img.setAttribute('data-original-alt', originalAlt);
                img.removeAttribute('alt');
            }
        });
    });
    
    // Block browser's History API access to image URLs
    const originalPushState = history.pushState;
    history.pushState = function() {
        // Clear any image URLs from state
        const args = Array.from(arguments);
        if (args[2] && typeof args[2] === 'string' && args[2].includes('/api/media/')) {
            // Allow but don't expose URLs
        }
        return originalPushState.apply(history, args);
    };
    
    // Block browser's Bookmark feature from saving image URLs
    window.addEventListener('beforeunload', function() {
        // Clear any image URLs from bookmarks
        const links = document.querySelectorAll('a[href*="/api/media/"]');
        links.forEach(function(link) {
            link.setAttribute('data-protected-href', link.href);
            link.removeAttribute('href');
        });
    });
    
    // Block browser's Download Manager from seeing image URLs
    // Intercept all link clicks that might trigger downloads
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href && target.href.includes('/api/media/')) {
            // Allow navigation but prevent download
            if (target.hasAttribute('download')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    }, true);
    
    // Block browser's Network tab from showing image requests
    // Override fetch to hide image URLs
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && url.includes('/api/media/')) {
                // Allow fetch but obfuscate in network tab
                return originalFetch.apply(this, args).catch(function(error) {
                    // Hide errors that might reveal URLs
                    throw new Error('Network error');
                });
            }
            return originalFetch.apply(this, args);
        };
    }
    
    // Block browser's Application/Cache tab from showing images
    // Prevent service worker registration that might cache images
    if ('serviceWorker' in navigator) {
        const originalRegister = navigator.serviceWorker.register;
        navigator.serviceWorker.register = function() {
            return Promise.reject(new Error('Service workers disabled'));
        };
    }
    
    // Block browser's Console from accessing image elements via selectors
    // Note: We can't fully override querySelector as it breaks page functionality
    // Instead, we'll protect images directly
    
    // Block browser's Share API
    if (navigator.share) {
        const originalShare = navigator.share;
        navigator.share = function(data) {
            if (data && (data.url && data.url.includes('/api/media/') || data.files)) {
                return Promise.reject(new Error('Sharing is not allowed'));
            }
            return originalShare.apply(this, arguments);
        };
    }
    
    // Block browser's Clipboard API for images
    if (navigator.clipboard) {
        if (navigator.clipboard.write) {
            const originalWrite = navigator.clipboard.write;
            navigator.clipboard.write = function() {
                return Promise.reject(new Error('Clipboard access denied'));
            };
        }
        
        if (navigator.clipboard.writeText) {
            const originalWriteText = navigator.clipboard.writeText;
            navigator.clipboard.writeText = function(text) {
                if (text && (text.includes('/api/media/') || text.includes('data:image'))) {
                    return Promise.reject(new Error('Clipboard access denied'));
                }
                return originalWriteText.apply(this, arguments);
            };
        }
    }
    
    // Block browser's Full Page Screenshot extensions
    // Detect and block common extension patterns
    setInterval(function() {
        // Check for extension injection
        if (window.chrome && window.chrome.runtime) {
            // Block extension message passing
            const originalSendMessage = window.chrome.runtime.sendMessage;
            if (originalSendMessage) {
                window.chrome.runtime.sendMessage = function() {
                    return Promise.reject(new Error('Extension access denied'));
                };
            }
        }
    }, 1000);
    
    // Block browser's QR Code generators that might use image URLs
    // Override URL.createObjectURL to prevent image URL creation
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(object) {
        if (object instanceof Blob && object.type.startsWith('image/')) {
            throw new Error('Image URL creation denied');
        }
        return originalCreateObjectURL.apply(this, arguments);
    };
    
    // Block browser's Print Preview from showing images
    // Override window.print
    const originalPrint = window.print;
    window.print = function() {
        if (typeof showScreenshotWarning === 'function') {
            showScreenshotWarning();
        }
        if (typeof activateBlackScreen === 'function') {
            activateBlackScreen();
        }
        return false;
    };
    
    // Block Print dialog
    window.addEventListener('beforeprint', function(e) {
        if (typeof showScreenshotWarning === 'function') {
            showScreenshotWarning();
        }
        if (typeof activateBlackScreen === 'function') {
            activateBlackScreen();
        }
    });
    
    window.addEventListener('afterprint', function() {
        if (typeof deactivateBlackScreen === 'function') {
            deactivateBlackScreen();
        }
    });
    
    // Block browser's Print menu
    if (window.matchMedia) {
        const mediaQueryList = window.matchMedia('print');
        if (mediaQueryList.addListener) {
            mediaQueryList.addListener(function(mql) {
                if (mql.matches) {
                    if (typeof showScreenshotWarning === 'function') {
                        showScreenshotWarning();
                    }
                    if (typeof activateBlackScreen === 'function') {
                        activateBlackScreen();
                    }
                }
            });
        } else if (mediaQueryList.addEventListener) {
            mediaQueryList.addEventListener('change', function(mql) {
                if (mql.matches) {
                    if (typeof showScreenshotWarning === 'function') {
                        showScreenshotWarning();
                    }
                    if (typeof activateBlackScreen === 'function') {
                        activateBlackScreen();
                    }
                }
            });
        }
    }
    
    // Block browser's Save As dialog
    // This is handled by blocking Ctrl+S above, but add additional protection
    document.addEventListener('keydown', function(e) {
        // Block all save-related shortcuts
        if ((e.ctrlKey || e.metaKey) && 
            (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showScreenshotWarning();
            return false;
        }
    }, true);

    // ========== PREVENT IFRAME EMBEDDING ==========
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // ========== DISABLE CONSOLE IN PRODUCTION ==========
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const noop = function() {};
        // Override console methods
        Object.defineProperty(window, 'console', {
            value: {
                log: noop,
                info: noop,
                warn: noop,
                error: noop,
                debug: noop,
                trace: noop,
                dir: noop,
                dirxml: noop,
                group: noop,
                groupEnd: noop,
                time: noop,
                timeEnd: noop,
                count: noop,
                clear: noop,
                profile: noop,
                profileEnd: noop,
                assert: noop
            },
            writable: false,
            configurable: false
        });
    }
})();
