# Fridge-to-Feast - Remaining Tasks

**DEADLINE: March 17, 2026 @ 6:00am GMT+6 (2 days)**
**Competition: 10,846 participants | $80,000 prize pool**

---

## BLOCKERS

### 1. Google Cloud Billing (URGENT)
- [ ] Set up sister's NSU university account for Google Cloud
- [ ] Enable billing with education credits (no credit card needed)
- [ ] Add billing to project OR deploy from her account
- **Why:** Cloud Run requires billing enabled (free tier, won't charge)

### 2. Gemini API Rate Limit
- **Status:** Recipe generation API rate limited (429 error)
- **Resets:** ~2:00 PM GMT+6 tomorrow (March 16)
- **Note:** Voice/camera (Live API) still works!

---

## Day 1 (March 15) - TODAY

### Completed Today
- [x] Tag input system for ingredients (comma separated chips)
- [x] Rate limit error message (user-friendly)
- [x] Cook screen navigation fixed (sticky buttons)
- [x] Network access for mobile testing
- [x] Dynamic URLs for local network

### Deployment (after billing fixed)
- [ ] Deploy to Google Cloud Run (`./deploy.sh`)
- [ ] Test deployed version thoroughly
- [ ] Get live URL for submission

### Architecture Diagram
- [ ] Create diagram showing:
  - Frontend (HTML/CSS/JS)
  - Backend (Node.js/Express)
  - Gemini Live API (WebSocket)
  - Gemini REST API (recipes + vision)
  - Google Cloud Run hosting

---

## Day 2 (March 16) - TOMORROW

### After 2pm (Rate limit resets)
- [ ] Test full recipe generation flow
- [ ] Test voice/camera on deployed HTTPS version

### Demo Video (under 4 minutes - REQUIRED)
- [ ] Record demo video
- [ ] Show: problem → solution → live demo
- [ ] Cover all 3 input modes (vision+voice, audio, text)
- [ ] Show recipe generation flow
- [ ] Show cook mode step-by-step

### Devpost Submission
- [ ] Write project description
- [ ] Upload screenshots/GIFs
- [ ] Add architecture diagram
- [ ] Link GitHub repo
- [ ] Submit before deadline

---

## Bonus Points (Extra Credit)

- [ ] Publish content with **#GeminiLiveAgentChallenge** (blog/video/tweet)
- [x] Infrastructure-as-Code deployment (deploy.sh - DONE!)
- [ ] Join a Google Developer Group (GDG) - free, 2 minutes
- [ ] Add Bangla language support (if time permits after submission ready)

---

## Target Prizes

| Prize | Amount | Our Advantage |
|-------|--------|---------------|
| Best of Live Agents | $10,000 | Gemini Live API with voice+video |
| Best Multimodal UX | $5,000 | 3 input modes + image detection |
| Grand Prize | $25,000 | Strong multimodal (40% weight) |

---

## Testing Checklist
- [ ] Test camera mode (vision + voice)
- [ ] Test audio-only mode
- [ ] Test text input mode
- [ ] Test on mobile device (scan QR code)
- [ ] Verify all 3 input modes work end-to-end

---

## Priority 2: Nice-to-Have (if time permits)

### Code Cleanup
- [ ] Remove unused `addDetectedIngredient()` function
- [ ] Remove unused `setRecipeFromAI()` function
- [ ] Use `createImageWithFallback()` helper instead of repeated code
- [ ] Remove duplicate `@keyframes spin` in CSS
- [ ] Consolidate tablet layout CSS

### Features
- [ ] Add loading skeleton for recipe cards
- [ ] Add error retry button when API fails
- [ ] Improve mobile responsiveness

---

## Auth Decision

**For hackathon: NO AUTH NEEDED**

Reasons:
- Guest user is fine for demo purposes
- Reduces complexity
- LocalStorage handles favorites/history
- Can add auth post-competition if needed for monetization

---

## Reusable Components Identified

| Component | Location | Reuse For |
|-----------|----------|-----------|
| Voice Orb | `.voice-orb` + states | Loading animations |
| Glass Card | `.glass-island` | Any card container |
| Pill Button | `.pill-btn` | Action buttons |
| Recipe Card | `.recipe-card` | Suggestions, history, favorites |
| Screen Header | `.screen-header.glass-header` | All screen headers |

---

## Files to Deploy

```
/
├── server.js          # Backend proxy + API
├── package.json       # Dependencies
├── .env               # API key (set in Cloud Run)
└── frontend/
    ├── index.html     # Main app
    ├── landing.html   # Landing page
    ├── main.js        # App logic
    ├── style.css      # Styles
    └── landing.css    # Landing styles
```

---

*Last updated: March 15, 2026*
