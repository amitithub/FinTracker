# FinTrack — AI Coding Agent Build Blueprint (From Scratch)

Use this document as a complete, self-contained specification for **any AI coding agent** (Claude Code, Cursor, Windsurf, Gemini CLI, Copilot Workspace, etc.) to recreate **FinTrack** cleanly from an empty repository.

---

## 1. Product Goal & Core Capabilities

Build **FinTrack**, an open-source (MIT), zero-cost personal & household expense tracker with:
1. **Cross-Device Cloud Sync & Auth**: Firebase Authentication (Email/Password with email verification + Google Sign-In + Password Reset) and Cloud Firestore (**Spark Free Tier**).
2. **Resilient Offline / Preview Fallback**: Full **6-Month Sample Ledger (Local Preview)** mode that works immediately even if Firebase credentials are absent.
3. **Full CRUD**:
   - **Expenses**: Title, amount, currency (9 currencies, default `INR ₹`), exchange rate, auto-converted base amount, category (10 categories), calendar date (`YYYY-MM-DD`), notes, two-step inline delete confirmation.
   - **Budgets**: Overall monthly spending cap + per-category monthly limits and alert thresholds (`10%–100%`), with `On Track`, `Approaching Limit`, and `Over Budget` evaluations.
   - **Recurring Bills**: Weekly/monthly/yearly bills, one-tap `Pay & Log` (atomically creates an expense and advances `nextDueDate` across month-ends/leap years via `writeBatch`), edit modal, and delete.
4. **Live Currency Conversion**: Keyless Frankfurter ECB API (`https://api.frankfurter.dev/v1/latest?base=...&symbols=...`) with built-in offline fallback rates.
5. **Interactive Visualizations**:
   - **6-Month Spending Trend**: Interactive SVG **Line & Area Chart** and **Bar Chart** switcher, direct currency value labels (`Labels` toggle on by default), Y-axis ticks, dashed Budget Cap reference line, and click-to-select-month.
   - **Daily Burn & Cumulative Pace Line Chart**: Day-by-day & cumulative spending trajectory with sparse non-overlapping labels, peak readout, and hover crosshair.
   - **Category Breakdown Donut Ring**: SVG donut segments + horizontal proportion bars, clickable to filter Reports.
6. **Advanced Filtering, CSV/Excel Import, Export & Backup**:
   - **Reports**: Category dropdown, Date/Period dropdown (Quick Ranges, Specific Month, Exact Calendar Date, Custom Range), Description search + clear button, Original Currency (`All FX`), Min/Max Amount, and Sort (`Newest`, `Oldest`, `Highest`, `Lowest`), paired with live-filtered Line & Donut charts.
   - **CSV & Excel Upload (`ImportExpensesModal`)**: Upload `.csv`, `.tsv`, or Excel `.xlsx` / SpreadsheetML `.xls` sheets (`read-excel-file/universal`) with auto column detection, interactive column remapping, duplicate skipping, negative-debit conversion option, row-level validation, and atomic chunked Firestore batch creation.
   - **Exports & Backup**: RFC-4180 CSV export (with formula-injection neutralization), Print/PDF stylesheet, and **Full JSON Backup & Validated Restore** (`Download Backup` / `Restore JSON`).
7. **GitHub Checkpoints & Rollback**: Automated `gh-pages-backup`, annotated `checkpoint-*` Git tags, source/dist tarballs on GitHub Releases, plus `rollback.yml` (`workflow_dispatch`) and `scripts/checkpoint-publish.sh`.
8. **Accessible Light & Dark Modes**: Zero-flash boot script + Tailwind CSS v4 `@custom-variant dark` + system/light/dark persistence.

---

## 2. Exact Tech Stack & Package Versions

- **Runtime**: React 19, TypeScript, Vite 8 (`@vitejs/plugin-react`), Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `motion`, `read-excel-file` (zero-CVE browser/universal `.xlsx` reader)
- **Backend/Auth**: `firebase` (Web v13 modular SDK)
- **Testing & Auditing**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `eslint`, `@firebase/eslint-plugin-security-rules`
- **Node Build Compatibility**: Keep `esbuild` aligned with Vite 8's optional peer range (`"esbuild": "^0.28.0"`) so `npm ci` / `npm install` never fails with `ERESOLVE` in GitHub Actions.

---

## 3. Master Prompt to Give Any AI Coding Agent

Copy and paste the prompt below to build the app from scratch in an empty directory:

> Build **FinTrack**, a responsive React 19 + TypeScript + Vite + Tailwind CSS v4 personal expense tracker with Firebase Spark free-tier sync, multi-currency conversion (default `INR`), interactive labeled line/bar/donut charts, advanced filtering, CSV/PDF/JSON backup & restore, and automated `gh-pages` deployment.
>
> Follow these strict architectural and security rules:
> 1. **Styling & Design System**:
>    - Use Tailwind CSS v4 with `@import "tailwindcss";` and `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`.
>    - Fonts: `Plus Jakarta Sans` (display), `DM Sans` (body), `JetBrains Mono` (`tabular-nums` for all numbers, dates, and currency amounts).
>    - Include a zero-flash theme `<script>` in `index.html` reading `localStorage.getItem('fintrack-theme')` plus a 4.5s `window.__FINTRACK_MOUNTED__` boot watchdog and React `<ErrorBoundary>`.
>    - Single-elevation cards (`bg-white/90 dark:bg-slate-900/90 border`), clean inline metadata separated by `·` (no pill badge spam, no `border-l-4` accent bars, no fake telemetry).
> 2. **Domain & Validation (`src/types/expense.ts`, `src/lib/validation.ts`)**:
>    - Strict validation limits: `MAX_TITLE_LENGTH = 120`, `MAX_NOTES_LENGTH = 500`, `MAX_AMOUNT = 100_000_000`, `MAX_EXCHANGE_RATE = 1_000_000`, `ID_PATTERN = /^[a-zA-Z0-9_-]+$/`.
>    - `sanitizeText` strips ASCII control chars `[\u0000-\u001F\u007F]`.
>    - `isValidCalendarDate` verifies real UTC calendar round-trip (rejecting `2026-02-30` and non-leap `2025-02-29`).
> 3. **Currency (`src/lib/currency.ts`)**:
>    - Fetch live ECB rates from CORS-enabled `https://api.frankfurter.dev/v1/latest?base=<BASE>&symbols=...` (NOT `.app`, which lacks CORS headers in some browsers) with a silent fallback to static reference rates.
> 4. **Analytics & Charts (`src/lib/analytics.ts`, `src/components/charts/`)**:
>    - `SpendingTrendChart`: 6-month SVG Line/Area + Bar mode switcher, direct currency value labels (`Labels` toggle on by default), Y-axis ticks, dashed Budget Cap line, click-to-select month.
>    - `DailySpendLineChart`: Reusable SVG Line/Area chart supporting `Cumulative` vs `Daily / Period` modes, direct point labels, peak/total readouts, and hover crosshair. Used both on Overview (selected month burn pace) and Reports (reacts live to filtered expenses).
>    - `CategoryDonutChart`: Interactive SVG donut + horizontal proportion bars, clickable to filter Reports.
> 5. **Filtering, CSV/Excel Import, Exports & Backup (`src/lib/export.ts`, `src/lib/importExpenses.ts`, `ReportsView.tsx`, `ImportExpensesModal.tsx`, `SettingsModal.tsx`)**:
>    - Filters: Category dropdown, Date/Period dropdown (`all`, `month`, `3m`, `6m`, `ytd`, `ym:YYYY-MM` specific month, `exact` calendar date, `custom` range), Description search + clear button, Original Currency (`All FX`), Min/Max Amount, Sort (`date-desc`, `date-asc`, `amount-desc`, `amount-asc`), and Reset Filters.
>    - CSV/Excel Upload (`readUploadedExpenseSheet`, `buildExpenseImportPreview`): Parse `.csv`/`.tsv` (RFC-4180 + formula-shield stripping) and `.xlsx` via `read-excel-file/universal` with auto header mapping, manual column override dropdowns, duplicate detection, negative-debit conversion option, and `batchCreateExpenses` (`<= 400` writes/batch).
>    - CSV export (`generateExpensesCsv`) escapes RFC-4180 cells and prepends `'` to values starting with `=`, `+`, `-`, `@`, `\t`, or `\r` to prevent spreadsheet formula injection.
>    - Full JSON Backup (`generateBackupJson`) & Validated Restore (`parseAndValidateBackup`) supporting both Preview Mode and chunked Firestore batches (`<= 400` writes/batch). Reject malformed, non-FinTrack, or oversized (>5MB / >5,000 items) files.
> 6. **Firebase Zero-Trust Architecture (`src/lib/firebase.ts`, `firestore.rules`, `firebase-blueprint.json`)**:
>    - Read config from `import.meta.env.VITE_FIREBASE_*` first (trimmed) and optional `firebase-applet-config.json` via `import.meta.glob('../../firebase-applet-config.json', { eager: true })` second.
>    - Export `isFirebaseConfigured` and `firebaseInitError`. Never crash at module load if keys are missing—allow users to enter 6-Month Sample Preview Mode.
>    - Never commit `firebase-applet-config.json` (add it to `.gitignore` to avoid GitHub Secret Scanning alerts).
>    - Owner-scoped Firestore paths:
>      - `users/{userId}/profile/preferences`
>      - `users/{userId}/expenses/{expenseId}`
>      - `users/{userId}/budgets/{budgetId}`
>      - `users/{userId}/recurring/{billId}`
>    - Enforce `rules_version = '2';`, global default-deny catch-all, `request.auth.token.email_verified == true`, `request.auth.uid == userId`, strict `keys().hasAll(...)`/`keys().hasOnly(...)`, `affectedKeys().hasOnly(...)`, immutable `ownerId`/`createdAt`, and `updatedAt == request.time`. Validate with `@firebase/eslint-plugin-security-rules`.
> 7. **Automated Testing & Security Verification (`src/__tests__/`)**:
>    - Unit tests for analytics, currency formatting/fallback, date math, validation, CSV formula neutralization, JSON backup/restore validation, UI E2E CRUD/theme/filter flows, and security/penetration tests (formula injection, path traversal, impossible dates, `firestore.rules` assertions, and unconfigured Firebase fallback).
> 8. **GitHub Pages Deployment, Checkpoints & Rollback (`vite.config.ts`, `.github/workflows/deploy.yml`, `.github/workflows/rollback.yml`)**:
>    - Set `base: './'` in `vite.config.ts`.
>    - `deploy.yml` triggers on `push` to `main` + `workflow_dispatch`, runs `npm run lint`, `npm run lint:rules`, and `npm test`, injects all 7 `VITE_FIREBASE_*` vars from `${{ secrets.VITE_FIREBASE_* || vars.VITE_FIREBASE_* }}` during `npm run build`, verifies `./assets/` in `dist/index.html`, creates `dist/.nojekyll` and `dist/404.html`, snapshots the previous `gh-pages` branch to `gh-pages-backup`, creates an annotated `checkpoint-*` tag + GitHub Release with source/dist `.tar.gz` archives + 90-day artifact, and deploys `./dist` to `gh-pages` via `peaceiris/actions-gh-pages@v4`.
>    - `rollback.yml` (`workflow_dispatch`) validates `checkpoint_ref` and either restores `gh-pages-backup` directly or checks out a `checkpoint-*` tag, runs lint/tests/build, and redeploys `gh-pages` (optionally creating a `restore/*` recovery branch).

