# SimCasino: mock Indian casino simulation

> **VIRTUAL ₹ ONLY. NO CASH VALUE.**
> There are no deposits, withdrawals, cash-outs, crypto conversions, transfers between players, or redemptions. Internally the currency is always `INR_VIRTUAL`.

This is a responsive casino-style game (phone, tablet and desktop) built from the PRD *"Mock Indian Casino Simulation Game"*. It has seven games, a virtual wallet, daily rewards, a leaderboard and an admin dashboard. The server decides every result.

---

## Run it on your computer

You need **Node.js 22 or newer**. Check with `node -v`.

```bash
npm install     # 1. download the libraries (first time only)
npm run dev     # 2. start everything
```

Then open **http://localhost:5173** in your browser.

| Account | Username | Password |
|---|---|---|
| Player | `demo_player_001` | `demo1234` |
| Admin | `admin_001` | `admin1234` |

There are also buttons on the sign-in page that fill these in for you. You can create your own account too; every new account gets ₹25,000 virtual.

You don't need to install a database. On first start, the app creates one inside `server/.data/` and fills it with demo accounts and two weeks of sample activity, so the admin charts have data. To start over from scratch, run `npm run db:reset`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API (port 8787) and the website (port 5173), with live reload. |
| `npm test` | Runs the automated tests: probability, game rules, wallet, concurrency and security. |
| `npm run typecheck` | Checks all the TypeScript for mistakes. |
| `npm run build` | Builds the optimized website into `apps/web/dist`. |
| `npm start` | Production mode: a single server on port 8787 serving the API and the built website. Run `npm run build` first. |
| `npm run db:reset` | Deletes the built-in database. It is recreated on next start. |
| `npm run db:generate` | Creates a new database migration after you change `server/src/db/schema.ts`. |

---

## What's included

**Games**

| Game | Type | Notes |
|---|---|---|
| Slots | instant | 3 reels, middle payline, up to 25× |
| Roulette | instant | European single zero: red, black, odd, even, dozens, columns, numbers. Several bets per spin. |
| Blackjack | interactive | Hit, stand, double, split. 3:2 blackjack. Dealer stands on 17. |
| Teen Patti | instant | 3-card showdown against the dealer. Stronger winning hands pay more. |
| Andar Bahar | instant | Andar pays 0.9:1, Bahar pays 1:1 |
| Dice | instant | 7 Up 7 Down |
| Poker | interactive | Jacks or Better video poker (hold and draw) |

**Player app:**
- **Home:** wallet, daily reward, featured game, game list, recent activity, achievements.
- **Wallet:** transactions, with filters for wins, bets, rewards and bonuses.
- **Game history:** a table on desktop and cards on mobile.
- **Rewards:** a 7-day streak plus achievements.
- **Leaderboard.**
- **Profile:** stats, plus the player's own simulation profile, shown openly.
- **Settings:** reduced motion and break reminders.
- **Help:** rules and paytables.
- **Break reminder:** by default, every 30 minutes it shows session time and the virtual amounts won and lost.

**Admin dashboard** (`/admin`, admin accounts only):
- **Overview:** metric tiles, a rounds-per-day chart, target vs actual outcome mix, a per-game table and security events.
- **Players:** search, view, and configure each player's probability profile. The total must equal 100%.
- **Player actions:** adjust balance, suspend or reactivate.
- **Probability profiles:** four locked presets, plus custom profiles you can create and edit.
- **Game configuration:** enable or pause a game, and set min/max bets.
- **Audit log:** append-only; the database itself refuses edits and deletes.

---

## How it works

1. **The server decides every result.** The browser only sends "I bet ₹500 on Red". The server:
   - checks the bet;
   - locks the player's wallet;
   - draws a random number from 0.00 to 99.99;
   - uses the player's simulation profile to pick a target outcome (loss / small win / win / big win);
   - asks the game engine for a result that is legal under the game's own rules;
   - records everything in one database transaction.

   If anything fails, nothing is charged.
