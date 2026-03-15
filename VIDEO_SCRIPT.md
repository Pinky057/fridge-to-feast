# Fridge-to-Feast: Video Scripts

> **Channel:** Ishrat's Devlog
> **Hashtag:** #GeminiLiveAgentChallenge

---

# VIDEO 1: 4-MINUTE PITCH (Devpost Submission)

> **Title:** Fridge-to-Feast: AI Sous-Chef | Gemini Live Agent Challenge
> **Duration:** 4 minutes
> **Purpose:** Devpost submission, product demo

---

## 🎬 PITCH VIDEO OUTLINE

### HOOK (0:00 - 0:15)

**[Show app in action - someone pointing phone at fridge]**

> "What if your phone could look inside your fridge and instantly tell you what to cook?"

**[Cut to yourself]**

> "No more endless scrolling through recipes. Just point, talk, and cook."

---

### INTRO (0:15 - 0:30)

> "I'm [Name], and this is Fridge-to-Feast - a real-time AI Sous-Chef built with Google's Gemini Live API for the Gemini Live Agent Challenge."

---

### THE PROBLEM (0:30 - 0:50)

**[Show relatable scenario]**

> "We've all done this - open the fridge, see random stuff, then waste 20 minutes searching for recipes that match what we have."

> "Fridge-to-Feast fixes this with multimodal AI that can SEE and TALK in real-time."

---

### DEMO: THREE INPUT MODES (0:50 - 1:30)

**[Screen recording]**

> "You get three ways to interact:"

**1. Camera Mode (show it)**
> "Point at your fridge - Gemini sees ALL your ingredients at once."

**2. Upload Mode (show drag & drop)**
> "No camera? Drag and drop a photo."

**3. Text Mode (show typing)**
> "Or just type what you have."

---

### DEMO: THE EXPERIENCE (1:30 - 2:15)

**[Full flow demo]**

> "Once it knows your ingredients, the magic happens..."

**[Show: Suggestions Screen]**
> "You get personalized recipe suggestions ranked by match percentage."

**[Show: Recipe Screen]**
> "Tap any recipe for full details - ingredients, time, difficulty."

**[Show: Cook Mode]**
> "And Cook Mode gives you hands-free, step-by-step guidance with large text - perfect when your hands are messy!"

**[Show: Voice Orb]**
> "The voice orb shows exactly what the AI is doing - listening, thinking, or speaking."

---

### ACCESSIBILITY (2:15 - 2:30)

> "And here's what I'm most proud of - it's built for EVERYONE."

> "Visually impaired users can say 'Hey Chef' and navigate entirely by voice. No screen required."

---

### TECH STACK (2:30 - 3:00)

**[Show architecture diagram or code snippets]**

> "Under the hood:"

- **Gemini 2.0 Flash** - Multimodal Live API for real-time vision and voice
- **Google Cloud Run** - Serverless deployment
- **WebSockets** - Bidirectional streaming for instant responses
- **AudioWorklet** - Low-latency audio capture and playback

**[Show quick code snippet]**

```javascript
// Real-time video frames to Gemini
ws.send(JSON.stringify({
  realtimeInput: {
    mediaChunks: [{ mimeType: "image/jpeg", data: base64Image }]
  }
}));
```

---

### CLOUD DEPLOYMENT PROOF (3:00 - 3:20)

**[Show Cloud Run console]**

> "It's deployed on Google Cloud Run - fully serverless, auto-scaling."

**[Show terminal running deploy.sh]**

> "One command deployment with our infrastructure-as-code script."

**[Show live URL working]**

---

### CLOSING (3:20 - 4:00)

**[Back to yourself]**

> "Fridge-to-Feast: Point your camera, talk to your chef, cook something amazing."

> "Check out the full source code on GitHub - link in description."

> "If you want to see HOW I built this step-by-step, watch my full coding video on the channel."

> "Thanks for watching, and happy cooking!"

**[End screen]**
- GitHub: github.com/Pinky057/fridge-to-feast
- #GeminiLiveAgentChallenge

---

### PITCH VIDEO CHECKLIST

- [ ] Hook shot (phone at fridge)
- [ ] All three input modes
- [ ] Full recipe flow demo
- [ ] Voice orb animations
- [ ] Accessibility mention
- [ ] Architecture diagram
- [ ] Cloud Run console proof
- [ ] deploy.sh running
- [ ] Live URL working
- [ ] GitHub link

