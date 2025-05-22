// admin-script.js

/**
 * Admin Panel for SpellcheckService
 * Manages custom words, user suggestions, and dictionary statistics
 */

// State management
const state = {
  currentTab: 'pending',
  currentLanguage: 'no',
  pendingWords: [],
  approvedWords: [],
  rejectedWords: [],
  customWords: [],
  statistics: {},
  modalData: null
};

// DOM elements
const elements = {
  tabs: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  languageSelector: document.getElementById('language-selector'),
  refreshBtn: document.getElementById('refresh-btn'),
  pendingWordsList: document.getElementById('pending-words-list'),
  approvedWordsList: document.getElementById('approved-words-list'),
  rejectedWordsList: document.getElementById('rejected-words-list'),
  customWordsList: document.getElementById('custom-words-list'),
  pendingSearch: document.getElementById('pending-search'),
  approvedSearch: document.getElementById('approved-search'),
  rejectedSearch: document.getElementById('rejected-search'),
  customSearch: document.getElementById('custom-search'),
  newWordInput: document.getElementById('new-word-input'),
  newWordCategory: document.getElementById('new-word-category'),
  newWordNotes: document.getElementById('new-word-notes'),
  addWordBtn: document.getElementById('add-word-btn'),
  modal: document.getElementById('word-modal'),
  modalTitle: document.getElementById('modal-title'),
  wordDetailsContainer: document.getElementById('word-details-container'),
  modalApproveBtn: document.getElementById('modal-approve-btn'),
  modalRejectBtn: document.getElementById('modal-reject-btn'),
  modalDeleteBtn: document.getElementById('modal-delete-btn'),
  modalRestoreBtn: document.getElementById('modal-restore-btn'),
  modalUpdateBtn: document.getElementById('modal-update-btn'),
  closeModal: document.querySelector('.close-modal'),
  statsWordCounts: document.getElementById('stats-word-counts'),
  statsLanguageDist: document.getElementById('stats-language-dist'),
  statsUserActivity: document.getElementById('stats-user-activity'),
  statsSystemStatus: document.getElementById('stats-system-status'),
  toastContainer: document.getElementById('toast-container')
};

// API endpoints
const API = {
  pendingWords: '/api/words/pending',
  approvedWords: '/api/words/approved',
  rejectedWords: '/api/words/rejected',
  customWords: '/api/words/custom',
  wordDetails: (word, lang) => `/api/words/${encodeURIComponent(word)}?lang=${lang}`,
  approveWord: '/api/words/approve',
  rejectWord: '/api/words/reject',
  deleteWord: '/api/words/delete',
  restoreWord: '/api/words/restore',
  addWord: '/api/words/add',
  updateWord: '/api/words/update',
  stats: '/api/words/stats'
};

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadInitialData();
});

/**
 * Set up event listeners for UI interactions
 */
const setupEventListeners = () => {
  // Tab navigation
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Language selector
  elements.languageSelector.addEventListener('change', () => {
    state.currentLanguage = elements.languageSelector.value;
    loadTabData(state.currentTab);
  });

  // Refresh button
  elements.refreshBtn.addEventListener('click', () => {
    loadTabData(state.currentTab);
    showToast('Data refreshed successfully', 'success');
  });

  // Search inputs
  elements.pendingSearch.addEventListener('input', () => filterWords('pending'));
  elements.approvedSearch.addEventListener('input', () => filterWords('approved'));
  elements.rejectedSearch.addEventListener('input', () => filterWords('rejected'));
  elements.customSearch.addEventListener('input', () => filterWords('custom'));

  // Add word button
  elements.addWordBtn.addEventListener('click', addNewWord);

  // Modal controls
  elements.closeModal.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => {
    if (e.target === elements.modal) {
      closeModal();
    }
  });

  // Modal action buttons
  elements.modalApproveBtn.addEventListener('click', () => handleModalAction('approve'));
  elements.modalRejectBtn.addEventListener('click', () => handleModalAction('reject'));
  elements.modalDeleteBtn.addEventListener('click', () => handleModalAction('delete'));
  elements.modalRestoreBtn.addEventListener('click', () => handleModalAction('restore'));
  elements.modalUpdateBtn.addEventListener('click', () => handleModalAction('update'));
};

/**
 * Load initial data for the admin panel
 */
const loadInitialData = () => {
  state.currentLanguage = elements.languageSelector.value;
  loadTabData('pending'); // Default tab
};

/**
 * Switch between tabs
 * @param {string} tabName - Name of the tab to switch to
 */
