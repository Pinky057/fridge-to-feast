import { createIcons, Mic, Square, Camera, Keyboard, Send, Loader, History, Plus, ArrowLeft, ArrowRight, Heart, ChefHat, Clock, Flame, List, ListOrdered, Sparkles, Utensils, Circle, CheckCircle, RefreshCw, Upload, ImagePlus, X, Ear, EarOff, Tablet, Smartphone, Home, BookOpen, Settings, Layout, ChevronDown } from 'lucide';
import QRCode from 'qrcode';

// All icons used in the app
const ALL_ICONS = {
  Mic, Square, Camera, Keyboard, Send, Loader, History, Plus,
  ArrowLeft, ArrowRight, Heart, ChefHat, Clock, Flame, List,
  ListOrdered, Sparkles, Utensils, Circle, CheckCircle, RefreshCw,
  Upload, ImagePlus, X, Ear, EarOff, Tablet, Smartphone,
  Home, BookOpen, Settings, Layout, ChevronDown
};

// Initialize Lucide Icons
function refreshIcons() {
  createIcons({ icons: ALL_ICONS });
}
refreshIcons();

// UI Elements
const videoElement = document.getElementById('camera-feed');
const toggleBtn = document.getElementById('toggle-agent-btn');
const statusOrb = document.getElementById('status-orb'); // The tiny one in header
const aiVoiceOrb = document.getElementById('ai-voice-orb'); // The big central one
const statusText = document.getElementById('status-text');
const transcriptBox = document.getElementById('transcript-content');
const transcriptContainer = document.getElementById('transcript-container');
const historyBtn = document.getElementById('history-btn');
const modesToggleBtn = document.getElementById('modes-toggle-btn');
const modesMenu = document.getElementById('modes-menu');
const currentModeLabel = document.getElementById('current-mode-label');
const modeOptions = document.querySelectorAll('.mode-option');
const textInputContainer = document.getElementById('text-input-container');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');

// State
let isConnected = false;
let localStream = null;
let ws = null;
let frameInterval = null;
let currentMode = 'vision'; // 'vision', 'audio', or 'text'
const BACKEND_WS_URL = 'ws://localhost:3000';

// Audio State
let audioContext = null;
let audioWorkletNode = null;
let playbackContext = null;
let audioQueue = [];
let isPlaying = false;
let currentAiState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'

// Wake Word Detection State
let speechRecognition = null;
let isListeningForWakeWord = false;
let silenceTimeout = null;
const WAKE_WORD = 'hey chef';
const SILENCE_TIMEOUT_MS = 30000; // 30 seconds of silence = disconnect

// Screen Navigation State
let currentScreen = 'home'; // 'home', 'scan', 'recipe', 'cook'
let screenHistory = [];
let scanCameraStream = null;

// Recipe/Cook Mode State
let currentRecipe = null;
let currentCookStep = 0;
let detectedIngredients = [];

// --- DOM Manipulation Helpers ---

// Mode-specific config for button icons, labels, and hints
const MODE_CONFIG = {
  vision: {
    icon: 'camera',
    label: 'START CAMERA',
    hint: 'Point your camera at your fridge and talk to Chef about what you see.',
    statusMsg: 'Camera ready'
  },
  audio: {
    icon: 'mic',
    label: 'START TALKING',
    hint: 'Have a real-time conversation with Chef about your ingredients.',
    statusMsg: 'Microphone ready'
  },
  text: {
    icon: 'keyboard',
    label: 'CONNECT',
    hint: 'Type your ingredients or questions below.',
    statusMsg: 'Text input ready'
  }
};

function updateModeUI() {
  const config = MODE_CONFIG[currentMode];
  const hintEl = transcriptBox.querySelector('.system-msg:first-child');
  
  // Update the hint text
  if (hintEl) {
    hintEl.textContent = config.hint;
  }
  
  // Update the action button for the selected mode (only when disconnected)
  if (!isConnected) {
    toggleBtn.innerHTML = `<i data-lucide="${config.icon}"></i> <span>${config.label}</span>`;
    refreshIcons();
  }
  
  // Update status text
  statusText.textContent = config.statusMsg;
}

let lastStatusState = null;
let lastButtonHTML = null;

function updateStatus(stateStr, message) {
  // Skip if state hasn't changed
  if (lastStatusState === stateStr && statusText.textContent === message) {
    return;
  }
  lastStatusState = stateStr;

  // Update tiny header orb
  statusOrb.className = `tiny-orb ${stateStr}`;
  statusText.textContent = message;

  // Update giant central Voice Orb
  aiVoiceOrb.className = `voice-orb ${stateStr}`;

  const config = MODE_CONFIG[currentMode];

  // Determine new button HTML
  let newButtonHTML;
  let newButtonClass;

  if (!isConnected) {
    newButtonClass = 'main-action-btn';
    if (isListeningForWakeWord) {
      newButtonHTML = `<i data-lucide="mic"></i> <span>LISTENING...</span>`;
    } else {
      newButtonHTML = `<i data-lucide="${config.icon}"></i> <span>${config.label}</span>`;
    }
  } else if (stateStr === 'connecting' || stateStr === 'thinking') {
    newButtonClass = 'main-action-btn active-listening';
    const textMsg = stateStr === 'thinking' ? 'PROCESSING...' : 'CONNECTING...';
    newButtonHTML = `<i data-lucide="loader"></i> <span>${textMsg}</span>`;
  } else {
    newButtonClass = 'main-action-btn danger';
    newButtonHTML = '<i data-lucide="square"></i> <span>STOP</span>';
  }

  // Only update DOM and refresh icons if button actually changed
  if (lastButtonHTML !== newButtonHTML) {
    toggleBtn.className = newButtonClass;
    toggleBtn.innerHTML = newButtonHTML;
    lastButtonHTML = newButtonHTML;
    refreshIcons();
  } else {
    toggleBtn.className = newButtonClass;
  }
}

function appendTranscript(role, text) {
  const p = document.createElement('p');
  p.className = `${role}-msg`;

  const prefix = role === 'user' ? 'You: ' : role === 'ai' ? 'Chef: ' : '';
  p.textContent = prefix + text;

  transcriptBox.appendChild(p);
  // Auto-scroll logic handled by flex-direction: column-reverse in CSS mostly,
  // but just in case, scroll to the bottom of the visible items.
  transcriptBox.parentElement.scrollTop = transcriptBox.parentElement.scrollHeight;
}

// --- Audio System ---

/**
 * Initialize AudioWorklet for microphone capture
 * Captures audio at native sample rate, converts to 16kHz PCM for Gemini
 */
