# FinTrack — Open-Source Cross-Device Expense Tracker

FinTrack is an MIT-licensed, zero-cost personal and household expense tracker built with React, TypeScript, Vite, Tailwind CSS v4, Motion, and the Firebase Spark Free Tier. Host it for free on **GitHub Pages** and access all your expense history, interactive spending reports, category budgets, multi-currency conversions (default **INR ₹**), and recurring bills seamlessly from any mobile or desktop browser.

---

## Free & Open-Source Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Motion
- **Cloud Sync & Auth**: Firebase Authentication (Email/Password + Google Sign-In) & Cloud Firestore (**Spark Free Tier**, zero paid plans)
- **Live Currency Conversion**: Open-source, keyless [Frankfurter ECB API](https://www.frankfurter.app/) with built-in offline fallback rates (9 currencies, default `INR`)
- **Hosting & CI/CD**: Free GitHub Pages static deployment to the `gh-pages` branch via `.github/workflows/deploy.yml`
- **Testing & Security Auditing**: Vitest + React Testing Library + ESLint (`@firebase/eslint-plugin-security-rules`)

---

## Key Features
- **Full CRUD Across All Entries**:
  - **Expenses**: Create, search/filter, edit (title, amount, currency/FX rate, category, date, notes), and delete with two-step confirmation from Overview, Reports, or inside the expense modal.
  - **Budgets**: Set or clear an overall monthly spending cap, create/upsert category limits, edit limits and alert percentages inline on budget cards, and delete category limits safely.
  - **Recurring Bills**: Schedule weekly/monthly/yearly bills, log one-tap payments (`Pay & Log` atomically creates an expense and advances the due date), edit bill details, and delete schedules.
- **Cross-Device Persistence & Historical Reports**: Real-time Firestore synchronization so mobile entries appear instantly on desktop; inspect any prior month, 3M, 6M, YTD, or All History.
- **Interactive Visualizations & Line Charts**: Interactive 6-month Spending Trend Line/Bar switcher with direct currency data labels, a Monthly Spend Pace cumulative/daily line chart, and a live-filtered Reports line chart paired with an interactive category breakdown donut ring.
- **CSV & Excel Expense Import**: Upload `.csv`, `.xlsx`, or bank SpreadsheetML `.xls` files with automatic header detection, interactive column mapping, currency normalization, duplicate detection, invalid row reporting, and atomic batch saving.
- **Advanced Filtering, Backups & Exports**: Filter reports via dropdowns for category, date/period (quick ranges, specific month, exact calendar date, or custom range), description search, currency, amount bounds, and sort order. Export RFC-4180 CSVs (formula-injection safe), print-ready PDFs, or take and restore full JSON ledger backups.
- **Automated GitHub Checkpoints & 1-Click Rollback**: Every publish creates a verified source & `dist` archive backup, an annotated Git checkpoint tag (`checkpoint-...`), a GitHub Release snapshot, and a `gh-pages-backup` branch—recoverable via GitHub Actions (`Restore FinTrack Checkpoint`) or `npm run checkpoint`.
- **AI Agent Blueprint (`AI_AGENT_BUILD_GUIDE.md`)**: Complete, copy-ready architectural specification and prompt enabling any AI coding agent to recreate FinTrack from scratch.
- **Light & Dark Modes**: Accessible high-contrast fintech design with frosted-glass surfaces, translucent architectural backdrop, and synchronized light/dark/system persistence.
- **Email & Google Authentication + Sample Preview**: Sign up/sign in with verified Email & Password (including password reset) or Google Sign-In, or explore offline via the 6-month Sample Ledger.

---

## Project Structure

```text
FiinTrack/
├── .github/
│   └── workflows/
│       ├── deploy.yml                # CI/CD: lint, rules audit, Vitest, checkpoint backup & gh-pages deploy
│       └── rollback.yml              # Manual 1-click workflow to restore any checkpoint tag or gh-pages-backup
├── scripts/
│   └── checkpoint-publish.sh         # Pre-publish verification, local .backups/ snapshot & Git tag checkpoint
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                  # Vitest & jsdom setup
│   │   ├── analytics.test.ts         # Monthly totals, MoM, trends, budgets, filters & sample data
│   │   ├── app.ui.test.tsx           # End-to-end UI, theme toggle, navigation & full CRUD tests
│   │   ├── currency.test.ts          # FX conversion, INR/JPY formatting & offline API fallback
│   │   ├── export.test.ts            # RFC-4180 CSV formatting, JSON backup & restore tests
│   │   ├── importExpenses.test.ts    # CSV/Excel parsing, column mapping, dates & duplicate checks
│   │   ├── security.pentest.test.tsx # Security, formula-injection, rules & fallback pentests
│   │   └── validation.test.ts        # Input sanitization, calendar dates & auth validation
│   ├── assets/
│   │   └── images/                   # Bundled fintech backdrop image asset
│   ├── components/
│   │   ├── charts/
│   │   │   ├── CategoryDonutChart.tsx
│   │   │   ├── DailySpendLineChart.tsx
│   │   │   └── SpendingTrendChart.tsx
│   │   ├── modals/
│   │   │   ├── ExpenseModal.tsx      # Create / Edit / Delete expense modal & mobile bottom sheet
│   │   │   ├── ImportExpensesModal.tsx # CSV & Excel (.xlsx/.xls) bulk import with column mapper
│   │   │   └── SettingsModal.tsx     # Base currency, cap, theme, backup & restore JSON
│   │   ├── views/
│   │   │   ├── BudgetsView.tsx       # Overall cap & category budget CRUD + progress alerts
│   │   │   ├── OverviewView.tsx      # KPI strip, line/bar/donut charts, burn pace & activity
│   │   │   ├── RecurringView.tsx     # Recurring bills CRUD & one-tap Pay & Log
│   │   │   └── ReportsView.tsx       # Category/date/search filters, live line chart, CSV/Excel/JSON/PDF
│   │   ├── AuthScreen.tsx            # Email/Password + Google auth, verification gate & preview CTA
│   │   ├── BackdropAtmosphere.tsx    # Translucent glassmorphic backdrop with gradient fallback
│   │   └── ErrorBoundary.tsx         # Client error recovery UI preventing blank screens
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Firebase Auth & Sample Preview session state
│   │   ├── LedgerContext.tsx         # Real-time Firestore subscriptions, FX rates, import & CRUD actions
│   │   └── ThemeContext.tsx          # Light / Dark / System theme state & persistence
│   ├── lib/
│   │   ├── analytics.ts              # Pure financial calculations & report filtering
│   │   ├── currency.ts               # Multi-currency FX conversion & Frankfurter ECB client
│   │   ├── demoData.ts               # 6-month INR sample dataset generator
│   │   ├── export.ts                 # Safe CSV builder, JSON backup & restore validation
│   │   ├── firebase.ts               # Firebase App, Auth & Firestore initialization
│   │   ├── importExpenses.ts         # RFC-4180 CSV & Excel (.xlsx) parser, mapper & duplicate check
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
├── AI_AGENT_BUILD_GUIDE.md           # Turnkey specification & prompt for AI agents to rebuild app
├── eslint.config.js                  # ESLint flat config for Firestore security rules
├── firebase-applet-config.json       # Local Firebase config (gitignored; CI uses VITE_FIREBASE_* Secrets)
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
3. **Restrict Your Firebase Web API Key (Resolves GitHub Secret Scanning Alerts)**:
   - A Firebase Web SDK `apiKey` is a public client identifier (security is enforced by `firestore.rules` and Firebase Auth), which still triggers GitHub's generic Google API Key scanner if committed in `firebase-applet-config.json`.
   - In **Google Cloud Console → APIs & Services → Credentials**, edit the Browser API key and add **Website (HTTP referrer) restrictions** (`https://<your-github-username>.github.io/*` and `http://localhost:*`) plus **API restrictions** (Identity Toolkit, Token Service, Cloud Firestore).
   - You can then safely dismiss the Secret Scanning alert in GitHub **Security → Secret scanning**, or set `VITE_FIREBASE_*` GitHub Actions Secrets and add `firebase-applet-config.json` to `.gitignore`.

---

## Publish & Host on GitHub Pages (Free)

### Option A: Using AI Studio's GitHub Integration
1. Use the **Save to GitHub** / GitHub sync control in your AI Studio toolbar to push this project to your `FinTracker` repository.
2. Add your seven `VITE_FIREBASE_*` values under **Settings → Secrets and variables → Actions → Repository secrets** so Cloud Sync works on GitHub Pages without committing API keys.
3. Trigger or wait for the **Deploy FinTrack to GitHub Pages** workflow (`.github/workflows/deploy.yml`) to finish and create the `gh-pages` branch.
4. Open **Settings → Pages → Build and deployment → Source**, choose **Deploy from a branch**, select **`gh-pages`** and folder **`/ (root)`**, then click **Save**; your site will go live at `https://<your-github-username>.github.io/FinTracker/`.

### Option B: Push via Git CLI
```bash
git init
git add .
git commit -m "Initial commit: FinTrack open-source expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/FinTracker.git
git push -u origin main
```
Then add your `VITE_FIREBASE_*` Actions Secrets, wait for `.github/workflows/deploy.yml` to push the `gh-pages` branch, and set **Settings → Pages → Build and deployment → Source** to **Deploy from a branch** (`gh-pages` / `/ (root)`).

### Option C: Create a Verified Backup & Checkpoint Before CLI Push
```bash
npm run checkpoint -- --push
```
This runs `npm run lint`, `npm run lint:rules`, and `npm test`, archives the repository into `.backups/` (gitignored), creates an annotated Git tag `checkpoint-YYYYMMDD-HHMMSS-<sha>`, and pushes `main` plus the checkpoint tag to GitHub.

---

## Checkpoints, Backups & Rollback (Recovery Guide)

Every automated publish via `.github/workflows/deploy.yml` creates multiple layers of recovery **before** updating your live site:
1. **`gh-pages-backup` branch**: Stores the exact previous live GitHub Pages deployment before overwriting `gh-pages`.
2. **Annotated Checkpoint Tag + GitHub Release**: Tags the commit (`checkpoint-YYYYMMDD-HHMMSS-<shortsha>`) and attaches `fintrack-source-*.tar.gz` + `fintrack-dist-*.tar.gz` under **GitHub → Releases** and as 90-day workflow artifacts.

### How to Restore to a Specific Checkpoint (No CLI Required)
1. Open your GitHub repository → **Actions** tab → select **Restore FinTrack Checkpoint** (`.github/workflows/rollback.yml`).
2. Click **Run workflow**.
3. Enter `checkpoint_ref`:
   - Leave `gh-pages-backup` to instantly revert your live website to the previous deployment, **or**
   - Enter any tag such as `checkpoint-20261114-120000-abc1234` to rebuild and redeploy that exact historical version.
4. Optionally choose `create-restore-branch-and-redeploy` to also create a `restore/...` branch in GitHub so you can review or merge the code back into `main`.

### How to Restore Locally via Git CLI
```bash
git fetch --tags origin
git tag -l "checkpoint-*" --sort=-creatordate   # List available checkpoints
git checkout -b restore/fix checkpoint-YYYYMMDD-HHMMSS-sha
```

> **Troubleshooting a Blank Page / "FinTrack failed to start" on GitHub Pages:**
> 1. Open **Settings → Pages → Build and deployment → Source** and verify it is set to **Deploy from a branch** with branch **`gh-pages`** and folder **`/ (root)`** (not `main`, which holds unbuilt TypeScript entrypoints).
> 2. Check `.github/workflows/` in your repository: if GitHub auto-created a `jekyll-gh-pages.yml` workflow, **delete `jekyll-gh-pages.yml`** so only `deploy.yml` runs—otherwise the Jekyll workflow publishes the unbuilt root `index.html` and `/src/main.tsx` returns `404`.

---

## Local Development, Testing & Security Checks

```bash
npm install          # Install dependencies
npm run dev          # Start development server on http://localhost:3000
npm test             # Run all Vitest unit & UI integration tests
npm run lint         # TypeScript typecheck (tsc --noEmit)
npm run lint:rules   # Audit firestore.rules with ESLint security plugin
npm run checkpoint   # Verify gates, archive .backups/ tarball & tag local Git checkpoint
npm run build        # Build production static bundle into ./dist
```

---

## License
Released under the [MIT License](LICENSE).
