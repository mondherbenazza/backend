(function(){
  // Only run in browsers
  if (typeof window === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function(){
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
