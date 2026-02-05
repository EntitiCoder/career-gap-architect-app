# Career Gap Architect

An AI-powered application to analyze gaps between your resume and a job description, and provide an action plan to bridge them.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- [OpenRouter API Key](https://openrouter.ai/)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/EntitiCoder/career-gap-architect-app
   cd career-gap-architect-app
   ```

2. **Configure Environment Variables**:
   Copy the example environment file and add your OpenRouter API key:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and replace `your_openrouter_api_key_here` with your actual key.

   *Note: For local development using Docker, the default database credentials in the example file will work automatically. You only **need** to change the `OPENROUTER_API_KEY`.*

3. **Run the application**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Web interface: [http://localhost:3000](http://localhost:3000)
   - API server: [http://localhost:4000](http://localhost:4000)

## Features

- **AI-Powered Gap Analysis**: Leverages OpenRouter's AI models to analyze resume vs job description gaps
- **Missing Skills Detection**: Identifies and displays missing skills as visual badges
- **Action Plan Generation**: Creates a personalized markdown-formatted action plan
- **Interview Preparation**: Generates relevant interview questions based on the job requirements
- **Intelligent Caching**: Two-tier caching system (Redis + PostgreSQL) for identical inputs
- **Rate Limiting**: Redis-backed distributed rate limiting (60 requests/minute per IP)
- **File Upload Support**: Upload resumes and job descriptions in PDF, DOCX, or TXT formats
- **Comprehensive Error Handling**: Detailed error messages and validation
- **Health Monitoring**: Built-in health check endpoints for all services

## Tech Stack

**Frontend:**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Mammoth (DOCX parsing)
- unpdf (PDF parsing)

**Backend:**
- Express.js
- TypeScript
- PostgreSQL 16
- Redis 7
- Zod (validation)
- Winston (logging)
- Rate Limiter Flexible

**DevOps:**
- Docker & Docker Compose
- Multi-stage builds
- Health checks

## Service Architecture

- **Web (Next.js)**: Frontend user interface with file upload capabilities
- **API (Node.js/Express)**: Backend server handling AI requests, caching, and database operations
- **PostgreSQL**: Primary database for persistent caching of analysis results (24-hour TTL)
- **Redis**: L1 cache for fast lookups and distributed rate limiting

## Available Scripts

**Root level:**
- `npm run dev` - Start all services with Docker Compose
- `npm run build` - Build all apps in the monorepo
- `npm run clean` - Clean all node_modules and build artifacts

**Individual apps (for local development):**
- `npm run dev:web` - Run web app locally (port 3000)
- `npm run dev:api` - Run API server locally (port 4000)

## API Endpoints

**Health Checks:**
- `GET /health` - API server health status
- `GET /db-health` - PostgreSQL connection status
- `GET /redis-health` - Redis connection status

**Analysis:**
- `POST /api/gap-analysis` - Analyze resume vs job description
  - **Request Body:**
    ```json
    {
      "resume": "string (required)",
      "jobDescription": "string (required)"
    }
    ```
  - **Response:**
    ```json
    {
      "missingSkills": ["skill1", "skill2"],
      "steps": "markdown formatted action plan",
      "interviewQuestions": "markdown formatted questions",
      "cached": false,
      "metadata": {
        "processingTime": 1234,
        "cacheSource": "ai",
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "timestamp": "2026-02-05T04:16:38.493Z",
        "version": "1.0.0"
      }
    }
    ```

## Database

**PostgreSQL** is auto-initialized with the schema defined in `init.sql`:

- **Database:** `career_gap_db`
- **User:** `postgres`
- **Password:** `postgres`
- **Port (host):** `5435`
- **Port (container):** `5432`

**Schema:**
- `gap_analyses` table with content hash indexing
- 24-hour automatic expiration for cached results
- JSONB storage for analysis results

**Connect to database:**
```bash
# Via Docker
docker exec -it career-gap-postgres psql -U postgres -d career_gap_db

# Via local client (TablePlus, DBeaver, etc.)
# Host: localhost, Port: 5435, User: postgres, Password: postgres
```

## Redis

**Redis 7** provides fast caching and rate limiting:

- **Port:** `6379`
- **Persistence:** AOF (Append-Only File) enabled
- **Rate Limit:** 60 requests per minute per IP address
- **Cache TTL:** 1 hour for analysis results
- **Use Cases:**
  - L1 cache for gap analysis results
  - Distributed rate limiting across API instances

**Connect to Redis:**
```bash
docker exec -it career-gap-redis redis-cli
```

## Useful Commands

- **Stop the application**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **View specific service logs**: `docker-compose logs -f api`
- **Restart a specific service**: `docker-compose restart api`
- **Reset database (wipe all data)**: `docker-compose down -v && docker-compose up -d`
- **Rebuild containers**: `docker-compose up --build`

## Project Structure

```
career-gap-architect-app/
├── apps/
│   ├── api/                 # Express backend
│   │   ├── src/
│   │   │   ├── middleware/  # Rate limiting, validation
│   │   │   ├── services/    # AI service integration
│   │   │   ├── types/       # TypeScript types
│   │   │   └── utils/       # Validators, errors, logging
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                 # Next.js frontend
│       ├── src/
│       │   ├── app/         # Next.js 14 app directory
│       │   └── api/         # API routes (file upload)
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml       # Multi-service orchestration
├── init.sql                 # Database initialization
├── .env.example             # Environment template
└── README.md
```

## License

MIT