async function initAudioCapture() {
  try {
    // Create AudioContext for capture (will resample to 16kHz for Gemini)
    audioContext = new AudioContext({ sampleRate: 16000 });

    // Load the AudioWorklet processor
    await audioContext.audioWorklet.addModule('/audio-worklet-processor.js');

    // Create the worklet node
    audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');

    // Handle audio data from worklet
    audioWorkletNode.port.onmessage = (event) => {
      if (event.data.type === 'audio' && ws && ws.readyState === WebSocket.OPEN) {
        // Convert ArrayBuffer to base64
        const base64Audio = arrayBufferToBase64(event.data.audio);

        // Check for voice activity (simple energy-based detection)
        const int16Array = new Int16Array(event.data.audio);
        let energy = 0;
        for (let i = 0; i < int16Array.length; i++) {
          energy += Math.abs(int16Array[i]);
        }
        const avgEnergy = energy / int16Array.length;

        // If user is speaking while AI is speaking, interrupt
        if (currentAiState === 'speaking' && avgEnergy > 500) {
          console.log('User interruption detected');
          stopAudioPlayback();
        }

        // Send to Gemini via WebSocket
        const message = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=16000",
              data: base64Audio
            }]
          }
        };
        ws.send(JSON.stringify(message));

        // Update state to listening if we have voice activity
        if (currentAiState !== 'speaking' && avgEnergy > 500) {
          setAiState('listening');
        }
      }
    };

    // Connect microphone stream to worklet
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(audioWorkletNode);
    // Don't connect to destination (we don't want to hear ourselves)

    console.log('Audio capture initialized');
  } catch (error) {
    console.error('Failed to initialize audio capture:', error);
    appendTranscript('system', 'Audio capture failed. Check microphone permissions.');
  }
}

/**
 * Initialize AudioContext for playback
 * Gemini sends audio at 24kHz PCM
 */
function initAudioPlayback() {
  // Gemini outputs 24kHz audio
  playbackContext = new AudioContext({ sampleRate: 24000 });
  audioQueue = [];
  isPlaying = false;
  console.log('Audio playback initialized');
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Int16 PCM to Float32 for Web Audio API
 */
function int16ToFloat32(int16Array) {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

/**
 * Queue audio data for playback
 */
function queueAudioForPlayback(base64Audio) {
  const arrayBuffer = base64ToArrayBuffer(base64Audio);
  const int16Array = new Int16Array(arrayBuffer);
  const float32Array = int16ToFloat32(int16Array);

  audioQueue.push(float32Array);

  // Start playback if not already playing
  if (!isPlaying) {
    playNextAudioChunk();
  }
}

/**
 * Play the next audio chunk from the queue
 */
function playNextAudioChunk() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    // Finished speaking, go back to listening
    if (isConnected) {
      setAiState('listening');
    }
    return;
  }

  isPlaying = true;
  setAiState('speaking');

  const audioData = audioQueue.shift();

  // Create an audio buffer
  const audioBuffer = playbackContext.createBuffer(1, audioData.length, 24000);
  audioBuffer.getChannelData(0).set(audioData);

  // Create buffer source and play
  const source = playbackContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(playbackContext.destination);

  // When this chunk ends, play the next one
  source.onended = () => {
    playNextAudioChunk();
  };

  source.start();
}

/**
 * Stop audio playback (for interruption)
 */
function stopAudioPlayback() {
  audioQueue = [];
  isPlaying = false;

  // Close and recreate playback context to stop all audio
  if (playbackContext && playbackContext.state !== 'closed') {
    playbackContext.close();
    initAudioPlayback();
  }
}

/**
 * Set AI state and update orb accordingly
 */
function setAiState(state) {
  if (currentAiState === state) return;
  currentAiState = state;

  switch (state) {
    case 'listening':
      updateStatus('listening', 'Listening...');
      break;
    case 'thinking':
      updateStatus('thinking', 'Thinking...');
      break;
    case 'speaking':
      updateStatus('speaking', 'Chef is speaking...');
      break;
    default:
      updateStatus('disconnected', 'Ready');
  }
}

/**
 * Handle incoming Gemini messages
 */
function handleGeminiMessage(data) {
  // Reset silence timeout on any activity
  resetSilenceTimeout();

  // Handle setupComplete
  if (data.setupComplete) {
    console.log('Gemini session setup complete');
    appendTranscript('system', 'Connected to Chef! Start talking...');
    setAiState('listening');
    return;
  }

  // Handle serverContent (AI responses)
  if (data.serverContent) {
    const content = data.serverContent;

    // Check for model turn (AI speaking)
    if (content.modelTurn) {
      const parts = content.modelTurn.parts || [];

      for (const part of parts) {
        // Handle text response
        if (part.text) {
          appendTranscript('ai', part.text);

          // Check if this is a goodbye response (AI acknowledging end)
          if (checkForGoodbye(part.text)) {
            // Give a moment for the audio to play, then disconnect
            setTimeout(() => {
              appendTranscript('system', 'Say "Hey Chef" when you need me again!');
              disconnectAndListenForWakeWord();
            }, 3000);
          }
        }

        // Handle audio response
        if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
          queueAudioForPlayback(part.inlineData.data);
        }
      }
    }

    // Check if turn is complete
    if (content.turnComplete) {
      console.log('AI turn complete');
      // State will transition back to listening when audio finishes
    }

    // Check if AI was interrupted
    if (content.interrupted) {
      console.log('AI was interrupted');
      stopAudioPlayback();
      setAiState('listening');
    }
  }

  // Handle toolCall if needed in the future
  if (data.toolCall) {
    console.log('Tool call received:', data.toolCall);
  }
}

/**
 * Cleanup audio resources
 */
function cleanupAudio() {
  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    audioWorkletNode = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }

  if (playbackContext && playbackContext.state !== 'closed') {
    playbackContext.close();
    playbackContext = null;
  }

  audioQueue = [];
  isPlaying = false;
  currentAiState = 'idle';
}

// --- Wake Word Detection (Web Speech API) ---

/**
 * Initialize Web Speech API for wake word detection
 */
function initWakeWordDetection() {
  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this browser');
    appendTranscript('system', 'Wake word not supported. Use the button to start.');
    return false;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.lang = 'en-US';

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();

    // Check if wake word is detected
    if (transcript.includes('hey chef') || transcript.includes('hey shift') ||
        transcript.includes('hey shop') || transcript.includes('hey cheff') ||
        transcript.includes('a chef') || transcript.includes('hey shef')) {
      console.log('Wake word detected!');
      onWakeWordDetected();
    }
    // NO UI updates here - silent background listening
  };

  speechRecognition.onerror = () => {
    // Silently ignore ALL errors - no logging, no UI updates
  };

  speechRecognition.onend = () => {
    // Silently restart if we should still be listening
    if (isListeningForWakeWord && !isConnected) {
      restartWakeWordDetection();
    }
  };

  return true;
}

/**
 * Start listening for wake word (silent background listening)
 */
function startWakeWordDetection() {
  if (!speechRecognition && !initWakeWordDetection()) {
    return;
  }

  try {
    isListeningForWakeWord = true;
    speechRecognition.start();
    // No UI updates - silent background listening for accessibility
  } catch (error) {
    // May already be running - silently ignore
  }
}

/**
 * Stop listening for wake word
 */
function stopWakeWordDetection() {
  isListeningForWakeWord = false;
  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch (error) {
      // May not be running
    }
  }
}

/**
 * Restart wake word detection (for error recovery)
 */
function restartWakeWordDetection() {
  setTimeout(() => {
    if (isListeningForWakeWord && !isConnected) {
      try {
        speechRecognition.start();
      } catch (error) {
        // Silently retry - this is expected behavior
      }
    }
  }, 1000); // 1 second delay to reduce CPU usage
}

/**
 * Called when wake word is detected
 */
function onWakeWordDetected() {
  // Stop wake word detection
  stopWakeWordDetection();

  // Play activation sound feedback (optional visual feedback)
  appendTranscript('system', '"Hey Chef" detected! Connecting...');

  // Start the connection
  isConnected = true;
  startCapture();

  // Start silence timeout
  resetSilenceTimeout();
}

/**
 * Reset the silence timeout (call this when there's activity)
 */
