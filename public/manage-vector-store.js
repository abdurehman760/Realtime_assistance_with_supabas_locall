let documents = [];
let selectedDocs = new Set();
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
// Remove sortOrder variable

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const themeIcon = document.querySelector('.theme-switch i');
    themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function filterDocuments(query) {
    const filtered = query 
        ? documents.filter(doc => 
            doc.content.toLowerCase().includes(query.toLowerCase()) ||
            doc.id.toString().includes(query)
          )
        : documents;
    renderDocuments(filtered);
}

function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (selectedDocs.size > 0) {
        counter.textContent = `(${selectedDocs.size} selected)`;
        counter.classList.remove('hidden');
    } else {
        counter.classList.add('hidden');
    }
}

function toggleDocumentSelection(id, checkbox) {
    if (checkbox.checked) {
        selectedDocs.add(id);
    } else {
        selectedDocs.delete(id);
    }
    updateSelectionCounter();
    updateDeleteButton();
}

function updateDeleteButton() {
    const deleteBtn = document.querySelector('.btn-danger');
    deleteBtn.textContent = selectedDocs.size 
        ? `Delete Selected (${selectedDocs.size})` 
        : 'Delete Selected';
}

function showDeleteConfirmation(type) {
    if (type === 'all' && selectedDocs.size === 0) {
        alert('Please select documents to delete');
        return;
    }

    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');

    title.textContent = `Confirm Delete`;
    message.textContent = type === 'all'
        ? `Delete ${selectedDocs.size} selected documents?`
        : `Delete document #${type}?`;

    confirmBtn.onclick = () => {
        if (type === 'all') {
            deleteSelectedDocuments();
        } else {
            deleteDocument(type);
        }
        hideModal();
    };

    modal.style.display = 'flex';
}

function hideModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

async function deleteSelectedDocuments() {
    try {
        await Promise.all(
            Array.from(selectedDocs).map(id =>
                fetch(`/manage-vector-store/documents/${id}`, {
                    method: 'DELETE'
                })
            )
        );
        selectedDocs.clear();
        await loadDocuments();
    } catch (error) {
        console.error('Error deleting documents:', error);
        alert('Failed to delete some documents. Please try again.');
    }
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.document-checkbox');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const isSelectingAll = selectAllBtn.textContent === 'Select All';

    checkboxes.forEach(checkbox => {
        checkbox.checked = isSelectingAll;
        const docId = parseInt(checkbox.closest('.document-item').id.replace('doc-', ''));
        if (isSelectingAll) {
            selectedDocs.add(docId);
        } else {
            selectedDocs.delete(docId);
        }
    });

    selectAllBtn.textContent = isSelectingAll ? 'Deselect All' : 'Select All';
    updateSelectionCounter();
    updateDeleteButton();
}

// Remove sortDocuments function

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderDocuments(documents);
    }
}

function changePageSize(size) {
    pageSize = parseInt(size);
    currentPage = 1;
    renderDocuments(documents);
}

function updateStats() {
    // Only update doc count, removed last-updated
    const docCountElement = document.getElementById('doc-count');
    if (docCountElement) {
        docCountElement.textContent = documents.length;
    }
}

function renderDocuments(docs) {
    const documentList = document.getElementById('document-list');
    
    if (!docs.length) {
        documentList.innerHTML = `
            <div class="empty-state">
                No documents found
            </div>
        `;
        return;
    }

    // Add pagination logic without sorting
    totalPages = Math.ceil(docs.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const paginatedDocs = docs.slice(start, start + pageSize);
    
    documentList.innerHTML = paginatedDocs.map(doc => `
        <div class="document-item" id="doc-${doc.id}">
            <div class="document-content">
                <div class="document-id">Document ID: ${doc.id}</div>
                <div>${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}</div>
            </div>
            <div class="checkbox-wrapper">
                <input type="checkbox" 
                       class="document-checkbox" 
                       ${selectedDocs.has(doc.id) ? 'checked' : ''} 
                       onclick="event.stopPropagation(); toggleDocumentSelection(${doc.id}, this)">
            </div>
        </div>
    `).join('');

    // Update page info
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;

    // Update Select All button state
    const selectAllBtn = document.getElementById('selectAllBtn');
    selectAllBtn.textContent = selectedDocs.size === docs.length ? 'Deselect All' : 'Select All';

    updateStats();
    updateSelectionCounter();
}

function exportSelected() {
    const selectedData = documents.filter(doc => selectedDocs.has(doc.id));
    const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected-documents.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function loadDocuments() {
    try {
        const [documentsResponse, countResponse] = await Promise.all([
            fetch('/manage-vector-store/documents'),
            fetch('/manage-vector-store/count')
        ]);

        documents = await documentsResponse.json();
        const count = await countResponse.json();

        document.getElementById('doc-count').textContent = `Total Documents: ${count.count || 0}`;
        renderDocuments(documents);
    } catch (error) {
        console.error('Error loading documents:', error);
        document.getElementById('document-list').innerHTML = `
            <div class="empty-state">
                Error loading documents. Please try again.
            </div>
        `;
    }
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// Initial load
loadDocuments();

// Refresh every 30 seconds
setInterval(loadDocuments, 30000);
