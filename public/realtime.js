document.addEventListener('DOMContentLoaded', () => {
    // Global State Variables
    let pc;                     // RTCPeerConnection instance
    let dc;                     // RTCDataChannel instance
    let audioStream = null;     // MediaStream for audio input
    let currentAIMessage = null;// Current AI response message element
    let currentUserMessage = null;// Current user message element
    let messageStartTime = null;// Timestamp for response timing
    let isVADMode = true;      // Voice Activity Detection mode flag
    let audioContext;          // AudioContext instance
    let analyser;             // Audio analyser node
    let isRecording = false;   // Recording state flag
    
    // Timer related variables
    let keyExpirationTimer;
    let keyExpirationTime;
    let countdownInterval;
    
    // Audio analysis constants
    const SILENCE_THRESHOLD = 0.01;
    const MIN_SPEECH_TIME = 300; // Minimum speech duration in ms
    
    /**
     * Theme Management
     */
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
    updateThemeIcon(savedTheme === 'dark');
    
    themeToggle.addEventListener('click', () => {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        updateThemeIcon(isDarkMode);
    });
    
    function updateThemeIcon(isDarkMode) {
        themeIcon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    /**
     * Message UI Management
     * @param {string} content - Message content
     * @param {boolean} isOutgoing - Whether message is from user
     * @param {number} timeTaken - Response time in ms
     * @param {string} sourceContext - Source context for AI responses
     */
    function createMessageElement(content, isOutgoing = false, timeTaken = null, sourceContext = null) {
        const message = document.createElement('div');
        message.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
        
        const timestamp = document.createElement('span');
        timestamp.classList.add('timestamp');
        const timeInfo = timeTaken ? ` (${(timeTaken/1000).toFixed(2)}s)` : '';
        timestamp.textContent = `${new Date().toLocaleTimeString()}${timeInfo}`;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content');
        
        const text = document.createElement('p');
        text.textContent = content;
        
        const recordingIndicator = document.createElement('div');
        recordingIndicator.classList.add('recording-indicator');
        recordingIndicator.innerHTML = '<i class="fas fa-microphone"></i><span>Recording...</span>';
        
        contentWrapper.appendChild(text);
        contentWrapper.appendChild(recordingIndicator);
        
        // Add source context dropdown if available
        if (sourceContext && !isOutgoing) {
            const sourceWrapper = document.createElement('div');
            sourceWrapper.classList.add('source-wrapper');
            
            const sourceToggle = document.createElement('button');
            sourceToggle.classList.add('source-toggle');
            sourceToggle.innerHTML = '<i class="fas fa-chevron-down"></i> Show Source';
            
            const sourceContent = document.createElement('div');
            sourceContent.classList.add('source-content');
            sourceContent.textContent = sourceContext;
            sourceContent.style.display = 'none';
            
            sourceToggle.addEventListener('click', () => {
                const isExpanded = sourceContent.style.display !== 'none';
                sourceContent.style.display = isExpanded ? 'none' : 'block';
                sourceToggle.innerHTML = isExpanded ? 
                    '<i class="fas fa-chevron-down"></i> Show Source' : 
                    '<i class="fas fa-chevron-up"></i> Hide Source';
            });
            
            sourceWrapper.appendChild(sourceToggle);
            sourceWrapper.appendChild(sourceContent);
            contentWrapper.appendChild(sourceWrapper);
        }
        
        message.appendChild(contentWrapper);
        message.appendChild(timestamp);
        
        return message;
    }

    /**
     * Session Timer Management
     * @param {number} expirationTime - Timestamp when session expires
     */
    function updateCountdown(expirationTime) {
        const timerElement = document.getElementById('sessionTimer');
        
        countdownInterval = setInterval(() => {
            const now = Date.now();
            const timeLeft = Math.max(0, expirationTime - now);
            
            if (timeLeft === 0) {
                clearInterval(countdownInterval);
                return;
            }

            const seconds = Math.ceil(timeLeft / 1000);
            timerElement.innerHTML = `<i class="fas fa-clock"></i> ${seconds}s`;
            
            // Add warning class when less than 30 seconds remain
            if (seconds <= 30) {
                timerElement.classList.add('warning');
            }
        }, 1000);
    }

    /**
     * WebRTC Connection Management
     */
    async function init() {
        try {
            // Update button to loading state
            startBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Connecting...</span>';
            startBtn.disabled = true;
            
            loadingIndicator.classList.remove('hidden'); // Show loading
            initAudioContext();

            // Fetch config first
            const configResponse = await fetch("/realtime/config");
            const config = await configResponse.json();
            keyExpirationTime = config.keyExpirationTime;

            // Calculate expiration timestamp
            const expirationTime = Date.now() + keyExpirationTime;
            
            // Start countdown display
            updateCountdown(expirationTime);

            const tokenResponse = await fetch("/realtime/session");
            const data = await tokenResponse.json();
            const EPHEMERAL_KEY = data.client_secret.value;

            // Set up key expiration timer
            if (keyExpirationTimer) {
                clearTimeout(keyExpirationTimer);
            }
            
            keyExpirationTimer = setTimeout(() => {
                handleKeyExpiration();
            }, keyExpirationTime);

            pc = new RTCPeerConnection();
            
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            pc.ontrack = e => audioEl.srcObject = e.streams[0];

            const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream = ms; // Store the stream reference
            const audioTrack = ms.getTracks()[0];
            audioTrack.enabled = isVADMode; // Set initial state based on mode
            pc.addTrack(audioTrack);

            dc = pc.createDataChannel("oai-events");
            
            // Configure session for transcription and tools
            dc.addEventListener('open', () => {
                const sessionConfig = {
                    type: "session.update",
                    session: {
                        instructions: "You are an AI receptionist and assistant. You have two main functions: 1) Answer questions using the company knowledge base by calling the query_company_info function, 2) Help schedule appointments by collecting visitor information (name, date/time, reason for visit) and store them in Google Sheets using store_appointment function. For appointments, guide users through the booking process step by step and confirm all details before finalizing. Always be professional, courteous and helpful. If asked about company information not available in the knowledge base, politely inform the user.",
                        input_audio_transcription: {
                            model: "whisper-1",
                            language: "en"
                        },
                        turn_detection: isVADMode ? {
                            type: "server_vad",
                            threshold: 0.7,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 800,
                            create_response: true
                        } : null,
                        temperature: 0.6,
                        tools: [
                            {
                                type: "function",
                                name: "query_company_info",
                                description: "Search through company knowledge base for relevant information",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        query: {
                                            type: "string",
                                            description: "The search query about company information"
                                        }
                                    },
                                    required: ["query"]
                                }
                            }
                        ],
                        tool_choice: "auto",
                        
                    }
                };
                dc.send(JSON.stringify(sessionConfig));
            });

            dc.addEventListener("message", (e) => {
                const data = JSON.parse(e.data);
                handleAPIResponse(data);
            });

            // Show recording indicator when audio track is active
            audioTrack.addEventListener('ended', () => {
                if (currentUserMessage) {
                    currentUserMessage.classList.remove('recording');
                }
            });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const baseUrl = "https://api.openai.com/v1/realtime";
            const model = "gpt-4o-realtime-preview-2024-12-17";
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp"
                },
            });

            const answer = {
                type: "answer",
                sdp: await sdpResponse.text(),
            };
            await pc.setRemoteDescription(answer);
            
            loadingIndicator.classList.add('hidden'); // Hide loading
            startBtn.classList.add('hidden'); // Hide start button
            stopBtn.classList.remove('hidden'); // Show stop button
            stopBtn.disabled = false;

            // Show mode switch when session starts
            document.querySelector('.mode-switch').classList.remove('hidden');

            setupAudioAnalyser(ms); // Setup audio analyser for push-to-talk

            // After connection is established, set up initial mode
            if (dc.readyState === 'open') {
                updateSessionMode();
            } else {
                dc.addEventListener('open', () => {
                    updateSessionMode();
                }, { once: true });
            }
        } catch (error) {
            loadingIndicator.classList.add('hidden'); // Hide loading on error
            // Reset start button on error
            startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Assistant</span>';
            startBtn.disabled = false;
            console.error('Error:', error);
        }
    }

    function handleKeyExpiration() {
        console.log('Ephemeral key expired');
        if (dc) dc.close();
        if (pc) pc.close();
        startBtn.classList.remove('hidden'); // Show start button
        stopBtn.classList.add('hidden'); // Hide stop button

        const expirationMessage = createMessageElement(
            'Session expired. Please start a new conversation.',
            false
        );
        transcriptions.appendChild(expirationMessage);
        transcriptions.scrollTop = transcriptions.scrollHeight;

        // Hide mode switch when session expires
        document.querySelector('.mode-switch').classList.add('hidden');
    }

    async function cleanup() {
        // Update stop button to show stopping state
        stopBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Stopping...</span>';
        stopBtn.disabled = true;

        if (keyExpirationTimer) {
            clearTimeout(keyExpirationTimer);
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        if (pc) pc.close();
        if (dc) dc.close();

        // Add small delay to show stopping state
        await new Promise(resolve => setTimeout(resolve, 800));
        
        startBtn.classList.remove('hidden');
        startBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Connecting...</span>';
        startBtn.disabled = true;
        stopBtn.classList.add('hidden');

        const message = createMessageElement('Disconnected from Realtime API');
        transcriptions.appendChild(message);

        // Add delay before showing ready state
        await new Promise(resolve => setTimeout(resolve, 1000));
        startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Assistant</span>';
        startBtn.disabled = false;

        if (audioStream) {
            audioStream.getTracks().forEach(track => {
                track.enabled = false;
                track.stop();
            });
            audioStream = null;
        }
        
        if (audioContext) {
            await audioContext.close();
            audioContext = null;
        }

        // Hide mode switch when session ends
        document.querySelector('.mode-switch').classList.add('hidden');
    }

    /**
     * Audio Processing
     */
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async function playAudioData(audioData) {
        initAudioContext();
        audioQueue.push(audioData);
        
        if (!isPlaying) {
            playNextInQueue();
        }
    }

    async function playNextInQueue() {
        if (audioQueue.length === 0 || isPlaying) return;
        
        isPlaying = true;
        const audioData = audioQueue.shift();
        
        try {
            const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
                isPlaying = false;
                playNextInQueue();
            };
            
            source.start();
        } catch (error) {
            console.error('Audio playback error:', error);
            isPlaying = false;
            playNextInQueue();
        }
    }

    /**
     * Voice Mode Management
     */
    async function updateSessionMode() {
        if (dc && dc.readyState === 'open') {
            // Log the current mode
            console.log('Updating session mode:', isVADMode ? 'VAD' : 'Manual');
            
            // First clear any existing audio buffer
            dc.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
            
            // Enable audio track for VAD mode, disable for manual
            if (audioStream) {
                const audioTrack = audioStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = isVADMode;
                    console.log('Audio track enabled:', audioTrack.enabled);
                }
            }

            // Update session configuration
            const sessionConfig = {
                type: "session.update",
                session: {
                    input_audio_transcription: {
                        model: "whisper-1",
                        language: "en"
                    },
                    turn_detection: isVADMode ? {
                        type: "server_vad",
                        threshold: 0.7,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 800,
                        create_response: true
                    } : null
                }
            };

            // Send the configuration update
            dc.send(JSON.stringify(sessionConfig));
            console.log('Session config sent:', sessionConfig);
        }
    }

    /**
     * Manual Recording Controls
     */
    function startManualInput() {
        if (!isVADMode && dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({
                type: "input_audio_buffer.clear"
            }));
            dc.send(JSON.stringify({
                type: "input_audio_buffer.commit"
            }));
        }
    }

    function endManualInput() {
        if (!isVADMode && dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({
                type: "response.create"
            }));
        }
    }

    /**
     * Push-to-Talk Implementation
     */
    function setupAudioAnalyser(stream) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Initially disable the audio track
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = false;
        }
        
        function checkAudioLevel() {
            if (!isRecording) {
                requestAnimationFrame(checkAudioLevel);
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            audioLevel = average / 128.0;
            
            const levelBar = pushToTalkBtn.querySelector('.level-bar');
            if (levelBar) {
                levelBar.style.height = `${audioLevel * 100}%`; // Changed from width to height
            }
            
            if (audioLevel > SILENCE_THRESHOLD) {
                if (!speechStartTime) {
                    speechStartTime = Date.now();
                }
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
            } else if (speechStartTime && !silenceTimer) {
                silenceTimer = setTimeout(() => {
                    endRecording();
                }, 500);
            }
            
            requestAnimationFrame(checkAudioLevel);
        }
        
        checkAudioLevel();
    }

    function startRecording() {
        if (!isVADMode && dc && dc.readyState === 'open') {
            isRecording = true;
            speechStartTime = null;
            pushToTalkBtn.classList.add('recording');

            // Ensure we have an audio track to work with
            if (audioStream) {
                const audioTrack = audioStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = true; // Enable the audio track
                }
            }

            dc.send(JSON.stringify({ 
                type: "input_audio_buffer.clear"
            }));

            // Create a new user message to show recording state
            currentUserMessage = createMessageElement('Recording...', true);
            currentUserMessage.classList.add('recording');
            transcriptions.appendChild(currentUserMessage);
            transcriptions.scrollTop = transcriptions.scrollHeight;
        }
    }

    function endRecording() {
        if (!isVADMode && isRecording && dc && dc.readyState === 'open') {
            isRecording = false;
            pushToTalkBtn.classList.remove('recording');

            // Disable the audio track when not recording
            if (audioStream) {
                const audioTrack = audioStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = false;
                }
            }

            if (speechStartTime && Date.now() - speechStartTime >= MIN_SPEECH_TIME) {
                // Remove the recording message
                if (currentUserMessage) {
                    currentUserMessage.remove();
                    currentUserMessage = null;
                }

                dc.send(JSON.stringify({ 
                    type: "input_audio_buffer.commit"
                }));
                dc.send(JSON.stringify({ 
                    type: "response.create"
                }));
            } else {
                // If speech was too short, just clear and remove the message
                dc.send(JSON.stringify({ 
                    type: "input_audio_buffer.clear"
                }));
                if (currentUserMessage) {
                    currentUserMessage.remove();
                    currentUserMessage = null;
                }
            }
            
            speechStartTime = null;
            if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
        }
    }

    /**
     * WebRTC Response Handler
     * @param {Object} data - Response data from WebRTC
     */
    function handleAPIResponse(data) {
        console.log('Received event:', data);
        
        if (data.type === 'response.done' && 
            data.response?.output?.[0]?.type === 'function_call' && 
            data.response.output[0].name === 'query_company_info') {
            
            const callId = data.response.output[0].call_id;
            const args = JSON.parse(data.response.output[0].arguments);
            
            fetch(`/context/retrieve?query=${encodeURIComponent(args.query)}`)
                .then(response => response.json())
                .then(contextResults => {
                    // Take only the most relevant context document
                    const topContext = contextResults[0];
                    const contextInfo = topContext ? `Source:\n${topContext}` : null;
                    currentContext = contextInfo;
                    
                    const functionResult = {
                        type: "conversation.item.create",
                        item: {
                            type: "function_call_output",
                            call_id: callId,
                            output: JSON.stringify({
                                found: !!topContext,
                                information: contextInfo || "No relevant information found."
                            })
                        }
                    };
                    dc.send(JSON.stringify(functionResult));

                    const generateResponse = {
                        type: "response.create"
                    };
                    dc.send(JSON.stringify(generateResponse));
                })
                .catch(error => {
                    console.error('Error fetching context:', error);
                    currentContext = "Error fetching context information.";
                    // Handle error by sending back an error response
                    const functionResult = {
                        type: "conversation.item.create",
                        item: {
                            type: "function_call_output",
                            call_id: callId,
                            output: JSON.stringify({
                                found: false,
                                information: "Error fetching company information."
                            })
                        }
                    };
                    dc.send(JSON.stringify(functionResult));
                });
            return;
        }

        switch (data.type) {
            case 'conversation.item.input_audio_transcription.completed':
                // Immediately display user message when transcription is completed
                if (data.transcript) {
                    const userMessage = createMessageElement(data.transcript.trim(), true);
                    transcriptions.appendChild(userMessage);
                    currentUserMessage = null;
                    
                    // Start timing for AI response
                    messageStartTime = performance.now();
                    
                    // Create a placeholder for AI response
                    currentAIMessage = createMessageElement('', false);
                    transcriptions.appendChild(currentAIMessage);
                    
                    // Scroll to show user message
                    transcriptions.scrollTop = transcriptions.scrollHeight;
                }
                break;

            case 'response.audio_transcript.delta':
                // Update the existing AI message placeholder
                if (data.delta && currentAIMessage) {
                    const transcriptContent = currentAIMessage.querySelector('p');
                    if (transcriptContent) {
                        transcriptContent.textContent += data.delta;
                    }
                }
                break;

            case 'response.audio_transcript.done':
                // Finalize the AI response
                if (currentAIMessage) {
                    const transcriptContent = currentAIMessage.querySelector('p');
                    if (transcriptContent && data.transcript) {
                        transcriptContent.textContent = data.transcript;
                        
                        // Calculate and update response time, and add source context
                        if (messageStartTime) {
                            const timeTaken = performance.now() - messageStartTime;
                            const timestamp = currentAIMessage.querySelector('.timestamp');
                            timestamp.textContent = `${new Date().toLocaleTimeString()} (${(timeTaken/1000).toFixed(2)}s)`;
                            
                            // Replace the current AI message with a new one that includes the context
                            const newMessage = createMessageElement(
                                data.transcript,
                                false,
                                timeTaken,
                                currentContext
                            );
                            currentAIMessage.replaceWith(newMessage);
                            messageStartTime = null;
                            currentContext = null;
                        }
                    }
                    currentAIMessage = null;
                }
                break;

            case 'response.audio.delta':
                // Handle audio data
                if (data.delta) {
                    try {
                        const audioData = atob(data.delta);
                        const audioArray = new Uint8Array(audioData.length);
                        for (let i = 0; i < audioData.length; i++) {
                            audioArray[i] = audioData.charCodeAt(i);
                        }
                        playAudioData(audioArray);
                    } catch (error) {
                        console.error('Error playing audio:', error);
                    }
                }
                break;

            case 'error':
                console.error('AI Error:', data.error);
                const errorMessage = createMessageElement(`Error: ${data.error.message}`, false);
                transcriptions.appendChild(errorMessage);
                break;

            default:
                console.log('Other event:', data);
        }

        // Scroll to bottom when new content is added
        transcriptions.scrollTop = transcriptions.scrollHeight;
    }

    /**
     * Event Listeners
     */
    // Mode toggle listener
    modeToggle.addEventListener('change', () => {
        isVADMode = modeToggle.checked;
        const modeLabel = modeToggle.parentElement.nextElementSibling;
        modeLabel.textContent = isVADMode ? 'VAD Mode' : 'Manual Mode';
        pushToTalkBtn.classList.toggle('hidden', isVADMode);
        
        updateSessionMode();
    });

    // Push-to-talk button listeners
    pushToTalkBtn.addEventListener('mousedown', startRecording);
    pushToTalkBtn.addEventListener('mouseup', endRecording);
    pushToTalkBtn.addEventListener('mouseleave', endRecording);
    pushToTalkBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
    });
    pushToTalkBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        endRecording();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!isVADMode && e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            startManualInput();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!isVADMode && e.code === 'Space') {
            e.preventDefault();
            endManualInput();
        }
    });

    // Start/Stop button listeners
    startBtn.addEventListener('click', async () => {
        try {
            await init();
            
            // Add initial connection message
            const message = createMessageElement('Connected to Realtime API');
            transcriptions.appendChild(message);
            
            // Send initial prompt to AI
            setTimeout(() => {
                if (dc && dc.readyState === 'open') {
                    const initialEvent = {
                        type: 'response.create',
                        response: {
                            modalities: ['text'],
                            instructions: "You are an AI receptionist and assistant. You have access to two tool functions: 1) query_company_info - which searches the company knowledge base for information, and 2) store_appointment - which stores appointment details in Google Sheets. Your main tasks are: 1) Answer questions by searching the company knowledge base using query_company_info, and 2) Schedule appointments by collecting visitor details (name, date/time, reason) and storing them using store_appointment. For appointments, guide users step by step and confirm details before finalizing. Always be professional and courteous. If information isn't found in the knowledge base, politely inform the user.",
                        }
                    };
                    dc.send(JSON.stringify(initialEvent));
                }
            }, 1000);
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            // Reset button on error
            startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Assistant</span>';
            startBtn.disabled = false;
            const errorMessage = createMessageElement('Failed to connect: ' + error.message);
            transcriptions.appendChild(errorMessage);
        }
    });

    stopBtn.addEventListener('click', () => {
        cleanup();
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Initialize buttons state
    startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Assistant</span>';
    stopBtn.classList.add('hidden');
});