---

## 4. Recommended Implementation Order for an Agent

1. **Scaffold & Tooling**: Initialize Vite + React + TypeScript + Tailwind v4 (`vite.config.ts` with `base: './'`, `vitest.config.ts`, `eslint.config.js`, `tsconfig.json`, `package.json`).
2. **Domain & Pure Logic**: Create `src/types/expense.ts`, `src/lib/validation.ts`, `src/lib/currency.ts`, `src/lib/analytics.ts`, `src/lib/demoData.ts`, and `src/lib/export.ts`.
3. **Security Blueprint & Rules**: Create `firebase-blueprint.json`, `firestore.rules`, and `security_spec.md`, then verify `npm run lint:rules`.
4. **Firebase & State Contexts**: Implement `src/lib/firebase.ts` (safe env/glob loading), `src/services/firestoreService.ts` (with structured `handleFirestoreError` & chunked backup restore), `ThemeContext.tsx`, `AuthContext.tsx` (with auth watchdog), and `LedgerContext.tsx`.
5. **UI Components & Charts**: Build `ErrorBoundary.tsx`, `BackdropAtmosphere.tsx`, `AuthScreen.tsx`, `SpendingTrendChart.tsx`, `DailySpendLineChart.tsx`, `CategoryDonutChart.tsx`, `ExpenseModal.tsx`, `SettingsModal.tsx`, `OverviewView.tsx`, `ReportsView.tsx`, `BudgetsView.tsx`, `RecurringView.tsx`, and `App.tsx`.
6. **Tests & CI/CD**: Add all Vitest unit, UI, and pentest suites, create `.github/workflows/deploy.yml`, and verify all checks:
   ```bash
   npm run lint
   npm run lint:rules
   npm test
   npm run build
   ```

---

## 5. GitHub Hosting & Firebase Secrets Checklist

1. Keep `firebase-applet-config.json` in `.gitignore` (never commit `apiKey` strings to GitHub).
2. Add the 7 Firebase variables under **GitHub Repository → Settings → Secrets and variables → Actions → Repository secrets** (NOT Environment secrets):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_FIRESTORE_DATABASE_ID`
3. In Firebase Console:
   - Enable **Email/Password** and **Google** providers under **Authentication → Sign-in method**.
   - Add `<your-username>.github.io` under **Authentication → Settings → Authorized domains**.
4. After the first `.github/workflows/deploy.yml` run pushes `gh-pages`, set **GitHub → Settings → Pages → Source** to **Deploy from a branch** → **`gh-pages`** → **`/ (root)`**.
