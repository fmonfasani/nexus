#!/bin/bash

# 🚀 Nexus Complete Setup Script
# ==============================
# Script completo para configurar el proyecto Nexus desde cero

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_NAME="nexus"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

# Functions
print_banner() {
    echo -e "${CYAN}"
    echo "🚀 =================================================="
    echo "   NEXUS - Complete Project Setup"
    echo "   Plataforma de Teleconferencias Inteligente"
    echo "================================================== 🚀"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Check system requirements
check_system_requirements() {
    print_step "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js $NODE_VERSION+"
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VER=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION+ required. Current: $(node --version)"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 not found. Please install Python $PYTHON_VERSION+"
        echo "Visit: https://www.python.org/"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker"
        echo "Visit: https://www.docker.com/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose not found. Please install Docker Compose"
        exit 1
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git not found. Please install Git"
        exit 1
    fi
    
    print_success "All system requirements met ✅"
}

# Create directory structure
create_directory_structure() {
    print_step "Creating complete directory structure..."
    
    # Create main directories
    mkdir -p {frontend,backend,ai-services}/{src,tests}
    mkdir -p frontend/src/{components,hooks,services,store,types,utils,pages,assets,styles}
    mkdir -p frontend/src/components/{ui,layout,meeting,auth,analytics}
    mkdir -p frontend/src/pages/{auth,meeting,dashboard}
    mkdir -p frontend/public
    
    mkdir -p backend/src/{controllers,middleware,models,routes,services,utils,websocket,config,database}
    mkdir -p backend/prisma/{migrations,seeds}
    
    mkdir -p ai-services/{services,models,utils,core,middleware}
    mkdir -p ai-services/services/{transcription,summary,analytics}
    
    mkdir -p infrastructure/{docker,kubernetes,terraform,scripts,monitoring,nginx}
    mkdir -p infrastructure/monitoring/{prometheus,grafana}
    
    mkdir -p docs/{api,architecture,deployment,guides}
    mkdir -p .github/workflows
    mkdir -p tests/{unit,integration,e2e,load}
    mkdir -p logs
    mkdir -p data/{uploads,exports,backups}
    mkdir -p scripts/{dev,deploy,maintenance}
    
    # Create .gitkeep files for empty directories
    find . -type d -empty -exec touch {}/.gitkeep \;
    
    print_success "Directory structure created ✅"
}

# Create package.json files
create_package_files() {
    print_step "Creating package.json files..."
    
    # Root package.json
    cat > package.json << 'EOF'
{
  "name": "nexus",
  "version": "1.0.0",
  "description": "Plataforma de Teleconferencias Inteligente con IA",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "install:all": "npm install && npm run install:frontend && npm run install:backend && npm run install:ai",
    "install:frontend": "cd frontend && npm install",
    "install:backend": "cd backend && npm install", 
    "install:ai": "cd ai-services && pip install -r requirements.txt",
    
    "dev": "npm run services:dev && concurrently \"npm run dev:frontend\" \"npm run dev:backend\" \"npm run dev:ai\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "dev:ai": "cd ai-services && python -m uvicorn main:app --reload --port 8001",
    
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    
    "test": "npm run test:frontend && npm run test:backend && npm run test:ai && npm run test:e2e",
    "test:frontend": "cd frontend && npm test",
    "test:backend": "cd backend && npm test",
    "test:ai": "cd ai-services && python -m pytest",
    "test:e2e": "cd tests/e2e && npm test",
    "test:load": "cd tests/load && npm test",
    
    "lint": "npm run lint:frontend && npm run lint:backend && npm run lint:ai",
    "lint:frontend": "cd frontend && npm run lint",
    "lint:backend": "cd backend && npm run lint",
    "lint:ai": "cd ai-services && python -m flake8 .",
    
    "format": "npm run format:frontend && npm run format:backend && npm run format:ai",
    "format:frontend": "cd frontend && npm run format",
    "format:backend": "cd backend && npm run format",
    "format:ai": "cd ai-services && python -m black .",
    
    "services:dev": "docker-compose up -d postgres redis kafka",
    "services:prod": "docker-compose -f docker-compose.prod.yml up -d",
    "services:stop": "docker-compose down",
    "services:clean": "docker-compose down -v --remove-orphans",
    
    "db:migrate": "cd backend && npm run db:migrate",
    "db:seed": "cd backend && npm run db:seed",
    "db:reset": "cd backend && npm run db:reset",
    "db:backup": "scripts/backup-database.sh",
    "db:restore": "scripts/restore-database.sh",
    
    "deploy:staging": "scripts/deploy-staging.sh",
    "deploy:production": "scripts/deploy-production.sh",
    
    "logs:backend": "docker-compose logs -f backend",
    "logs:ai": "docker-compose logs -f ai-services",
    "logs:all": "docker-compose logs -f",
    
    "monitoring:start": "docker-compose up -d prometheus grafana",
    "monitoring:stop": "docker-compose stop prometheus grafana",
    
    "security:audit": "npm audit && cd frontend && npm audit && cd ../backend && npm audit",
    "security:fix": "npm audit fix && cd frontend && npm audit fix && cd ../backend && npm audit fix",
    
    "docs:generate": "scripts/generate-docs.sh",
    "docs:serve": "cd docs && python -m http.server 8080",
    
    "cleanup": "npm run services:clean && npm run clean:deps && npm run clean:logs",
    "clean:deps": "rm -rf node_modules frontend/node_modules backend/node_modules",
    "clean:logs": "rm -rf logs/*.log",
    "clean:cache": "npm cache clean --force && cd frontend && npm cache clean --force && cd ../backend && npm cache clean --force"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "cross-env": "^7.0.3",
    "rimraf": "^5.0.1"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=9.0.0"
  }
}
EOF

    print_success "Package.json files created ✅"
}

