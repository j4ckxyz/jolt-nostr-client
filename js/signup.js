import { generateKeys, publishMetadata, getPrivateKeyFromNsec, saveKeysToStorage, uploadImageToBlossom } from './nostr.js';

let generatedKeys = null;
let profilePictureFile = null;

document.getElementById('generate-keys-btn').addEventListener('click', () => {
    generatedKeys = generateKeys();
    
    document.getElementById('nsec-display').value = generatedKeys.nsec;
    document.getElementById('npub-display').value = generatedKeys.npub;
    
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
});

document.getElementById('copy-nsec-btn').addEventListener('click', () => {
    const nsecInput = document.getElementById('nsec-display');
    nsecInput.select();
    navigator.clipboard.writeText(nsecInput.value);
    
    const btn = document.getElementById('copy-nsec-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
});

document.getElementById('copy-npub-btn').addEventListener('click', () => {
    const npubInput = document.getElementById('npub-display');
    npubInput.select();
    navigator.clipboard.writeText(npubInput.value);
    
    const btn = document.getElementById('copy-npub-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
});

document.getElementById('confirm-saved').addEventListener('change', (e) => {
    document.getElementById('continue-btn').disabled = !e.target.checked;
});

document.getElementById('continue-btn').addEventListener('click', () => {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
});

const profilePicInput = document.getElementById('profile-picture');
if (profilePicInput) {
    profilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            profilePictureFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('preview-avatar').src = event.target.result;
                document.getElementById('profile-pic-preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'remove-avatar-btn') {
        profilePictureFile = null;
        document.getElementById('profile-pic-preview').style.display = 'none';
        document.getElementById('preview-avatar').src = '';
        document.getElementById('profile-picture').value = '';
    }
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const about = document.getElementById('about').value;
    const statusDiv = document.getElementById('profile-upload-status');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
        const privateKey = getPrivateKeyFromNsec(generatedKeys.nsec);
        
        let profilePictureUrl = null;
        
        if (profilePictureFile) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading profile picture...';
            statusDiv.textContent = 'Uploading profile picture to Blossom servers...';
            
            try {
                const uploadResult = await uploadImageToBlossom(profilePictureFile, privateKey, 'Profile picture');
                profilePictureUrl = uploadResult.url;
                statusDiv.textContent = 'Profile picture uploaded successfully!';
                console.log('Profile picture uploaded to:', uploadResult.uploadedUrls);
            } catch (uploadError) {
                console.error('Failed to upload profile picture:', uploadError);
                statusDiv.textContent = 'Warning: Profile picture upload failed. Continuing without it.';
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        submitBtn.textContent = 'Creating profile...';
        statusDiv.textContent = 'Publishing profile to Nostr...';
        
        const metadata = {
            name: username,
            about: about
        };
        
        if (profilePictureUrl) {
            metadata.picture = profilePictureUrl;
        }
        
        await publishMetadata(privateKey, metadata);
        
        saveKeysToStorage(generatedKeys.nsec, generatedKeys.npub);
        
        try {
            const { getPublicKey } = await import('https://esm.sh/nostr-tools@2.7.2');
            const publicKeyHex = getPublicKey(privateKey);
            const response = await fetch('/api/register-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pubkey: publicKeyHex })
            });
            if (response.ok) {
                console.log('Registered signup with server');
            }
        } catch (error) {
            console.error('Failed to register signup:', error);
        }
        
        document.getElementById('step3').style.display = 'none';
        document.getElementById('step4').style.display = 'block';
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create My Account';
        statusDiv.textContent = '';
        alert('Error creating profile: ' + error.message);
    }
});
