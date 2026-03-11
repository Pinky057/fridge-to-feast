require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In production, we would serve static files built by Vite
// app.use(express.static('frontend/dist'));

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;

// The Setup message must be the very first message sent to the Gemini Live API over the WebSocket
const SETUP_MESSAGE = {
    setup: {
        model: "models/gemini-2.0-flash-exp",
        systemInstruction: {
            parts: [{
                text: "You are 'Chef', a professional but encouraging multimodal AI Sous-Chef. You observe ingredients in the user's fridge and suggest simple, fast recipes. Keep your spoken responses extremely concise, conversational, and energetic. Never use markdown formatting like asterisks or bullet points."
            }]
        }
    }
};

wss.on('connection', (ws) => {
    console.log('Frontend Client connected to proxy server.');

    // Only attempt to connect to Gemini if an API key is present
    if (!process.env.GEMINI_API_KEY) {
        console.error("ERROR: GEMINI_API_KEY is not set in the .env file.");
        ws.send(JSON.stringify({ type: "error", message: "Missing Gemini API Key on Backend." }));
        // We do not close the socket immediately during dev so the frontend doesn't crash, but it won't work.
        return;
    }

    const geminiWs = new WebSocket(GEMINI_WS_URL);

    geminiWs.on('open', () => {
        console.log('Proxy connected to Gemini Live API.');
        geminiWs.send(JSON.stringify(SETUP_MESSAGE));
    });

    geminiWs.on('message', (data) => {
        // Data arriving from Gemini (usually ServerContent with audio bytes)
        // Forward it directly to the frontend client
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    geminiWs.on('error', (error) => {
        console.error('Gemini WebSocket Error:', error);
    });

    ws.on('message', (data) => {
        // Data arriving from Frontend (audio/video frames from getUserMedia)
        // Forward it to Gemini
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    ws.on('close', () => {
        console.log('Frontend Client disconnected.');
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });

    geminiWs.on('close', () => {
        console.log('Gemini Live API connection closed.');
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`📡 Backend server listening on port ${PORT}`);
    console.log(`Make sure your Vite frontend is pointing to ws://localhost:${PORT}`);
});