# Create environment files
create_environment_files() {
    print_step "Creating environment configuration..."
    
    # Copy from existing .env.example or create minimal version
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'EOF'
# ===================================
# NEXUS - Environment Variables
# ===================================

# Application
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus
REDIS_URL=redis://localhost:6379

# Authentication  
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your-openai-api-key
WHISPER_MODEL=base

# WebRTC
TURN_SERVER_URL=turn:localhost:3478
TURN_USERNAME=nexus
TURN_CREDENTIAL=nexus123
EOF
    fi
    
    # Copy to actual .env if it doesn't exist
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_info "Created .env file from template. Please update with your values."
    fi
    
    print_success "Environment files ready ✅"
}

# Setup Docker environment
setup_docker_environment() {
    print_step "Setting up Docker environment..."
    
    # Create Dockerfiles if they don't exist
    if [ ! -f "frontend/Dockerfile.dev" ]; then
        cat > frontend/Dockerfile.dev << 'EOF'
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
EOF
    fi
    
    if [ ! -f "backend/Dockerfile.dev" ]; then
        cat > backend/Dockerfile.dev << 'EOF'
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
RUN npm install -g nodemon typescript ts-node
COPY . .
EXPOSE 8000 9229
CMD ["npm", "run", "dev"]
EOF
    fi
    
    if [ ! -f "ai-services/Dockerfile.dev" ]; then
        cat > ai-services/Dockerfile.dev << 'EOF'
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc g++ cmake pkg-config libffi-dev libssl-dev git curl && rm -rf /var/lib/apt/lists/*
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
EOF
    fi
    
    print_success "Docker environment configured ✅"
}

# Initialize Git repository
setup_git_repository() {
    print_step "Setting up Git repository..."
    
    if [ ! -d ".git" ]; then
        git init
        print_info "Git repository initialized"
    fi
    
    # Create .gitignore if it doesn't exist
    if [ ! -f ".gitignore" ]; then
        cat > .gitignore << 'EOF'
# Dependencies
node_modules/
__pycache__/
*.pyc

# Build outputs
dist/
build/

# Environment variables
.env
.env.local

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Uploads
data/uploads/*
!data/uploads/.gitkeep
EOF
    fi
    
    print_success "Git repository configured ✅"
}

# Install dependencies
install_dependencies() {
    print_step "Installing project dependencies..."
    
    # Install root dependencies
    print_info "Installing root dependencies..."
    npm install
    
    # Install frontend dependencies
    if [ -f "frontend/package.json" ]; then
        print_info "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    # Install backend dependencies  
    if [ -f "backend/package.json" ]; then
        print_info "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi
    
    # Install AI services dependencies
    if [ -f "ai-services/requirements.txt" ]; then
        print_info "Installing AI services dependencies..."
        cd ai-services
        
        # Create virtual environment if it doesn't exist
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        
        # Activate and install
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        cd ..
    fi
    
    print_success "Dependencies installed ✅"
}

# Start services
start_services() {
    print_step "Starting development services..."
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        print_warning "docker-compose.yml not found, creating minimal version..."
        cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nexus
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF
    fi
    
    # Start essential services
    print_info "Starting PostgreSQL and Redis..."
    docker-compose up -d postgres redis
    
    # Wait for services to be ready
    print_info "Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        print_success "Development services started ✅"
    else
        print_warning "Some services may not have started correctly"
        docker-compose ps
    fi
}

# Create initial commit
create_initial_commit() {
    print_step "Creating initial Git commit..."
    
    git add .
    git commit -m "🚀 Initial Nexus project setup

- Complete project structure
- Frontend with React + TypeScript
- Backend with Node.js + Express  
- AI services with Python + FastAPI
- Docker development environment
- Comprehensive documentation
- CI/CD pipeline configuration"
    
    print_success "Initial commit created ✅"
}

# Display final instructions
show_final_instructions() {
    echo ""
    print_success "🎉 Nexus setup completed successfully!"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo ""
    echo "1. ${YELLOW}Configure environment variables:${NC}"
    echo "   Edit .env file with your API keys and settings"
    echo ""
    echo "2. ${YELLOW}Start development servers:${NC}"
    echo "   ${GREEN}npm run dev${NC}                 # Start all services"
    echo "   ${GREEN}npm run dev:frontend${NC}        # Frontend only (port 3000)"
    echo "   ${GREEN}npm run dev:backend${NC}         # Backend only (port 8000)" 
    echo "   ${GREEN}npm run dev:ai${NC}              # AI services only (port 8001)"
    echo ""
    echo "3. ${YELLOW}Useful commands:${NC}"
    echo "   ${GREEN}npm run services:dev${NC}        # Start databases"
    echo "   ${GREEN}npm run db:migrate${NC}          # Run database migrations"
    echo "   ${GREEN}npm run test${NC}                # Run all tests"
    echo "   ${GREEN}npm run lint${NC}                # Lint all code"
    echo "   ${GREEN}npm run logs:all${NC}            # View all logs"
    echo ""
    echo "4. ${YELLOW}Access points:${NC}"
    echo "   🌐 Frontend:    ${CYAN}http://localhost:3000${NC}"
    echo "   🔧 Backend API: ${CYAN}http://localhost:8000${NC}"
    echo "   🤖 AI Services: ${CYAN}http://localhost:8001${NC}"
    echo "   📊 Grafana:     ${CYAN}http://localhost:3001${NC}"
    echo ""
    echo "5. ${YELLOW}Documentation:${NC}"
    echo "   📖 README.md - Project overview"
    echo "   📚 docs/ - Detailed documentation"
    echo "   🔗 API docs available at backend/docs when running"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
    echo ""
}

# Main execution
main() {
    print_banner
    
    echo "This script will set up the complete Nexus project environment."
    echo "It will create directories, install dependencies, and configure services."
    echo ""
    read -p "Do you want to continue? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_info "Starting Nexus setup..."
        
        check_system_requirements
        create_directory_structure  
        create_package_files
        create_environment_files
        setup_docker_environment
        setup_git_repository
        install_dependencies
        start_services
        create_initial_commit
        show_final_instructions
        
        print_success "Setup completed! 🎉"
    else
        echo "Setup cancelled."
        exit 0
    fi
}

# Handle interruption
trap 'print_error "Setup interrupted"; exit 1' INT

# Run main function
main "$@"