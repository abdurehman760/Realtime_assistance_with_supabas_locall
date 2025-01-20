document.addEventListener('DOMContentLoaded', () => {
  // Add theme switching functionality
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('i');
  
  // Check for saved theme preference or default to 'light'
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

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  function createMessageElement(content, isOutgoing = false, timeTaken = null) {
    const message = document.createElement('div');
    message.classList.add('message', isOutgoing ? 'outgoing' : 'incoming');
    
    // Add 'short-message' class for messages with very little content
    if (content.length < 10) {
      message.classList.add('short-message');
    }
    
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    const timeInfo = timeTaken ? ` (${(timeTaken/1000).toFixed(2)}s)` : '';
    timestamp.textContent = `${formatTime(new Date())}${timeInfo}`;
    
    message.innerHTML = `<p>${content}</p>`;
    message.appendChild(timestamp);
    
    return message;
  }

  // Add initial AI welcome message
  const initialMessage = createMessageElement(
    "Hello! I'm Texagon Assistant. How can I help you today? Feel free to type your question or use the microphone to speak."
  );
  document.getElementById('transcriptions').appendChild(initialMessage);

  const form = document.getElementById('questionForm');
  const transcriptions = document.getElementById('transcriptions');
  let audioContext;
  let audioQueue = [];
  let isPlaying = false;

  function resetAudio() {
    audioQueue = [];
    isPlaying = false;
    if (audioContext) {
      audioContext.close();
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetAudio(); // Reset audio state for new request
    
    console.time('Total Response Time');
    const startTime = performance.now();
    
    const questionInput = document.getElementById('question');
    const question = questionInput.value;

    console.log('Processing request started at:', new Date().toISOString());
    
    console.time('UI Setup Time');
    const setupStartTime = Date.now();
    const userMessage = createMessageElement(question, true, 0);
    appendMessage(userMessage);

    const aiMessage = document.createElement('div');
    aiMessage.classList.add('message', 'incoming');
    const aiMessageContent = document.createElement('p');
    
    // Add timestamp to AI message
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    aiMessage.appendChild(timestamp);
    
    // Create container for generating text and loader
    const generatingContainer = document.createElement('div');
    generatingContainer.classList.add('generating-container');
    
    const generatingText = document.createElement('span');
    generatingText.textContent = 'Generating';
    
    const loaderSpan = document.createElement('span');
    loaderSpan.classList.add('loader');
    
    generatingContainer.appendChild(generatingText);
    generatingContainer.appendChild(loaderSpan);
    aiMessageContent.appendChild(generatingContainer);
    aiMessage.appendChild(aiMessageContent);
    appendMessage(aiMessage);

    console.timeEnd('UI Setup Time');
    console.log(`Setup time: ${Date.now() - setupStartTime}ms - Setup user and AI message elements`);

    console.time('Server Response Time');
    const responseStartTime = Date.now();
    const eventSource = new EventSource(`/pdf-loader/retrieve-data?query=${encodeURIComponent(question)}`);

    let firstChunkTime = null;
    let isFirstChunk = true;

    async function playNextChunk() {
      if (audioQueue.length === 0 || isPlaying) return;
      
      isPlaying = true;
      const audioData = audioQueue.shift();
      
      // Add speaking indicator when audio starts
      const speakingIndicator = document.createElement('div');
      speakingIndicator.classList.add('speaking-indicator');
      speakingIndicator.innerHTML = `
        <i class="fas fa-volume-up"></i>
        <div class="speaking-waves">
          <div class="speaking-wave"></div>
          <div class="speaking-wave"></div>
          <div class="speaking-wave"></div>
        </div>
      `;
      aiMessageContent.appendChild(speakingIndicator);
      
      try {
        const arrayBuffer = await new Response(
          new Blob([new Uint8Array(audioData)])
        ).arrayBuffer();
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          isPlaying = false;
          // Remove speaking indicator when audio ends
          if (speakingIndicator && speakingIndicator.parentNode) {
            speakingIndicator.remove();
          }
          playNextChunk();
        };
        source.start();
      } catch (error) {
        console.error('Audio playback error:', error);
        isPlaying = false;
        // Remove speaking indicator on error
        if (speakingIndicator && speakingIndicator.parentNode) {
          speakingIndicator.remove();
        }
        playNextChunk();
      }
    }

    eventSource.onmessage = (event) => {
      if (isFirstChunk) {
        firstChunkTime = performance.now();
        console.log(`Time to first chunk: ${((firstChunkTime - startTime)/1000).toFixed(2)}s`);
        const responseTimeSeconds = ((firstChunkTime - startTime)/1000).toFixed(2);
        timestamp.textContent = `${formatTime(new Date())} (${responseTimeSeconds}s)`;
        aiMessageContent.innerHTML = ''; // Clear the generating container
        isFirstChunk = false;
      }

      const data = JSON.parse(event.data);
      if (data.type === 'text') {
        if (isFirstChunk) {
          aiMessageContent.innerHTML = ''; // Clear the generating container
          isFirstChunk = false;
        }
        aiMessageContent.textContent += data.data;
      } else if (data.type === 'audio') {
        const chunk = new Uint8Array(
          atob(data.data)
            .split('')
            .map(char => char.charCodeAt(0))
        );
        audioQueue.push(chunk);
        if (!isPlaying) {
          playNextChunk();
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      isPlaying = false; // Reset playing state on error
      const endTime = performance.now();
      console.timeEnd('Server Response Time');
      console.log(`Total processing time: ${endTime - startTime}ms`);
      console.timeEnd('Total Response Time');
    };

    eventSource.onopen = () => {
      console.log(`Connection established in: ${performance.now() - startTime}ms`);
    };

    questionInput.value = '';
  });

  // Speech Recognition Setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';

  const micButton = document.getElementById('micButton');
  const listeningText = document.getElementById('listeningText');
  const tapToRecordText = document.getElementById('tapToRecordText');
  let isListening = false;

  micButton.addEventListener('click', () => {
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  });

  function startListening() {
    isListening = true;
    micButton.classList.add('listening');
    // Only show text on desktop
    if (window.innerWidth > 768) {
      listeningText.style.display = 'inline';
      tapToRecordText.style.display = 'none';
    }
    recognition.start();
  }

  function stopListening() {
    isListening = false;
    micButton.classList.remove('listening');
    // Only show text on desktop
    if (window.innerWidth > 768) {
      listeningText.style.display = 'none';
      tapToRecordText.style.display = 'inline';
    }
    recognition.stop();
  }

  recognition.onresult = (event) => {
    const results = Array.from(event.results);
    const lastResult = results[results.length - 1];
    const transcript = lastResult[0].transcript;
    
    document.getElementById('question').value = transcript;
    
    if (!isContinuousListening) {
      stopListening();
    }
    
    // Submit the form with the transcribed text
    form.dispatchEvent(new Event('submit'));
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopListening();
  };

  recognition.onend = () => {
    if (isContinuousListening && isListening) {
      recognition.start();
    } else {
      stopListening();
    }
  };

  // Add continuous listening functionality
  const continuousListeningButton = document.getElementById('continuousListeningButton');
  let isContinuousListening = false;

  continuousListeningButton.addEventListener('click', () => {
    isContinuousListening = !isContinuousListening;
    if (isContinuousListening) {
      enableContinuousListening();
    } else {
      disableContinuousListening();
    }
  });

  function enableContinuousListening() {
    recognition.continuous = true;
    continuousListeningButton.innerHTML = window.innerWidth <= 768 ? 
      '<i class="fas fa-stop"></i>' : 
      '<i class="fas fa-stop"></i><span>Stop Listening</span>';
    continuousListeningButton.classList.add('danger');
    micButton.style.display = 'none';
    startListening();
  }

  function disableContinuousListening() {
    recognition.continuous = false;
    continuousListeningButton.innerHTML = window.innerWidth <= 768 ? 
      '<i class="fas fa-headset"></i>' : 
      '<i class="fas fa-headset"></i><span>Auto Listen</span>';
    continuousListeningButton.classList.remove('danger');
    micButton.style.display = 'flex';
    stopListening();
  }

  // Add window resize handler to update button text
  window.addEventListener('resize', () => {
    if (isContinuousListening) {
      enableContinuousListening();
    } else {
      disableContinuousListening();
    }
  });

  // Add cleanup when leaving the page
  window.addEventListener('beforeunload', () => {
    if (isListening) {
      stopListening();
    }
  });

  const chatBody = document.getElementById('transcriptions');
  const scrollButton = document.getElementById('scrollBottomButton');
  
  // Check if should show scroll button
  function checkScroll() {
    const { scrollTop, scrollHeight, clientHeight } = chatBody;
    const shouldShow = scrollTop + clientHeight < scrollHeight - 100;
    scrollButton.classList.toggle('visible', shouldShow);
  }

  // Scroll to bottom when button clicked
  scrollButton.addEventListener('click', () => {
    chatBody.scrollTo({
      top: chatBody.scrollHeight,
      behavior: 'smooth'
    });
  });

  // Check scroll position when user scrolls
  chatBody.addEventListener('scroll', checkScroll);

  // Modify the existing message append logic to check scroll
  function appendMessage(message) {
    transcriptions.appendChild(message);
    checkScroll();
  }
});
