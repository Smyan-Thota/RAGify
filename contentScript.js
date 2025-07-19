/**
 * YouTube Course Assistant - Content Script
 * Main orchestrator for transcript extraction, embedding generation, and chat interface
 */

class YouTubeCourseAssistant {
  constructor() {
    this.videoId = null;
    this.transcript = null;
    this.chunks = [];
    this.embeddings = [];
    this.apiKey = null;
    this.panel = null;
    this.isProcessing = false;
    
    // UI element references
    this.transcriptProgress = null;
    this.embeddingProgress = null;
    this.chatWindow = null;
    this.queryInput = null;
    this.debugSection = null;
    this.statusText = null;
    
    this.init();
  }
  
  /**
   * Initialize the assistant - load API key and set up video change detection
   */
  async init() {
    // Wait for YouTube page to stabilize
    await delay(2000);
    
    // Load API key from extension storage
    await this.loadApiKey();
    
    // Set up navigation change detection for YouTube SPA
    this.setupVideoChangeDetection();
    
    // Create the trigger button
    this.createTriggerButton();
  }
  
  /**
   * Loads OpenAI API key from Chrome storage
   */
  async loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(['openaiApiKey']);
      this.apiKey = result.openaiApiKey;
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }
  
  /**
   * Sets up detection for YouTube video navigation changes
   * YouTube is a SPA so we need to detect route changes
   */
  setupVideoChangeDetection() {
    // Primary method: YouTube-specific navigation event
    window.addEventListener('yt-navigate-finish', () => {
      this.handleVideoChange();
    });
    
    // Fallback: Monitor URL changes via polling
    let currentUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleVideoChange();
      }
    }, 1000);
    
    // Additional fallback: Listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleVideoChange(), 500);
    });
  }
  
  /**
   * Handles video change events - resets state and recreates UI
   */
  handleVideoChange() {
    const newVideoId = extractVideoId();
    if (newVideoId && newVideoId !== this.videoId) {
      console.log('Video changed from', this.videoId, 'to', newVideoId);
      this.videoId = newVideoId;
      this.resetState();
      
      // Recreate trigger button after a delay to ensure DOM is ready
      setTimeout(() => this.createTriggerButton(), 1500);
    }
  }
  
  /**
   * Resets all state when navigating to a new video
   */
  resetState() {
    this.transcript = null;
    this.chunks = [];
    this.embeddings = [];
    this.isProcessing = false;
    
    // Remove existing panel if present
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    // Remove existing trigger button
    const existingTrigger = document.querySelector('#assistant-trigger');
    if (existingTrigger) {
      existingTrigger.remove();
    }
  }
  
  /**
   * Creates the Q&A trigger button and injects it into YouTube's UI
   */
  createTriggerButton() {
    // Remove any existing trigger button
    const existingButton = document.querySelector('#assistant-trigger');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Find appropriate insertion point in YouTube's layout
    // Try multiple selectors as YouTube's DOM structure can vary
    const possibleContainers = [
      '#above-the-fold #title h1',
      '.title.ytd-video-primary-info-renderer',
      '#container h1',
      'h1.ytd-video-primary-info-renderer'
    ];
    
    let titleContainer = null;
    for (const selector of possibleContainers) {
      titleContainer = document.querySelector(selector);
      if (titleContainer) break;
    }
    
    if (!titleContainer) {
      // Retry after delay if title container not found
      setTimeout(() => this.createTriggerButton(), 2000);
      return;
    }
    
    // Create trigger button
    const button = document.createElement('button');
    button.id = 'assistant-trigger';
    button.className = 'assistant-trigger-btn';
    button.innerHTML = '🤖 Q&A Assistant';
    button.title = 'Start interactive Q&A for this video';
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePanel();
    });
    
    // Insert button after title element
    titleContainer.parentNode.insertBefore(button, titleContainer.nextSibling);
  }
  
  /**
   * Toggles the main assistant panel visibility
   */
  async togglePanel() {
    if (this.panel) {
      // Toggle existing panel
      this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
      return;
    }
    
    // Create new panel and start processing
    await this.createPanel();
    await this.startProcessing();
  }
  
  /**
   * Creates the main assistant panel UI
   */
  async createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'assistant-panel';
    this.panel.className = 'assistant-panel';
    
    this.panel.innerHTML = `
      <div class="assistant-header">
        <h3>📚 Video Q&A Assistant</h3>
        <button class="close-btn" title="Close panel">×</button>
      </div>
      
      <div class="progress-section">
        <div class="progress-item">
          <label>Transcript Processing:</label>
          <div class="progress-wrapper">
            <progress id="transcript-progress" max="100" value="0"></progress>
            <span class="progress-text">0%</span>
          </div>
        </div>
        <div class="progress-item">
          <label>Embedding Creation:</label>
          <div class="progress-wrapper">
            <progress id="embedding-progress" max="100" value="0"></progress>
            <span class="progress-text">0%</span>
          </div>
        </div>
      </div>
      
      <div class="debug-section" style="display: none;">
        <button class="debug-toggle">🔍 Show Debug Info</button>
        <div class="debug-content">
          <div class="transcript-preview">
            <h5>First 300 Lines of Transcript:</h5>
            <pre id="transcript-debug"></pre>
          </div>
          <div class="embeddings-preview">
            <h5>First 5 Embeddings (truncated):</h5>
            <pre id="embeddings-debug"></pre>
          </div>
        </div>
      </div>
      
      <div class="chat-section">
        <div id="chat-window" class="chat-window">
          <div class="welcome-message">
            <p>👋 Welcome! I'll help you ask questions about this video.</p>
            <p>Once processing is complete, you can ask about any topic covered in the video.</p>
          </div>
        </div>
        <div class="input-section">
          <input type="text" id="query-input" placeholder="Processing transcript..." disabled>
          <button id="send-btn" disabled>Send</button>
        </div>
      </div>
      
      <div class="status-section">
        <span id="status-text">Initializing...</span>
      </div>
    `;
    
    // Inject panel into page
    document.body.appendChild(this.panel);
    
    // Get UI element references
    this.transcriptProgress = document.getElementById('transcript-progress');
    this.embeddingProgress = document.getElementById('embedding-progress');
    this.chatWindow = document.getElementById('chat-window');
    this.queryInput = document.getElementById('query-input');
    this.debugSection = this.panel.querySelector('.debug-section');
    this.statusText = document.getElementById('status-text');
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Sets up all event listeners for the panel UI
   */
  setupEventListeners() {
    // Close button
    this.panel.querySelector('.close-btn').addEventListener('click', () => {
      this.panel.style.display = 'none';
    });
    
    // Debug toggle
    this.panel.querySelector('.debug-toggle').addEventListener('click', (e) => {
      const content = this.panel.querySelector('.debug-content');
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      e.target.textContent = isVisible ? '🔍 Show Debug Info' : '🔍 Hide Debug Info';
    });
    
    // Query input - Enter key
    this.queryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.queryInput.disabled && this.queryInput.value.trim()) {
        this.handleQuery();
      }
    });
    
    // Send button
    document.getElementById('send-btn').addEventListener('click', () => {
      if (!this.queryInput.disabled && this.queryInput.value.trim()) {
        this.handleQuery();
      }
    });
  }
  
  /**
   * Main processing pipeline - checks cache, extracts transcript, generates embeddings
   */
  async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.videoId = extractVideoId();
    
    if (!this.videoId) {
      this.updateStatus('❌ Error: Could not detect video ID');
      return;
    }
    
    if (!this.apiKey) {
      this.updateStatus('❌ Error: OpenAI API key not configured. Click the extension icon to set it up.');
      return;
    }
    
    try {
      // Check for cached data first
      this.updateStatus('🔍 Checking for cached data...');
      const cached = await chrome.storage.local.get([
        `transcript_${this.videoId}`,
        `chunks_${this.videoId}`,
        `embeddings_${this.videoId}`
      ]);
      
      if (cached[`transcript_${this.videoId}`] && cached[`embeddings_${this.videoId}`]) {
        this.updateStatus('⚡ Loading from cache...');
        
        // Load cached data
        this.transcript = cached[`transcript_${this.videoId}`];
        this.chunks = cached[`chunks_${this.videoId}`] || chunkText(this.transcript);
        this.embeddings = cached[`embeddings_${this.videoId}`];
        
        // Update UI to show completion
        this.transcriptProgress.value = 100;
        this.embeddingProgress.value = 100;
        this.updateProgressText();
        this.showDebugInfo();
        this.enableChat();
        this.updateStatus('✅ Ready! Ask questions about this video.');
        return;
      }
      
      // Process fresh transcript
      await this.extractTranscript();
      await this.generateEmbeddings();
      
      this.enableChat();
      this.updateStatus('✅ Ready! Ask questions about this video.');
      
    } catch (error) {
      console.error('Processing error:', error);
      this.updateStatus(`❌ Error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Extracts transcript from YouTube's transcript panel
   */
  async extractTranscript() {
    this.updateStatus('🔍 Checking for transcript availability...');
    
    // Try to open transcript panel
    await this.openTranscriptPanel();
    
    // Wait for transcript content to load
    this.updateStatus('⏳ Loading transcript content...');
    const transcriptSegments = await waitForElement('ytd-transcript-segment-renderer', 15000);
    
    if (!transcriptSegments) {
      throw new Error('No transcript available for this video. Transcripts are required for Q&A functionality.');
    }
    
    // Ensure all transcript content is loaded
    await this.ensureFullTranscriptLoaded();
    
    // Extract all transcript text
    const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
    const transcriptTexts = Array.from(segments).map(segment => {
      const textElement = segment.querySelector('.segment-text, yt-formatted-string');
      return textElement ? textElement.textContent.trim() : '';
    }).filter(text => text.length > 0);
    
    this.transcript = transcriptTexts.join(' ');
    
    if (!this.transcript || this.transcript.length < 100) {
      throw new Error('Transcript appears to be empty or too short for analysis');
    }
    
    // Update progress
    this.transcriptProgress.value = 100;
    this.updateProgressText();
    
    // Create chunks for embedding
    this.chunks = chunkText(this.transcript, 1000);
    
    // Cache transcript and chunks
    // TODO: Add size check before caching - if approaching 10MB limit, implement cleanup
    await chrome.storage.local.set({
      [`transcript_${this.videoId}`]: this.transcript,
      [`chunks_${this.videoId}`]: this.chunks
    });
    
    this.updateStatus(`📄 Transcript extracted: ${this.chunks.length} chunks created`);
  }
  
  /**
   * Attempts to open YouTube's transcript panel
   */
  async openTranscriptPanel() {
    // Multiple strategies to find transcript button due to YouTube's varying DOM structure
    const strategies = [
      // Strategy 1: Look for transcript button directly
      () => document.querySelector('button[aria-label*="transcript" i]'),
      
      // Strategy 2: Look in menu items
      () => {
        const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
        return Array.from(menuItems).find(item => 
          item.textContent && item.textContent.toLowerCase().includes('transcript')
        );
      },
      
      // Strategy 3: Look for "Show transcript" text
      () => {
        const allClickables = document.querySelectorAll('button, [role="button"], ytd-menu-service-item-renderer');
        return Array.from(allClickables).find(el => 
          el.textContent && el.textContent.toLowerCase().includes('transcript')
        );
      },
      
      // Strategy 4: Try opening more actions menu first
      async () => {
        const moreButton = document.querySelector('button[aria-label*="More actions" i], button[aria-label*="Show more" i]');
        if (moreButton) {
          moreButton.click();
          await delay(1000);
          return document.querySelector('[role="menuitem"]:has-text("transcript"), ytd-menu-service-item-renderer:has-text("transcript")');
        }
        return null;
      }
    ];
    
    let transcriptButton = null;
    
    for (const strategy of strategies) {
      try {
        transcriptButton = await strategy();
        if (transcriptButton) {
          console.log('Found transcript button using strategy', strategies.indexOf(strategy) + 1);
          break;
        }
      } catch (error) {
        console.warn('Strategy failed:', error);
      }
      await delay(500);
    }
    
    if (!transcriptButton) {
      throw new Error('Could not find transcript button. This video may not have transcripts available.');
    }
    
    // Click the transcript button
    transcriptButton.click();
    await delay(2000); // Wait for panel to open and content to start loading
  }
  
  /**
   * Ensures the full transcript is loaded by scrolling if necessary
   */
  async ensureFullTranscriptLoaded() {
    const transcriptContainer = document.querySelector('ytd-transcript-renderer #segments');
    if (!transcriptContainer) return;
    
    let previousCount = 0;
    let currentCount = document.querySelectorAll('ytd-transcript-segment-renderer').length;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Scroll to load all segments
    while (currentCount > previousCount && attempts < maxAttempts) {
      previousCount = currentCount;
      
      // Scroll to bottom of transcript container
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      await delay(1000);
      
      currentCount = document.querySelectorAll('ytd-transcript-segment-renderer').length;
      attempts++;
      
      // Update progress during loading
      const progress = Math.min(50 + (attempts / maxAttempts) * 50, 99);
      this.transcriptProgress.value = progress;
      this.updateProgressText();
    }
  }
  
  /**
   * Generates embeddings for all transcript chunks using OpenAI API
   */
  async generateEmbeddings() {
    this.updateStatus('🧠 Generating embeddings...');
    this.embeddings = [];
    
    const totalChunks = this.chunks.length;
    const batchSize = 5; // Process in small batches to show progress
    
    for (let i = 0; i < totalChunks; i += batchSize) {
      const batch = this.chunks.slice(i, Math.min(i + batchSize, totalChunks));
      
      try {
        // Process batch sequentially to avoid rate limits
        for (let j = 0; j < batch.length; j++) {
          const chunkIndex = i + j;
          const embedding = await this.getEmbedding(batch[j]);
          this.embeddings.push(embedding);
          
          // Update progress
          const progress = ((chunkIndex + 1) / totalChunks) * 100;
          this.embeddingProgress.value = progress;
          this.updateProgressText();
          
          this.updateStatus(`🧠 Generating embeddings... ${chunkIndex + 1}/${totalChunks}`);
          
          // Small delay to avoid hitting rate limits
          await delay(200);
        }
        
      } catch (error) {
        console.error(`Failed to generate embeddings for batch starting at ${i}:`, error);
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
    }
    
    // Cache embeddings
    // TODO: Add size monitoring - if storage approaches 10MB, add unlimitedStorage permission
    await chrome.storage.local.set({
      [`embeddings_${this.videoId}`]: this.embeddings
    });
    
    this.showDebugInfo();
  }
  
  /**
   * Gets embedding for a single text chunk using OpenAI API
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} 1536-dimensional embedding vector
   */
  async getEmbedding(text) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Ensure we don't exceed token limits
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  /**
   * Shows debug information in the panel
   */
  showDebugInfo() {
    // Display first 300 lines of transcript
    const lines = this.transcript.split(/[.!?]+/).filter(line => line.trim().length > 0);
    const first300Lines = lines.slice(0, 300).join('.\n') + '.';
    document.getElementById('transcript-debug').textContent = first300Lines;
    
    // Display first 5 embeddings (truncated to first 10 values)
    const embeddingsDebug = this.embeddings.slice(0, 5).map((embedding, index) => {
      const truncated = embedding.slice(0, 10).map(val => val.toFixed(4));
      return `Embedding ${index + 1}: [${truncated.join(', ')}... ${embedding.length - 10} more values]`;
    }).join('\n');
    
    document.getElementById('embeddings-debug').textContent = embeddingsDebug;
    
    // Show debug section
    this.debugSection.style.display = 'block';
  }
  
  /**
   * Enables the chat interface after processing is complete
   */
  enableChat() {
    this.queryInput.disabled = false;
    document.getElementById('send-btn').disabled = false;
    this.queryInput.placeholder = 'Ask a question about this video...';
    this.queryInput.focus();
  }
  
  /**
   * Handles user queries - finds relevant content and generates answers
   */
  async handleQuery() {
    const query = this.queryInput.value.trim();
    if (!query) return;
    
    // Clear input and add user message to chat
    this.queryInput.value = '';
    this.addChatMessage('user', query);
    
    // Show typing indicator
    const typingId = this.addChatMessage('assistant', '⏳ Analyzing your question...');
    
    try {
      this.updateStatus('🔍 Finding relevant content...');
      
      // Get embedding for the query
      const queryEmbedding = await this.getEmbedding(query);
      
      // Find most relevant transcript chunks
      const relevantChunks = this.findRelevantChunks(queryEmbedding, 3);
      
      this.updateStatus('🤖 Generating answer...');
      
      // Generate answer using GPT-3.5
      const answer = await this.generateAnswer(query, relevantChunks);
      
      // Replace typing indicator with actual answer
      this.updateChatMessage(typingId, answer);
      this.updateStatus('✅ Ready! Ask another question.');
      
    } catch (error) {
      console.error('Query processing error:', error);
      this.updateChatMessage(typingId, `❌ Sorry, I encountered an error: ${error.message}`);
      this.updateStatus('✅ Ready! Ask another question.');
    }
  }
  
  /**
   * Finds the most relevant transcript chunks for a query using cosine similarity
   * @param {number[]} queryEmbedding - Query embedding vector
   * @param {number} topK - Number of top chunks to return
   * @returns {Array} Array of relevant chunks with similarity scores
   */
  findRelevantChunks(queryEmbedding, topK = 3) {
    const similarities = this.embeddings.map((embedding, index) => ({
      index,
      similarity: cosineSimilarity(queryEmbedding, embedding),
      text: this.chunks[index]
    }));
    
    // Sort by similarity score (descending) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Log similarity scores for debugging
    console.log('Top similarity scores:', similarities.slice(0, topK).map(s => s.similarity));
    
    return similarities.slice(0, topK);
  }
  
  /**
   * Generates answer using GPT-3.5 with relevant transcript context
   * @param {string} query - User's question
   * @param {Array} relevantChunks - Relevant transcript chunks
   * @returns {Promise<string>} Generated answer
   */
  async generateAnswer(query, relevantChunks) {
    // Construct context from relevant chunks
    const context = relevantChunks.map((chunk, index) => 
      `Excerpt ${index + 1} (relevance: ${(chunk.similarity * 100).toFixed(1)}%):\n"${chunk.text}"`
    ).join('\n\n');
    
    const prompt = `Here are the most relevant excerpts from a video transcript:

${context}

Based ONLY on the information provided above, please answer the following question:
${query}

Instructions:
- Use only the information from the excerpts above
- If the excerpts don't contain enough information to answer the question, say so
- Be concise but thorough
- Reference specific points from the excerpts when possible

Answer:`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1, // Low temperature for more focused, factual responses
        top_p: 0.9
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
  
  /**
   * Adds a chat message to the conversation
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @returns {string} Unique message ID for later updates
   */
  addChatMessage(role, content) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.id = messageId;
    messageDiv.innerHTML = `
      <div class="message-content">${this.formatMessageContent(content)}</div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    
    // Remove welcome message if this is the first real message
    const welcomeMessage = this.chatWindow.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    this.chatWindow.appendChild(messageDiv);
    this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    
    return messageId;
  }
  
  /**
   * Updates an existing chat message
   * @param {string} messageId - Message ID to update
   * @param {string} newContent - New content
   */
  updateChatMessage(messageId, newContent) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      const contentElement = messageElement.querySelector('.message-content');
      if (contentElement) {
        contentElement.innerHTML = this.formatMessageContent(newContent);
      }
    }
  }
  
  /**
   * Formats message content with basic styling
   * @param {string} content - Raw message content
   * @returns {string} Formatted HTML content
   */
  formatMessageContent(content) {
    // Basic formatting for readability
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }
  
  /**
   * Updates the status text in the UI
   * @param {string} status - New status message
   */
  updateStatus(status) {
    if (this.statusText) {
      this.statusText.textContent = status;
    }
  }
  
  /**
   * Updates progress bar percentage text
   */
  updateProgressText() {
    const transcriptPercent = Math.round(this.transcriptProgress?.value || 0);
    const embeddingPercent = Math.round(this.embeddingProgress?.value || 0);
    
    const transcriptText = this.panel?.querySelector('.progress-item:first-child .progress-text');
    const embeddingText = this.panel?.querySelector('.progress-item:last-child .progress-text');
    
    if (transcriptText) transcriptText.textContent = `${transcriptPercent}%`;
    if (embeddingText) embeddingText.textContent = `${embeddingPercent}%`;
  }
}

// Initialize the assistant when content script loads
// Handle both immediate execution and deferred execution scenarios
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeCourseAssistant();
  });
} else {
  // DOM already loaded
  new YouTubeCourseAssistant();
}