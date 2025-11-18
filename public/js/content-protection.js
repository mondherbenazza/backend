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
        
        // Block Save shortcuts
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Block Copy on media
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && 
            (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Block Print Screen
        if (e.key === 'PrintScreen') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Block View Source
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

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

    // ========== MOBILE SCREENSHOT DETECTION ==========
    let lastBlurTime = 0;
    let lastVisibilityChange = Date.now();
    let screenshotDetected = false;
    
    // Desktop screenshot detection
    window.addEventListener('blur', function() {
        lastBlurTime = Date.now();
    });

    window.addEventListener('focus', function() {
        const timeSinceBlur = Date.now() - lastBlurTime;
        if (timeSinceBlur > 0 && timeSinceBlur < 200) {
            // Possible screenshot - hide content temporarily
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.1s';
            setTimeout(function() {
                document.body.style.opacity = '1';
            }, 150);
        }
    });
    
    // Mobile screenshot detection (iOS and Android)
    if (isMobile) {
        // Detect when page becomes hidden (common during screenshots)
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                lastVisibilityChange = Date.now();
                // Hide content when page becomes hidden
                document.body.style.opacity = '0';
                document.body.style.transition = 'opacity 0.05s';
            } else {
                const timeHidden = Date.now() - lastVisibilityChange;
                // If page was hidden for a very short time, might be screenshot
                if (timeHidden > 0 && timeHidden < 500) {
                    screenshotDetected = true;
                    // Keep content hidden longer
                    setTimeout(function() {
                        document.body.style.opacity = '1';
                    }, 300);
                } else {
                    document.body.style.opacity = '1';
                }
            }
        });
        
        // iOS specific: Detect app backgrounding (screenshot indicator)
        if (isIOS) {
            window.addEventListener('pagehide', function() {
                document.body.style.opacity = '0';
            });
            
            window.addEventListener('pageshow', function() {
                setTimeout(function() {
                    document.body.style.opacity = '1';
                }, 200);
            });
        }
        
        // Android specific: Detect when window loses focus
        if (isAndroid) {
            window.addEventListener('blur', function() {
                document.body.style.opacity = '0';
            });
            
            window.addEventListener('focus', function() {
                setTimeout(function() {
                    document.body.style.opacity = '1';
                }, 200);
            });
        }
        
        // Additional mobile screenshot detection using page visibility
        setInterval(function() {
            if (document.hidden && !screenshotDetected) {
                // Page is hidden - might be screenshot
                const allImages = document.querySelectorAll('img, video, canvas');
                allImages.forEach(function(media) {
                    media.style.opacity = '0';
                });
            }
        }, 100);
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
