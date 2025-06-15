# nexus
# 🚀 Nexus - Teleconferencia Inteligente

## 📁 Estructura del Proyecto

```
nexus/
├── 📁 frontend/                 # React + TypeScript
│   ├── 📁 public/
│   ├── 📁 src/
│   │   ├── 📁 components/       # Componentes React
│   │   ├── 📁 hooks/           # Custom hooks
│   │   ├── 📁 services/        # API calls
│   │   ├── 📁 store/           # Redux store
│   │   ├── 📁 types/           # TypeScript definitions
│   │   ├── 📁 utils/           # Utilities
│   │   └── 📁 pages/           # Page components
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── 📁 backend/                  # Node.js + Express + TypeScript
│   ├── 📁 src/
│   │   ├── 📁 controllers/     # Route controllers
│   │   ├── 📁 middleware/      # Express middleware
│   │   ├── 📁 models/          # Database models
│   │   ├── 📁 routes/          # API routes
│   │   ├── 📁 services/        # Business logic
│   │   ├── 📁 utils/           # Utilities
│   │   ├── 📁 websocket/       # WebSocket handlers
│   │   └── 📁 mcp/             # MCP protocol
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── 📁 ai-services/              # Python + FastAPI
│   ├── 📁 transcription/       # Whisper service
│   ├── 📁 summary/             # Resumen inteligente
│   ├── 📁 analytics/           # Análisis de reuniones
│   ├── 📁 shared/              # Código compartido
│   │   ├── 📁 mcp/             # MCP client
│   │   └── 📁 models/          # ML models
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📁 infrastructure/           # DevOps & Infrastructure
│   ├── 📁 docker/              # Docker configs
│   ├── 📁 kubernetes/          # K8s manifests
│   ├── 📁 terraform/           # Infrastructure as Code
│   └── 📁 scripts/             # Setup scripts
│
├── 📁 docs/                     # Documentación
│   ├── 📁 api/                 # API documentation
│   ├── 📁 architecture/        # Diagramas de arquitectura
│   └── 📁 deployment/          # Guías de deployment
│
├── 📁 .github/                  # GitHub workflows
│   └── 📁 workflows/           # CI/CD pipelines
│
├── docker-compose.yml           # Desarrollo local
├── docker-compose.prod.yml      # Producción
├── .env.example                 # Variables de entorno
├── .gitignore                   # Git ignore
├── README.md                    # Documentación principal
└── package.json                 # Root package.json
```

## 🎯 Comandos de Setup

```bash
# 1. Clonar tu repositorio
git clone https://github.com/fmonfasani/nexus.git
cd nexus

# 2. Crear la estructura de carpetas
mkdir -p frontend/src/{components,hooks,services,store,types,utils,pages}
mkdir -p frontend/public
mkdir -p backend/src/{controllers,middleware,models,routes,services,utils,websocket,mcp}
mkdir -p ai-services/{transcription,summary,analytics,shared/{mcp,models}}
mkdir -p infrastructure/{docker,kubernetes,terraform,scripts}
mkdir -p docs/{api,architecture,deployment}
mkdir -p .github/workflows

# 3. Ejecutar el setup automático (lo crearemos)
npm run setup

# 4. Iniciar el desarrollo
docker-compose up -d
```

## 🔧 Stack Tecnológico

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** + **Material-UI**
- **Redux Toolkit** (estado)
- **Socket.io-client** (WebSocket)
- **Simple-peer** (WebRTC)

### Backend
- **Node.js 20** + **TypeScript**
- **Express** + **Helmet** (seguridad)
- **Socket.io** (WebSocket)
- **PostgreSQL** + **Prisma ORM**
- **Redis** (cache/sessions)
- **JWT** (autenticación)

### AI Services
- **Python 3.11** + **FastAPI**
- **Whisper** (transcripción)
- **Transformers** (HuggingFace)
- **TensorFlow/PyTorch**
- **Kafka** (messaging)

### Infrastructure
- **Docker** + **Docker Compose**
- **PostgreSQL 15**
- **Redis 7**
- **Nginx** (reverse proxy)
- **Prometheus** + **Grafana** (monitoring)

## 🚀 Próximos Pasos

1. **Copiar todos los archivos** que te voy a generar
2. **Ejecutar setup inicial** con Docker
3. **Verificar que todo funciona**
4. **Empezar desarrollo iterativo**

¿Listo para que empiece a crear todos los archivos? 🎯
