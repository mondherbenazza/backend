(function(){
  // Only run in browsers
  if (typeof window === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function(){
    // Password toggle functionality
    const passwordToggles = document.querySelectorAll('.password-toggle');

    passwordToggles.forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        const container = this.closest('.password-input-container');
        const input = container.querySelector('.form-input');
        const icon = this.querySelector('.eye-icon');

        if (input.type === 'password') {
          input.type = 'text';
          // Change to eye-off icon
          icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
          input.type = 'password';
          // Change back to eye icon
          icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
      });
    });
  });
})();