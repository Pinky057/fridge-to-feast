# Fridge-to-Feast — Full Project Context & Handoff Guide

> **Purpose:** This file gives any AI agent (or human) the complete context needed to continue working on this project without any verbal briefing. Read this before touching any code.

---

## 🎯 What Is This Project?

**Fridge-to-Feast** is a real-time, multimodal AI Sous-Chef built for the **Devpost Gemini Live Agent Challenge** (Category: **Live Agents 🗣️**).

The user points their phone camera at their fridge, and a conversational AI "Chef" **sees** the ingredients and **talks back** with recipe suggestions. The conversation is fully interruptible — the user can cut in mid-sentence just like talking to a real person.

**Competition:** [Gemini Live Agent Challenge on Devpost](https://geminiliveagentchallenge.devpost.com/)
**Category:** Live Agents 🗣️
**Deadline:** March 17, 2026 @ 6:00am GMT+6 (2 days remaining)
**Participants:** 10,846 | **Prize Pool:** $80,000

### Judging Criteria & Our Status

| Criteria | Weight | Our Status |
|----------|--------|------------|
| **Innovation & Multimodal UX** | 40% | ✅ Wake word, vision+audio, interruption |
| **Technical Implementation** | 30% | ✅ AudioWorklet, WebSocket relay, state machine |
| **Demo & Presentation** | 30% | 🟡 Need demo video + deployment proof |

### Required Submissions
- [x] Text description of features
- [x] Public code repository with spin-up instructions
- [ ] Proof of Google Cloud deployment
- [ ] Architecture diagram (have ARCHITECTURE.md)
- [ ] Demo video (<4 minutes)

---

## 🏗️ Architecture (Thin Client, Thick Server)

```
┌─────────────────┐       WebSocket        ┌─────────────────┐       WebSocket (wss://)      ┌─────────────────┐
│   Vite Frontend │ ◄──────────────────►   │  Node.js Proxy  │ ◄─────────────────────────►   │  Gemini Live API│
│   (Browser)     │    ws://localhost:3000  │  (server.js)    │    BidiGenerateContent        │  (Google Cloud) │
│                 │                        │                 │                               │                 │
│ • Camera frames │─── base64 JPEG ──────► │ • Injects API   │─── realtimeInput ───────────► │ • Sees images   │
│ • Mic audio     │─── PCM audio ────────► │   key securely  │─── audio/pcm ──────────────► │ • Hears speech  │
│ • Text input    │─── clientContent ────► │ • Forwards msgs │─── clientContent ──────────► │ • Thinks recipe │
│                 │                        │                 │                               │                 │
│ • Plays audio   │◄── PCM audio ──────── │ • Forwards back │◄── serverContent (audio) ──── │ • Speaks recipe │
│ • Shows text    │◄── transcript ──────── │                 │◄── text chunks ───────────── │                 │
└─────────────────┘                        └─────────────────┘                               └─────────────────┘
```

**Why a proxy?** The Gemini API key must NEVER be in frontend code. The backend hides it.

---

## 📁 File Structure

```
fridge-to-feast/
├── .env                  # YOUR GEMINI_API_KEY goes here (gitignored)
├── .env.example          # Template for the env file
├── server.js             # ⭐ Node.js WebSocket proxy → Gemini Live API
├── package.json          # Backend deps: express, ws, dotenv
├── deploy.sh             # One-click Google Cloud Run deployment script
├── README.md             # Public-facing README for Devpost judges
├── ARCHITECTURE.md       # Mermaid sequence diagram of data flow
├── gemini_challenge_context.md  # THIS FILE — full project context for agents
│
└── frontend/
    ├── index.html        # ⭐ Main HTML — phone frame, glass islands, orb, controls
    ├── style.css         # ⭐ All CSS — glassmorphism, orb animations, phone frame
    ├── main.js           # ⭐ All JS — WebSocket, audio system, wake word, state machine
    ├── package.json      # Frontend deps: vite, lucide (icons)
    └── public/
        ├── vite.svg      # Favicon
        └── audio-worklet-processor.js  # ⭐ AudioWorklet for mic capture (PCM)
```

---

## 🎨 UI Design System (Current State)

The frontend is a **premium, competition-grade** interface. Key design decisions:

### Phone Frame
- The entire app sits inside a **smartphone-shaped container** (`.phone-frame`) with rounded corners and a drop shadow, centered on the desktop viewport.
- On mobile (`<450px`), the frame disappears and it goes edge-to-edge.

### Glassmorphism
- All panels use `backdrop-filter: blur(40px)` with `rgba(255,255,255,0.08)` backgrounds.
- **Critical:** Glassmorphism is only visible if there's colorful content behind the glass. We added ambient gradient blobs in `.phone-frame::before` (cyan, pink, purple radial gradients) to provide the "light source" for the blur.

### The Voice Orb (Center of Screen)
The central `#ai-voice-orb` has **four distinct animation states** to provide high-fidelity feedback:

| State | CSS class | Animation | Visual Feel |
|-------|-----------|-----------|-------------|
| **Idle** | `.disconnected` | Thin rings, slow spin | "Sleeping" / Not connected |
| **Listening** | `.listening` | Thick rings, gentle pulse | "Paying attention" / Hearing voice |
| **Thinking** | `.thinking` | 360° Rotate + Hue Shift | "Processing" / Calmer than shaking |
| **Speaking** | `.speaking` | 25% Expansion + Mega Glow | "Responding" / Projecting voice |

**Note:** The orb correctly uses `::before`, `::after`, and the `.inner-ring` child `<div>` for the three ring layers (Cyan, Pink, Yellow).

### Bottom Controls Layout
```
┌──────────────────────────┐   ┌──────────────────────────┐
│  🕐 History              │   │   📷 SNAP PHOTO (Camera) │
├──────────────────────────┤   │   🎤 TAP TO SPEAK (Audio)│
│  ➕ Modes                │   │   ⌨️ CONNECT      (Text) │
│     (Camera/Audio/Text)  │   │    (dynamic icon/label)  │
└──────────────────────────┘   └──────────────────────────┘
         Left Column                  Right Column
```

### Screen Navigation Flow
```
HOME → SCAN (Camera) → SUGGESTIONS → RECIPE → COOK MODE
         ↓
HOME → SUGGESTIONS (Audio/Text) → RECIPE → COOK MODE
```

Each screen has:
- Back button with smooth slide-out animation
- Screen-specific header with title/subtitle
- Pointer events properly managed for glass UI elements

- **History button:** Toggles the transcript box.
- **Modes button:** Opens a dropdown to switch between **Camera**, **Audio**, and **Text Input**.
- **Main Action Button:** Dynamically updates its icon, label, and functionality based on the selected mode and connection state.

---

## ⚙️ JavaScript State Machine (`main.js`)

### Key State Variables
```js
let isConnected = false;           // Whether WebSocket to Gemini is active
let currentMode = 'vision';        // 'vision' | 'audio' | 'text'
let isListeningForWakeWord = false; // Whether listening for "Hey Chef"
let currentAiState = 'idle';       // 'idle' | 'listening' | 'thinking' | 'speaking'
const MODE_CONFIG = {...};         // Holds icons, labels, and hints per mode
```

### Core Functions
- `updateStatus(stateStr, message)`: Central controller for orb animations and button states.
- `updateModeUI()`: Updates icons, labels, and hints when mode is switched.
- `initAudioCapture()`: Sets up AudioWorklet for mic → PCM streaming.
- `initAudioPlayback()`: Sets up AudioContext for PCM → speaker playback.
- `handleGeminiMessage(data)`: Parses Gemini responses (text, audio, interruption).
- `startWakeWordDetection()`: Activates Web Speech API for "Hey Chef" detection.

---

## 🗣️ Wake Word System ("Hey Chef")

The app uses the **Web Speech API** (free, browser-native) to listen for the wake word.

### Flow
```
┌─────────────────┐   User speaks    ┌─────────────────┐   "Hey Chef"    ┌─────────────────┐
│  DISCONNECTED   │ ───────────────► │   LISTENING     │ ──────────────► │   CONNECTING    │
│  (waiting)      │                  │   (orb pulses)  │                 │   to Gemini     │
└─────────────────┘                  └─────────────────┘                 └─────────────────┘
         ▲                                                                       │
         │              30s silence / "goodbye" / "thanks chef"                  │
         └───────────────────────────────────────────────────────────────────────┘
```

### Wake Word Variants Recognized
The system catches common misheard variations: "hey chef", "hey shift", "hey shop", "a chef", etc.

---

## 🎤 Audio Pipeline

### Capture (User → Gemini)
```
Microphone → getUserMedia → AudioContext (16kHz) → AudioWorklet → Int16 PCM → Base64 → WebSocket
```

### Playback (Gemini → User)
```
WebSocket → Base64 → Int16 PCM → Float32 → AudioBuffer → AudioContext (24kHz) → Speakers
```

### Interruption Detection
- Simple energy-based voice activity detection in the AudioWorklet callback
- When `avgEnergy > 500` and AI is speaking → `stopAudioPlayback()` is called
- Audio queue is cleared, playback context is reset
- Gemini also sends `interrupted: true` flag which we handle

---

## 🔴 What's DONE (Completed)

### Core Infrastructure
- [x] Full Node.js backend proxy with Gemini Live API relay
- [x] Premium phone-framed UI with deep glassmorphism
- [x] **Animated Orb:** 4 states (Idle, Listening, Thinking, Speaking)
- [x] **Four Input Modes:** Camera, Upload, Audio, Text
- [x] Visual feedback system for mode switching
- [x] **Sidebar Navigation:** Vertical nav with View toggle (Desktop only)
- [x] **Mobile/Tablet Layout:** Switchable layouts for different screen preferences

### Audio System
- [x] **Audio Capture:** AudioWorklet → 16-bit PCM @ 16kHz → WebSocket
- [x] **Audio Playback:** WebSocket → PCM @ 24kHz → AudioContext → Speakers
- [x] **Wake Word Detection:** "Hey Chef" as opt-in button (accessibility)
- [x] **Interruption Handling:** User can cut off Chef mid-sentence
- [x] **AI Integration:** Orb states synced with Gemini responses
- [x] **Auto-Disconnect:** 30 seconds silence or goodbye phrases
- [x] Silent error handling for speech recognition (no console spam)
- [x] Fixed flickering issue with wake word detection

### Multi-Screen Navigation
- [x] **Home Screen:** Voice orb + mode selection + transcript
- [x] **Scan Screen:** Live camera feed + Image upload with drag & drop
- [x] **Suggestions Screen:** 2x2 recipe card grid with match percentages
- [x] **Recipe Screen:** Full recipe with ingredients and directions
- [x] **Cook Mode:** Step-by-step navigation with progress bar
- [x] **Landing Page:** Separate landing page with 3D phone mockup
- [x] Smooth slide transitions between all screens
- [x] Back button navigation with reverse animations

### Image Upload Feature
- [x] **Camera/Upload Toggle:** Switch between live camera and image upload
- [x] **Drag & Drop:** Drop images directly onto upload zone
- [x] **Click to Browse:** Traditional file picker
- [x] **Image Preview:** See uploaded image before processing
- [x] **Remove Button:** Clear uploaded image and try again

### AI-Powered Features (NEW)
- [x] **Dynamic Recipe Generation:** Gemini API generates 6 unique recipes from ingredients
- [x] **Image-Based Ingredient Detection:** Gemini Vision analyzes uploaded/camera images
- [x] **Real Food Images:** Curated images with emoji fallbacks
- [x] **Favorites System:** Save recipes to favorites with localStorage persistence
- [x] **Cooking History:** Track completed recipes with timestamps
- [x] **Completion Screen:** "Enjoy your meal!" screen after finishing all cook steps
- [x] **Production-Ready URLs:** Dynamic WebSocket/API URLs for Cloud Run deployment

### REST API Endpoints (server.js)
- [x] `POST /api/recipes` - Generate 6 recipes from ingredient list
- [x] `POST /api/detect-ingredients` - Analyze image for food items

### Demo Mode (Works Without API Key)
- [x] **Text Input Demo:** Type ingredients → AI response → Suggestions screen
- [x] **Upload Demo:** Upload image → Show detected ingredients
- [x] Full flow testable: Home → Suggestions → Recipe → Cook Mode → Complete → History

### Extras
- [x] **QR Code:** Desktop shows QR for easy mobile testing
- [x] **Transcript Display:** Shows conversation history
- [x] **Proprietary License:** IP protection for monetization
- [x] Documentation: README and context files updated
- [x] Git repository pushed to GitHub

---

## 🟡 What's NOT DONE (Remaining Work)

### 1. ☁️ Google Cloud Deployment (Day 1 - TODAY)
- [ ] Run `./deploy.sh` to deploy to Cloud Run
- [ ] Test deployed version thoroughly
- [ ] Get live URL for submission
- [x] Dynamic URLs configured for production (wss://, relative API paths)

### 2. 📊 Architecture Diagram (Day 1 - TODAY)
- [ ] Create visual diagram showing:
  - Frontend (HTML/CSS/JS)
  - Backend (Node.js/Express)
  - Gemini Live API (WebSocket)
  - Gemini REST API (recipes + vision)
  - Google Cloud Run hosting

### 3. 🎬 Demo Video (Day 2 - TOMORROW)
- [ ] Record under 4-minute demo
- [ ] Show: problem → solution → live demo
- [ ] Cover all 3 input modes (vision+voice, audio, text)
- [ ] Show recipe generation with real ingredients
- [ ] Show cook mode step-by-step to completion

### 4. 📝 Devpost Submission (Day 2 - TOMORROW)
- [ ] Write project description
- [ ] Upload screenshots/GIFs
- [ ] Add architecture diagram
- [ ] Submit before March 17 @ 6:00am GMT+6

### 5. 🎁 Bonus Points
- [x] Infrastructure-as-Code deployment (deploy.sh)
- [ ] Publish content with #GeminiLiveAgentChallenge
- [ ] Join a Google Developer Group (GDG)

---

## 📂 Visual Asset Library (`/docs`)
We've archived high-quality demonstration assets for the project:
- `orb_animations.webp`: All orb states in motion.
- `mode_switching.webp`: UI demo of switching between Camera/Audio/Text.
- `orb_[state].png`: Static high-res screenshots of each orb phase.

---

## ⚠️ Important Gotchas

1. **Pointer Events:** The `#ui-layer` has `pointer-events: none`. Interactive sections (islands, container) MUST have `pointer-events: auto` to receive clicks.
2. **Icon Rendering:** Always call `createIcons()` after any `innerHTML` changes to buttons/pills to render Lucide icons.
3. **Glass Ambience:** The `.phone-frame::before` radial gradients are essential for the glass look.
4. **Backend URL:** Hardcoded in `main.js` to `localhost:3000`. Needs update for production env.
5. **AudioContext Autoplay:** Browsers require user interaction before playing audio. The wake word activation satisfies this requirement.
6. **Web Speech API:** Only works in Chrome/Edge reliably. Safari has limited support. Firefox doesn't support it.
7. **AudioWorklet Path:** The processor file must be in `/public/` and loaded via absolute path `/audio-worklet-processor.js`.
8. **Sample Rates:** Capture at 16kHz (Gemini input), playback at 24kHz (Gemini output). Mismatched rates = distorted audio.
9. **Mode Menu Animation:** The modes dropdown uses `display: none` (not opacity/transform animation) to prevent double-click issues during close animation.
10. **Mode Switch Debounce:** `switchMode()` has a 500ms debounce to prevent rapid mode changes.

---

## 📝 Recent Session Notes

### Session: March 15, 2026 (Final Push)

**Major Work Completed:**
1. **Dynamic Recipe Generation** - Gemini API generates 6 unique recipes based on user ingredients
2. **Image-Based Ingredient Detection** - Gemini Vision API analyzes photos for food items
3. **Favorites System** - Save/remove recipes with localStorage persistence
4. **Cooking History** - Track completed recipes with timestamps (max 20)
5. **Completion Screen** - Celebration screen after finishing all cook steps
6. **Real Food Images** - Curated Unsplash images with emoji fallbacks
7. **Production URLs** - Dynamic WebSocket (wss://) and API URLs for Cloud Run
8. **UI Improvements** - Compact cook step card, ingredient chips wrapping

**Key Files Modified:**
- `server.js` - Added `/api/recipes` and `/api/detect-ingredients` endpoints
- `frontend/main.js` - Recipe fetching, favorites, history, image detection, dynamic URLs
- `frontend/style.css` - Compact cook steps, ingredient chip wrapping, complete screen
- `frontend/index.html` - Complete screen, Favorites screen, History screen

**API Endpoints Added:**
- `POST /api/recipes` - Takes `{ingredients: [...]}`, returns 6 AI-generated recipes
- `POST /api/detect-ingredients` - Takes `{image: base64}`, returns detected ingredients

---

### Session: March 11, 2026 (Evening)

**Major Work Completed:**
1. **Image Upload Feature** - Camera/Upload toggle on scan screen with drag & drop support
2. **Sidebar Navigation** - Vertical sidebar with Home, Recipes, Saved, View, Settings
3. **Mobile/Tablet View Toggle** - Switch layouts via sidebar View menu
4. **Wake Word Optimization** - Changed to opt-in button to fix flickering issue
5. **Landing Page** - Separate landing.html with 3D phone mockup, features, accessibility section
6. **Proprietary License** - Added LICENSE file for IP protection
7. **Git Repository** - Pushed to GitHub at https://github.com/Pinky057/fridge-to-feast

**Key Files Modified:**
- `frontend/main.js` - Image upload handlers, sidebar navigation, view toggle
- `frontend/style.css` - Sidebar styles, tablet layout, upload dropzone
- `frontend/index.html` - Sidebar HTML, upload area in scan screen
- `frontend/landing.html` - New landing page
- `frontend/landing.css` - Landing page styles
- `LICENSE` - Proprietary license for monetization

**Fixed Issues:**
- Mic button flickering caused by Web Speech API constant events
- Camera mode on desktop without webcam now shows upload option
- Pointer events on upload dropzone

### Session: March 11, 2026 (Morning)

**Major Work Completed:**
1. **Recipe Suggestions Screen** - Added 2x2 grid of recipe cards with match percentages, cooking time, and difficulty
2. **Text Mode Demo Flow** - Type ingredients → Parse as list → Show AI response → Navigate to suggestions
3. **Fixed Mode Switching Bug** - Menu animation was causing double-click (text then vision). Fixed by using `display: none` instead of opacity/transform animation
4. **Silent Speech Recognition** - Removed console spam from "no-speech" errors
5. **QR Code** - Added QR code card on desktop for easy mobile testing

**Demo Flow (Works Without API Key):**
1. Switch to Text mode (Modes → Text Input)
2. Type ingredients (e.g., "eggs, bread, butter")
3. Press Enter or click Send
4. See AI response in transcript
5. Auto-navigate to Suggestions screen
6. Click any recipe card → Recipe screen
7. Click "COOK MODE" → Step-by-step cooking

---

## 🧪 How to Run Locally

### Backend Proxy
```bash
# In project root
npm install
node server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🎨 CSS Design Tokens (for consistency)

```css
--bg-dark: #0f1115;           /* Main background */
--accent-cyan: #00f2fe;       /* Primary accent */
--accent-pink: #fe0979;       /* Secondary accent */
--accent-yellow: #ffeb3b;     /* Tertiary accent (inner ring) */
--danger: #ff4757;            /* Stop/error states */
--ready: #2ed573;             /* Connected/ready status */
```

Glass panels use `backdrop-filter: blur(40px)` and `rgba(255,255,255,0.08)`.