const switchTab = (tabName) => {
  // Update active tab
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Show selected tab content
  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  state.currentTab = tabName;
  loadTabData(tabName);
};

/**
 * Load data for the selected tab
 * @param {string} tabName - Name of the tab to load data for
 */
const loadTabData = async (tabName) => {
  try {
    switch (tabName) {
      case 'pending':
        await loadPendingWords();
        break;
      case 'approved':
        await loadApprovedWords();
        break;
      case 'rejected':
        await loadRejectedWords();
        break;
      case 'custom':
        await loadCustomWords();
        break;
      case 'stats':
        await loadStatistics();
        break;
      default:
        console.error('Unknown tab:', tabName);
    }
  } catch (error) {
    console.error(`Error loading data for tab ${tabName}:`, error);
    showToast(`Failed to load data: ${error.message}`, 'error');
  }
};

/**
 * Load pending word suggestions
 */
const loadPendingWords = async () => {
  setLoading('pending', true);
  
  try {
    const response = await fetch(`${API.pendingWords}?lang=${state.currentLanguage}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    state.pendingWords = data;
    
    renderWordsList('pending', state.pendingWords);
  } catch (error) {
    console.error('Error loading pending words:', error);
    showToast(`Failed to load pending words: ${error.message}`, 'error');
    renderErrorState('pending');
  } finally {
    setLoading('pending', false);
  }
};

/**
 * Load approved word suggestions
 */
const loadApprovedWords = async () => {
  setLoading('approved', true);
  
  try {
    const response = await fetch(`${API.approvedWords}?lang=${state.currentLanguage}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    state.approvedWords = data;
    
    renderWordsList('approved', state.approvedWords);
  } catch (error) {
    console.error('Error loading approved words:', error);
    showToast(`Failed to load approved words: ${error.message}`, 'error');
    renderErrorState('approved');
  } finally {
    setLoading('approved', false);
  }
};

/**
 * Load rejected word suggestions
 */
const loadRejectedWords = async () => {
  setLoading('rejected', true);
  
  try {
    const response = await fetch(`${API.rejectedWords}?lang=${state.currentLanguage}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    state.rejectedWords = data;
    
    renderWordsList('rejected', state.rejectedWords);
  } catch (error) {
    console.error('Error loading rejected words:', error);
    showToast(`Failed to load rejected words: ${error.message}`, 'error');
    renderErrorState('rejected');
  } finally {
    setLoading('rejected', false);
  }
};

/**
 * Load custom dictionary words
 */
const loadCustomWords = async () => {
  setLoading('custom', true);
  
  try {
    const response = await fetch(`${API.customWords}?lang=${state.currentLanguage}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    state.customWords = data;
    
    renderWordsList('custom', state.customWords);
  } catch (error) {
    console.error('Error loading custom words:', error);
    showToast(`Failed to load custom words: ${error.message}`, 'error');
    renderErrorState('custom');
  } finally {
    setLoading('custom', false);
  }
};

/**
 * Load statistics data
 */
const loadStatistics = async () => {
  try {
    const response = await fetch(API.stats);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    state.statistics = data;
    
    renderStatistics();
  } catch (error) {
    console.error('Error loading statistics:', error);
    showToast(`Failed to load statistics: ${error.message}`, 'error');
    renderErrorState('stats');
  }
};

/**
 * Render words list for a specific tab
 * @param {string} tabType - Type of tab ('pending', 'approved', 'rejected', 'custom')
 * @param {Array} words - List of words to render
 */
const renderWordsList = (tabType, words) => {
  const listElement = document.getElementById(`${tabType}-words-list`);
  if (!listElement) return;
  
  if (!words || words.length === 0) {
    listElement.innerHTML = `<tr><td colspan="7" class="no-data">No ${tabType} words found.</td></tr>`;
    return;
  }
  
  // Prepare HTML content based on tab type
  const rows = words.map(word => {
    switch (tabType) {
      case 'pending':
        return `
          <tr data-word="${escapeHtml(word.word)}" data-lang="${escapeHtml(word.language || state.currentLanguage)}">
            <td>${escapeHtml(word.word)}</td>
            <td>${escapeHtml(word.language || state.currentLanguage)}</td>
            <td>${word.votes || 0}</td>
            <td>${formatDate(word.addedAt)}</td>
            <td>
              <button class="btn btn-sm btn-success action-btn" data-action="view" title="View Details">View</button>
              <button class="btn btn-sm btn-primary action-btn" data-action="approve" title="Approve Word">✓</button>
              <button class="btn btn-sm btn-danger action-btn" data-action="reject" title="Reject Word">✗</button>
            </td>
          </tr>
        `;
      
      case 'approved':
        return `
          <tr data-word="${escapeHtml(word.word)}" data-lang="${escapeHtml(word.language || state.currentLanguage)}">
            <td>${escapeHtml(word.word)}</td>
            <td>${escapeHtml(word.language || state.currentLanguage)}</td>
            <td>${escapeHtml(word.approvedBy || 'System')}</td>
            <td>${formatDate(word.approvedAt || word.addedAt)}</td>
            <td>
              <button class="btn btn-sm btn-success action-btn" data-action="view" title="View Details">View</button>
              <button class="btn btn-sm btn-danger action-btn" data-action="delete" title="Delete Word">✗</button>
            </td>
          </tr>
        `;
      
      case 'rejected':
        return `
          <tr data-word="${escapeHtml(word.word)}" data-lang="${escapeHtml(word.language || state.currentLanguage)}">
            <td>${escapeHtml(word.word)}</td>
            <td>${escapeHtml(word.language || state.currentLanguage)}</td>
            <td>${escapeHtml(word.rejectedBy || 'System')}</td>
            <td>${formatDate(word.rejectedAt || word.addedAt)}</td>
            <td>${escapeHtml(word.rejectionReason || '')}</td>
            <td>
              <button class="btn btn-sm btn-success action-btn" data-action="view" title="View Details">View</button>
              <button class="btn btn-sm btn-secondary action-btn" data-action="restore" title="Restore Word">↺</button>
            </td>
          </tr>
        `;
      
      case 'custom':
        return `
          <tr data-word="${escapeHtml(word.word)}" data-lang="${escapeHtml(word.language || state.currentLanguage)}">
            <td>${escapeHtml(word.word)}</td>
            <td>${escapeHtml(word.language || state.currentLanguage)}</td>
            <td>${escapeHtml(word.category || 'General')}</td>
            <td>${escapeHtml(word.addedBy || 'System')}</td>
            <td>${formatDate(word.addedAt)}</td>
            <td>${escapeHtml(word.notes || '')}</td>
            <td>
              <button class="btn btn-sm btn-success action-btn" data-action="view" title="View Details">View</button>
              <button class="btn btn-sm btn-primary action-btn" data-action="edit" title="Edit Word">✎</button>
              <button class="btn btn-sm btn-danger action-btn" data-action="delete" title="Delete Word">✗</button>
            </td>
          </tr>
        `;
      
      default:
        return '';
    }
  }).join('');
  
  listElement.innerHTML = rows;
  
  // Add event listeners for action buttons
  listElement.querySelectorAll('.action-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const row = e.target.closest('tr');
      const word = row.dataset.word;
      const lang = row.dataset.lang;
      
      handleWordAction(action, word, lang, tabType);
    });
  });
};