function resetSilenceTimeout() {
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
  }

  silenceTimeout = setTimeout(() => {
    if (isConnected) {
      console.log('Silence timeout - disconnecting');
      appendTranscript('system', 'No activity detected. Say "Hey Chef" to start again.');
      disconnectAndListenForWakeWord();
    }
  }, SILENCE_TIMEOUT_MS);
}

/**
 * Disconnect from Gemini and go back to listening for wake word
 */
function disconnectAndListenForWakeWord() {
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }

  isConnected = false;
  stopCapture();

  // Go back to listening for wake word
  setTimeout(() => {
    startWakeWordDetection();
  }, 500);
}

/**
 * Check if user said goodbye/exit phrases
 */
function checkForGoodbye(text) {
  const goodbyePhrases = ['goodbye', 'bye', 'see you', 'thanks chef', 'thank you chef', 'that\'s all', 'done', 'stop'];
  const lowerText = text.toLowerCase();

  for (const phrase of goodbyePhrases) {
    if (lowerText.includes(phrase)) {
      return true;
    }
  }
  return false;
}

// --- Camera & Audio Capture ---
async function startCapture() {
  try {
    const requiredConstraints = { audio: true };
    if (currentMode === 'vision') {
      requiredConstraints.video = {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      };
    }

    // Request raw A/V stream from browser based on mode
    localStream = await navigator.mediaDevices.getUserMedia(requiredConstraints);

    // Mount stream to the hidden background video element
    if (currentMode === 'vision') {
      videoElement.srcObject = localStream;
      videoElement.style.display = 'block';
    } else {
      videoElement.srcObject = null;
      videoElement.style.display = 'none';
    }

    updateStatus('connecting', 'Connecting to Chef...');
    appendTranscript('system', currentMode === 'vision' ? 'Camera and microphone active.' : 'Microphone active.');

    // Initialize WebSocket connection to backend
    ws = new WebSocket(BACKEND_WS_URL);

    ws.onopen = async () => {
      appendTranscript('system', 'Connected to backend server.');

      // Initialize audio playback
      initAudioPlayback();

      // Initialize audio capture (for audio and vision modes)
      if (currentMode === 'audio' || currentMode === 'vision') {
        await initAudioCapture();
      }

      // Start frame extraction loop (VISION MODE ONLY)
      if (currentMode === 'vision') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 640;
        canvas.height = 480;

        frameInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN && videoElement.readyState >= 2) {
            // Draw current video frame to canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            // Extract base64 jpeg data payload
            const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

            // Construct Gemini Live API realtimeInput message
            const message = {
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "image/jpeg",
                  data: base64Image
                }]
              }
            };
            ws.send(JSON.stringify(message));
          }
        }, 1000); // 1 Frame Per Second
      }

      updateStatus('listening', currentMode === 'vision' ? 'Observing & Listening...' : 'Listening...');
    };

    ws.onmessage = async (event) => {
      try {
        // Handle incoming messages from Gemini (Proxy)
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);

          // Check for backend error
          if (data.type === "error") {
            appendTranscript('system', data.message);
            updateStatus('disconnected', 'API Key Missing');
            stopCapture();
            return;
          }

          // Handle Gemini response
          handleGeminiMessage(data);
        } else if (event.data instanceof Blob) {
          // Handle binary data (sometimes Gemini sends raw binary)
          const text = await event.data.text();
          const data = JSON.parse(text);
          handleGeminiMessage(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendTranscript('system', 'Connection error. Please try again.');
    };

    ws.onclose = () => {
      if (isConnected) {
        appendTranscript('system', 'Connection closed.');
        stopCapture();
      }
    };

  } catch (error) {
    console.error('Error accessing media devices.', error);
    updateStatus('disconnected', 'Error: Permissions Denied');
    appendTranscript('system', 'Please allow camera and microphone access.');
  }
}

function stopCapture() {
  // Stop media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
    localStream = null;
  }

  // Clear frame interval
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }

  // Cleanup audio resources
  cleanupAudio();

  // Close WebSocket
  if (ws) {
    ws.close();
    ws = null;
  }

  isConnected = false;
  updateStatus('disconnected', 'Disconnected');
}

// --- Event Listeners ---

// History Toggle
historyBtn.addEventListener('click', () => {
   transcriptContainer.classList.toggle('hidden');
});

// Wake Word Toggle (Accessibility)
const wakeWordBtn = document.getElementById('wake-word-btn');
let wakeWordEnabled = false;

wakeWordBtn?.addEventListener('click', () => {
  wakeWordEnabled = !wakeWordEnabled;

  if (wakeWordEnabled) {
    startWakeWordDetection();
    wakeWordBtn.classList.add('active');
    wakeWordBtn.innerHTML = '<i data-lucide="ear"></i> <span>Listening...</span>';
    appendTranscript('system', 'Voice activation ON - Say "Hey Chef" anytime');
  } else {
    stopWakeWordDetection();
    wakeWordBtn.classList.remove('active');
    wakeWordBtn.innerHTML = '<i data-lucide="ear-off"></i> <span>Hey Chef</span>';
    appendTranscript('system', 'Voice activation OFF');
  }
  refreshIcons();
});


// Modes Dropdown Toggle
modesToggleBtn.addEventListener('click', (e) => {
   modesMenu.classList.toggle('hidden');
   e.stopPropagation(); // prevent document click from immediately closing
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
   if (!modesToggleBtn.contains(e.target) && !modesMenu.contains(e.target)) {
       modesMenu.classList.add('hidden');
   }
});

toggleBtn.addEventListener('click', () => {
  // In camera mode, navigate to scan screen first
  if (currentMode === 'vision' && !isConnected) {
    navigateToScreen('scan');
    return;
  }

  if (isConnected) {
    // Disconnect and go back to wake word listening
    disconnectAndListenForWakeWord();
  } else if (isListeningForWakeWord) {
    // If already listening for wake word, manually activate
    onWakeWordDetected();
  } else {
    // Start wake word detection
    startWakeWordDetection();
  }
});

// Mode Switching Logic
let lastModeSwitch = 0;

function switchMode(newMode) {
    // Debounce - ignore if called within 500ms
    const now = Date.now();
    if (now - lastModeSwitch < 500) return;
    lastModeSwitch = now;

    if (isConnected) {
        alert("Please stop the agent before switching modes.");
        return;
    }

    if (newMode === currentMode) {
        modesMenu.classList.add('hidden');
        return;
    }

    // Update UI Active State
    modeOptions.forEach(b => {
        b.classList.toggle('active', b.dataset.mode === newMode);
    });

    currentMode = newMode;

    // Update label on modes button
    const activeBtn = document.querySelector(`.mode-option[data-mode="${newMode}"]`);
    if (activeBtn) {
        currentModeLabel.textContent = activeBtn.textContent.trim();
    }

    // Hide Menu immediately
    modesMenu.classList.add('hidden');

    // Toggle Text Input Visibility
    if (currentMode === 'text') {
        textInputContainer.classList.remove('hidden');
    } else {
        textInputContainer.classList.add('hidden');
    }

    // Update all mode-specific visuals
    updateModeUI();
    appendTranscript('system', MODE_CONFIG[currentMode].hint);
}

