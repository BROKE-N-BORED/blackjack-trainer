# ♠ BROKE-N-BORED Blackjack Trainer

A realistic, full-featured blackjack simulator with **real-time strategy advising**, **session analytics**, and **bankroll tracking** — built to help you practice and refine your strategy without risking real money.

> **[▶ Play Now](https://YOUR-USERNAME.github.io/blackjack-trainer/)** ← _Update this link after deploying_

![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 🎰 Realistic Casino Mechanics
- Configurable shoe (1–12 decks) with custom input
- Cut card with automatic reshuffle at 75% penetration
- Proper blackjack rules: 3:2 payouts, splitting up to 4 hands, doubling down
- Dealer stands/hits soft 17 (configurable)
- Custom buy-in amounts from $1 to $10,000

### 🧠 Strategy Advisor
- Real-time basic strategy recommendations on every hand
- Covers hard hands, soft hands, pairs, doubles, and splits
- Highlights the optimal action button so you can learn by doing
- Tracks your accuracy % vs. basic strategy

### 📊 Session Analytics Dashboard
- Bankroll graph over time
- Win rate, ROI, average bet size
- Win/loss/push breakdown
- Streak tracking (best and worst)
- Double down and split frequency
- Full hand-by-hand history with results

### 💾 Export & AI Analysis
- **Save Session (JSON)** — includes an AI analysis prompt, upload directly to Claude or ChatGPT for strategy review
- **Export CSV** — for spreadsheet analysis
- All session data: hand history, bankroll curve, settings, and performance stats

### 💰 Smart Betting System
- Chip stacking: tap chips to build your bet like a real table ($1, $5, $10, $25, $50, $100)
- Win progression system (increase on wins, reset on losses)
- Auto-detection of session targets (walk away at 2x buy-in)

## Getting Started

### Play Online
Visit the live demo link above — no installation needed.

### Run Locally
```bash
git clone https://github.com/YOUR-USERNAME/blackjack-trainer.git
cd blackjack-trainer
npm install
npm run dev
```

### Deploy Your Own
This repo includes a GitHub Actions workflow that auto-deploys to GitHub Pages on every push to `main`.

1. Fork or clone this repo
2. Go to repo **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — the site deploys automatically
4. Your site will be live at `https://YOUR-USERNAME.github.io/blackjack-trainer/`

## Strategy Rules

This trainer implements **complete basic strategy**. See [`blackjack-rules.md`](./blackjack-rules.md) for the full reference chart.

## Project Structure

```
blackjack-trainer/
├── src/
│   ├── main.jsx              # React entry point
│   └── BlackjackApp.jsx      # Full game component
├── index.html                # HTML shell
├── vite.config.js            # Vite config (GitHub Pages base path)
├── package.json
├── blackjack-rules.md        # Strategy reference
├── .github/workflows/
│   └── deploy.yml            # Auto-deploy to GitHub Pages
└── README.md
```

## Built By

**BROKE-N-BORED** — independent game dev & AI tooling

## License

MIT — use it, mod it, share it.
