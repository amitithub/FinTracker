# FinTrack — Open-Source Cross-Device Expense Tracker

FinTrack is an MIT-licensed, zero-cost personal and household expense tracker built with React, TypeScript, Vite, Tailwind CSS v4, Motion, and the Firebase Spark Free Tier. Host it for free on **GitHub Pages** and access all your expense history, interactive spending reports, category budgets, multi-currency conversions (default **INR ₹**), and recurring bills seamlessly from any mobile or desktop browser.

---

## Free & Open-Source Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Motion
- **Cloud Sync & Auth**: Firebase Authentication (Email/Password + Google Sign-In) & Cloud Firestore (**Spark Free Tier**, zero paid plans)
- **Live Currency Conversion**: Open-source, keyless [Frankfurter ECB API](https://www.frankfurter.app/) with built-in offline fallback rates (9 currencies, default `INR`)
- **Hosting & CI/CD**: Free GitHub Pages static deployment via `.github/workflows/deploy-pages.yml`
- **Testing & Security Auditing**: Vitest + React Testing Library + ESLint (`@firebase/eslint-plugin-security-rules`)

---

## Key Features
- **Full CRUD Across All Entries**:
  - **Expenses**: Create, search/filter, edit (title, amount, currency/FX rate, category, date, notes), and delete with two-step confirmation from Overview, Reports, or inside the expense modal.
  - **Budgets**: Set or clear an overall monthly spending cap, create/upsert category limits, edit limits and alert percentages inline on budget cards, and delete category limits safely.
  - **Recurring Bills**: Schedule weekly/monthly/yearly bills, log one-tap payments (`Pay & Log` atomically creates an expense and advances the due date), edit bill details, and delete schedules.
- **Cross-Device Persistence & Historical Reports**: Real-time Firestore synchronization so mobile entries appear instantly on desktop; inspect any prior month, 3M, 6M, YTD, or All History.
- **Interactive Visualizations**: Animated 6-month spending trend bar chart (click any bar to jump to that month) and interactive category breakdown donut ring (click a slice to filter Reports).
- **CSV & Print/PDF Exports**: RFC-4180 CSV export with spreadsheet formula-injection neutralization and print-ready PDF styling.
- **Light & Dark Modes**: Accessible high-contrast fintech design with frosted-glass surfaces, translucent architectural backdrop, and synchronized light/dark/system persistence.
- **Email & Google Authentication + Sample Preview**: Sign up/sign in with verified Email & Password (including password reset) or Google Sign-In, or explore offline via the 6-month Sample Ledger.

---

## Project Structure

```text
FiinTrack/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml          # CI/CD: lint, rules audit, Vitest, build & Pages deploy
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                  # Vitest & jsdom setup
│   │   ├── analytics.test.ts         # Monthly totals, MoM, trends, budgets, filters & sample data
│   │   ├── app.ui.test.tsx           # End-to-end UI, theme toggle, navigation & full CRUD tests
│   │   ├── currency.test.ts          # FX conversion, INR/JPY formatting & offline API fallback
│   │   ├── export.test.ts            # RFC-4180 CSV formatting & formula-injection defense
│   │   └── validation.test.ts        # Input sanitization, calendar dates & auth validation
│   ├── assets/
│   │   └── images/                   # Bundled fintech backdrop image asset
│   ├── components/
│   │   ├── charts/
│   │   │   ├── CategoryDonutChart.tsx
│   │   │   └── SpendingTrendChart.tsx
│   │   ├── modals/
│   │   │   ├── ExpenseModal.tsx      # Create / Edit / Delete expense modal & mobile bottom sheet
│   │   │   └── SettingsModal.tsx     # Base currency, overall cap, theme & sample data loader
│   │   ├── views/
│   │   │   ├── BudgetsView.tsx       # Overall cap & category budget CRUD + progress alerts
│   │   │   ├── OverviewView.tsx      # KPI strip, charts, budget alert banner & recent activity
│   │   │   ├── RecurringView.tsx     # Recurring bills CRUD & one-tap Pay & Log
│   │   │   └── ReportsView.tsx       # Historical filter bar, summary, CSV & print/PDF reports
│   │   ├── AuthScreen.tsx            # Email/Password + Google auth, verification gate & preview CTA
│   │   └── BackdropAtmosphere.tsx    # Translucent glassmorphic backdrop with gradient fallback
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Firebase Auth & Sample Preview session state
│   │   ├── LedgerContext.tsx         # Real-time Firestore subscriptions, FX rates & CRUD actions
│   │   └── ThemeContext.tsx          # Light / Dark / System theme state & persistence
│   ├── lib/
│   │   ├── analytics.ts              # Pure financial calculations & report filtering
│   │   ├── currency.ts               # Multi-currency FX conversion & Frankfurter ECB client
│   │   ├── demoData.ts               # 6-month INR sample dataset generator
│   │   ├── export.ts                 # Safe CSV builder & downloader
│   │   ├── firebase.ts               # Firebase App, Auth & Firestore initialization
│   │   └── validation.ts             # Strict payload validation & text sanitization
│   ├── services/
│   │   └── firestoreService.ts       # Owner-scoped Firestore queries, writes & atomic batches
│   ├── types/
│   │   └── expense.ts                # Core TypeScript domain models & constants
│   ├── App.tsx                       # Responsive desktop sidebar + mobile bottom-bar shell
│   ├── index.css                     # Tailwind CSS v4 config, dark variant & print styles
│   └── main.tsx                      # React entry point
├── .env.example                      # Sample environment variable placeholders (no secrets)
├── .gitignore
├── eslint.config.js                  # ESLint flat config for Firestore security rules
├── firebase-applet-config.json       # Firebase web app & database configuration
├── firebase-blueprint.json           # Firestore schema blueprint
├── firestore.rules                   # Zero-trust owner-scoped Firestore security rules
├── index.html                        # HTML entry with zero-flash theme script
├── LICENSE                           # MIT License
├── metadata.json                     # App metadata
├── package.json
├── README.md
├── security_spec.md                  # Security invariants & Dirty Dozen rule audit cases
├── tsconfig.json
├── vite.config.ts                    # Vite config (`base: './'` for GitHub Pages subpaths)
└── vitest.config.ts
```

---

## Firebase Console Setup (Free Spark Plan)
Before using cloud sync on your live GitHub Pages URL, complete these two free steps in the [Firebase Console](https://console.firebase.google.com/):

1. **Enable Email/Password Sign-In** (Google Sign-In is enabled by default):
   - Open **Authentication → Sign-in method → Add new provider → Email/Password** and toggle **Enable**.
2. **Allowlist Your GitHub Pages Domain**:
   - Open **Authentication → Settings → Authorized domains → Add domain** and add `<your-github-username>.github.io` (or your custom domain).

---

## Publish & Host on GitHub Pages (Free)

### Option A: Using AI Studio's GitHub Integration
1. Use the **Save to GitHub** / GitHub sync control in your AI Studio toolbar to push this project to your `FiinTrack` repository.
2. Open your `FiinTrack` repository on GitHub and navigate to **Settings → Pages → Build and deployment → Source**.
3. Select **GitHub Actions**.
4. Trigger or wait for the **Deploy FinTrack to GitHub Pages** workflow (`.github/workflows/deploy-pages.yml`) to finish; your site will go live at `https://<your-github-username>.github.io/FiinTrack/`.

### Option B: Push via Git CLI
```bash
git init
git add .
git commit -m "Initial commit: FinTrack open-source expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/FiinTrack.git
git push -u origin main
```
Then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

> **Troubleshooting a Blank Page on GitHub Pages:** If your GitHub Pages URL shows a blank page, open **Settings → Pages → Build and deployment → Source** and verify it is set to **GitHub Actions** (and **not** `Deploy from a branch`). Serving the raw repository root instead of the Vite `./dist` build artifact causes `/src/main.tsx` to 404.

---

## Local Development, Testing & Security Checks

```bash
npm install          # Install dependencies
npm run dev          # Start development server on http://localhost:3000
npm test             # Run all Vitest unit & UI integration tests
npm run lint         # TypeScript typecheck (tsc --noEmit)
npm run lint:rules   # Audit firestore.rules with ESLint security plugin
npm run build        # Build production static bundle into ./dist
```

---

## License
Released under the [MIT License](LICENSE).