/**
 * Handle word action (view, approve, reject, etc.)
 * @param {string} action - Action to perform
 * @param {string} word - Word to act on
 * @param {string} lang - Language of the word
 * @param {string} tabType - Current tab type
 */
const handleWordAction = async (action, word, lang, tabType) => {
  switch (action) {
    case 'view':
      await openWordDetails(word, lang, tabType);
      break;
    
    case 'approve':
      await approveWord(word, lang);
      break;
    
    case 'reject':
      await openRejectModal(word, lang);
      break;
    
    case 'delete':
      if (confirm(`Are you sure you want to delete the word "${word}"?`)) {
        await deleteWord(word, lang, tabType);
      }
      break;
    
    case 'restore':
      await restoreWord(word, lang);
      break;
    
    case 'edit':
      await openEditModal(word, lang);
      break;
    
    default:
      console.error('Unknown action:', action);
  }
};

/**
 * Open word details in modal
 * @param {string} word - Word to show details for
 * @param {string} lang - Language of the word
 * @param {string} tabType - Current tab type
 */
const openWordDetails = async (word, lang, tabType) => {
  try {
    const response = await fetch(API.wordDetails(word, lang));
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const wordData = await response.json();
    state.modalData = { ...wordData, type: tabType };
    
    // Prepare modal
    elements.modalTitle.textContent = `Word Details: ${word}`;
    
    // Populate word details
    let detailsHTML = '';
    
    // Common fields
    detailsHTML += createDetailRow('Word', wordData.word);
    detailsHTML += createDetailRow('Language', wordData.language || lang);
    
    // Tab-specific fields
    switch (tabType) {
      case 'pending':
        detailsHTML += createDetailRow('Votes', wordData.votes || 0);
        detailsHTML += createDetailRow('Added Date', formatDate(wordData.addedAt));
        if (wordData.voters && wordData.voters.length) {
          detailsHTML += createDetailRow('Voters', wordData.voters.join(', '));
        }
        if (wordData.contexts && wordData.contexts.length) {
          detailsHTML += createDetailRow('Example Contexts', wordData.contexts.join('<br>'));
        }
        if (wordData.notes) {
          detailsHTML += createDetailRow('Notes', wordData.notes);
        }
        break;
      
      case 'approved':
        detailsHTML += createDetailRow('Approved By', wordData.approvedBy || 'System');
        detailsHTML += createDetailRow('Approval Date', formatDate(wordData.approvedAt || wordData.addedAt));
        if (wordData.votes) {
          detailsHTML += createDetailRow('Original Votes', wordData.votes);
        }
        if (wordData.notes) {
          detailsHTML += createDetailRow('Notes', wordData.notes);
        }
        break;
      
      case 'rejected':
        detailsHTML += createDetailRow('Rejected By', wordData.rejectedBy || 'System');
        detailsHTML += createDetailRow('Rejection Date', formatDate(wordData.rejectedAt || wordData.addedAt));
        detailsHTML += createDetailRow('Reason', wordData.rejectionReason || 'No reason provided');
        if (wordData.votes) {
          detailsHTML += createDetailRow('Original Votes', wordData.votes);
        }
        if (wordData.notes) {
          detailsHTML += createDetailRow('Notes', wordData.notes);
        }
        break;
      
      case 'custom':
        detailsHTML += createDetailRow('Category', wordData.category || 'General');
        detailsHTML += createDetailRow('Added By', wordData.addedBy || 'System');
        detailsHTML += createDetailRow('Added Date', formatDate(wordData.addedAt));
        if (wordData.notes) {
          detailsHTML += createDetailRow('Notes', wordData.notes);
        }
        break;
    }
    
    elements.wordDetailsContainer.innerHTML = detailsHTML;
    
    // Show/hide buttons based on tab type
    elements.modalApproveBtn.style.display = tabType === 'pending' ? 'block' : 'none';
    elements.modalRejectBtn.style.display = tabType === 'pending' ? 'block' : 'none';
    elements.modalDeleteBtn.style.display = ['approved', 'custom'].includes(tabType) ? 'block' : 'none';
    elements.modalRestoreBtn.style.display = tabType === 'rejected' ? 'block' : 'none';
    elements.modalUpdateBtn.style.display = tabType === 'custom' ? 'block' : 'none';
    
    // Show modal
    elements.modal.style.display = 'block';
  } catch (error) {
    console.error('Error fetching word details:', error);
    showToast(`Failed to load word details: ${error.message}`, 'error');
  }
};