// Attach click handlers to each mode option directly
modeOptions.forEach((btn) => {
    btn.onclick = (e) => {
        e.stopPropagation();
        // Disable pointer events on menu IMMEDIATELY to prevent animation-triggered clicks
        modesMenu.style.pointerEvents = 'none';
        switchMode(btn.dataset.mode);
        // Re-enable after animation completes
        setTimeout(() => {
            modesMenu.style.pointerEvents = '';
        }, 300);
    };
});

// Text Input Sending Logic
function sendText() {
    const text = textInput.value.trim();
    if (!text) return;

    appendTranscript('user', text);
    textInput.value = '';

    // If connected to backend, send via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            clientContent: {
                turns: [{
                    parts: [{ text: text }],
                    role: "user"
                }],
                turnComplete: true
            }
        };
        ws.send(JSON.stringify(message));
        updateStatus('thinking', 'Processing recipe...');
    } else {
        // Parse ingredients from text and call Gemini API
        const ingredients = text.split(/[,\s]+/).filter(w => w.length > 2);
        detectedIngredients = ingredients.map(name => ({
            icon: '🥘',
            name: name.charAt(0).toUpperCase() + name.slice(1)
        }));

        appendTranscript('ai', `Great! Let me find some recipes based on: ${ingredients.join(', ')}...`);

        // Navigate to suggestions screen and fetch recipes
        setTimeout(async () => {
            navigateToScreen('suggestions');
            showRecipesLoading();

            const recipes = await fetchRecipesFromAPI(detectedIngredients);

            if (recipes) {
                // Add image URLs to recipes
                recipes.forEach((recipe, index) => {
                    recipe.imageUrl = FOOD_IMAGES[index % FOOD_IMAGES.length];
                });
                generatedRecipes = recipes;
                renderRecipeCards(recipes);
                appendTranscript('ai', `Found ${recipes.length} recipes for you!`);
            } else {
                renderRecipeCards(null);
                appendTranscript('ai', `Sorry, couldn't generate recipes. Please try again.`);
            }
        }, 500);
    }
}

sendBtn.addEventListener('click', sendText);
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendText();
});

// Prevent text input clicks from bubbling
textInput.addEventListener('click', (e) => e.stopPropagation());
textInputContainer.addEventListener('click', (e) => e.stopPropagation());


// ====================================================
// SCREEN NAVIGATION SYSTEM
// ====================================================

/**
 * Navigate to a specific screen
 */
function navigateToScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  const targetScreen = document.getElementById(`${screenId}-screen`);

  if (!targetScreen) {
    console.error(`Screen not found: ${screenId}`);
    return;
  }

  // Add current screen to history (for back navigation)
  if (currentScreen !== screenId) {
    screenHistory.push(currentScreen);
  }

  // Animate out current screen
  screens.forEach(screen => {
    if (screen.classList.contains('active')) {
      screen.classList.add('slide-out');
      screen.classList.remove('active');
    }
  });

  // Animate in new screen after current one fades out
  setTimeout(() => {
    screens.forEach(screen => screen.classList.remove('slide-out'));
    targetScreen.classList.add('active');
    currentScreen = screenId;

    // Refresh icons after DOM update
    requestAnimationFrame(() => {
      refreshIcons();
    });

    // Screen-specific initialization
    if (screenId === 'scan') {
      initScanScreen();
    } else if (screenId === 'suggestions') {
      initSuggestionsScreen();
    } else if (screenId === 'recipe') {
      initRecipeScreen();
    } else if (screenId === 'cook') {
      initCookScreen();
    } else if (screenId === 'complete') {
      initCompleteScreen();
    } else if (screenId === 'saved') {
      initSavedScreen();
    } else if (screenId === 'history') {
      initHistoryScreen();
    }
  }, 350);
}

/**
 * Initialize history screen
 */
function initHistoryScreen() {
  const grid = document.getElementById('history-grid');
  const noHistory = document.getElementById('no-history');
  const history = getHistory();

  grid.innerHTML = '';

  if (history.length === 0) {
    noHistory.style.display = 'flex';
    grid.style.display = 'none';
    refreshIcons();
    return;
  }

  noHistory.style.display = 'none';
  grid.style.display = 'grid';

  history.forEach((recipe, index) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.recipeId = recipe.id;
    const imageUrl = recipe.imageUrl || FOOD_IMAGES[index % FOOD_IMAGES.length];
    const emoji = FOOD_EMOJIS[index % FOOD_EMOJIS.length];

    // Format date
    const cookedDate = new Date(recipe.cookedAt);
    const dateStr = cookedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    card.innerHTML = `
      <div class="card-image" data-image-url="${imageUrl}">
        <span class="emoji-fallback">${emoji}</span>
        <div class="card-badge">${dateStr}</div>
      </div>
      <div class="card-content">
        <h4>${recipe.title}</h4>
        <p>${recipe.description}</p>
        <div class="card-meta">
          <span><i data-lucide="clock"></i> ${recipe.time}</span>
          <span><i data-lucide="flame"></i> ${recipe.difficulty}</span>
        </div>
      </div>
    `;

    // Load image
    const cardImage = card.querySelector('.card-image');
    const img = new Image();
    img.onload = () => {
      cardImage.style.backgroundImage = `url('${imageUrl}')`;
      cardImage.style.backgroundSize = 'cover';
      cardImage.style.backgroundPosition = 'center';
      cardImage.querySelector('.emoji-fallback').style.display = 'none';
    };
    img.src = imageUrl;

    // Click to view recipe
    card.addEventListener('click', () => {
      currentRecipe = recipe;
      generatedRecipes = [recipe];
      navigateToScreen('recipe');
    });

    grid.appendChild(card);
  });

  refreshIcons();
}

/**
 * Initialize saved/favorites screen
 */
function initSavedScreen() {
  const grid = document.getElementById('favorites-grid');
  const noFavorites = document.getElementById('no-favorites');
  const favs = getFavorites();

  grid.innerHTML = '';

  if (favs.length === 0) {
    noFavorites.style.display = 'flex';
    grid.style.display = 'none';
    refreshIcons();
    return;
  }

  noFavorites.style.display = 'none';
  grid.style.display = 'grid';

  favs.forEach((recipe, index) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.recipeId = recipe.id;
    const imageUrl = recipe.imageUrl || FOOD_IMAGES[index % FOOD_IMAGES.length];
    const emoji = FOOD_EMOJIS[index % FOOD_EMOJIS.length];

    card.innerHTML = `
      <div class="card-image" data-image-url="${imageUrl}">
        <span class="emoji-fallback">${emoji}</span>
        <div class="card-badge saved-badge"><i data-lucide="heart"></i></div>
      </div>
      <div class="card-content">
        <h4>${recipe.title}</h4>
        <p>${recipe.description}</p>
        <div class="card-meta">
          <span><i data-lucide="clock"></i> ${recipe.time}</span>
          <span><i data-lucide="flame"></i> ${recipe.difficulty}</span>
        </div>
      </div>
    `;

    // Load image
    const cardImage = card.querySelector('.card-image');
    const img = new Image();
    img.onload = () => {
      cardImage.style.backgroundImage = `url('${imageUrl}')`;
      cardImage.style.backgroundSize = 'cover';
      cardImage.style.backgroundPosition = 'center';
      cardImage.querySelector('.emoji-fallback').style.display = 'none';
    };
    img.src = imageUrl;

    // Click to view recipe
    card.addEventListener('click', () => {
      currentRecipe = recipe;
      generatedRecipes = [recipe];
      navigateToScreen('recipe');
    });

    grid.appendChild(card);
  });

  refreshIcons();
}

