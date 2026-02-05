# Career Gap Architect

Compare resume to job description with AI.

## Quick Start

```bash
git clone https://github.com/EntitiCoder/career-gap-architect-app
cd career-gap-architect-app
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_key_here
```

Install and start:
```bash
npm install
cd apps/web && npm install
cd ../api && npm install
cd ../..
npm run dev
```

Access at http://localhost:3000

## Features

- AI gap analysis with OpenRouter
- Missing skills as badges
- Action plan with markdown
- Interview questions
- Cache for identical inputs
- Error handling
- Redis-based distributed rate limiting

## Tech Stack

Frontend: Next.js 14, React 18, TypeScript, Tailwind
Backend: Express, TypeScript, PostgreSQL, Redis
DevOps: Docker, Docker Compose

## Available Scripts

Root level:
- `npm run dev` - Start all services
- `npm run build` - Build all apps
- `npm run clean` - Clean modules

Individual apps:
- `npm run dev:web` - Run web locally
- `npm run dev:api` - Run API locally

## Access

- Web: http://localhost:3000
- API: http://localhost:4000
- Endpoint: POST /api/gap-analysis
- Health checks: GET /health, /db-health, /redis-health

## Database

PostgreSQL auto-initialized with:
- Database: career_gap_db
- User: postgres
- Password: postgres

Connect:
```bash
docker exec -it career-gap-postgres psql -U postgres -d career_gap_db
```

## Redis

Rate limiting backed by Redis 7:
- Port: 6379
- Persistence: AOF enabled
- Rate limit: 60 requests per minute per IP

## License

MIT