/**
 * Handle modal action button clicks
 * @param {string} action - Action to perform ('approve', 'reject', 'delete', 'restore', 'update')
 */
const handleModalAction = async (action) => {
  if (!state.modalData) return;
  
  const { word, language, type } = state.modalData;
  
  switch (action) {
    case 'approve':
      await approveWord(word, language);
      closeModal();
      break;
    
    case 'reject':
      await openRejectModal(word, language);
      break;
    
    case 'delete':
      if (confirm(`Are you sure you want to delete the word "${word}"?`)) {
        await deleteWord(word, language, type);
        closeModal();
      }
      break;
    
    case 'restore':
      await restoreWord(word, language);
      closeModal();
      break;
    
    case 'update':
      await openEditModal(word, language);
      break;
  }
};

/**
 * Open reject modal to get rejection reason
 * @param {string} word - Word to reject
 * @param {string} lang - Language of the word
 */
const openRejectModal = async (word, lang) => {
  const reason = prompt(`Enter reason for rejecting "${word}" (optional):`);
  if (reason !== null) { // Not canceled
    await rejectWord(word, lang, reason);
    closeModal();
  }
};

/**
 * Open edit modal for custom word
 * @param {string} word - Word to edit
 * @param {string} lang - Language of the word
 */
const openEditModal = async (word, lang) => {
  // Implementation for editing a word would go here
  // For simplicity, we'll just use prompts
  const category = prompt('Enter category:', state.modalData.category || 'General');
  if (category === null) return; // Canceled
  
  const notes = prompt('Enter notes:', state.modalData.notes || '');
  if (notes === null) return; // Canceled
  
  await updateWord(word, lang, category, notes);
  closeModal();
};

