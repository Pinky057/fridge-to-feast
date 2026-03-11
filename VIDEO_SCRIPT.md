# Fridge-to-Feast: Code in Public - Video Script

> **Video Title:** Building an AI Sous-Chef with Gemini Live API | Gemini Live Agent Challenge
> **Channel:** Ishrat's Devlog
> **Duration:** ~4 minutes
> **Hashtag:** #GeminiLiveAgentChallenge

---

## 🎬 VIDEO OUTLINE

### INTRO (0:00 - 0:30)

**[HOOK - Show the app in action]**

> "What if you could just point your phone at your fridge and have an AI chef tell you exactly what to cook? No typing, no searching - just talk."

**[Show yourself / talking head]**

> "Hey everyone! I'm [Name] and this is Fridge-to-Feast - a real-time, multimodal AI Sous-Chef I built for the Gemini Live Agent Challenge on Devpost."

> "In the next 4 minutes, I'll show you what it does, how I built it, and the code behind it."

---

### DEMO - THE PROBLEM (0:30 - 1:00)

**[Screen recording: Show typical recipe app frustration]**

> "We've all been there - you open your fridge, see random ingredients, and then spend 20 minutes typing into recipe websites trying to find something that matches."

**[Show Fridge-to-Feast]**

> "Fridge-to-Feast solves this with THREE input modes:"

**[Quick demo of each mode]**

1. **Camera Mode** - "Point your phone at the fridge, and Gemini SEES your ingredients"
2. **Voice Mode** - "Or just TALK - say what you have"
3. **Text Mode** - "Or type if you prefer"

---

### DEMO - KEY FEATURES (1:00 - 2:00)

**[Screen recording with voiceover]**

#### Feature 1: Wake Word Activation
> "Say 'Hey Chef' and the AI activates - just like Siri or Alexa."

**[Show clicking the Hey Chef button, then saying "Hey Chef"]**

#### Feature 2: The Voice Orb
> "This animated orb shows exactly what the AI is doing:"
- Idle (thin rings)
- Listening (pulsing)
- Thinking (rotating)
- Speaking (glowing)

**[Show orb state transitions]**

#### Feature 3: Recipe Flow
> "Once it identifies your ingredients, you get recipe suggestions..."

**[Navigate: Home → Scan → Suggestions → Recipe → Cook Mode]**

> "And Cook Mode gives you hands-free, step-by-step instructions with large text - perfect when your hands are covered in flour!"

#### Feature 4: Image Upload
> "No camera? No problem - drag and drop a photo of your ingredients."

**[Show drag & drop upload]**

---

### CODE WALKTHROUGH (2:00 - 3:00)

**[Screen recording: VS Code / IDE]**

#### Architecture Overview
> "Let me show you how this works under the hood."

**[Show ARCHITECTURE.md or draw on screen]**

```
Browser (Frontend)  →  Node.js Proxy  →  Gemini Live API
   ↓                        ↓                   ↓
Camera/Mic              Hides API Key       Real-time AI
Audio Playback          WebSocket Relay     Vision + Voice
```

#### Key Code: WebSocket Connection

**[Show server.js]**

> "The backend is a simple WebSocket proxy. It connects to Gemini's Live API and relays messages."

```javascript
// server.js - Key part
const geminiWs = new WebSocket(
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`
);
```

#### Key Code: Sending Video Frames

**[Show main.js - frame capture]**

> "Every second, we capture a frame from the camera and send it to Gemini as base64."

```javascript
// Capture frame and send to Gemini
ctx.drawImage(videoElement, 0, 0);
const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

ws.send(JSON.stringify({
  realtimeInput: {
    mediaChunks: [{
      mimeType: "image/jpeg",
      data: base64Image
    }]
  }
}));
```

#### Key Code: Audio System

**[Show AudioWorklet code]**

> "Audio is captured at 16kHz using AudioWorklet, and playback is at 24kHz - exactly what Gemini expects."

```javascript
// Audio capture in AudioWorklet
const int16Array = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
}
```

---

### GOOGLE CLOUD DEPLOYMENT (3:00 - 3:30)

**[Show terminal / Cloud Console]**

> "For deployment, I'm using Google Cloud Run - serverless, auto-scaling, and free tier friendly."

**[Run deploy.sh or show Cloud Console]**

```bash
# One-command deployment
./deploy.sh
```

**[Show Cloud Run console with service running]**

> "The deploy script uses Google Cloud Buildpacks to containerize the app automatically. No Dockerfile needed!"

**[Show the live URL working]**

---

### TECHNOLOGIES USED (3:30 - 3:45)

**[Quick visual list / graphics]**

- **AI:** Google Gemini 2.0 Flash (Multimodal Live API)
- **Frontend:** Vanilla JS, Vite, Web Audio API
- **Backend:** Node.js, WebSocket
- **Cloud:** Google Cloud Run
- **Features:** Voice recognition, real-time video, interruption handling

---

### CLOSING (3:45 - 4:00)

**[Show yourself / talking head]**

> "That's Fridge-to-Feast! An AI that sees your ingredients and guides you through cooking - all in real-time."

> "If you want to try it yourself, check out the GitHub repo - link in the description. Everything is open for you to learn from."

> "This was built for the Gemini Live Agent Challenge on Devpost. If you liked this, drop a like and let me know what features you'd want to see next!"

> "Thanks for watching - and happy cooking!"

**[End screen with:]**
- GitHub: github.com/Pinky057/fridge-to-feast
- Hashtag: #GeminiLiveAgentChallenge

---

## 📝 VIDEO CHECKLIST

### Required Shots:
- [ ] App demo (all screens)
- [ ] Wake word activation
- [ ] Voice orb animations
- [ ] Recipe flow (Scan → Suggestions → Recipe → Cook)
- [ ] Image upload feature
- [ ] Code walkthrough (server.js, main.js)
- [ ] Cloud Run deployment proof
- [ ] Architecture diagram

### B-Roll Ideas:
- [ ] Typing on keyboard
- [ ] Phone pointed at fridge
- [ ] Code scrolling
- [ ] Terminal commands running

### Graphics Needed:
- [ ] Architecture diagram
- [ ] Technology stack icons
- [ ] Screen flow diagram

---

## 🎯 KEY MESSAGES TO CONVEY

1. **Problem:** Finding recipes with random ingredients is frustrating
2. **Solution:** AI that SEES and TALKS - multimodal interaction
3. **Technology:** Gemini Live API enables real-time conversation
4. **Accessibility:** Hands-free cooking, works for visually impaired
5. **Cloud Native:** Deployed on Google Cloud Run

---

## 📋 DEVPOST SUBMISSION TEXT

### Project Title
Fridge-to-Feast: AI Sous-Chef

### Tagline
Point your camera at your fridge, talk to your AI chef, cook something delicious.

### Description
*(Copy from README.md and customize)*

### Built With
- Gemini 2.0 Flash (Multimodal Live API)
- Google Cloud Run
- Node.js
- Vanilla JavaScript
- Web Audio API
- WebSockets

### Try It Out
- GitHub: https://github.com/Pinky057/fridge-to-feast
- Live Demo: [Cloud Run URL]

---

## 🔗 LINKS TO INCLUDE

- GitHub Repo: https://github.com/Pinky057/fridge-to-feast
- Devpost: [Your submission URL]
- Video: [YouTube URL]
- Cloud Run: [Deployed URL]

---

*Created for #GeminiLiveAgentChallenge on Devpost*
