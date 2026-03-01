# NurseScheduler Pro

Automated weekly scheduling system for a medical clinic.
15 nurses, 23 clinic types, Hebrew/Arabic bilingual, RTL layout.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL 16 (Prisma ORM)
- **Auth:** PIN → bcrypt → JWT (httpOnly cookie)
- **Deploy:** Docker Compose

---

## Docker Deployment

### Prerequisites

- Docker Engine 20+ and Docker Compose v2

### 1. Create environment file

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

```env
POSTGRES_DB=nurse_scheduler
POSTGRES_USER=nurse_app
POSTGRES_PASSWORD=<generate a strong password>
JWT_SECRET=<generate with: openssl rand -hex 64>
APP_PORT=3000
SEED_ON_STARTUP=true
```

### 2. Build and start

```bash
docker compose --env-file .env.production up -d --build
```

This will:
1. Start PostgreSQL 16 and wait until healthy
2. Build the Next.js app (3-stage Docker build)
3. Run database migrations
4. Seed all nurse/clinic data (if `SEED_ON_STARTUP=true`)
5. Start the server

### 3. Verify

```bash
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

### 4. Disable seeding after first run

```bash
# In .env.production, set:
SEED_ON_STARTUP=false

# Then restart:
docker compose --env-file .env.production up -d
```

---

## Seeded Data

| Entity | Count | Details |
|--------|-------|---------|
| Users | 16 | 1 manager + 15 nurses |
| Clinics | 23 | All types with Hebrew/Arabic names |
| Default Configs | 78 | Weekly clinic scheduling templates |
| Fixed Assignments | 29 | Permanent nurse-clinic assignments |
| Patient Programs | 4 | Breast unit, diabetes, heart failure, sugar load |
| Sample Schedule | 1 | Published week with 105 assignments |
| Time-Off Requests | 2 | Sample vacation + day off |

## Login PINs

PINs are in `.env.seed` (copied into the Docker image at build time).

- **Manager:** 6-digit PIN (`MANAGER_PIN`)
- **Nurses:** 4-digit PINs (`NURSE_PINS`, comma-separated)

Nurse order: כתיבה, נגלא, נידאל, רבחייה, היא, אינאס, רוואא, הדיל, סאנדי, נסרין-עלי, נסרין-משני, עלאא, גמילה, אנוואר, רוואן

---

## Architecture

```
┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│   App :3000  │
│              │     │  (Next.js)   │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   DB :5432   │
                     │ (PostgreSQL) │
                     └──────────────┘
```

- App runs as non-root user (`nextjs`, UID 1001)
- DB port is NOT exposed externally
- Both containers have `no-new-privileges` security policy
- Resource limits: App 1GB/1CPU, DB 512MB/0.5CPU

---

## Common Operations

```bash
# View logs
docker compose --env-file .env.production logs app -f

# Stop
docker compose --env-file .env.production down

# Stop and delete all data
docker compose --env-file .env.production down -v

# Rebuild after code changes
docker compose --env-file .env.production up -d --build

# Run migrations only
docker compose --env-file .env.production exec app npx prisma migrate deploy
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `POSTGRES_PASSWORD is missing` | Create `.env.production` from the example |
| `Authentication failed` on DB | Delete volume: `docker compose down -v` then `up -d` |
| Health check failing | Check logs: `docker compose logs app --tail 50` |
| Port 3000 in use | Set `APP_PORT=3001` in `.env.production` |

---

## Local Development

```bash
pnpm install
cp .env.example .env    # SQLite for local dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev                # http://localhost:3000
```

## Tests

```bash
pnpm test               # 120 tests (algorithm + integration)
pnpm tsc --noEmit       # Type check
```
