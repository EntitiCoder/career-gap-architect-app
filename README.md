# Career Gap Architect

AI-powered career gap analysis tool that compares resumes to job descriptions and provides actionable insights.

## 🚀 Quick Start

```bash
git clone https://github.com/EntitiCoder/career-gap-architect-app
cd career-gap-architect-app
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_key_here
```

Install dependencies and start:
```bash
npm install
cd apps/web && npm install
cd ../api && npm install
cd ../..
npm run dev
```

Access at http://localhost:3000

## 📁 Project Structure

```
career-gap-architect-app/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   └── app/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   └── api/              # Express backend
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
├── docker-compose.yml    # Docker orchestration
├── init.sql              # Database initialization
├── .env.example          # Environment variables template
└── package.json          # Root package.json
```

## 🛠️ Prerequisites

- **Node.js** 20+ 
- **Docker** & **Docker Compose**
- **npm** or **yarn**

## 📦 Installation

1. **Clone the repository**
   ```bash
   cd career-gap-architect-app
   ```

2. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```

3. **Install dependencies**
   ```bash
   npm install
   cd apps/web && npm install
   cd ../api && npm install
   cd ../..
   ```

4. **Start everything with Docker**
   ```bash
   npm run dev
   ```

## ✨ Features

- AI-powered gap analysis using OpenRouter
- Missing skills displayed as badges
- Action plan with markdown rendering
- Interview preparation questions
- Intelligent caching for identical inputs
- Input validation and error handling

## 🌐 Access the Applications

- **Web App**: http://localhost:3000
- **API**: http://localhost:4000
- **Gap Analysis**: POST http://localhost:4000/api/gap-analysis

## 📝 Available Scripts

### Root Level
- `npm run dev` - Start all services with Docker Compose
- `npm run build` - Build all apps
- `npm run clean` - Clean all node_modules and build artifacts

### Individual Apps
- `npm run dev:web` - Run web app locally (without Docker)
- `npm run dev:api` - Run API locally (without Docker)

## 🗄️ Database

PostgreSQL is automatically initialized with:
- Database: `career_gap_db`
- User: `postgres`
- Password: `postgres`
- Sample `users` table with test data

Connect to the database:
```bash
docker exec -it career-gap-postgres psql -U postgres -d career_gap_db
```

## 🔧 Tech Stack

### Frontend (apps/web)
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### Backend (apps/api)
- **Express** - Web framework
- **TypeScript** - Type safety
- **pg** - PostgreSQL client
- **cors** - CORS middleware
- **dotenv** - Environment variables

### Database
- **PostgreSQL 16** - Relational database

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## 🔄 Development Workflow

1. Make changes to your code
2. Changes are hot-reloaded automatically
3. Web app watches `apps/web/src`
4. API watches `apps/api/src`

## 🐳 Docker Commands

```bash
# Start services
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop services
docker-compose down

# Rebuild containers
docker-compose up --build

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres
```

## 📚 API Endpoints

- `GET /health` - API health check
- `GET /db-health` - Database connection check
- `GET /api/users` - Get all users (example endpoint)

## 🎨 Customization

### Add New Dependencies

**Web App:**
```bash
cd apps/web
npm install <package-name>
```

**API:**
```bash
cd apps/api
npm install <package-name>
```

### Environment Variables

Edit `.env` file to customize:
- Database credentials
- API port
- Other configuration

## 🚨 Troubleshooting

### Port Already in Use
If ports 3000, 4000, or 5432 are already in use:
1. Stop the conflicting service
2. Or change ports in `docker-compose.yml`

### Database Connection Issues
```bash
# Check if PostgreSQL is healthy
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres
```

### Clear Everything and Start Fresh
```bash
docker-compose down -v
npm run clean
npm install
cd apps/web && npm install
cd ../api && npm install
cd ../..
npm run dev
```

## 📄 License

MIT

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
