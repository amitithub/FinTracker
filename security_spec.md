# Security Specification & Red-Team Audit Matrix

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `userId` (`ownerId == request.auth.uid`), and the caller must have a verified email (`request.auth.token.email_verified == true`).
2. `ownerId` and `createdAt` are immutable after document creation.
3. All `createdAt` and `updatedAt` timestamps must equal `request.time` (server timestamp).
4. All document IDs (`userId`, `expenseId`, `budgetId`, `billId`) must match `^[a-zA-Z0-9_\-]+$` with length 1–128.
5. Every string field enforces explicit `.size()` bounds; every numeric amount/limit enforces strict positive and upper bounds (`<= 100000000`).
6. No shadow/ghost fields are accepted on `create` or `update` (`keys().hasOnly(...)` + `affectedKeys().hasOnly(...)`).
7. Collection `list` queries explicitly validate `resource.data.ownerId == request.auth.uid` on the rule side rather than delegating filtering to the client.

## 2. Dirty Dozen Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read or write `/users/alice/expenses/exp1` with `auth == null`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to create an expense.
3. **Cross-Tenant Read**: Authenticated verified `bob` attempting to `get` or `list` `/users/alice/expenses`.
4. **Cross-Tenant Ownership Spoof**: `bob` writing to `/users/bob/expenses/exp1` with `ownerId: "alice"`.
5. **Shadow Field Injection on Create**: Creating an expense with an extra undeclared field `isAdmin: true`.
6. **Shadow Field Injection on Update**: Updating an expense title while injecting `approvedOverride: true`.
7. **Immutable Field Tampering**: Updating an existing expense to change `createdAt` or `ownerId`.
8. **Client Clock Forgery**: Creating an expense with `createdAt` or `updatedAt` set to a client-forged timestamp instead of `request.time`.
9. **Denial-of-Wallet String Bomb**: Creating an expense with a 10KB `title` or 2KB `expenseId` path variable.
10. **Negative / Zero Amount Fraud**: Creating an expense with `amount: -500` or `convertedAmount: 0`.
11. **Invalid Category / Currency Enum Injection**: Creating an expense with `currency: "FAKECOIN"` or `category: "Hack"`.
12. **Malformed Date / MonthKey Injection**: Creating an expense with `date: "2026/99/99"` or `monthKey: "invalid"`.
