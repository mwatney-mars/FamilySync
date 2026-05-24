# FamilySync ✨

> ⚠️ **Disclaimer:** Este aplicativo é focado em privacidade, totalmente *self-hosted* e projetado exclusivamente para uso familiar único e privado.

O **FamilySync** é um portal residencial de gerenciamento familiar projetado em estética **Dark Glassmorphism** ultra-moderna. Ele combina uma lista de compras cooperativa e inteligente, rotinas de afazeres gamificadas com privacidade isolada, agendamento de medicamentos assistido por IA e um Modo Geladeira dedicado para displays de parede (*Smart Home Wall Dashboards*).

---

## 🚀 Funcionalidades Principais

*   🛒 **Despensa & Compras por IA (Gemini)**: Classificação e categorização de itens em tempo real utilizando o modelo `gemini-2.5-flash` integrado a um fluxo *Cache-First* no IndexedDB local (0ms) e arrastar e soltar (*Drag & Drop*) nativo fluido.
*   🔒 **Controle de Acesso por Papel (RBAC)**: Separação física de privilégios entre Administrador (gestão total, gerenciamento de membros, redefinição de senhas, backups e IA) e Membro Comum.
*   🛡️ **Isolamento de Rotinas & Privacidade**: Membros comuns visualizam apenas as tarefas destinadas a eles ou marcadas para "Toda a Família". Apenas Administradores têm visão de radar de todas as tarefas da casa.
*   💊 **Agendamento Inteligente de Medicamentos**: Painel de cascata assistida. Defina a quantidade de doses diárias (ex: a cada 8h) e a duração do tratamento em dias, e o sistema agenda de forma autônoma todas as tarefas.
*   💾 **Central de Backups (Disaster Recovery)**: Exportação e importação transacional segura de dados da família em formato JSON, além de um sistema de backups locais automáticos e rotativos no IndexedDB (mantendo até 3 snapshots recentes).
*   🔔 **Notificações SSE & Chime de Áudio**: Sincronização em tempo real entre todos os dispositivos da casa por Server-Sent Events (SSE), com alerta push do sistema operacional e um toque sonoro lúdico gerado de forma programática por Web Audio API (0 bytes de download!).
*   📺 **Modo Geladeira (Smart Home Wall Dashboard)**: Central de parede otimizada para tablets domésticos com relógio digital segundo a segundo, saudações sazonais baseadas no horário, caixa de adição rápida integrada à IA e *premium empty states* artísticos.
*   🧹 **Registro Fechado (Hardening)**: Registro público suspenso (`403 Forbidden`) para máxima segurança contra acessos externos. Os integrantes são cadastrados manualmente pelo administrador da família.

---

## 🐳 Inicialização Rápida (Docker)

A forma recomendada de executar o FamilySync em produção é através do Docker Compose, garantindo isolamento total e persistência segura.

### 1. Criar o arquivo `docker-compose.yml`

```yaml
version: '3.8'

services:
  familysync:
    image: gutolm/familysync:latest
    container_name: familysync-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - DATABASE_PATH=/data/familysync.db
      - JWT_SECRET=FamilySyncSecretKey_SuperSecure123! # Altere para uma chave forte e secreta!
    volumes:
      - familysync-data:/data

volumes:
  familysync-data:
    driver: local
```

### 2. Rodar o container

```bash
docker compose up -d
```

Acesse a interface em seu navegador: **`http://YOUR_SERVER_IP:5000`**
*   **Login de Primeiro Acesso**: Nome de Usuário: `admin` / Senha: `admin`
*   *Recomendamos fortemente acessar as Configurações > Meu Perfil e alterar o nome de usuário e a senha imediatamente após o primeiro acesso!*

---

## 🛠️ Instalação Manual (Desenvolvimento)

Caso queira executar o ambiente de desenvolvimento local diretamente em sua máquina:

### Requisitos
*   [Node.js](https://nodejs.org/) v20 ou superior.
*   [NPM](https://www.npmjs.com/) v10 ou superior.

### Passos para Inicialização

1.  **Clonar o repositório:**
    ```bash
    git clone https://github.com/mwatney-mars/FamilySync.git
    cd FamilySync
    ```

2.  **Configurar Variáveis de Ambiente:**
    Crie o arquivo `.env` na pasta raiz baseando-se no `.env.example`:
    ```env
    PORT=5000
    DATABASE_PATH=./backend/familysync.db
    JWT_SECRET=SuaChaveUltraSecretaAqui
    ```

3.  **Instalar dependências e iniciar o Backend:**
    ```bash
    cd backend
    npm install
    npm run dev
    ```

4.  **Instalar dependências e iniciar o Frontend (Vite):**
    Abra outro terminal:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---

## ☁️ Acesso Externo Seguro

O FamilySync é projetado para operar dentro da sua rede local (LAN). Para acessá-lo fora de casa sem expor portas no seu roteador, recomendamos utilizar o Cloudflare Tunnels (Zero Trust). Um passo a passo completo de configuração de rotas e segurança de túneis está detalhado em [CLOUD.md](CLOUD.md).

---

## 📜 Créditos & Atribuições de Terceiros

O **FamilySync** é construído utilizando excelentes bibliotecas, APIs e tecnologias de código aberto:

*   **Inteligência Artificial:** API do [Google Gemini](https://ai.google.dev/) com o modelo `gemini-2.5-flash` para processamento semântico offline-first e classificação de compras.
*   **Banco de Dados Local:** [Dexie.js](https://dexie.org/) por **Nikolas Dahlby** para encapsular de forma robusta e transacional o IndexedDB do navegador.
*   **Persistência de Produção:** [SQLite](https://www.sqlite.org/) integrado de forma otimizada com o driver assíncrono em Node.js.
*   **Comunicação em Tempo Real:** Mecanismo nativo de [Server-Sent Events (SSE)](https://developer.mozilla.org/pt-BR/docs/Web/API/Server-sent_events) para propagação imediata de eventos familiares.
*   **Áudio Sintetizado:** [Web Audio API](https://developer.mozilla.org/pt-BR/docs/Web/API/Web_Audio_API) nativa do navegador para a geração do som de notificação (Chime) sob demanda sem downloads extras.
*   **Frontend Core:** Escrito em [React 19](https://react.dev/), compilado com [Vite](https://vite.dev/) e tipado em [TypeScript](https://www.typescriptlang.org/).
*   **Estética & Iconografia:** Desenvolvido em Vanilla CSS customizado, com ícones modernos fornecidos pela coleção [Lucide React](https://lucide.dev/).

Obrigado a todos os desenvolvedores e mantenedores dessas ferramentas fantásticas!
