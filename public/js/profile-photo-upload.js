document.addEventListener('DOMContentLoaded', function() {
    const profilePhotoContainer = document.getElementById('profile-photo-container');
    const profilePhotoInput = document.getElementById('profile-photo-input');
    const profilePhotoImg = document.getElementById('profile-photo-img');
    const profilePhotoDefault = document.getElementById('profile-photo-default');

    if (!profilePhotoContainer || !profilePhotoInput) {
        return;
    }

    // Make the profile photo clickable
    profilePhotoContainer.addEventListener('click', function() {
        profilePhotoInput.click();
    });

    // Handle file selection
    profilePhotoInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image is too large. Maximum size is 10MB');
            return;
        }

        // Show loading state
        profilePhotoContainer.style.opacity = '0.5';
        profilePhotoContainer.style.cursor = 'wait';

        try {
            const formData = new FormData();
            formData.append('profilePhoto', file);

            const response = await fetch('/upload-profile-photo', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update the profile photo display
                if (profilePhotoImg) {
                    profilePhotoImg.src = data.profilePhotoUrl;
                } else if (profilePhotoDefault) {
                    // Replace default with actual image
                    const newImg = document.createElement('img');
                    newImg.id = 'profile-photo-img';
                    newImg.src = data.profilePhotoUrl;
                    newImg.alt = 'Profile';
                    newImg.className = 'profile-photo';
                    profilePhotoDefault.replaceWith(newImg);
                }
                
                // Reset opacity and cursor
                profilePhotoContainer.style.opacity = '1';
                profilePhotoContainer.style.cursor = 'pointer';
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading profile photo:', error);
            alert('Failed to upload profile photo. Please try again.');
            profilePhotoContainer.style.opacity = '1';
            profilePhotoContainer.style.cursor = 'pointer';
        }

        // Reset the input
        profilePhotoInput.value = '';
    });
});
