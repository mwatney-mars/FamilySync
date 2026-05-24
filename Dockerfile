# ==========================================
# Estágio 1: Build do Frontend React PWA
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copiar dependências do frontend e instalar
COPY frontend/package*.json ./
RUN npm install

# Copiar código do frontend e compilar para produção (dist)
COPY frontend/ ./
RUN npm run build

# ==========================================
# Estágio 2: Setup e Execução do Backend
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app/backend

# Configurar variáveis de ambiente de produção
ENV NODE_ENV=production
ENV PORT=5000

# Copiar dependências do backend e instalar
COPY backend/package*.json ./
RUN npm install --only=production

# Copiar código-fonte do backend
COPY backend/ ./

# Copiar os arquivos estáticos compilados do frontend do Estágio 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expor a porta unificada do servidor
EXPOSE 5000

# Comando para iniciar o app unificado
CMD ["npm", "start"]
