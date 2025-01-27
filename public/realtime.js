document.addEventListener('DOMContentLoaded', () => {
  // Global State Variables
  let pc; // RTCPeerConnection instance
  let dc; // RTCDataChannel instance
  let audioStream = null; // MediaStream for audio input
  let currentAIMessage = null; // Current AI response message element
  let currentUserMessage = null; // Current user message element
  let messageStartTime = null; // Timestamp for response timing
  let isVADMode = true; // Voice Activity Detection mode flag
  let audioContext; // AudioContext instance
  let analyser; // Audio analyser node
  let isRecording = false; // Recording state flag

  // Timer related variables
  let keyExpirationTimer;
  let keyExpirationTime;
  let countdownInterval;

  // Audio analysis constants
  const SILENCE_THRESHOLD = 0.01;
  const MIN_SPEECH_TIME = 300; // Minimum speech duration in ms

  // Appointment scheduling context
  let appointmentContext = {
    isScheduling: false,
    attemptedTimes: [], // Track all attempted times
    currentDate: null,
  };

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
  function createMessageElement(
    content,
    isOutgoing = false,
    timeTaken = null,
    sourceContext = null,
  ) {
    const message = document.createElement('div');
    message.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    const timeInfo = timeTaken ? ` (${(timeTaken / 1000).toFixed(2)}s)` : '';
    timestamp.textContent = `${new Date().toLocaleTimeString()}${timeInfo}`;

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content');

    const text = document.createElement('p');
    text.textContent = content;

    const recordingIndicator = document.createElement('div');
    recordingIndicator.classList.add('recording-indicator');
    recordingIndicator.innerHTML =
      '<i class="fas fa-microphone"></i><span>Recording...</span>';

    contentWrapper.appendChild(text);
    contentWrapper.appendChild(recordingIndicator);

    // Add source context dropdown if available
    if (sourceContext && !isOutgoing) {
      const sourceWrapper = document.createElement('div');
      sourceWrapper.classList.add('source-wrapper');

      const sourceToggle = document.createElement('button');
      sourceToggle.classList.add('source-toggle');
      sourceToggle.innerHTML =
        '<i class="fas fa-chevron-down"></i> Show Source';

      const sourceContent = document.createElement('div');
      sourceContent.classList.add('source-content');
      sourceContent.textContent = sourceContext;
      sourceContent.style.display = 'none';

      sourceToggle.addEventListener('click', () => {
        const isExpanded = sourceContent.style.display !== 'none';
        sourceContent.style.display = isExpanded ? 'none' : 'block';
        sourceToggle.innerHTML = isExpanded
          ? '<i class="fas fa-chevron-down"></i> Show Source'
          : '<i class="fas fa-chevron-up"></i> Hide Source';
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
      startBtn.innerHTML =
        '<i class="fas fa-circle-notch fa-spin"></i><span>Connecting...</span>';
      startBtn.disabled = true;

      loadingIndicator.classList.remove('hidden'); // Show loading
      initAudioContext();

      // Fetch config first
      const configResponse = await fetch('/realtime/config');
      const config = await configResponse.json();
      keyExpirationTime = config.keyExpirationTime;

      // Calculate expiration timestamp
      const expirationTime = Date.now() + keyExpirationTime;

      // Start countdown display
      updateCountdown(expirationTime);

      const tokenResponse = await fetch('/realtime/session');
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

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream = ms; // Store the stream reference
      const audioTrack = ms.getTracks()[0];
      audioTrack.enabled = isVADMode; // Set initial state based on mode
      pc.addTrack(audioTrack);

      dc = pc.createDataChannel('oai-events');

      // Configure session for transcription and tools
      dc.addEventListener('open', () => {
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: `
            ### Role and Persona
            You are Sophie, an experienced dental clinic receptionist and knowledge assistant. Be warm, professional, and efficient.

            ### Knowledge Base Usage (query_company_info)
            ALWAYS use query_company_info when users ask about:
            1. Dental Services
               - Procedures details
               - Treatment information
               - Service costs or pricing
               - Recovery time
               - What to expect
            
            2. Clinic Information
               - Working hours
               - Location details
               - Insurance coverage
               - Payment methods
               - Parking information
            
            3. Medical Questions
               - Treatment preparations
               - Post-procedure care
               - Pain management
               - Medical conditions
               - Medications

            4. Emergency Information
               - Emergency procedures
               - After-hours care
               - Urgent care protocols
               - Emergency contacts

            Example Scenarios:
            User: "How much does a root canal cost?"
            Action: query_company_info with "root canal cost pricing"

            User: "What should I do before my wisdom teeth removal?"
            Action: query_company_info with "wisdom teeth removal preparation"

            User: "Do you accept insurance?"
            Action: query_company_info with "insurance payment methods"

            ### Appointment Management
            When checking availability:
            1. Use check_availability to get ALL booked appointment times
            2. The endpoint returns an array of datetime strings in YYYY-MM-DD HH:mm format
            3. Each appointment is 1 hour long
            4. Available hours are 9 AM to 5 PM
            5. No appointments on weekends

            When patient requests a time:
            1. Check if their requested time conflicts with booked times
            2. If time is available:
               - Confirm the slot is free
               - Proceed with booking
            3. If time is booked:
               - Inform patient the slot is taken
               - Check 60 minutes before and after
               - Suggest nearest available slots
            4. If multiple slots are booked:
               - List available times for that day
               - Let patient choose

            Example response when slot is booked:
            "I see that 2:30 PM is already booked. However, I can offer you 2:00 PM or 3:00 PM instead. Would either of those times work for you?"

            ### Appointment Booking Process
            1. Name Collection:
               First explain to the user: "I'll help you schedule an appointment. To get started, may I have your full name for the appointment?"
               - If user seems unsure: "This information is needed to create your appointment record."
               - Wait for full name before proceeding
               - If only first name given: "Could you please provide your last name as well?"

            2. Date and Time Selection:
               a) Ask for preferred date first
               b) Then get desired time
               c) Use check_availability to verify slot
               d) If booked, help find alternative time
               e) Confirm final time selection

            3. Service Details:
               "What dental service do you need?"
               - If unclear, use query_company_info for service details
               - For emergencies, add "EMERGENCY: " prefix

            4. Contact Info:
               "Would you like a confirmation call? If yes, I'll need your phone number."
               Phone Number Handling:
               - Valid formats: 10-13 digits (including country code if provided)
               - If invalid number provided:
                 * Explain the issue specifically
                 * Request correct format
                 * NEVER modify or create phone numbers
                 * Examples:
                   - Too short: "I notice the phone number you provided is too short. Please provide a complete phone number with at least 10 digits."
                   - Too long: "The phone number you provided has too many digits. Please provide a number between 10-13 digits."
                 * Wait for correct number before proceeding
               - If user doesn't want to provide number:
                 * "No problem, we'll proceed without a contact number."
                 * Set phoneNumber to empty string

               Examples:
               User: "My number is 123"
               Response: "That phone number seems too short. Please provide a complete phone number with at least 10 digits."

               User: "12345678901234567"
               Response: "That phone number has too many digits. Please provide a number between 10-13 digits."

               User: "I don't want to give my number"
               Response: "No problem, we'll proceed without a contact number."

            5. Additional Notes:
               "Any special notes or concerns?"
               - Optional
               - Include relevant medical history

            ### Important Rules
            1. Knowledge Base Priority:
               - ALWAYS search knowledge base BEFORE giving information
               - NEVER make assumptions about services or policies
               - If information isn't found, say "sorry i dont have that information"
               - Only provide verified information from the knowledge base

            2. Appointment Handling:
               - Always verify slot availability before confirming
               - Compare requested time against booked times array
               - Consider 1-hour duration when checking conflicts
               - Business hours: 9 AM - 5 PM
               - Each query should check ALL booked times
               - Suggest alternatives when requested time is unavailable

            ### Appointment Flow
            1. Required Information Collection:
               a) Name:
                  "What is your full name, please?"
               
               b) Date/Time:
                  - Ask for preferred date
                  - Check availability
                  - Confirm time slot
               
               c) Service:
                  - Ask for service needed
                  - Use query_company_info if clarification needed
                  - Add "EMERGENCY: " prefix if urgent

            2. Optional Information:
               After collecting required info, always offer:
               
               a) Phone Contact (optional but recommended):
                  "Would you like to receive a confirmation call? It's optional, but recommended so we can contact you if needed."
                  - If yes: "Please provide your phone number"
                  - If no: "No problem, we'll proceed without a contact number"
               
               b) Additional Notes (optional):
                  "Would you like to add any notes or special concerns to your appointment? This could include medical history or specific needs."
                  - If yes: Record their notes
                  - If no: "That's fine, we'll proceed without additional notes"

            3. Final Confirmation (MANDATORY):
               Always perform this sequence:
               
               a) First Review:
               "Great! Let me confirm all your appointment details:
               - Name: [full name]
               - Date: [date in natural format]
               - Time: [time in 12-hour format]
               - Service: [service type]
               [If provided: - Phone: (number)]
               [If provided: - Notes: (special instructions)]
               
               Is all of this information correct? Please let me know if anything needs to be adjusted."

               b) Final Availability Check:
               - ALWAYS use check_availability one final time before scheduling
               - If slot is no longer available:
                  * Apologize for the last-minute conflict
                  * Immediately check surrounding times
                  * Offer closest available alternatives
               - If still available, proceed with booking

               c) Final Booking Process:
               - Only proceed with schedule_appointment after final availability check is successful
               - Confirm booking with clear success message
               - If booking fails, apologize and offer to try another time

               Example Final Check Flow:
               1. After user confirms details are correct:
                  "Let me do one final check to ensure this slot is still available..."
               
               2. If slot became unavailable:
                  "I apologize, but it seems someone just booked that slot. However, I can see that [alternative times] are still available. Would you like to choose one of these times instead?"
               
               3. If slot is still available:
                  "Perfect! The slot is still available. I'll proceed with booking your appointment now."

            ### Appointment Availability Checking Process
            1. First Check:
               - When patient requests a time, use check_availability first
               - Store the attempted datetime in memory
               
            2. If Time is Booked:
               a) Inform patient the slot is taken
               b) Check surrounding times (+/- 30 min)
               c) Suggest available alternatives
               
            3. If Patient Requests New Time/Date:
               a) ALWAYS use check_availability again
               b) Compare against ALL previously attempted times
               c) Keep tracking new attempts
               
            4. For Each New Attempt:
               - Add to attempted times list
               - Check availability immediately
               - Provide clear feedback
               - If booked, suggest alternatives
               
            5. Continue Until:
               - Successfully find available slot
               - Patient decides to end scheduling
               
            Example Response Flow:
            Patient: "I'd like 2:30 PM tomorrow"
            Action: check_availability
            Response: "2:30 PM is booked. I see that 2:00 PM and 3:00 PM are available. Would either of those work?"
            
            Patient: "How about Friday at 1:00 PM?"
            Action: check_availability
            Response: "Let me check that for you... I see 1:00 PM on Friday is also booked. 
            Available times on Friday are: 11:30 AM, 12:00 PM, and 2:00 PM. Would any of those times work better?"

            Always maintain context of previously checked times and dates to provide better suggestions.

            ### Time Awareness and Appointment Rules
            1. Current Time Handling:
               - Current date/time: ${new Date().toISOString()}
               - ALWAYS compare requested dates against current time
               - NEVER allow bookings for past dates or times
               - If user requests a past date/time, kindly inform them and ask for a future date

            2. Time Validation Rules:
               a) For Same-Day Appointments:
                  - Compare against current time
                  - Only allow bookings at least 1 hour after current time
                  - If requested time has passed, suggest next available time
               
               b) For Future Dates:
                  - Must be within next 3 months
                  - Weekdays only (Monday-Friday)
                  - Between 9 AM and 5 PM

            Example Responses:
            - For past date: "I notice that's a past date. Let me help you schedule for an upcoming date instead."
            - For same day: "Since it's currently [current time], the earliest available appointment today would be at [next available hour]."
            - For passed time: "That time has already passed today. Would you like to schedule for tomorrow or later today at [suggest next available time]?"

            ### Appointment Flow Updates
            1. Date/Time Collection:
               a) If user requests a specific date:
                  - Check if date is in the past
                  - If past, explain and ask for future date
                  - Validate against business hours and weekends
               
               b) If user requests a specific time:
                  - For today: verify time hasn't passed
                  - Suggest next available if too soon/passed
                  - Check availability as usual

            2. Availability Checks:
               - ALWAYS check current time first
               - Then check booked slots
               - Combine both to suggest valid times
            `,
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'en',
            },
            turn_detection: isVADMode
              ? {
                  type: 'server_vad',
                  threshold: 0.7,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 800,
                  create_response: true,
                }
              : null,
            temperature: 0.6,
            tools: [
              {
                type: 'function',
                name: 'query_company_info',
                description:
                  'Search through company knowledge base for relevant information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query about company information',
                    },
                  },
                  required: ['query'],
                },
              },
              {
                type: 'function',
                name: 'schedule_appointment',
                description: 'Schedule a new dental appointment',
                parameters: {
                  type: 'object',
                  properties: {
                    patientName: {
                      type: 'string',
                      description: 'Full name of the patient',
                    },
                    dateTime: {
                      type: 'string',
                      description: 'Date and time for the appointment (format: YYYY-MM-DD HH:mm)',
                    },
                    service: {
                      type: 'string',
                      description: 'Type of dental service or reason for visit',
                    },
                    phoneNumber: {
                      type: 'string',
                      description: 'Optional contact phone number',
                    },
                    notes: {
                      type: 'string',
                      description: 'Additional notes or special instructions',
                    },
                  },
                  required: ['patientName', 'dateTime', 'service'],
                },
              },
              {
                type: 'function',
                name: 'check_availability',
                description: 'Check available appointment slots for a given date',
                parameters: {
                  type: 'object',
                  properties: {
                    date: {
                      type: 'string',
                      description: 'Date to check availability for (YYYY-MM-DD format)',
                    },
                  },
                  required: ['date'],
                },
              },
            ],
            tool_choice: 'auto',
          },
        };
        dc.send(JSON.stringify(sessionConfig));
      });

      dc.addEventListener('message', (e) => {
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

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      const answer = {
        type: 'answer',
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
        dc.addEventListener(
          'open',
          () => {
            updateSessionMode();
          },
          { once: true },
        );
      }
    } catch (error) {
      loadingIndicator.classList.add('hidden'); // Hide loading on error
      // Reset start button on error
      startBtn.innerHTML =
        '<i class="fas fa-play"></i><span>Start Assistant</span>';
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
      false,
    );
    transcriptions.appendChild(expirationMessage);
    transcriptions.scrollTop = transcriptions.scrollHeight;

    // Hide mode switch when session expires
    document.querySelector('.mode-switch').classList.add('hidden');
  }

  async function cleanup() {
    // Update stop button to show stopping state
    stopBtn.innerHTML =
      '<i class="fas fa-circle-notch fa-spin"></i><span>Stopping...</span>';
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
    await new Promise((resolve) => setTimeout(resolve, 800));

    startBtn.classList.remove('hidden');
    startBtn.innerHTML =
      '<i class="fas fa-circle-notch fa-spin"></i><span>Connecting...</span>';
    startBtn.disabled = true;
    stopBtn.classList.add('hidden');

    const message = createMessageElement('Disconnected from Realtime API');
    transcriptions.appendChild(message);

    // Add delay before showing ready state
    await new Promise((resolve) => setTimeout(resolve, 1000));
    startBtn.innerHTML =
      '<i class="fas fa-play"></i><span>Start Assistant</span>';
    startBtn.disabled = false;

    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
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
      dc.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));

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
        type: 'session.update',
        session: {
          input_audio_transcription: {
            model: 'whisper-1',
            language: 'en',
          },
          turn_detection: isVADMode
            ? {
                type: 'server_vad',
                threshold: 0.7,
                prefix_padding_ms: 300,
                silence_duration_ms: 800,
                create_response: true,
              }
            : null,
        },
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
      dc.send(
        JSON.stringify({
          type: 'input_audio_buffer.clear',
        }),
      );
      dc.send(
        JSON.stringify({
          type: 'input_audio_buffer.commit',
        }),
      );
    }
  }

  function endManualInput() {
    if (!isVADMode && dc && dc.readyState === 'open') {
      dc.send(
        JSON.stringify({
          type: 'response.create',
        }),
      );
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

      dc.send(
        JSON.stringify({
          type: 'input_audio_buffer.clear',
        }),
      );

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

        dc.send(
          JSON.stringify({
            type: 'input_audio_buffer.commit',
          }),
        );
        dc.send(
          JSON.stringify({
            type: 'response.create',
          }),
        );
      } else {
        // If speech was too short, just clear and remove the message
        dc.send(
          JSON.stringify({
            type: 'input_audio_buffer.clear',
          }),
        );
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

    if (data.type === 'response.done' && data.response?.output?.[0]?.type === 'function_call') {
      const functionCall = data.response.output[0];
      const callId = functionCall.call_id;
      const args = JSON.parse(functionCall.arguments);

      switch (functionCall.name) {
        case 'query_company_info':
          fetch(`/context/retrieve?query=${encodeURIComponent(args.query)}`)
            .then((response) => response.json())
            .then((contextResults) => {
              // Take only the most relevant context document
              const topContext = contextResults[0];
              const contextInfo = topContext ? `Source:\n${topContext}` : null;
              currentContext = contextInfo;

              const functionResult = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    found: !!topContext,
                    information: contextInfo || 'No relevant information found.',
                  }),
                },
              };
              dc.send(JSON.stringify(functionResult));

              const generateResponse = {
                type: 'response.create',
              };
              dc.send(JSON.stringify(generateResponse));
            })
            .catch((error) => {
              console.error('Error fetching context:', error);
              currentContext = 'Error fetching context information.';
              // Handle error by sending back an error response
              const functionResult = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    found: false,
                    information: 'Error fetching company information.',
                  }),
                },
              };
              dc.send(JSON.stringify(functionResult));
            });
          break;

        case 'schedule_appointment':
          fetch('/appointments/schedule', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(args),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                const functionResult = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({
                      success: true,
                      message: `Appointment scheduled successfully for ${args.patientName} on ${args.dateTime} for ${args.service}`,
                      appointmentDetails: {
                        patientName: args.patientName,
                        dateTime: args.dateTime,
                        service: args.service,
                        notes: args.notes || '',
                      }
                    }),
                  },
                };
                dc.send(JSON.stringify(functionResult));
              } else {
                throw new Error(result.error || 'Failed to schedule appointment');
              }

              const generateResponse = {
                type: 'response.create',
              };
              dc.send(JSON.stringify(generateResponse));
            })
            .catch((error) => {
              console.error('Error scheduling appointment:', error);
              const functionResult = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    success: false,
                    message: `Failed to schedule appointment: ${error.message}. Please try again.`,
                  }),
                },
              };
              dc.send(JSON.stringify(functionResult));

              const generateResponse = {
                type: 'response.create',
              };
              dc.send(JSON.stringify(generateResponse));
            });
          break;

        case 'check_availability':
          fetch('/appointments/booked-times')
            .then(response => response.json())
            .then(result => {
              // Track this attempt in our context
              if (appointmentContext.isScheduling) {
                appointmentContext.attemptedTimes.push(args.date);
                appointmentContext.currentDate = args.date;
              }

              const functionResult = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    success: true,
                    bookedTimes: result.data, // Array of booked datetime strings
                    context: appointmentContext // Include scheduling context
                  }),
                },
              };
              dc.send(JSON.stringify(functionResult));
              
              const generateResponse = {
                type: 'response.create',
              };
              dc.send(JSON.stringify(generateResponse));
            })
            .catch(error => {
              console.error('Error checking availability:', error);
              const functionResult = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({
                    success: false,
                    message: `Failed to check availability: ${error.message}. Please try again.`,
                  }),
                },
              };
              dc.send(JSON.stringify(functionResult));

              const generateResponse = {
                type: 'response.create',
              };
              dc.send(JSON.stringify(generateResponse));
            });
          break;
      }
      return;
    }

    switch (data.type) {
      case 'conversation.item.input_audio_transcription.completed':
        // Immediately display user message when transcription is completed
        if (data.transcript) {
          const userMessage = createMessageElement(
            data.transcript.trim(),
            true,
          );
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
              timestamp.textContent = `${new Date().toLocaleTimeString()} (${(timeTaken / 1000).toFixed(2)}s)`;

              // Replace the current AI message with a new one that includes the context
              const newMessage = createMessageElement(
                data.transcript,
                false,
                timeTaken,
                currentContext,
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
        const errorMessage = createMessageElement(
          `Error: ${data.error.message}`,
          false,
        );
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
    } catch (error) {
      console.error('Failed to initialize:', error);
      // Reset button on error
      startBtn.innerHTML =
        '<i class="fas fa-play"></i><span>Start Assistant</span>';
      startBtn.disabled = false;
      const errorMessage = createMessageElement(
        'Failed to connect: ' + error.message,
      );
      transcriptions.appendChild(errorMessage);
    }
  });

  stopBtn.addEventListener('click', () => {
    cleanup();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // Initialize buttons state
  startBtn.innerHTML =
    '<i class="fas fa-play"></i><span>Start Assistant</span>';
  stopBtn.classList.add('hidden');
});