---
---

# VIDEO 2: FULL CODING TUTORIAL (Ishrat's Devlog)

> **Title:** I Built an AI Chef That Sees Your Fridge | Full Coding Tutorial
> **Duration:** 20-30 minutes (or split into parts)
> **Purpose:** Educational content, code walkthrough, devlog

---

## 🎬 CODING VIDEO OUTLINE

### INTRO (0:00 - 2:00)

**[Show finished app first]**

> "Before we write any code, let me show you what we're building..."

**[Demo the app]**

> "An AI sous-chef that can SEE your ingredients through the camera and TALK to you in real-time."

> "This is built for the Gemini Live Agent Challenge, and I'm going to show you exactly how to build it from scratch."

**[Show what viewers will learn]**

- Gemini Multimodal Live API
- WebSocket real-time streaming
- Audio capture with AudioWorklet
- Beautiful glassmorphism UI
- Google Cloud Run deployment

---

### PART 1: PROJECT SETUP (2:00 - 5:00)

**[Terminal / VS Code]**

> "Let's start with the project structure."

```
fridge-to-feast/
├── server.js          # Backend proxy
├── package.json
├── .env               # API key (secret!)
└── frontend/
    ├── index.html     # Main app
    ├── main.js        # All the magic
    ├── style.css      # Glassmorphism UI
    └── public/
        └── audio-worklet-processor.js
```

**[Install dependencies]**

```bash
npm init -y
npm install express ws dotenv
```

---

### PART 2: BACKEND PROXY (5:00 - 12:00)

**[Code server.js from scratch]**

> "Why do we need a backend? To hide our API key! Never put API keys in frontend code."

**[Explain WebSocket relay concept]**

```
Browser ←→ Our Server ←→ Gemini API
              ↑
         Hides API key
```

**[Code walkthrough - key parts]**

1. Express server setup
2. WebSocket connection to Gemini
3. Relay messages both directions
4. Error handling

```javascript
// The key connection to Gemini
const geminiUrl = `wss://generativelanguage.googleapis.com/ws/...?key=${API_KEY}`;
const geminiWs = new WebSocket(geminiUrl);

// Relay browser → Gemini
clientWs.on('message', (data) => {
  geminiWs.send(data);
});

// Relay Gemini → browser
geminiWs.on('message', (data) => {
  clientWs.send(data);
});
```

---

### PART 3: FRONTEND HTML STRUCTURE (12:00 - 18:00)

**[Build index.html]**

> "Let's create the UI structure."

**[Explain the phone frame concept]**

```html
<div class="phone-frame">
  <div id="ui-layer">
    <!-- Screens go here -->
  </div>
</div>
```

**[Build each screen]**

1. Home Screen (voice orb + controls)
2. Scan Screen (camera + upload)
3. Suggestions Screen (recipe cards)
4. Recipe Screen (full details)
5. Cook Screen (step-by-step)

---

### PART 4: CSS GLASSMORPHISM (18:00 - 25:00)

**[Style the app]**

> "Let's make it look premium with glassmorphism."

**[Key CSS concepts]**

```css
.glass-island {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**[Voice orb animations]**

```css
.voice-orb.listening {
  animation: orb-pulse-gentle 3s ease-in-out infinite;
}

.voice-orb.thinking {
  animation: orb-think-rotate 4s infinite;
}

.voice-orb.speaking {
  animation: orb-expand-breathe 1.5s infinite;
}
```

---

### PART 5: JAVASCRIPT - WEBSOCKET & AUDIO (25:00 - 40:00)

**[The core functionality]**

#### 5.1 WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Send setup message to Gemini
  ws.send(JSON.stringify({
    setup: {
      model: "models/gemini-2.0-flash-exp",
      generationConfig: { responseModalities: "audio" }
    }
  }));
};
```

#### 5.2 Camera Capture

```javascript
// Get camera stream
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' }
});

