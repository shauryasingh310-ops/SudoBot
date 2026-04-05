# SudoBot

Scan a sudoku puzzle, solve it instantly, or challenge yourself with hints and real-time validation — all in the browser.

Live at : 🔗 **[sudo-bot-kappa.vercel.app](https://sudo-bot-kappa.vercel.app)**

Built with React + TypeScript, Firebase for cloud sync, and Tesseract.js for image recognition.

---

## What it does

- **Scan puzzles** — photograph a printed or digital sudoku and it reads the numbers automatically
- **Solve it for you** — watch the AI work through it step by step, or just get the answer instantly
- **Play manually** — pencil marks, hints, mistake tracking, the full experience
- **Sync across devices** — progress and stats saved to Firebase if you're logged in
- **Track your game** — times, win rates, difficulty history, all in a dashboard
- **Dark mode** — because of course

---

## Tech stack

| Layer | What's used |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS, Framer Motion |
| Build | Vite |
| Image processing | Tesseract.js (OCR), Canvas API, Sobel edge detection |
| Auth & database | Firebase Authentication, Firestore |

---

## Getting started

You need Node.js 18 or higher.

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

Firebase is optional — the game works without it, but you won't get cloud sync or stats persistence. If you want those, add your credentials to `src/firebase.ts`.

---

## Image scanning — what works and what doesn't

The scanner works well with clean, high-contrast images. Here's the honest picture:

**Works reliably**
- White or light background with dark grid lines
- Printed numbers (not handwritten)
- Straight-on angle, no skew
- Good lighting, no blur

**Doesn't work yet**
- Colored cell backgrounds (blue, cyan, etc.) — the grayscale conversion turns them dark and confuses the edge detector
- Handwritten numbers — OCR accuracy drops a lot
- Rotated or skewed images
- Very thin grid lines or low contrast

The pipeline goes: resize → grayscale → Sobel edge detection → line detection → cell extraction → OCR → validation. The weak point right now is anything that throws off the edge detection step.

---

## Project structure

```
src/
├── pages/
│   ├── GamePage.tsx        # main game, image processing lives here
│   ├── DashboardPage.tsx   # stats and analytics
│   ├── LandingPage.tsx
│   └── LoginPage.tsx
├── utils/
│   └── statsManager.ts     # Firestore read/write
├── App.tsx
├── firebase.ts
└── main.tsx
```

---

## Known issues

- Colored backgrounds aren't supported yet — on the roadmap
- OCR sometimes misses numbers on lower-quality photos, so the minimum clue threshold is set to 8 to be forgiving
- Skewed or rotated images will likely fail grid detection

If you scan a puzzle and it doesn't load, try a cleaner photo with better lighting and make sure the grid takes up most of the frame.

---

## License

MIT