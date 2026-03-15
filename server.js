require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '10mb' })); // Increased for image uploads

// Enable CORS for frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Recipe generation endpoint
app.post('/api/recipes', async (req, res) => {
    try {
        const { ingredients } = req.body;

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of ingredients' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a professional chef. Given these ingredients: ${ingredients.join(', ')}

Generate exactly 6 recipes that can be made with these ingredients. For each recipe, provide:
- A creative but simple title
- Short description (under 10 words)
- Cooking time
- Difficulty (Easy, Medium, or Hard)
- Match percentage (how well it matches the available ingredients, 70-100)
- List of ingredients with emoji icons
- Step-by-step directions (4-6 steps)

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "recipes": [
    {
      "id": "1",
      "title": "Recipe Name",
      "description": "Short description",
      "time": "15 min",
      "difficulty": "Easy",
      "match": 95,
      "ingredients": [
        { "icon": "🥚", "name": "Eggs x2" }
      ],
      "directions": [
        "Step 1 instruction",
        "Step 2 instruction"
      ]
    }
  ]
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const recipes = JSON.parse(text);
        res.json(recipes);
    } catch (error) {
        console.error('Recipe generation error:', error);
        res.status(500).json({ error: 'Failed to generate recipes', details: error.message });
    }
});

// Ingredient detection from image endpoint
app.post('/api/detect-ingredients', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Please provide a base64 image' });
        }

        // Remove data URL prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are analyzing an image of food items, ingredients, or a fridge/pantry.

Identify ALL food ingredients you can see in this image. Be thorough and identify as many items as possible.

For each ingredient found, provide:
- An appropriate food emoji icon
- The ingredient name (with quantity if visible, e.g., "Eggs x6", "Tomatoes x3")

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "ingredients": [
    { "icon": "🥚", "name": "Eggs x6" },
    { "icon": "🥛", "name": "Milk" },
    { "icon": "🧀", "name": "Cheese" }
  ],
  "confidence": 85
}

The "confidence" field should be your estimated accuracy percentage (0-100) for the detection.
If you cannot identify any food items, return: { "ingredients": [], "confidence": 0 }`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            }
        ]);

        const response = await result.response;
        let text = response.text();

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const detected = JSON.parse(text);
        console.log(`Detected ${detected.ingredients.length} ingredients with ${detected.confidence}% confidence`);
        res.json(detected);
    } catch (error) {
        console.error('Ingredient detection error:', error);
        res.status(500).json({ error: 'Failed to detect ingredients', details: error.message });
    }
});

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
