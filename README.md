# YouTube Course Assistant

A Chrome extension that enables interactive Q&A for educational YouTube videos using AI-powered transcript analysis.

## Features

- 🎯 **Semantic Search**: Find relevant content using OpenAI embeddings
- 🧠 **AI-Powered Answers**: Get contextual responses from GPT-3.5-turbo
- 💾 **Local Caching**: Fast re-access with browser storage
- 🔍 **Debug Mode**: View transcript chunks and embedding data
- 📊 **Progress Tracking**: Real-time processing status

## Installation

1. **Get OpenAI API Key**: Sign up at [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Download Extension**: Clone or download this repository
3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory
4. **Configure**: Click the extension icon and enter your API key

## Usage

1. Navigate to any YouTube video with transcripts/captions
2. Click the "🤖 Q&A Assistant" button near the video title
3. Wait for transcript processing to complete (shows progress bars)
4. Ask questions about the video content in the chat interface

## How It Works

1. **Transcript Extraction**: Automatically extracts YouTube's transcript data
2. **Text Chunking**: Splits transcript into semantic chunks (~1000 chars each)
3. **Embedding Generation**: Creates vector embeddings using `text-embedding-3-small`
4. **Semantic Search**: Finds relevant chunks using cosine similarity
5. **Answer Generation**: Uses GPT-3.5-turbo with relevant context to answer questions

## Requirements

- Chrome browser with extensions enabled
- OpenAI API key with access to:
  - `text-embedding-3-small` model
  - `gpt-3.5-turbo` model
- YouTube videos with available transcripts/captions

## Privacy & Storage

- All data processed locally in your browser
- API key stored securely in Chrome's encrypted storage
- Transcripts and embeddings cached locally for faster re-access
- No data sent to external servers except OpenAI API calls

## Development

This extension is built with vanilla JavaScript and Chrome Extension Manifest V3.

### File Structure
```
youtube-explainer/
├── manifest.json          # Extension configuration
├── contentScript.js       # Main transcript processing logic
├── background.js          # Extension lifecycle management
├── options.html/js        # Settings page
├── utils.js              # Utility functions
├── panel.css             # UI styling
└── icons/                # Extension icons (16, 48, 128px)
```

### API Usage Costs

Typical costs per video (estimates):
- Transcript embedding: $0.01-0.05 depending on length
- Each question: $0.001-0.005 for answer generation

## Troubleshooting

### "No transcript available"
- Ensure the video has captions/transcripts enabled
- Try videos from educational channels (MIT, Khan Academy, etc.)

### API Key Issues
- Verify key starts with "sk-"
- Check API key has access to required models
- Ensure sufficient API credits

### Extension Not Loading
- Check Chrome Developer mode is enabled
- Look for errors in `chrome://extensions/`
- Verify all files are present

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various YouTube videos
5. Submit a pull request

## Limitations

- Requires videos with available transcripts
- Processing time depends on video length
- 10MB storage limit (can be increased with permissions)
- English language optimized (other languages may work but not tested)