2. **Payouts always come from the game's paytable.** If a bet can't produce the drawn outcome (for example, a single Red bet can never be a 25× big win), the game picks the closest sensible result. A big payout only ever happens when "Big Win" was drawn. Both the target and the actual outcome are stored, so admins can compare them.
3. **Every balance change is a ledger row** recording balance before, amount and balance after. The database enforces two rules: balances can't go negative, and every ledger row must add up. Ledger rows can't be edited or deleted.
4. **Duplicate protection:**
   - Each round has an `Idempotency-Key`, so a double-click or a retry after a network blip can never create two rounds.
   - Blackjack and poker actions carry a step number, so a repeated click is ignored.
5. **Security:**
   - **Logins:** passwords are hashed with scrypt, and login cookies are HTTP-only.
   - **Access control:** player and admin roles are separate.
   - **Request protection:** rate limits, strict input validation (unknown fields such as `payout` or `balance` are rejected and logged), protection against cross-site requests, and security headers.

---

## Project layout

```
shared/        Types, constants, paytables, validation — used by both server and web
server/        API (Hono) + database (Drizzle ORM)
  src/games/     One engine per game + shared selection logic
  src/services/  Wallet ledger, rounds, rewards, admin, probability
  src/routes/    HTTP endpoints (see "API" below)
  drizzle/       SQL migrations (incl. the append-only triggers)
  tests/         Automated tests
apps/web/      Website (React + Vite + Tailwind)
  src/games/     The seven game screens
  src/admin/     Admin dashboard (a separate download; players never load it)
  src/pages/     Home, Wallet, History, Rewards, Leaderboard, Profile, Settings, Help
```

The PRD suggested a separate admin app. Here it lives inside the web app under `/admin`, but as its own lazily loaded bundle. That keeps it to one site to run while players still never download admin code.

### API (main endpoints)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | Accounts |
| GET | `/api/wallet` | `{ virtualBalance, currency: "INR_VIRTUAL" }` |
| GET | `/api/wallet/transactions?filter=all\|wins\|bets\|rewards\|bonuses` | Ledger |
| POST | `/api/games/:gameId/play` (header `Idempotency-Key`) | Play / start a round |
| POST | `/api/games/:gameId/rounds/:roundId/action` | Blackjack / poker decisions |
| GET | `/api/games/history` | Game history |
| GET | `/api/profile` | Profile, stats, simulation profile |
| PUT | `/api/admin/players/:playerId/probability` | Set probability (must total 100) |

---

## Settings

Copy `.env.example` to `.env` and edit it. Every setting is optional for local use. The important ones:

- `DATABASE_URL`: leave empty for the built-in database, or paste a Postgres/Neon connection string.
- `SEED_DEMO_DATA`: set to `false` before going public.
- `APP_ORIGINS` and `TRUST_PROXY`: needed when hosting online (see below).

---

## Putting it online (optional)

Hosting needs your own accounts, so it isn't done for you. A simple route:

1. **Database:** create a free Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. **Host:** use a Node.js host such as Render, Railway or Fly.io. Connect this folder (for example, via a GitHub repo).
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. **Environment variables on the host:**
   - `DATABASE_URL=<your Neon string>`
   - `SEED_DEMO_DATA=false`
   - `TRUST_PROXY=true`
   - `APP_ORIGINS=https://<your-domain>`
4. **HTTPS:** these hosts provide it automatically. Login cookies require it in production.
5. **Create your admin:** register normally, then run this once in Neon's SQL editor:
   `update users set role = 'admin' where username = 'your_name';`

Notes for later:
- The PRD mentions Cloudflare. This server runs on Node.js. Running on Cloudflare Workers would need a Workers-compatible database driver and a shared rate-limit store.
- The rate limiter keeps its counts in memory, which is fine for a single server instance.

**Before going public:**
- Change or remove the demo accounts (`SEED_DEMO_DATA=false` on a fresh database).
- Check the age-rating rules for *simulated gambling* in your region and app store. Many require 17+ or 18+.

---

## Not included yet

- **PostHog analytics:** needs your PostHog key.
- **Sound effects.**
- **Gems:** the PRD's optional second currency.
- **Purchasing virtual currency:** deliberately excluded. The PRD's non-goals forbid real-money deposits.
