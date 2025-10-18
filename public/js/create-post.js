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

    // Clear draft on form submit to prevent pre-filling after successful post creation
    const form = document.querySelector('form[action="/create-post"]');
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault(); // Prevent default form submission

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Uploading...';

        try {
          // Get the selected file
          const fileInput = document.getElementById('fileInput');
          const file = fileInput && fileInput.files && fileInput.files[0];

          if (!file) {
            alert('Please select an image to upload.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
          }

          // Compress image if needed (reuse existing logic)
          const compressedFile = await compressImage(file);

          // Request signed upload URL from server
          const urlResponse = await fetch('/generate-upload-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!urlResponse.ok) {
            throw new Error('Failed to get upload URL');
          }

          const { signedUrl, path } = await urlResponse.json();

          // Upload directly to Supabase
          const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: compressedFile,
            headers: {
              'Content-Type': compressedFile.type
            }
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed');
          }

          // Get public URL
          const publicUrl = signedUrl.split('?')[0]; // Remove query params to get public URL

          // Submit form with image URL
          const formData = new FormData(form);
          formData.append('imageUrl', publicUrl);

          const createResponse = await fetch('/create-post', {
            method: 'POST',
            body: formData
          });

          if (createResponse.ok) {
            // Clear draft and redirect
            try {
              localStorage.removeItem(DRAFT_KEY);
            } catch (e) {}
            window.location.href = createResponse.headers.get('Location') || '/dashboard';
          } else {
            const errorData = await createResponse.json();
            alert('Failed to create post: ' + (errorData.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('Upload error:', error);
          alert('Upload failed: ' + error.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    }

    // Image compression function (moved from server to client)
    async function compressImage(file) {
      try {
        // Only compress image files
        if (!file.type.startsWith('image/')) {
          return file;
        }

        // Skip compression for very small images
        if (file.size < 100000) { // Less than 100KB
          return file;
        }

        // Use browser's Image and Canvas APIs for compression
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate new dimensions (max 1920px width, maintain aspect ratio)
            const maxWidth = 1920;
            const ratio = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;

            // Draw and compress
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
              resolve(blob);
            }, 'image/webp', 0.85); // Convert to WebP with 85% quality
          };
          img.src = URL.createObjectURL(file);
        });
      } catch (error) {
        console.error("Image compression failed, using original:", error.message);
        return file;
      }
    }

    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    if (!fileInput || !uploadArea) return;

    function clearUploadArea() {
  
      const prev = uploadArea.querySelector('img.upload-preview');
      if (prev) prev.remove();
 
      const txt = uploadArea.querySelectorAll('.upload-text, .upload-subtext');
      txt.forEach(el => el.style.display = 'block');
      const svg = uploadArea.querySelector('.upload-icon');
      if (svg) svg.style.display = 'inline-block';
    }

    function showPreview(file) {
      clearUploadArea();
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'upload-preview';
        // set accessible alt text from filename if available
        img.alt = file && file.name ? file.name : 'Image preview';
  
        const txt = uploadArea.querySelectorAll('.upload-text, .upload-subtext');
        txt.forEach(el => el.style.display = 'none');
        const svg = uploadArea.querySelector('.upload-icon');
        if (svg) svg.style.display = 'none';

        // insert at the top of uploadArea
        uploadArea.insertBefore(img, uploadArea.firstChild);
      };
      reader.readAsDataURL(file);
    }

    // If there's an existing image URL (editing), show it on load
    const existing = uploadArea.dataset && uploadArea.dataset.existingImage;
    if (existing) {
      // create an img element pointing to the existing URL
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

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const uploadErrorEl = document.getElementById('uploadError');

    fileInput.addEventListener('change', function(e){
      const f = e.target.files && e.target.files[0];
      if (!f) return clearUploadArea();

      // Clear previous error if any
      if (uploadErrorEl) uploadErrorEl.textContent = '';

      // Reject non-images early
      if (!f.type.startsWith('image/')) {
        if (uploadErrorEl) uploadErrorEl.textContent = 'Selected file is not an image.';
        return clearUploadArea();
      }

      // Client-side size check (friendly UX) - server still enforces the limit.
      if (f.size > MAX_BYTES) {
        if (uploadErrorEl) uploadErrorEl.textContent = 'Selected file is too large. Maximum allowed size is 10 MB.';
        return clearUploadArea();
      }

      showPreview(f);
    });
     
  });
})();