/**
 * Go back to previous screen
 */
function goBack() {
  if (screenHistory.length > 0) {
    const previousScreen = screenHistory.pop();

    // Clean up current screen
    if (currentScreen === 'scan') {
      stopScanCamera();
    }

    navigateBack(previousScreen);
  }
}

/**
 * Navigate back with reverse animation
 */
function navigateBack(screenId) {
  const currentScreenEl = document.getElementById(`${currentScreen}-screen`);
  const targetScreen = document.getElementById(`${screenId}-screen`);

  // Add going-back class for reverse animation
  currentScreenEl.classList.add('slide-out-right');
  currentScreenEl.classList.remove('active');

  // Show target with reverse entrance
  targetScreen.classList.add('entering-from-left');

  // Force reflow
  void targetScreen.offsetWidth;

  targetScreen.classList.add('active');
  targetScreen.classList.remove('entering-from-left');

  // Cleanup after animation
  setTimeout(() => {
    currentScreenEl.classList.remove('slide-out-right');
    currentScreen = screenId;
    refreshIcons();
  }, 500);
}

// ====================================================
// SCAN SCREEN LOGIC
// ====================================================

/**
 * Initialize scan screen
 */
async function initScanScreen() {
  // Reset to camera mode by default
  const scanModeBtns = document.querySelectorAll('.scan-mode-btn');
  const cameraModeContainer = document.getElementById('camera-mode-container');
  const uploadModeContainer = document.getElementById('upload-mode-container');

  scanModeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scanMode === 'camera');
  });

  cameraModeContainer?.classList.remove('hidden');
  uploadModeContainer?.classList.add('hidden');

  // Clear any uploaded image
  clearUploadedImage();

  // Start camera
  await startScanCamera();
}

/**
 * Start scan camera
 */
async function startScanCamera() {
  const scanVideo = document.getElementById('scan-camera-feed');
  const ingredientsContainer = document.getElementById('detected-ingredients');
  const cameraFrame = document.querySelector('.camera-preview-frame');

  // Reset detected ingredients
  detectedIngredients = [];
  if (ingredientsContainer) {
    ingredientsContainer.innerHTML = '<span class="ingredient-chip placeholder">Scanning...</span>';
  }

  // Remove any previous error state
  cameraFrame?.classList.remove('no-camera');

  try {
    // Get camera stream
    scanCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    if (scanVideo) {
      scanVideo.srcObject = scanCameraStream;
      scanVideo.style.display = 'block';
    }

    // Simulate ingredient detection (replace with actual AI detection)
    simulateIngredientDetection();
  } catch (error) {
    console.error('Error accessing camera:', error);

    // Hide video, show error state
    if (scanVideo) scanVideo.style.display = 'none';
    cameraFrame?.classList.add('no-camera');

    // Show error in ingredients area
    if (ingredientsContainer) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        ingredientsContainer.innerHTML = '<span class="ingredient-chip placeholder">Camera requires HTTPS. Try Upload mode!</span>';
      } else {
        ingredientsContainer.innerHTML = '<span class="ingredient-chip placeholder">No camera found. Try Upload mode!</span>';
      }
    }
  }
}

/**
 * Stop scan camera
 */
function stopScanCamera() {
  if (scanCameraStream) {
    scanCameraStream.getTracks().forEach(track => track.stop());
    scanCameraStream = null;
  }
}

/**
 * Simulate ingredient detection (demo purposes)
 */
function simulateIngredientDetection() {
  const ingredientsContainer = document.getElementById('detected-ingredients');
  const demoIngredients = [
    { icon: '🥚', name: 'Eggs' },
    { icon: '🍅', name: 'Tomatoes x2' },
    { icon: '🧅', name: 'Onion' },
    { icon: '🧄', name: 'Garlic' }
  ];

  let index = 0;
  ingredientsContainer.innerHTML = '';

  const interval = setInterval(() => {
    if (index < demoIngredients.length) {
      const ingredient = demoIngredients[index];
      detectedIngredients.push(ingredient);

      const chip = document.createElement('span');
      chip.className = 'ingredient-chip';
      chip.innerHTML = `${ingredient.icon} ${ingredient.name}`;
      ingredientsContainer.appendChild(chip);

      index++;
    } else {
      clearInterval(interval);
    }
  }, 800);
}

/**
 * Add detected ingredient
 */
function addDetectedIngredient(icon, name) {
  const ingredientsContainer = document.getElementById('detected-ingredients');

  // Remove placeholder if exists
  const placeholder = ingredientsContainer.querySelector('.placeholder');
  if (placeholder) placeholder.remove();

  const ingredient = { icon, name };
  detectedIngredients.push(ingredient);

  const chip = document.createElement('span');
  chip.className = 'ingredient-chip';
  chip.innerHTML = `${icon} ${name}`;
  ingredientsContainer.appendChild(chip);
}

// ====================================================
// SUGGESTIONS SCREEN LOGIC
// ====================================================

// Dynamic recipes from Gemini API
let generatedRecipes = [];

const API_BASE_URL = 'http://localhost:3000';

// Curated food images for recipes
const FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop'
];

// Fallback food emojis when images fail
const FOOD_EMOJIS = ['🍳', '🍲', '🥗', '🍝', '🍜', '🥘', '🍛', '🥪'];

// Favorites storage
let favorites = JSON.parse(localStorage.getItem('fridgeToFeastFavorites') || '[]');

// History storage
let cookingHistory = JSON.parse(localStorage.getItem('fridgeToFeastHistory') || '[]');

/**
 * Add recipe to cooking history
 */
function addToHistory(recipe) {
  if (!recipe) return;

  // Remove if already exists (to move to top)
  cookingHistory = cookingHistory.filter(h => h.title !== recipe.title);

  // Add to beginning
  cookingHistory.unshift({
    ...recipe,
    cookedAt: new Date().toISOString()
  });

  // Keep only last 20
  cookingHistory = cookingHistory.slice(0, 20);

  localStorage.setItem('fridgeToFeastHistory', JSON.stringify(cookingHistory));
}

/**
 * Get cooking history
 */
function getHistory() {
  return cookingHistory;
}

/**
 * Save recipe to favorites
 */
function saveToFavorites(recipe) {
  if (!recipe) return false;

  // Check if already saved
  const exists = favorites.some(f => f.title === recipe.title);
  if (exists) return false;

  favorites.push({
    ...recipe,
    savedAt: new Date().toISOString()
  });

  localStorage.setItem('fridgeToFeastFavorites', JSON.stringify(favorites));
  return true;
}

/**
 * Check if recipe is in favorites
 */
function isInFavorites(recipe) {
  if (!recipe) return false;
  return favorites.some(f => f.title === recipe.title);
}

/**
 * Remove recipe from favorites
 */
function removeFromFavorites(recipe) {
  if (!recipe) return;
  favorites = favorites.filter(f => f.title !== recipe.title);
  localStorage.setItem('fridgeToFeastFavorites', JSON.stringify(favorites));
}

/**
 * Get all favorites
 */
function getFavorites() {
  return favorites;
}

/**
 * Create image element with emoji fallback
 */
