/**
 * YouTube Course Assistant - Background Service Worker
 * Handles extension lifecycle events and provides central coordination
 */

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('YouTube Course Assistant installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Open options page on first install to configure API key
    chrome.runtime.openOptionsPage();
    
    // TODO: Consider showing onboarding information
    console.log('First-time install detected - opening options page');
  }
  
  if (details.reason === 'update') {
    // TODO: Handle version updates, migrate storage if needed
    console.log('Extension updated from version:', details.previousVersion);
  }
});

/**
 * Handle extension startup
 * Could be used for cleanup, cache warming, etc.
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
  
  // TODO: Implement periodic cleanup of old cached data
  // This could prevent storage from growing too large over time
  cleanupOldStorageData();
});

/**
 * Message handler for communication between extension components
 * Currently not used but reserved for future features
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // TODO: Implement centralized message handling for:
  // - Cross-tab communication
  // - Centralized API key management
  // - Background processing tasks
  // - Analytics/usage tracking
  
  switch (request.type) {
    case 'GET_API_KEY':
      // Future: Centralized API key management
      handleApiKeyRequest(sendResponse);
      return true; // Keep message channel open for async response
      
    case 'BACKGROUND_EMBED':
      // Future: Move embedding generation to background for better performance
      handleBackgroundEmbedding(request.data, sendResponse);
      return true;
      
    case 'STORAGE_CLEANUP':
      // Future: On-demand storage cleanup
      cleanupOldStorageData(sendResponse);
      return true;
      
    default:
      // Unknown message type
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle API key requests (future feature)
 * @param {Function} sendResponse - Response callback
 */
async function handleApiKeyRequest(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    sendResponse({ 
      success: true, 
      apiKey: result.openaiApiKey 
    });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Handle background embedding requests (future feature)
 * This could move the heavy embedding work to background to keep content script responsive
 * @param {Object} data - Embedding request data
 * @param {Function} sendResponse - Response callback
 */
async function handleBackgroundEmbedding(data, sendResponse) {
  try {
    // TODO: Implement background embedding processing
    // This would require moving the OpenAI API calls here
    sendResponse({ 
      success: false, 
      error: 'Background embedding not yet implemented' 
    });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Cleanup old storage data to prevent hitting storage limits
 * Chrome extension storage has a 10MB limit by default
 * @param {Function} [sendResponse] - Optional response callback
 */
async function cleanupOldStorageData(sendResponse) {
  try {
    const allData = await chrome.storage.local.get();
    const keys = Object.keys(allData);
    
    // Find transcript and embedding data
    const dataKeys = keys.filter(key => 
      key.startsWith('transcript_') || 
      key.startsWith('chunks_') || 
      key.startsWith('embeddings_')
    );
    
    console.log(`Found ${dataKeys.length} cached data entries`);
    
    // TODO: Implement cleanup strategy based on:
    // 1. Age of data (remove entries older than X days)
    // 2. LRU (Least Recently Used)
    // 3. Storage size (remove largest entries first)
    
    // For now, just log the storage usage
    const storageSize = JSON.stringify(allData).length;
    const storageMB = (storageSize / (1024 * 1024)).toFixed(2);
    
    console.log(`Current storage usage: ${storageMB} MB`);
    
    // If approaching 10MB limit, consider adding unlimitedStorage permission
    if (storageSize > 8 * 1024 * 1024) { // 8MB threshold
      console.warn('Storage usage high - consider cleanup or unlimitedStorage permission');
      
      // TODO: Implement actual cleanup logic
      // Example: Remove oldest entries
      /*
      const oldEntries = dataKeys.filter(key => {
        // Logic to identify old entries
        return isOldEntry(key, allData[key]);
      });
      
      if (oldEntries.length > 0) {
        await chrome.storage.local.remove(oldEntries);
        console.log(`Cleaned up ${oldEntries.length} old entries`);
      }
      */
    }
    
    if (sendResponse) {
      sendResponse({ 
        success: true, 
        message: `Storage usage: ${storageMB} MB`,
        entriesCount: dataKeys.length
      });
    }
    
  } catch (error) {
    console.error('Storage cleanup error:', error);
    if (sendResponse) {
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

/**
 * Handle tab updates to manage extension state
 * Could be used to reset state when navigating away from YouTube
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process complete page loads
  if (changeInfo.status !== 'complete') return;
  
  // Check if tab is YouTube
  if (tab.url && tab.url.includes('youtube.com/watch')) {
    console.log('YouTube video page loaded:', tab.url);
    
    // TODO: Could inject content script dynamically here if needed
    // TODO: Could perform pre-loading or cache preparation
  }
});

/**
 * Handle extension icon clicks (when no popup is defined)
 * This opens the options page
 */
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

/**
 * Error handling for unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in background script:', event.reason);
  // TODO: Implement error reporting/logging
});

/**
 * Utility function to check if a storage entry is old (future use)
 * @param {string} key - Storage key
 * @param {*} value - Storage value
 * @returns {boolean} True if entry should be considered old
 */
function isOldEntry(key, value) {
  // TODO: Implement logic to determine if an entry is old
  // Could be based on timestamp in the key or metadata in the value
  return false;
}