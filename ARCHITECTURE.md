# Fridge-to-Feast 🍳 - Architecture Diagram

This diagram visualizes how the Fridge-to-Feast Live Agent captures multimodal input, proxies it through a secure backend, and streams Audio responses back to the user in real-time.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Vite Frontend (Client)
    participant Backend as Node.js Proxy (Cloud Run)
    participant Gemini as Gemini Live API (Google)

    Note over User, Frontend: User points camera at Fridge
    User->>Frontend: Clicks "Start Cooking"
    
    Frontend->>Frontend: Request Camera & Mic Permissions
    Frontend->>Backend: Open WebSocket Connection (ws://)
    
    Note over Backend, Gemini: Backend Securely Injects API Key
    Backend->>Gemini: Establish BidiGenerateContent WebSocket (wss://)
    Backend->>Gemini: Send [SETUP_MESSAGE] (System Instructions)
    Gemini-->>Backend: [SETUP_COMPLETE] Acknowledge
    Backend-->>Frontend: Ready!
    
    loop Real-time Capture (1 FPS)
        Frontend->>Frontend: Draw Video Frame to <canvas>
        Frontend->>Frontend: Extract Base64 JPEG
        Frontend->>Backend: Send {realtimeInput: [{image/jpeg}]}
        Backend->>Gemini: Proxy Message to Gemini
    end
    
    Note over User: User speaks: "What can I make?"
    loop Real-time Audio
        User->>Frontend: Speaks into Microphone
        Frontend->>Frontend: Capture PCM Audio Chunks
        Frontend->>Backend: Send {realtimeInput: [{audio/pcm}]}
        Backend->>Gemini: Proxy Message to Gemini
    end
    
    Note over Gemini: Multimodal Processing (Vision + Audio)
    
    loop Streaming Audio Response
        Gemini-->>Backend: Yield {serverContent: {audio/pcm}}
        Backend-->>Frontend: Proxy Audio Chunk to Client
        Frontend->>Frontend: Schedule Gapless Playback (AudioContext)
        Frontend-->>User: Plays spoken recipe suggestion!
    end
```

## System Components List

1. **Vite Frontend (`index.html`, `main.js`, `style.css`)**
   - **Role:** The "Eyes and Ears". 
   - Uses `MediaDevices.getUserMedia()` to access the camera and microphone.
   - Extracts frames to Base64 using a hidden HTML5 `<canvas>`.
   - Renders the aesthetic Glassmorphism UI.

2. **Express/WebSocket Proxy (`server.js`)**
   - **Role:** The secure bridge.
   - Runs on Google Cloud Run. 
   - Protects the `GEMINI_API_KEY` from being exposed in frontend browser source code.
   - Forwards raw WebSocket JSON payloads back and forth instantly to minimize latency.

3. **Gemini Live API (`BidiGenerateContent` endpoint)**
   - **Role:** The Brain.
   - Multimodal model (`gemini-2.0-flash-exp`) evaluates the incoming audio query against the continual stream of jpeg camera frames to generate a cooking recipe.
   - Streams pure PCM audio bytes back for immediate playback without waiting for full text generation.