function createImageWithFallback(container, imageUrl, emojiIndex) {
  const emoji = FOOD_EMOJIS[emojiIndex % FOOD_EMOJIS.length];

  // Try loading image
  const img = new Image();
  img.onload = () => {
    container.style.backgroundImage = `url('${imageUrl}')`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    container.innerHTML = '';
  };
  img.onerror = () => {
    // Fallback to emoji
    container.style.backgroundImage = 'none';
    container.innerHTML = `<span class="emoji-fallback">${emoji}</span>`;
  };
  img.src = imageUrl;
}

/**
 * Fetch recipes from Gemini API based on ingredients
 */
async function fetchRecipesFromAPI(ingredients) {
  try {
    const ingredientNames = ingredients.map(ing =>
      typeof ing === 'string' ? ing : ing.name
    );

    const response = await fetch(`${API_BASE_URL}/api/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients: ingredientNames }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recipes');
    }

    const data = await response.json();
    return data.recipes || [];
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return null;
  }
}

/**
 * Render recipe cards dynamically
 */
function renderRecipeCards(recipes) {
  const grid = document.getElementById('recipe-cards-grid');
  const loading = document.getElementById('recipes-loading');

  if (loading) {
    loading.style.display = 'none';
  }

  // Clear existing cards (except loading)
  const existingCards = grid.querySelectorAll('.recipe-card');
  existingCards.forEach(card => card.remove());

  if (!recipes || recipes.length === 0) {
    grid.innerHTML = `
      <div class="recipes-error">
        <p>Couldn't generate recipes. Please try again.</p>
        <button onclick="goBack()" class="btn-secondary">Go Back</button>
      </div>
    `;
    return;
  }

  // Create recipe cards
  recipes.forEach((recipe, index) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.recipeId = recipe.id;
    const imageUrl = recipe.imageUrl || FOOD_IMAGES[index % FOOD_IMAGES.length];
    const emoji = FOOD_EMOJIS[index % FOOD_EMOJIS.length];
    card.innerHTML = `
      <div class="card-image" data-image-url="${imageUrl}" data-emoji="${emoji}">
        <span class="emoji-fallback">${emoji}</span>
        <div class="card-badge">${recipe.match}% match</div>
      </div>
      <div class="card-content">
        <h4>${recipe.title}</h4>
        <p>${recipe.description}</p>
        <div class="card-meta">
          <span><i data-lucide="clock"></i> ${recipe.time}</span>
          <span><i data-lucide="flame"></i> ${recipe.difficulty}</span>
        </div>
      </div>
    `;

    // Try loading image with fallback
    const cardImage = card.querySelector('.card-image');
    const img = new Image();
    img.onload = () => {
      cardImage.style.backgroundImage = `url('${imageUrl}')`;
      cardImage.querySelector('.emoji-fallback').style.display = 'none';
    };
    img.src = imageUrl;

    // Animate entrance
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    grid.appendChild(card);

    setTimeout(() => {
      card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + index * 100);
  });

  refreshIcons();
}

/**
 * Show loading state on suggestions screen
 */
function showRecipesLoading() {
  const grid = document.getElementById('recipe-cards-grid');
  const existingCards = grid.querySelectorAll('.recipe-card');
  existingCards.forEach(card => card.remove());

  const loading = document.getElementById('recipes-loading');
  if (loading) {
    loading.style.display = 'flex';
  } else {
    grid.innerHTML = `
      <div id="recipes-loading" class="recipes-loading">
        <div class="thinking-orb">
          <div class="orb-glow"></div>
          <div class="orb-core"></div>
          <div class="orb-ring"></div>
        </div>
        <p>Chef is thinking of recipes...</p>
      </div>
    `;
  }
}

/**
 * Initialize suggestions screen
 */
function initSuggestionsScreen() {
  // Update ingredients bar with detected ingredients
  const ingredientsContainer = document.getElementById('suggestion-ingredients');
  if (ingredientsContainer && detectedIngredients.length > 0) {
    ingredientsContainer.innerHTML = detectedIngredients.map(ing =>
      `<span class="ingredient-chip small">${ing.icon} ${ing.name}</span>`
    ).join('');
  }

  // Animate recipe cards
  const cards = document.querySelectorAll('.recipe-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + index * 100);
  });

  refreshIcons();
}

/**
 * Select a recipe and navigate to recipe screen
 */
function selectRecipe(recipeId) {
  const recipe = generatedRecipes.find(r => r.id === recipeId);
  if (recipe) {
    currentRecipe = recipe;
    navigateToScreen('recipe');
  }
}

// ====================================================
// RECIPE SCREEN LOGIC
// ====================================================

/**
 * Initialize recipe screen with data
 */
function initRecipeScreen() {
  // Fallback to first generated recipe if none selected
  if (!currentRecipe && generatedRecipes.length > 0) {
    currentRecipe = generatedRecipes[0];
  }

  if (!currentRecipe) {
    console.error('No recipe selected');
    goBack();
    return;
  }

  // Update UI
  document.getElementById('recipe-title').textContent = currentRecipe.title;
  document.getElementById('recipe-time').textContent = currentRecipe.time;
  document.getElementById('recipe-difficulty').textContent = currentRecipe.difficulty;

  // Update recipe image with emoji fallback
  const recipeImage = document.getElementById('recipe-image');
  const recipeIndex = generatedRecipes.findIndex(r => r.id === currentRecipe.id);
  const emoji = FOOD_EMOJIS[recipeIndex >= 0 ? recipeIndex % FOOD_EMOJIS.length : 0];

  if (currentRecipe.imageUrl) {
    recipeImage.innerHTML = `<span class="emoji-fallback">${emoji}</span>`;
    const img = new Image();
    img.onload = () => {
      recipeImage.style.backgroundImage = `url('${currentRecipe.imageUrl}')`;
      recipeImage.style.backgroundSize = 'cover';
      recipeImage.style.backgroundPosition = 'center';
      recipeImage.querySelector('.emoji-fallback').style.display = 'none';
    };
    img.src = currentRecipe.imageUrl;
  } else {
    recipeImage.innerHTML = `<span class="emoji-fallback">${emoji}</span>`;
  }

  // Update ingredients list
  const ingredientsList = document.getElementById('recipe-ingredients');
  ingredientsList.innerHTML = currentRecipe.ingredients.map(ing =>
    `<li><span class="ingredient-icon">${ing.icon}</span> ${ing.name}</li>`
  ).join('');

  // Update directions
  const directionsList = document.getElementById('recipe-directions');
  directionsList.innerHTML = currentRecipe.directions.map(step =>
    `<li>${step}</li>`
  ).join('');
}

/**
 * Set recipe data from AI response
 */
function setRecipeFromAI(recipeText) {
  // Parse AI response into structured recipe
  // This is a simplified parser - enhance based on actual AI output
  currentRecipe = {
    title: 'AI Generated Recipe',
    time: '20 min',
    difficulty: 'Medium',
    ingredients: detectedIngredients.length > 0 ? detectedIngredients : [
      { icon: '🥘', name: 'Ingredients from your fridge' }
    ],
    directions: recipeText.split(/\d+\.\s*/).filter(s => s.trim().length > 0)
  };
}

// ====================================================
// COOK MODE LOGIC
// ====================================================

/**
 * Initialize cook mode screen
 */
function initCookScreen() {
  if (!currentRecipe) return;

  currentCookStep = 0;
  const totalSteps = currentRecipe.directions.length;

  // Update total steps
  document.getElementById('total-steps').textContent = totalSteps;

  // Build steps list
  const stepsList = document.getElementById('cook-steps-list');
  stepsList.innerHTML = currentRecipe.directions.map((step, i) => `
    <li class="step-item ${i === 0 ? 'active' : ''}" data-step="${i + 1}">
      <span class="step-check"><i data-lucide="circle"></i></span>
      <span>${step}</span>
    </li>
  `).join('');

  // Update ingredients chips
  const ingredientsChips = document.getElementById('cook-ingredients-chips');
  ingredientsChips.innerHTML = currentRecipe.ingredients.map(ing =>
    `<span class="ingredient-chip">${ing.icon} ${ing.name}</span>`
  ).join('');

  // Update current step display
  updateCookStepDisplay();
  refreshIcons();
}

/**
 * Update cook step display
 */
function updateCookStepDisplay() {
  if (!currentRecipe) return;

  const steps = currentRecipe.directions;
  const totalSteps = steps.length;

  // Update step number and text
  document.getElementById('current-step-num').textContent = currentCookStep + 1;
  document.getElementById('step-badge').textContent = currentCookStep + 1;
  document.getElementById('current-step-text').textContent = steps[currentCookStep];

  // Update next step preview
  const nextStepText = document.getElementById('next-step-text');
  if (currentCookStep < totalSteps - 1) {
    nextStepText.textContent = steps[currentCookStep + 1];
    nextStepText.parentElement.style.display = 'block';
  } else {
    nextStepText.parentElement.style.display = 'none';
  }

  // Update progress bar
  const progress = ((currentCookStep + 1) / totalSteps) * 100;
  document.getElementById('step-progress-bar').style.width = `${progress}%`;

  // Update step list
  const stepItems = document.querySelectorAll('.step-item');
  stepItems.forEach((item, i) => {
    item.classList.remove('active', 'completed');
    if (i < currentCookStep) {
      item.classList.add('completed');
      item.querySelector('.step-check').innerHTML = '<i data-lucide="check-circle"></i>';
    } else if (i === currentCookStep) {
      item.classList.add('active');
    }
  });

  // Update nav buttons
  document.getElementById('prev-step-btn').disabled = currentCookStep === 0;
  const nextBtn = document.getElementById('next-step-btn');
  if (currentCookStep >= totalSteps - 1) {
    nextBtn.innerHTML = '<i data-lucide="check-circle"></i> Done';
  } else {
    nextBtn.innerHTML = 'Next <i data-lucide="arrow-right"></i>';
  }

  refreshIcons();
}

/**
 * Go to next cook step
 */
function nextCookStep() {
  if (!currentRecipe) return;

  if (currentCookStep < currentRecipe.directions.length - 1) {
    currentCookStep++;
    updateCookStepDisplay();
  } else {
    // Recipe complete - show completion screen
    navigateToScreen('complete');
  }
}

/**
 * Initialize completion screen
 */
function initCompleteScreen() {
  if (!currentRecipe) return;

  // Add to cooking history
  addToHistory(currentRecipe);

  // Set recipe name
  document.getElementById('complete-recipe-name').textContent = currentRecipe.title;

  // Update favorite button state
  const btn = document.getElementById('save-favorite-btn');
  if (isInFavorites(currentRecipe)) {
    btn.classList.add('saved');
    btn.innerHTML = '<i data-lucide="check"></i><span>Saved!</span>';
  } else {
    btn.classList.remove('saved');
    btn.innerHTML = '<i data-lucide="heart"></i><span>Save to Favorites</span>';
  }

  // Set food image with emoji fallback
  const completeImage = document.getElementById('complete-image');
  const recipeIndex = generatedRecipes.findIndex(r => r.id === currentRecipe.id);
  const emoji = FOOD_EMOJIS[recipeIndex >= 0 ? recipeIndex % FOOD_EMOJIS.length : 0];

  if (currentRecipe.imageUrl) {
    completeImage.innerHTML = `<span class="emoji-fallback">${emoji}</span>`;
    const img = new Image();
    img.onload = () => {
      completeImage.style.backgroundImage = `url('${currentRecipe.imageUrl}')`;
      completeImage.style.backgroundSize = 'cover';
      completeImage.style.backgroundPosition = 'center';
      completeImage.querySelector('.emoji-fallback').style.display = 'none';
    };
    img.src = currentRecipe.imageUrl;
  } else {
    completeImage.innerHTML = `<span class="emoji-fallback">${emoji}</span>`;
  }

  refreshIcons();
}

/**
 * Go to previous cook step
 */
function prevCookStep() {
  if (currentCookStep > 0) {
    currentCookStep--;
    updateCookStepDisplay();
  }
}

// ====================================================
// SCREEN NAVIGATION EVENT LISTENERS
// ====================================================

// Back buttons
document.getElementById('scan-back-btn')?.addEventListener('click', () => {
  stopScanCamera();
  goBack();
});

document.getElementById('recipe-back-btn')?.addEventListener('click', goBack);
document.getElementById('cook-back-btn')?.addEventListener('click', goBack);
document.getElementById('saved-back-btn')?.addEventListener('click', goBack);
document.getElementById('history-back-btn')?.addEventListener('click', goBack);

// Saved nav item
document.getElementById('saved-nav')?.addEventListener('click', () => {
  navigateToScreen('saved');
});

// History nav item
document.getElementById('history-nav')?.addEventListener('click', () => {
  navigateToScreen('history');
});

// Favorites button in phone UI
document.getElementById('favorites-btn')?.addEventListener('click', () => {
  navigateToScreen('saved');
});

// History button in phone UI
document.getElementById('history-btn')?.addEventListener('click', () => {
  navigateToScreen('history');
});

// Complete screen actions
document.getElementById('cook-again-btn')?.addEventListener('click', () => {
  currentRecipe = null;
  navigateToScreen('home');
});
document.getElementById('go-home-btn')?.addEventListener('click', () => {
  currentRecipe = null;
  generatedRecipes = [];
  navigateToScreen('home');
});
document.getElementById('save-favorite-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('save-favorite-btn');
  if (isInFavorites(currentRecipe)) {
    removeFromFavorites(currentRecipe);
    btn.classList.remove('saved');
    btn.innerHTML = '<i data-lucide="heart"></i><span>Save to Favorites</span>';
  } else {
    saveToFavorites(currentRecipe);
    btn.classList.add('saved');
    btn.innerHTML = '<i data-lucide="check"></i><span>Saved!</span>';
  }
  refreshIcons();
});

// Scan screen actions
document.getElementById('get-recipes-btn')?.addEventListener('click', async () => {
  stopScanCamera();
  navigateToScreen('suggestions');
  showRecipesLoading();

  // Get ingredients (from detected or use defaults for testing)
  const ingredients = detectedIngredients.length > 0
    ? detectedIngredients
    : [{ name: 'eggs' }, { name: 'bread' }, { name: 'butter' }, { name: 'cheese' }];

  const recipes = await fetchRecipesFromAPI(ingredients);

  if (recipes) {
    // Add image URLs to recipes
    recipes.forEach((recipe, index) => {
      recipe.imageUrl = FOOD_IMAGES[index % FOOD_IMAGES.length];
    });
    generatedRecipes = recipes;
    renderRecipeCards(recipes);
  } else {
    renderRecipeCards(null);
  }
});

document.getElementById('cancel-scan-btn')?.addEventListener('click', () => {
  stopScanCamera();
  goBack();
});

// ====================================================
// IMAGE UPLOAD HANDLING
// ====================================================

let uploadedImageData = null;

function initUploadHandlers() {
  const scanModeBtns = document.querySelectorAll('.scan-mode-btn');
  const cameraModeContainer = document.getElementById('camera-mode-container');
  const uploadModeContainer = document.getElementById('upload-mode-container');
  const uploadDropzone = document.getElementById('upload-dropzone');
  const imageUploadInput = document.getElementById('image-upload');
  const uploadPlaceholder = document.getElementById('upload-placeholder');
  const uploadPreview = document.getElementById('upload-preview');
  const uploadedImageEl = document.getElementById('uploaded-image');
  const removeImageBtn = document.getElementById('remove-image-btn');

  // Toggle between camera and upload modes
  scanModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.scanMode;

      // Update active button
      scanModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle containers
      if (mode === 'camera') {
        cameraModeContainer?.classList.remove('hidden');
        uploadModeContainer?.classList.add('hidden');
        startScanCamera();
      } else {
        cameraModeContainer?.classList.add('hidden');
        uploadModeContainer?.classList.remove('hidden');
        stopScanCamera();
        // Update hint for upload mode
        const ingredientsContainer = document.getElementById('detected-ingredients');
        if (ingredientsContainer && !uploadedImageData) {
          ingredientsContainer.innerHTML = '<span class="ingredient-chip placeholder">Upload an image to detect...</span>';
        }
      }

      // Re-render icons
      refreshIcons();
    });
  });

  // Click to upload
  if (uploadDropzone) {
    uploadDropzone.addEventListener('click', (e) => {
      // Don't trigger if clicking remove button
      if (e.target.closest('.remove-image-btn')) return;
      imageUploadInput?.click();
    });
  }

  // File input change
  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImageUpload(file, uploadedImageEl, uploadPlaceholder, uploadPreview);
    });
  }

  // Drag and drop
  if (uploadDropzone) {
    uploadDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.add('drag-over');
    });

    uploadDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove('drag-over');
    });

    uploadDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleImageUpload(file, uploadedImageEl, uploadPlaceholder, uploadPreview);
      }
    });
  }

  // Remove uploaded image
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      clearUploadedImage(uploadedImageEl, imageUploadInput, uploadPlaceholder, uploadPreview);
    });
  }
}

// Handle the uploaded image
function handleImageUpload(file, uploadedImageEl, uploadPlaceholder, uploadPreview) {
  const reader = new FileReader();

  reader.onload = (e) => {
    uploadedImageData = e.target.result;

    // Show preview
    if (uploadedImageEl) uploadedImageEl.src = uploadedImageData;
    if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
    if (uploadPreview) uploadPreview.classList.remove('hidden');

    // Update detected ingredients with demo data
    updateDetectedIngredients([
      { icon: '🥚', name: 'Eggs' },
      { icon: '🧀', name: 'Cheese' },
      { icon: '🥛', name: 'Milk' },
      { icon: '🧈', name: 'Butter' }
    ]);

    // Re-render icons
    refreshIcons();
  };

  reader.readAsDataURL(file);
}

function clearUploadedImage(uploadedImageEl, imageUploadInput, uploadPlaceholder, uploadPreview) {
  uploadedImageData = null;

  // Get elements if not passed
  const imgEl = uploadedImageEl || document.getElementById('uploaded-image');
  const inputEl = imageUploadInput || document.getElementById('image-upload');
  const placeholderEl = uploadPlaceholder || document.getElementById('upload-placeholder');
  const previewEl = uploadPreview || document.getElementById('upload-preview');

  if (imgEl) imgEl.src = '';
  if (inputEl) inputEl.value = '';
  if (placeholderEl) placeholderEl.classList.remove('hidden');
  if (previewEl) previewEl.classList.add('hidden');

  // Clear detected ingredients
  const detectedContainer = document.getElementById('detected-ingredients');
  if (detectedContainer) {
    detectedContainer.innerHTML = '<span class="ingredient-chip placeholder">Upload an image to detect...</span>';
  }
}

// Update detected ingredients display
function updateDetectedIngredients(ingredients) {
  const container = document.getElementById('detected-ingredients');
  if (!container) return;

  if (ingredients.length === 0) {
    container.innerHTML = '<span class="ingredient-chip placeholder">No ingredients detected</span>';
    return;
  }

  container.innerHTML = ingredients.map(ing =>
    `<span class="ingredient-chip"><span class="chip-icon">${ing.icon}</span> ${ing.name}</span>`
  ).join('');
}

// Initialize upload handlers - ES modules run after DOM is parsed
setTimeout(initUploadHandlers, 0);

// Suggestions screen actions
document.getElementById('suggestions-back-btn')?.addEventListener('click', goBack);

document.getElementById('refresh-suggestions-btn')?.addEventListener('click', () => {
  // Re-generate suggestions (demo: just refresh the animations)
  initSuggestionsScreen();
});

// Recipe card click handlers - delegate to grid
document.getElementById('recipe-cards-grid')?.addEventListener('click', (e) => {
  const card = e.target.closest('.recipe-card');
  if (card) {
    const recipeId = card.dataset.recipeId;
    selectRecipe(recipeId);
  }
});

// Recipe screen actions
document.getElementById('cook-mode-btn')?.addEventListener('click', () => {
  navigateToScreen('cook');
});

document.getElementById('save-recipe-btn')?.addEventListener('click', () => {
  alert('Recipe saved! ❤️');
});

// Cook mode navigation
document.getElementById('next-step-btn')?.addEventListener('click', nextCookStep);
document.getElementById('prev-step-btn')?.addEventListener('click', prevCookStep);

// ====================================================
// QR CODE GENERATION
// ====================================================

/**
 * Generate QR code for easy mobile access
 */
function generateQRCode() {
  const canvas = document.getElementById('qr-code');
  const urlText = document.getElementById('qr-url-text');

  if (!canvas) return;

  // Get the current URL (works for both localhost and deployed)
  const currentUrl = window.location.href;

  // Update the URL display
  if (urlText) {
    // Shorten the URL for display
    const displayUrl = currentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    urlText.textContent = displayUrl.length > 25 ? displayUrl.substring(0, 25) + '...' : displayUrl;
  }

  // Generate QR code
  QRCode.toCanvas(canvas, currentUrl, {
    width: 140,
    margin: 0,
    color: {
      dark: '#0f1115',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  }, (error) => {
    if (error) {
      console.error('QR Code generation failed:', error);
    } else {
      console.log('QR Code generated for:', currentUrl);
    }
  });
}

// Initial Setup
updateStatus('disconnected', 'Tap to start');

// Generate QR code on load
generateQRCode();

// Wake word detection OFF by default (Web Speech API causes tab flickering)
// Users can enable it via the "Hey Chef" button for accessibility

// ====================================================
// SIDEBAR NAVIGATION
// ====================================================

// View Toggle (Mobile/Tablet)
const viewToggle = document.getElementById('view-toggle');
const viewSubmenu = document.getElementById('view-submenu');
const viewItems = document.querySelectorAll('.submenu-item[data-view]');

viewToggle?.addEventListener('click', () => {
  const parent = viewToggle.closest('.has-submenu');
  parent?.classList.toggle('open');
});

viewItems.forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;

    // Update active state
    viewItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    // Toggle body class for layout
    if (view === 'tablet') {
      document.body.classList.add('tablet-view');
    } else {
      document.body.classList.remove('tablet-view');
    }
  });
});

// Initialize sidebar icons
refreshIcons();