/**
 * Close the details modal
 */
const closeModal = () => {
  elements.modal.style.display = 'none';
  state.modalData = null;
};

/**
 * Add a new custom word
 */
const addNewWord = async () => {
  const word = elements.newWordInput.value.trim();
  const category = elements.newWordCategory.value;
  const notes = elements.newWordNotes.value.trim();
  const lang = state.currentLanguage;
  
  if (!word) {
    showToast('Please enter a word', 'warning');
    return;
  }
  
  try {
    const response = await fetch(API.addWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang, category, notes })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Clear form
    elements.newWordInput.value = '';
    elements.newWordCategory.value = 'general';
    elements.newWordNotes.value = '';
    
    // Reload custom words list
    await loadCustomWords();
    showToast(`Word "${word}" added successfully`, 'success');
  } catch (error) {
    console.error('Error adding word:', error);
    showToast(`Failed to add word: ${error.message}`, 'error');
  }
};

/**
 * Approve a pending word suggestion
 * @param {string} word - Word to approve
 * @param {string} lang - Language of the word
 */
const approveWord = async (word, lang) => {
  try {
    const response = await fetch(API.approveWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Reload word lists
    await loadPendingWords();
    await loadApprovedWords();
    showToast(`Word "${word}" approved successfully`, 'success');
  } catch (error) {
    console.error('Error approving word:', error);
    showToast(`Failed to approve word: ${error.message}`, 'error');
  }
};

/**
 * Reject a pending word suggestion
 * @param {string} word - Word to reject
 * @param {string} lang - Language of the word
 * @param {string} reason - Rejection reason
 */
const rejectWord = async (word, lang, reason = '') => {
  try {
    const response = await fetch(API.rejectWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang, reason })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Reload word lists
    await loadPendingWords();
    await loadRejectedWords();
    showToast(`Word "${word}" rejected successfully`, 'success');
  } catch (error) {
    console.error('Error rejecting word:', error);
    showToast(`Failed to reject word: ${error.message}`, 'error');
  }
};

/**
 * Delete a word
 * @param {string} word - Word to delete
 * @param {string} lang - Language of the word
 * @param {string} tabType - Current tab type
 */
const deleteWord = async (word, lang, tabType) => {
  try {
    const response = await fetch(API.deleteWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang, type: tabType })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Reload word lists based on tab type
    if (tabType === 'custom') {
      await loadCustomWords();
    } else if (tabType === 'approved') {
      await loadApprovedWords();
    }
    
    showToast(`Word "${word}" deleted successfully`, 'success');
  } catch (error) {
    console.error('Error deleting word:', error);
    showToast(`Failed to delete word: ${error.message}`, 'error');
  }
};

/**
 * Restore a rejected word to pending status
 * @param {string} word - Word to restore
 * @param {string} lang - Language of the word
 */
const restoreWord = async (word, lang) => {
  try {
    const response = await fetch(API.restoreWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Reload word lists
    await loadRejectedWords();
    await loadPendingWords();
    showToast(`Word "${word}" restored to pending successfully`, 'success');
  } catch (error) {
    console.error('Error restoring word:', error);
    showToast(`Failed to restore word: ${error.message}`, 'error');
  }
};

/**
 * Update a custom word
 * @param {string} word - Word to update
 * @param {string} lang - Language of the word
 * @param {string} category - New category
 * @param {string} notes - New notes
 */
const updateWord = async (word, lang, category, notes) => {
  try {
    const response = await fetch(API.updateWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ word, lang, category, notes })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    
    // Reload custom words list
    await loadCustomWords();
    showToast(`Word "${word}" updated successfully`, 'success');
  } catch (error) {
    console.error('Error updating word:', error);
    showToast(`Failed to update word: ${error.message}`, 'error');
  }
};

/**
 * Filter words list based on search input
 * @param {string} tabType - Type of tab to filter
 */
const filterWords = (tabType) => {
  const searchInput = document.getElementById(`${tabType}-search`);
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  let wordsList;
  
  switch (tabType) {
    case 'pending':
      wordsList = state.pendingWords;
      break;
    case 'approved':
      wordsList = state.approvedWords;
      break;
    case 'rejected':
      wordsList = state.rejectedWords;
      break;
    case 'custom':
      wordsList = state.customWords;
      break;
    default:
      return;
  }
  
  if (searchTerm === '') {
    renderWordsList(tabType, wordsList);
    return;
  }
  
  const filteredWords = wordsList.filter(word => {
    return word.word.toLowerCase().includes(searchTerm);
  });
  
  renderWordsList(tabType, filteredWords);
};

