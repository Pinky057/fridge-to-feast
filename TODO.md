# Fridge-to-Feast - Remaining Tasks

## Priority 1: Before Submission (2 days left)

### Deployment
- [ ] Deploy to Google Cloud Run
  - Run `./deploy.sh`
  - Test deployed version thoroughly
  - Get live URL for submission

### Testing
- [ ] Test camera mode (vision + voice)
- [ ] Test audio-only mode
- [ ] Test text input mode
- [ ] Test on mobile device (scan QR code)
- [ ] Test "Hey Chef" wake word activation
- [ ] Test voice interruption feature
- [ ] Verify all 3 input modes work end-to-end

### Demo Video
- [ ] Record 2-3 minute demo video
- [ ] Show: problem → solution → live demo
- [ ] Cover all 3 input modes
- [ ] Show recipe generation flow
- [ ] Show cook mode step-by-step

### Submission
- [ ] Write Devpost description
- [ ] Upload screenshots/GIFs
- [ ] Submit before deadline

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
