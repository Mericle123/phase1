# CountTale Blockchain Invoice Management System

CountTale is a role-based invoice, payment verification, audit, employee activity, and blockchain record management application.

The app has two parts:

- Frontend: React + Vite, served on `http://127.0.0.1:5173`
- Backend API: Node.js + Express, served on `http://127.0.0.1:4178/api`

Both parts must be running for the application to work.

## Features

- Login with JWT authentication.
- Role-based access for Super Admin, Admin, Employee, and Verifier.
- Employee invoice/data entry.
- Duplicate journal number checking.
- Payment verification and payment status updates.
- Blockchain/local ledger storage for verified paid records.
- Locked and tamper-protected blockchain-confirmed records.
- Controlled revision flow for updates after blockchain storage.
- Admin dashboard with compact responsive records table.
- Full record details with entered by, verified by, approved by, updated by, timestamps, audit history, and revision history.
- Late or unusual entries monitoring.
- Hidden employee activity tracking.
- Audit reports and CSV exports.
- User management for Admin.

## Requirements

Install these first:

- Node.js 20 or newer
- npm

Check your versions:

```bash
node -v
npm -v
```

## Installation

Open a terminal and go to the project folder:

```bash
cd "/Users/ng/Documents/New project/NZ"
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

The demo works without PostgreSQL or a real Fabric network. If `DATABASE_URL` is not configured, the backend uses the local demo file:

```text
server/data/app-db.json
```

## How To Run The Application

You need two terminals.

### Terminal 1: Start The Backend API

```bash
cd "/Users/ng/Documents/New project/NZ"
npm run api
```

Expected output:

```text
CountTale API running on http://127.0.0.1:4178
```

### Terminal 2: Start The Frontend

```bash
cd "/Users/ng/Documents/New project/NZ"
npm run dev -- --host 127.0.0.1
```

Expected output:

```text
Local: http://127.0.0.1:5173/
```

Open this link in the browser:

```text
http://127.0.0.1:5173/
```

## Demo Login Accounts

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `ngawangg927@gmail.com` | `Admin@123` |
| Admin | `admin@counttale.bt` | `Admin@123` |
| Employee | `employee@counttale.bt` | `Employee@123` |
| Verifier | `verifier@counttale.bt` | `Verifier@123` |

## Role Guide

Employee:

- Create invoice/data records.
- Submit financial and payment-related details.
- View own submitted records.

Verifier:

- View submitted records.
- Verify payment status.
- Commit valid paid records to the blockchain/local ledger.

Admin:

- View all employee-submitted records.
- Monitor employee activity.
- Review, approve, reject, flag, and verify records.
- Manage employee and verifier accounts.
- View audit and revision history.

Super Admin:

- Own the protected CountTale administration dashboard.
- Assign and manage up to 5 active Admin accounts.
- Manage employee, verifier, and admin access.

## Blockchain And Locked Record Logic

When a payment is verified and stored on the blockchain/local ledger:

- The original record becomes locked.
- The UI shows `Verified`, `Locked`, `Stored on Blockchain`, and `Tamper-Protected`.
- The original blockchain transaction hash is kept unchanged.
- Direct silent edits are blocked.
- Any later update must be submitted as a new revision.
- The revision stores who changed it, when it changed, what changed, and why it changed.

## Preview / Production Build

Build the frontend:

```bash
npm run build
```

Preview the built frontend:

```bash
npm run preview
```

Important:

- `npm run preview` only serves the built frontend.
- The backend API must still be running with `npm run api`.
- Vite preview usually runs on `http://127.0.0.1:4173`, not `5173`.
- For normal development, use `npm run dev -- --host 127.0.0.1`.

## Testing

Run lint:

```bash
npm run lint
```

Run the production build check:

```bash
npm run build
```

Run the full end-to-end API and app logic check:

```bash
npm run test:e2e
```

The end-to-end check covers:

- Login for all roles.
- Invalid login rejection.
- Role-based access.
- Employee invoice creation.
- Required field validation.
- Duplicate journal prevention.
- Admin record visibility.
- Admin approve/reject/flag/verify actions.
- Document audit actions.
- Payment verification.
- Blockchain/local ledger storage.
- Locked-record revision behavior.
- Audit logs.
- Employee activity tracking.
- User management.
- Logout session invalidation.

## Troubleshooting

### The preview link is not working

Most likely the local servers are not running.

Start the API:

```bash
npm run api
```

Start the frontend:

```bash
npm run dev -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

### The page opens but login/API data does not work

Make sure the backend is running:

```text
http://127.0.0.1:4178/api/health
```

You should see a JSON response with `"ok": true`.

### Port already in use

If port `4178` or `5173` is already being used, stop the old server process and run the commands again.

On macOS, you can check the process with:

```bash
lsof -i :4178
lsof -i :5173
```

### Reset local demo data

The app uses local demo data in:

```text
server/data/app-db.json
```

The end-to-end test resets demo data automatically after it runs.

## Project Structure

```text
NZ/
  chaincode/              Hyperledger Fabric chaincode
  database/               PostgreSQL schema
  scripts/                E2E verification scripts
  server/                 Express backend API
  src/                    React frontend
  .env.example            Environment variable template
  package.json            App scripts and dependencies
```

## Useful Commands

```bash
npm install
npm run api
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
npm run test:e2e
```
# phase1
# phase1
