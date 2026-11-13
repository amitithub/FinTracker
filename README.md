# FinTrack — Open-Source Cross-Device Expense Tracker

FinTrack is an MIT-licensed, zero-cost personal and household expense tracker built with React, Vite, Tailwind CSS, Motion, and Firebase Spark Free Tier. Host it for free on **GitHub Pages** and access all your expense history, interactive spending reports, category budgets, multi-currency conversions, and recurring bills seamlessly from any mobile or desktop browser.

## Free & Open-Source Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Motion
- **Cloud Sync & Auth**: Firebase Authentication (Google + Email/Password) & Cloud Firestore (**Spark Free Tier**, no paid plan required)
- **Live Currency Conversion**: Open-source, keyless [Frankfurter ECB API](https://www.frankfurter.app/) with built-in offline fallback rates
- **Hosting & CI/CD**: Free GitHub Pages static deployment via `.github/workflows/deploy-pages.yml`

---

## Features
- **Cross-Device Persistence**: Expenses, budgets, recurring bills, and settings sync in real time between mobile and web browsers.
- **Email & Google Sign-In**: Create an account with Email & Password (with email verification & password reset) or sign in with Google, plus an offline 6-month Sample Ledger preview.
- **Interactive Visualizations**: Animated 6-month spending trend bar chart (click any bar to jump to that month) and category breakdown donut ring.
- **Historical Expense Reports**: Filter across any prior month, 3M, 6M, YTD, or All History; search by merchant/notes/currency; export RFC-4180 CSV (with spreadsheet formula-injection protection) or print/save PDF reports.
- **Budgets & Recurring Bills**: Set overall and per-category monthly limits with 80% & 100% alerts; schedule recurring bills with one-tap payment logging.
- **Light & Dark Modes**: Accessible high-contrast fintech palette respecting system preference or manual toggle.

---

## Firebase Console Setup (Free Spark Plan)
Before deploying to GitHub Pages, complete these two free steps in the [Firebase Console](https://console.firebase.google.com/) for your project:

1. **Enable Email/Password Sign-In** (Google Sign-In is already active):
   - Open **Authentication → Sign-in method → Add new provider → Email/Password** and toggle **Enable**.
2. **Allowlist Your GitHub Pages Domain**:
   - Open **Authentication → Settings → Authorized domains → Add domain** and add `<your-github-username>.github.io` (or your custom domain).

---

## Publish to GitHub Pages (Free)

1. Initialize Git and push to a public GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: FinTrack open-source expense tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In your GitHub repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy-pages.yml`) automatically runs TypeScript checks, Firestore security rule linting, Vitest unit tests, builds the relative-path Vite bundle (`base: './'`), and publishes to `https://<your-username>.github.io/<your-repo>/`.

---

## Local Development & Testing

```bash
npm install
npm run dev          # Start dev server on port 3000
npm test             # Run Vitest unit & component tests
npm run lint         # TypeScript check
npm run lint:rules   # ESLint security audit on firestore.rules
npm run build        # Production static build in ./dist
```