/**
 * Render statistics on the stats tab
 */
const renderStatistics = () => {
  if (!state.statistics) return;
  
  // Word counts
  const wordCountsHtml = `
    <div class="stats-grid">
      <div class="stats-item"><strong>Custom Words:</strong> ${state.statistics.customWordCount || 0}</div>
      <div class="stats-item"><strong>Pending Suggestions:</strong> ${state.statistics.pendingCount || 0}</div>
      <div class="stats-item"><strong>Approved Suggestions:</strong> ${state.statistics.approvedCount || 0}</div>
      <div class="stats-item"><strong>Rejected Suggestions:</strong> ${state.statistics.rejectedCount || 0}</div>
      <div class="stats-item"><strong>Total Words:</strong> ${state.statistics.totalWordCount || 0}</div>
    </div>
  `;
  elements.statsWordCounts.innerHTML = wordCountsHtml;
  
  // Language distribution
  let langDistHtml = '<div class="stats-grid">';
  if (state.statistics.languageDistribution) {
    for (const lang in state.statistics.languageDistribution) {
      langDistHtml += `
        <div class="stats-item"><strong>${lang.toUpperCase()}:</strong> ${state.statistics.languageDistribution[lang] || 0}</div>
      `;
    }
  }
  langDistHtml += '</div>';
  elements.statsLanguageDist.innerHTML = langDistHtml;
  
  // User activity
  const userActivityHtml = `
    <div class="stats-grid">
      <div class="stats-item"><strong>Recent Suggestions:</strong> ${state.statistics.recentSuggestions || 0} (last 7 days)</div>
      <div class="stats-item"><strong>Active Users:</strong> ${state.statistics.activeUsers || 0}</div>
      <div class="stats-item"><strong>Total Feedback Count:</strong> ${state.statistics.totalFeedbackCount || 0}</div>
    </div>
  `;
  elements.statsUserActivity.innerHTML = userActivityHtml;
  
  // System status
  const systemStatusHtml = `
    <div class="stats-grid">
      <div class="stats-item"><strong>Last Updated:</strong> ${formatDate(state.statistics.lastUpdated)}</div>
      <div class="stats-item"><strong>Database Status:</strong> <span class="status-indicator ${state.statistics.databaseStatus === 'OK' ? 'status-ok' : 'status-error'}">${state.statistics.databaseStatus || 'Unknown'}</span></div>
      <div class="stats-item"><strong>Cache Hit Rate:</strong> ${state.statistics.cacheHitRate || '0'}%</div>
    </div>
  `;
  elements.statsSystemStatus.innerHTML = systemStatusHtml;
};

/**
 * Set loading state for a tab
 * @param {string} tabType - Type of tab
 * @param {boolean} isLoading - Whether the tab is loading
 */
const setLoading = (tabType, isLoading) => {
  const listElement = document.getElementById(`${tabType}-words-list`);
  if (!listElement) return;
  
  if (isLoading) {
    listElement.innerHTML = `<tr class="loading-row"><td colspan="7">Loading ${tabType} words...</td></tr>`;
  }
};

/**
 * Render error state for a tab
 * @param {string} tabType - Type of tab
 */
const renderErrorState = (tabType) => {
  const listElement = document.getElementById(`${tabType}-words-list`);
  if (!listElement) return;
  
  listElement.innerHTML = `<tr class="error-row"><td colspan="7">Failed to load ${tabType} words. Please try again.</td></tr>`;
};

/**
 * Create a detail row for the modal
 * @param {string} label - Label for the detail
 * @param {string} value - Value of the detail
 * @returns {string} HTML for the detail row
 */
const createDetailRow = (label, value) => {
  return `
    <div class="detail-row">
      <div class="detail-label">${label}:</div>
      <div class="detail-value">${value}</div>
    </div>
  `;
};

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch (error) {
    return dateString;
  }
};

/**
 * Show a toast message
 * @param {string} message - Message to show
 * @param {string} type - Type of toast ('success', 'error', 'info', 'warning')
 */
const showToast = (message, type = 'info') => {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  elements.toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      elements.toastContainer.removeChild(toast);
    }, 300);
  }, 3000);
};

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Unsafe string that might contain HTML
 * @returns {string} - Safe string with HTML characters escaped
 */
const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};