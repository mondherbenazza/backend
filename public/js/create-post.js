(function(){
  // Only run in browsers
  if (typeof window === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function(){
    // Simple draft autosave for title/body so users don't lose typed content
    const titleInput = document.getElementById('title');
    const bodyInput = document.getElementById('body');
    const DRAFT_KEY = 'post-draft-v1';

    // Restore draft only when inputs are empty (server-rendered values take precedence)
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (titleInput && !titleInput.value && draft.title) titleInput.value = draft.title;
        if (bodyInput && !bodyInput.value && draft.body) bodyInput.value = draft.body;
      }
    } catch (e) {
      // ignore storage errors
    }

    function saveDraft(){
      try {
        const data = { title: titleInput ? titleInput.value : '', body: bodyInput ? bodyInput.value : '' };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch (e) {}
    }

    if (titleInput) titleInput.addEventListener('input', saveDraft);
    if (bodyInput) bodyInput.addEventListener('input', saveDraft);

    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    if (!fileInput || !uploadArea) return;

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const uploadErrorEl = document.getElementById('uploadError');
    let selectedFile = null;
    let uploadedImageUrl = null;

    function clearUploadArea() {
      const prev = uploadArea.querySelector('img.upload-preview');
      if (prev) prev.remove();
 
      const txt = uploadArea.querySelectorAll('.upload-text, .upload-subtext');
      txt.forEach(el => el.style.display = 'block');
      const svg = uploadArea.querySelector('.upload-icon');
      if (svg) svg.style.display = 'inline-block';
      
      // Remove progress bar if exists
      const progressBar = uploadArea.querySelector('.upload-progress');
      if (progressBar) progressBar.remove();
    }

    function showPreview(file) {
      clearUploadArea();
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'upload-preview';
        img.alt = file && file.name ? file.name : 'Image preview';
  
        const txt = uploadArea.querySelectorAll('.upload-text, .upload-subtext');
        txt.forEach(el => el.style.display = 'none');
        const svg = uploadArea.querySelector('.upload-icon');
        if (svg) svg.style.display = 'none';

        uploadArea.insertBefore(img, uploadArea.firstChild);
      };
      reader.readAsDataURL(file);
    }

    function showProgress(percent) {
      let progressBar = uploadArea.querySelector('.upload-progress');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'upload-progress';
        progressBar.innerHTML = `
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">Uploading... 0%</div>
        `;
        uploadArea.appendChild(progressBar);
      }
      
      const fill = progressBar.querySelector('.progress-fill');
      const text = progressBar.querySelector('.progress-text');
      if (fill) fill.style.width = percent + '%';
      if (text) text.textContent = `Uploading... ${Math.round(percent)}%`;
    }

    function hideProgress() {
      const progressBar = uploadArea.querySelector('.upload-progress');
      if (progressBar) progressBar.remove();
    }

    // Client-side image compression
    async function compressImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize to max 1920px on longest side
            let width = img.width;
            let height = img.height;
            const maxDimension = 1920;
            
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
              } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to WebP blob with quality 0.7 for smaller file sizes
            canvas.toBlob(function(blob) {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas conversion failed'));
              }
            }, 'image/webp', 0.7);
          };
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });
    }

    // Direct upload to Supabase
    async function uploadImageDirect(file) {
      try {
        showProgress(10);
        
        // Compress the image first
        const compressedBlob = await compressImage(file);
        showProgress(30);
        
        // Get signed upload URL from server
        const urlResponse = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!urlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadUrl, path, token } = await urlResponse.json();
        showProgress(40);

        // Upload directly to Supabase
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: compressedBlob,
          headers: {
            'Content-Type': 'image/webp',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Upload failed');
        }
        
        showProgress(80);
        
        // Get the public URL
        const finalizeResponse = await fetch('/api/finalize-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        });
        
        if (!finalizeResponse.ok) {
          throw new Error('Failed to finalize upload');
        }
        
        const { publicUrl } = await finalizeResponse.json();
        showProgress(100);
        
        setTimeout(hideProgress, 500);
        return publicUrl;
        
      } catch (error) {
        hideProgress();
        throw error;
      }
    }

    // If there's an existing image URL (editing), show it on load
    const existing = uploadArea.dataset && uploadArea.dataset.existingImage;
    if (existing) {
      const img = document.createElement('img');
      img.src = existing;
      img.className = 'upload-preview';
      img.alt = 'Current image';
      const txt = uploadArea.querySelectorAll('.upload-text, .upload-subtext');
      txt.forEach(el => el.style.display = 'none');
      const svg = uploadArea.querySelector('.upload-icon');
      if (svg) svg.style.display = 'none';
      uploadArea.insertBefore(img, uploadArea.firstChild);
    }

    fileInput.addEventListener('change', function(e){
      const f = e.target.files && e.target.files[0];
      if (!f) {
        selectedFile = null;
        uploadedImageUrl = null;
        return clearUploadArea();
      }

      // Clear previous error if any
      if (uploadErrorEl) uploadErrorEl.textContent = '';
      uploadedImageUrl = null;

      // Reject non-images early
      if (!f.type.startsWith('image/')) {
        if (uploadErrorEl) uploadErrorEl.textContent = 'Selected file is not an image.';
        selectedFile = null;
        return clearUploadArea();
      }

      // Client-side size check
      if (f.size > MAX_BYTES) {
        if (uploadErrorEl) uploadErrorEl.textContent = 'Selected file is too large. Maximum allowed size is 10 MB.';
        selectedFile = null;
        return clearUploadArea();
      }

      selectedFile = f;
      showPreview(f);
    });

    // Intercept form submission for direct upload
    const form = document.querySelector('form[action="/create-post"]');
    if (form) {
      form.addEventListener('submit', async function(e) {
        if (selectedFile && !uploadedImageUrl) {
          e.preventDefault();
          
          try {
            // Disable submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.style.opacity = '0.6';
              submitBtn.style.cursor = 'not-allowed';
            }
            
            // Upload image directly to Supabase
            uploadedImageUrl = await uploadImageDirect(selectedFile);
            
            // Add hidden input with the uploaded URL
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'imageUrl';
            hiddenInput.value = uploadedImageUrl;
            form.appendChild(hiddenInput);
            
            // Clear draft on successful upload
            try {
              localStorage.removeItem(DRAFT_KEY);
            } catch (e) {}
            
            // Submit the form
            form.submit();
            
          } catch (error) {
            console.error('Upload error:', error);
            if (uploadErrorEl) {
              uploadErrorEl.textContent = error.message || 'Upload failed. Please try again.';
            }
            
            // Re-enable submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
              submitBtn.style.cursor = 'pointer';
            }
          }
        } else {
          // Clear draft on normal submit
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch (e) {}
        }
      });
    }
  });
})();
