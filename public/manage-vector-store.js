/**
 * @fileoverview Document management system for vector store
 * Handles document CRUD operations, pagination, and UI interactions
 */

// Constants
const REFRESH_INTERVAL = 30000;  // Auto-refresh interval in milliseconds
const DEFAULT_THEME = 'light';   // Default theme setting

// Global State Variables
/**
 * @type {Array} - Array to store all documents
 */
let documents = [];          

/**
 * @type {Set} - Set to track selected document IDs
 */
let selectedDocs = new Set(); 

/**
 * @type {number} - Current page number for pagination
 */
let currentPage = 1;         

/**
 * @type {number} - Number of documents to display per page
 */
let pageSize = 10;          

/**
 * @type {number} - Total number of pages based on document count
 */
let totalPages = 1;         

/**
 * Toggles between light and dark theme
 * Updates theme in localStorage and updates UI elements
 */
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

/**
 * Filters documents based on search query
 * @param {string} query - Search text to filter documents
 * @returns {void}
 */
function filterDocuments(query) {
    const filtered = query 
        ? documents.filter(doc => 
            doc.content.toLowerCase().includes(query.toLowerCase()) ||
            doc.id.toString().includes(query)
          )
        : documents;
    renderDocuments(filtered);
}

/**
 * Updates the selection counter in the UI
 * Shows/hides counter based on selection state
 * @returns {void}
 */
function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (selectedDocs.size > 0) {
        counter.textContent = `(${selectedDocs.size} selected)`;
        counter.classList.remove('hidden');
    } else {
        counter.classList.add('hidden');
    }
}

/**
 * Toggles selection state of a document
 * @param {number} id - Document ID to toggle
 * @param {HTMLInputElement} checkbox - Checkbox element that triggered the toggle
 * @returns {void}
 */
function toggleDocumentSelection(id, checkbox) {
    if (checkbox.checked) {
        selectedDocs.add(id);
    } else {
        selectedDocs.delete(id);
    }
    updateSelectionCounter();
    updateDeleteButton();
}

/**
 * Updates delete button text with selection count
 * @returns {void}
 */
function updateDeleteButton() {
    const deleteBtn = document.querySelector('.btn-danger');
    deleteBtn.textContent = selectedDocs.size 
        ? `Delete Selected (${selectedDocs.size})` 
        : 'Delete Selected';
}

/**
 * Shows delete confirmation modal
 * @param {string|number} type - 'all' for bulk delete or document ID for single delete
 * @returns {void}
 */
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

/**
 * Hides the confirmation modal
 * @returns {void}
 */
function hideModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

/**
 * Deletes multiple selected documents
 * Makes parallel API calls for deletion
 * @returns {Promise<void>}
 */
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

/**
 * Toggles selection of all documents on current page
 * Updates UI elements accordingly
 * @returns {void}
 */
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

/**
 * Changes the current page
 * @param {number} delta - Page change amount (+1 or -1)
 * @returns {void}
 */
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderDocuments(documents);
    }
}

/**
 * Updates number of items shown per page
 * @param {number} size - New page size
 * @returns {void}
 */
function changePageSize(size) {
    pageSize = parseInt(size);
    currentPage = 1;
    renderDocuments(documents);
}

/**
 * Updates document count in the UI
 * @returns {void}
 */
function updateStats() {
    const docCountElement = document.getElementById('doc-count');
    if (docCountElement) {
        docCountElement.textContent = documents.length;
    }
}

/**
 * Renders documents with pagination
 * @param {Array} docs - Array of documents to display
 * @returns {void}
 */
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

/**
 * Exports selected documents as JSON file
 * Creates and triggers download of selected documents
 * @returns {void}
 */
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

/**
 * Loads documents from server
 * Fetches both documents and count
 * @returns {Promise<void>}
 */
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

// Initialization
const savedTheme = localStorage.getItem('theme') || DEFAULT_THEME;
document.documentElement.setAttribute('data-theme', savedTheme);

// Initial document load
loadDocuments();

// Setup auto-refresh interval
setInterval(loadDocuments, REFRESH_INTERVAL);
