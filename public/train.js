document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('status');
    const file = document.getElementById('pdfFile').files[0];
    const submitButton = e.target.querySelector('button');
    
    if (!file) {
        updateStatus('Please select a PDF file', 'error');
        return;
    }

    // File size check (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        updateStatus('File size exceeds 10MB limit', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        submitButton.disabled = true;
        updateStatus(`
            <div class="loading-spinner"></div>
            <div>Processing your file: ${file.name}</div>
            <div class="progress-bar">
                <div class="progress-bar-fill"></div>
            </div>
        `, 'loading');

        const response = await fetch('/pdf-loader/upload-and-train', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(errorData || 'Upload failed');
        }
        
        const result = await response.json();
        updateStatus(`
            <div>✅ Success!</div>
            <div>${result.message}</div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                File processed and cleaned up successfully.
                <a href="index.html">You can now ask questions about this document in the chat.</a>
            </div>
        `, 'success');

        // Clear the file input
        document.getElementById('pdfFile').value = '';
        
    } catch (error) {
        updateStatus(`
            <div>❌ Error occurred</div>
            <div>${error.message}</div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                The uploaded file has been cleaned up. Please try again or contact support if the problem persists.
            </div>
        `, 'error');
    } finally {
        submitButton.disabled = false;
    }
});

function updateStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = message;
    status.className = 'status active ' + type;
}

// Add file input change listener for immediate feedback
document.getElementById('pdfFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        updateStatus(`Selected file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'loading');
    } else {
        updateStatus('', '');
    }
});

// Add theme toggle function
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const themeIcon = document.querySelector('.theme-toggle i');
    themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Set initial theme
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.querySelector('.theme-toggle i');
    themeIcon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
});
