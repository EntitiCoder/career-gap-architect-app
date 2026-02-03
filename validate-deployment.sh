#!/bin/bash
# Production Deployment Validation Script
# This script validates that all deployment prerequisites are met

set -e

echo "🔍 DEPLOYMENT VALIDATION CHECKLIST"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_success() { echo -e "${GREEN}✅ $1${NC}"; }
check_fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
check_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# 1. Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -ge 18 ]; then
    check_success "Node.js $(node -v) (required: v18+)"
else
    check_fail "Node.js version too old ($(node -v)), need v18+"
fi

# 2. npm version
echo "2️⃣  Checking npm version..."
check_success "npm $(npm -v)"

# 3. Git
echo "3️⃣  Checking git..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    check_success "Git repository initialized"
else
    check_fail "Not a git repository"
fi

# 4. Build test - Backend
echo "4️⃣  Testing backend build..."
cd apps/api
if npm run build > /dev/null 2>&1; then
    check_success "Backend builds successfully"
else
    check_fail "Backend build failed"
fi
cd ../..

# 5. Build test - Frontend  
echo "5️⃣  Testing frontend build..."
cd apps/web
if npm run build > /dev/null 2>&1; then
    check_success "Frontend builds successfully"
else
    check_fail "Frontend build failed"
fi
cd ../..

# 6. Environment files
echo "6️⃣  Checking environment templates..."
[ -f "apps/api/.env.example" ] && check_success "apps/api/.env.example exists" || check_fail "apps/api/.env.example missing"
[ -f "apps/web/.env.example" ] && check_success "apps/web/.env.example exists" || check_fail "apps/web/.env.example missing"

# 7. Configuration files
echo "7️⃣  Checking deployment configs..."
[ -f "vercel.json" ] && check_success "vercel.json exists" || check_fail "vercel.json missing"
[ -f "apps/api/vercel.json" ] && check_success "apps/api/vercel.json exists" || check_fail "apps/api/vercel.json missing"

# 8. Git status
echo "8️⃣  Checking git status..."
if git status --short | grep -q .; then
    check_warn "Uncommitted changes exist - please commit before deploying"
else
    check_success "All changes committed"
fi

echo ""
echo "=================================="
echo "✅ ALL CHECKS PASSED!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Create Vercel account (vercel.com)"
echo "2. Create Railway account (railway.app)"
echo "3. Get OpenRouter API key"
echo "4. Run: npm install -g vercel"
echo "5. Run: vercel login"
echo "6. Run: bash deploy.sh OR follow QUICK_DEPLOY.md"
