# 🤖 Texagon Assistant

> A powerful dual-interface AI assistant that combines traditional chat and real-time voice interactions with your knowledge base.

[![NestJS](https://img.shields.io/badge/NestJS-Framework-red.svg)](https://nestjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-AI%20Model-blue.svg)](https://openai.com/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

## 📑 Table of Contents

1. [Key Features](#-key-features)
2. [Interface Comparison](#-interface-comparison)
3. [Quick Start](#-quick-start)
4. [Core Components & Interfaces](#-core-components--interfaces)
   - [Chat vs Real-time Voice](#-traditional-chat-vs-️-real-time-voice)
   - [Management Tools](#-management-tools)
5. [Key Features Deep Dive](#-key-features-deep-dive)
   - [Chat Interface](#-chat-interface-indexhtml)
   - [Realtime Voice Interface](#️-realtime-voice-interface-realtimehtml)
   - [Training Interface](#-training-interface-trainhtml)
   - [Management Interface](#️-management-interface-manage-vector-storehtml)
   - [Shared Features](#-shared-features)
6. [Technical Features](#️-technical-features)
   - [Input Processing](#input-processing)
   - [Response Generation](#response-generation)
   - [User Experience](#user-experience)

## 🌟 Key Features

- 📱 **Two Distinct Interfaces**:
  - Traditional Chat Interface with voice capabilities
  - Real-time Voice Interface with VAD/Push-to-Talk
- 🗣️ **Advanced Voice Processing**:
  - Voice Activity Detection (VAD)
  - Real-time transcription
  - Text-to-Speech responses
- 📚 **Knowledge Base Integration**:
  - PDF document processing
  - Vector similarity search
  - Context-aware responses
- 🎨 **Modern UI/UX**:
  - Dark/Light themes
  - Responsive design
  - Real-time feedback

## 🔍 Interface Comparison

### Chat Interface vs Real-time Interface

Feature | Chat Interface | Real-time Interface
--------|---------------|-------------------
URL | `/index.html` | `/realtime.html`
Primary Input | Text with voice option | Voice with VAD/PTT
Response Type | Text + Audio | Real-time audio stream
Session Type | Persistent | Timed sessions
Use Case | Document Q&A | Interactive conversations
Latency | Standard | Ultra-low latency

## 🚀 Quick Start

1. **Setup Environment**
   - Clone the repository
   - Install dependencies (`npm install`)
   - Set up environment variables
   - Start Supabase locally (`supabase start`)
   - Run the application (`npm run start:dev`)

2. **Environment Variables**

```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_PRIVATE_KEY=your_supabase_key
```

## 🎯 Core Components & Interfaces

### 💬 Traditional Chat vs 🎙️ Real-time Voice

Feature | Chat Mode | Real-time Mode
--------|-----------|---------------
Interface | `/index.html` | `/realtime.html`
Input Method | Text + Optional Voice | VAD/Push-to-Talk
Processing | Asynchronous | Real-time Streaming
Response | Text with Audio | Instant Audio + Text
Use Case | Document Analysis | Interactive Dialog
Session | Persistent | Time-boxed
Latency | ~1-2s | ~100-300ms
Context | Full History | Session-based

### 🔧 Management Tools

Tool | URL | Purpose
-----|-----|--------
📚 Training | `/train.html` | Document Upload & Processing
🗄️ Vector Store | `/manage-vector-store.html` | Knowledge Base Management

## 🔬 Key Features Deep Dive

### 💬 Chat Interface (`/index.html`)
- **Input Methods**
  - 🎯 Smart Text Input
    - Real-time suggestions
    - Command history
    - Context awareness
  - 🎤 Voice Commands
    - Push-to-talk mode
    - Continuous listening
    - Speech recognition
    - Auto-punctuation

- **Response System**
  - 🔄 Real-time Streaming
    - Progressive text display
    - Chunked responses
    - Loading indicators
    - Response timing metrics
  - 🔊 Voice Synthesis
    - Natural TTS output
    - Adjustable speech rate
    - Multiple voices
    - Audio visualizations

- **Knowledge Integration**
  - 📚 Context Retrieval
    - Vector similarity search
    - Source attribution
    - Relevance scoring
    - Citation linking

### 🎙️ Realtime Voice Interface (`/realtime.html`)
- **Voice Processing**
  - 🎯 Dual Input Modes
    - VAD (Voice Activity Detection)
      - Auto speech detection
      - Configurable sensitivity
      - Silence thresholds
      - Background noise filtering
    - Push-to-Talk
      - Space bar control
      - Touch support
      - Visual feedback
      - Audio level display

  - ⚡ Ultra-low Latency
    - 100-300ms response time
    - Bi-directional streaming
    - WebRTC optimization
    - Buffer management

  - 🔄 Session Management
    - Timed sessions
    - Auto-renewal
    - Graceful timeout
    - Connection recovery

### 📚 Training Interface (`/train.html`)
- **Document Processing**
  - 📄 File Handling
    - Drag-and-drop upload
    - 10MB size limit
    - Format validation
    - Progress tracking

  - 🔍 Text Extraction
    - PDF parsing
    - Structure preservation
    - Metadata extraction
    - Error recovery

  - 📊 Embedding Generation
    - Chunk optimization
    - Vector creation
    - Quality validation
    - Progress monitoring

### ⚙️ Management Interface (`/manage-vector-store.html`)
- **Knowledge Base Control**
  - 📋 Document Management
    - Real-time listing
    - Content preview
    - Bulk operations
    - Search functionality

  - 🔄 Data Operations
    - Delete (single/bulk)
    - Export capability
    - Count tracking
    - Auto-refresh

  - 🛡️ Security Features
    - Action confirmation
    - Deletion safeguards
    - Status tracking
    - Error handling

### 🎨 Shared Features
- **Theme System**
  - 🌓 Dark/Light modes
  - System preference detection
  - Persistent settings
  - Smooth transitions

- **Responsive Design**
  - 📱 Mobile optimization
  - Touch interactions
  - Adaptive layouts
  - Gesture support

- **Error Handling**
  - 🚨 Clear notifications
  - Automatic recovery
  - Fallback options
  - User guidance

## 🛠️ Technical Features

### Input Processing
- 📝 Text Input
  - Auto-complete
  - History tracking
  - Context awareness
- 🎤 Voice Input
  - VAD mode
  - Push-to-Talk
  - Continuous listening
  - Audio level visualization

### Response Generation
- 🤖 AI Processing
  - GPT-4 integration
  - Vector similarity search
  - Context retrieval
- 🔊 Audio Output
  - Text-to-Speech
  - Real-time streaming
  - Bi-directional audio
  - Low-latency playback

### User Experience
- 🎨 Theme Support
  - Dark/Light modes
  - System theme detection
  - Persistent settings
- 📱 Responsive Design
  - Mobile optimization
  - Touch controls
  - Gesture support
- ⚡ Performance
  - Real-time updates
  - Progress indicators
  - Error handling
  - Auto-recovery



## License

MIT License - See LICENSE file for details
