/**
 * YouTube Course Assistant - Utility Functions
 * Provides core mathematical and text processing utilities
 */

/**
 * Computes cosine similarity between two embedding vectors
 * @param {number[]} vecA - First embedding vector (1536-dimensional)
 * @param {number[]} vecB - Second embedding vector (1536-dimensional)
 * @returns {number} Cosine similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimensions must match');
  }
  
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  // Avoid division by zero
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Extracts YouTube video ID from current URL or provided URL
 * @param {string} [url] - Optional URL to parse, defaults to current page
 * @returns {string|null} Video ID or null if not found
 */
function extractVideoId(url = window.location.href) {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Chunks transcript text into manageable pieces for embedding
 * Respects sentence boundaries to maintain semantic coherence
 * @param {string} text - Full transcript text to chunk
 * @param {number} maxChars - Maximum characters per chunk (approximately 1000 tokens)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, maxChars = 1000) {
  const chunks = [];
  let currentText = text.trim();
  
  while (currentText.length > 0) {
    if (currentText.length <= maxChars) {
      chunks.push(currentText);
      break;
    }
    
    // Find optimal split point, preferring sentence boundaries
    let splitIndex = currentText.lastIndexOf('.', maxChars);
    
    // If no sentence boundary found within reasonable range, try other punctuation
    if (splitIndex < maxChars * 0.5) {
      splitIndex = Math.max(
        currentText.lastIndexOf('!', maxChars),
        currentText.lastIndexOf('?', maxChars),
        splitIndex
      );
    }
    
    // If still no good boundary, try space
    if (splitIndex < maxChars * 0.3) {
      splitIndex = currentText.lastIndexOf(' ', maxChars);
    }
    
    // Last resort: hard cut at maxChars
    if (splitIndex < 0) {
      splitIndex = maxChars;
    }
    
    chunks.push(currentText.slice(0, splitIndex + 1).trim());
    currentText = currentText.slice(splitIndex + 1).trim();
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Creates a delay/sleep function for async operations
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after the delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for a DOM element to appear with timeout
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<Element|null>} Found element or null if timeout
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise(resolve => {
    // Check if element already exists
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      resolve(existingElement);
      return;
    }
    
    // Set up mutation observer to watch for element
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Set timeout
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Debounces function calls to prevent excessive API requests
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Safely gets nested object properties without throwing errors
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot notation path (e.g., 'a.b.c')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Value at path or default value
 */
function safeGet(obj, path, defaultValue = null) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}