/**
 * YouTube Course Assistant - Options Page Script
 * Handles settings management and storage operations
 */

// DOM elements
let apiKeyInput, saveBtn, testBtn, statusDiv, storageInfo, clearStorageBtn, refreshStorageBtn;

/**
 * Initialize options page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM element references
  apiKeyInput = document.getElementById('apiKey');
  saveBtn = document.getElementById('saveBtn');
  testBtn = document.getElementById('testBtn');
  statusDiv = document.getElementById('status');
  storageInfo = document.getElementById('storageInfo');
  clearStorageBtn = document.getElementById('clearStorageBtn');
  refreshStorageBtn = document.getElementById('refreshStorageBtn');
  
  // Load existing settings
  await loadSettings();
  
  // Update storage information
  await updateStorageInfo();
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Set up all event listeners for the options page
 */
function setupEventListeners() {
  // Save settings button
  saveBtn.addEventListener('click', handleSaveSettings);
  
  // Test API key button
  testBtn.addEventListener('click', handleTestApiKey);
  
  // Clear storage button
  clearStorageBtn.addEventListener('click', handleClearStorage);
  
  // Refresh storage info button
  refreshStorageBtn.addEventListener('click', updateStorageInfo);
  
  // Enter key in API key input
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSaveSettings();
    }
  });
  
  // Hide status on input change
  apiKeyInput.addEventListener('input', () => {
    hideStatus();
  });
}

/**
 * Load existing settings from storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load existing settings', 'error');
  }
}

/**
 * Handle save settings button click
 */
async function handleSaveSettings() {
  const apiKey = apiKeyInput.value.trim();
  
  // Validate API key
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    apiKeyInput.focus();
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    showStatus('API key should start with "sk-"', 'error');
    apiKeyInput.focus();
    return;
  }
  
  if (apiKey.length < 20) {
    showStatus('API key appears to be too short', 'error');
    apiKeyInput.focus();
    return;
  }
  
  // Save to storage
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
  
  try {
    await chrome.storage.sync.set({ openaiApiKey: apiKey });
    showStatus('✅ Settings saved successfully!', 'success');
    
    // Auto-test the API key after saving
    setTimeout(() => {
      if (!testBtn.disabled) {
        handleTestApiKey();
      }
    }, 1000);
    
  } catch (error) {
    console.error('Save error:', error);
    showStatus('❌ Failed to save settings: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '💾 Save Settings';
  }
}

/**
 * Handle test API key button click
 */
async function handleTestApiKey() {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key first', 'error');
    apiKeyInput.focus();
    return;
  }
  
  testBtn.disabled = true;
  testBtn.innerHTML = '<span class="loading-spinner"></span> Testing...';
  
  try {
    // Test API key by making a simple request to list models
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const hasRequiredModels = data.data.some(model => 
        model.id.includes('text-embedding-3-small') || model.id.includes('gpt-3.5-turbo')
      );
      
      if (hasRequiredModels) {
        showStatus('✅ API key is valid and has access to required models!', 'success');
      } else {
        showStatus('⚠️ API key is valid but may not have access to required models', 'error');
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      showStatus(`❌ API key test failed: ${errorMessage}`, 'error');
    }
    
  } catch (error) {
    console.error('Test error:', error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showStatus('❌ Network error: Please check your internet connection', 'error');
    } else {
      showStatus('❌ Test failed: ' + error.message, 'error');
    }
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = '🧪 Test API Key';
  }
}

/**
 * Handle clear storage button click
 */
async function handleClearStorage() {
  const confirmMessage = `Are you sure you want to clear all cached transcript and embedding data?

This will:
• Remove all processed transcripts
• Delete all generated embeddings
• Force re-processing of videos

This action cannot be undone.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  clearStorageBtn.disabled = true;
  clearStorageBtn.innerHTML = '<span class="loading-spinner"></span> Clearing...';
  
  try {
    // Get all storage data first to show what's being cleared
    const allData = await chrome.storage.local.get();
    const dataKeys = Object.keys(allData).filter(key => 
      key.startsWith('transcript_') || 
      key.startsWith('chunks_') || 
      key.startsWith('embeddings_')
    );
    
    // Clear all local storage (this preserves sync storage with API key)
    await chrome.storage.local.clear();
    
    showStatus(`✅ Cleared ${dataKeys.length} cached entries successfully!`, 'success');
    
    // Update storage info
    await updateStorageInfo();
    
  } catch (error) {
    console.error('Clear storage error:', error);
    showStatus('❌ Failed to clear storage: ' + error.message, 'error');
  } finally {
    clearStorageBtn.disabled = false;
    clearStorageBtn.innerHTML = '🗑️ Clear All Cached Data';
  }
}

/**
 * Update storage information display
 */
async function updateStorageInfo() {
  try {
    const data = await chrome.storage.local.get();
    const keys = Object.keys(data);
    
    // Count different types of cached data
    const transcriptCount = keys.filter(k => k.startsWith('transcript_')).length;
    const chunkCount = keys.filter(k => k.startsWith('chunks_')).length;
    const embeddingCount = keys.filter(k => k.startsWith('embeddings_')).length;
    
    // Calculate storage usage
    const dataSize = JSON.stringify(data).length;
    const sizeMB = (dataSize / (1024 * 1024)).toFixed(2);
    const sizeKB = (dataSize / 1024).toFixed(1);
    
    // Storage limit warning
    const storageLimit = 10; // MB
    const usagePercent = ((dataSize / (storageLimit * 1024 * 1024)) * 100).toFixed(1);
    
    // Build storage info HTML
    storageInfo.innerHTML = `
      <div class="metric">
        <span class="metric-label">Cached Videos:</span>
        <span class="metric-value">${transcriptCount}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Chunk Sets:</span>
        <span class="metric-value">${chunkCount}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Embedding Sets:</span>
        <span class="metric-value">${embeddingCount}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Storage Used:</span>
        <span class="metric-value">${sizeMB} MB (${usagePercent}% of 10MB limit)</span>
      </div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
        ${dataSize > 8 * 1024 * 1024 ? 
          '⚠️ Storage usage is high. Consider clearing old data or add unlimitedStorage permission.' :
          '✅ Storage usage is within normal limits.'
        }
      </div>
    `;
    
    // Update refresh button
    refreshStorageBtn.innerHTML = '🔄 Refresh Info';
    refreshStorageBtn.disabled = false;
    
  } catch (error) {
    console.error('Storage info error:', error);
    storageInfo.innerHTML = `
      <div style="color: #dc3545;">
        ❌ Failed to load storage information: ${error.message}
      </div>
    `;
  }
}

/**
 * Show status message with specified type
 * @param {string} message - Status message to display
 * @param {string} type - Status type: 'success' or 'error'
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      hideStatus();
    }, 5000);
  }
}

/**
 * Hide status message
 */
function hideStatus() {
  statusDiv.style.display = 'none';
}

/**
 * Handle runtime errors gracefully
 */
window.addEventListener('error', (event) => {
  console.error('Options page error:', event.error);
  showStatus('❌ An unexpected error occurred. Please refresh the page.', 'error');
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in options:', event.reason);
  showStatus('❌ An unexpected error occurred. Please refresh the page.', 'error');
});