// Send frames every second
setInterval(() => {
  ctx.drawImage(video, 0, 0);
  const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
  ws.send(JSON.stringify({
    realtimeInput: {
      mediaChunks: [{ mimeType: "image/jpeg", data: base64 }]
    }
  }));
}, 1000);
```

#### 5.3 Audio System

**[Explain AudioWorklet]**

```javascript
// audio-worklet-processor.js
process(inputs, outputs) {
  const input = inputs[0][0];
  // Convert to 16-bit PCM
  const int16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    int16[i] = input[i] * 32768;
  }
  this.port.postMessage(int16);
  return true;
}
```

#### 5.4 Playing AI Response

```javascript
// Receive audio from Gemini
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.serverContent?.modelTurn?.parts) {
    const audio = data.serverContent.modelTurn.parts[0].inlineData;
    playAudio(audio.data); // Base64 PCM at 24kHz
  }
};
```

---

### PART 6: SCREEN NAVIGATION (40:00 - 45:00)

**[Smooth transitions]**

```javascript
function navigateToScreen(screenId) {
  currentScreen.classList.add('slide-out');

  setTimeout(() => {
    currentScreen.classList.remove('active');
    newScreen.classList.add('active', 'entering');
  }, 400);
}
```

---

### PART 7: IMAGE UPLOAD FEATURE (45:00 - 50:00)

**[Drag and drop]**

```javascript
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    // Send to Gemini for analysis
    sendImageToGemini(e.target.result);
  };
  reader.readAsDataURL(file);
});
```

---

### PART 8: GOOGLE CLOUD DEPLOYMENT (50:00 - 55:00)

**[deploy.sh walkthrough]**

```bash
#!/bin/bash
gcloud run deploy fridge-to-feast \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

**[Show deployment in action]**

**[Show Cloud Run console]**

---

### PART 9: TESTING & DEMO (55:00 - 60:00)

**[Full walkthrough of finished app]**

- Camera mode
- Upload mode
- Text mode
- Recipe flow
- Cook mode
- Voice commands

---

### CLOSING (60:00+)

> "And that's it! A complete AI sous-chef with real-time vision and voice."

> "All the code is on GitHub - link in description."

> "If you build something cool with this, let me know in the comments!"

> "Don't forget to like and subscribe for more AI coding tutorials."

---

### CODING VIDEO CHECKLIST

- [ ] Show finished app first (hook)
- [ ] Project structure explanation
- [ ] Backend proxy (server.js)
- [ ] HTML structure (all screens)
- [ ] CSS glassmorphism
- [ ] Voice orb animations
- [ ] WebSocket connection
- [ ] Camera capture code
- [ ] AudioWorklet explanation
- [ ] Audio playback
- [ ] Screen navigation
- [ ] Image upload
- [ ] Cloud Run deployment
- [ ] Full demo at the end

---

## 📋 TIMESTAMPS TEMPLATE (for YouTube)

```
0:00 - What we're building
2:00 - Project setup
5:00 - Backend proxy server
12:00 - HTML structure
18:00 - CSS glassmorphism & animations
25:00 - WebSocket connection
30:00 - Camera capture
35:00 - Audio system (AudioWorklet)
40:00 - Screen navigation
45:00 - Image upload feature
50:00 - Google Cloud deployment
55:00 - Final demo
```

---

## 🔗 LINKS FOR BOTH VIDEOS

- **GitHub:** https://github.com/Pinky057/fridge-to-feast
- **Devpost:** [submission URL]
- **Live Demo:** [Cloud Run URL]
- **Gemini API:** https://aistudio.google.com/apikey
- **Google Cloud:** https://console.cloud.google.com

---

## 📝 DESCRIPTION TEMPLATE

```
🍳 Fridge-to-Feast: AI Sous-Chef

Point your camera at your fridge and let AI tell you what to cook!
Built with Google Gemini 2.0 Multimodal Live API.

🔗 Links:
GitHub: https://github.com/Pinky057/fridge-to-feast
Try it: [Cloud Run URL]

🛠️ Tech Stack:
- Gemini 2.0 Flash (Multimodal Live API)
- Google Cloud Run
- Node.js + WebSockets
- Vanilla JavaScript

Built for #GeminiLiveAgentChallenge on Devpost

⏱️ Timestamps:
[paste timestamps]

#GeminiAI #GoogleCloud #AI #Coding #WebDevelopment
```

---

*Created for #GeminiLiveAgentChallenge on Devpost*
