# Atome Card Support Bot

A full-stack AI-powered customer service bot for Atome Card, built with:
- **Backend**: Python + FastAPI + SQLite
- **Frontend**: React
- **AI**: Claude (Anthropic)
- **Deployment**: Docker Compose

---

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose installed
- An Anthropic API key

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Build and run
```bash
docker compose up --build
```

### 4. Open the app
- **Frontend**: http://localhost:3000
- **Backend API docs**: http://localhost:8000/docs

---

## Features

### 💬 Chat
- AI-powered responses using Atome Card knowledge base
- Handles card application status queries (calls mock `getApplicationStatus`)
- Handles failed transaction queries (calls mock `getTransactionStatus`)
- Each bot response has a "report incorrect answer" button

### ⚙️ Config
- Edit knowledge base URL (affects bot immediately, no restart needed)
- Edit bot guidelines and behavior instructions
- Full CRUD for custom workflows (trigger → action mappings)
- Enable/disable individual workflows

### ⚑ Mistakes
- View all reported incorrect answers
- See: original question, bot's answer, expected correction
- **Auto-Fix**: applies correction directly to bot guidelines
- Archive mistakes for reference

### 📋 Logs
- Full audit log of all bot interactions
- Stats dashboard: total interactions, accuracy rate, pending mistakes, auto-fixes

---

## Architecture

```
atome-bot/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLite setup & seed data
│   ├── schemas.py           # Pydantic request/response models
│   ├── mock_functions.py    # Replaceable mock API functions
│   ├── routers/
│   │   ├── chat.py          # POST /api/chat — AI conversation
│   │   ├── config.py        # GET/PUT /api/config
│   │   ├── workflows.py     # CRUD /api/workflows
│   │   ├── mistakes.py      # CRUD /api/mistakes + fix endpoint
│   │   └── logs.py          # GET /api/logs + stats
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.js           # Root component + nav
│   │   ├── api/client.js    # Axios API client
│   │   └── components/
│   │       ├── UI.js        # Shared UI primitives
│   │       ├── ChatTab.js
│   │       ├── ConfigTab.js
│   │       ├── MistakesTab.js
│   │       └── LogsTab.js
│   ├── nginx.conf           # Reverse proxy to backend
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message, get AI reply |
| GET | `/api/config` | Get bot configuration |
| PUT | `/api/config` | Update bot configuration |
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows` | Create workflow |
| PATCH | `/api/workflows/{id}` | Update workflow |
| DELETE | `/api/workflows/{id}` | Delete workflow |
| GET | `/api/mistakes` | List mistakes (`?archived=true` for archived) |
| POST | `/api/mistakes` | Report a mistake |
| POST | `/api/mistakes/{id}/fix` | Apply auto-fix |
| DELETE | `/api/mistakes/{id}/archive` | Archive a mistake |
| GET | `/api/logs` | List interaction logs |
| GET | `/api/logs/stats` | Get stats |

---

## Replacing Mock Functions

The mock functions in `backend/mock_functions.py` are designed to be easily swapped:

```python
# Current mock:
async def get_application_status(customer_id: str) -> dict:
    ...

# Replace with real API:
async def get_application_status(customer_id: str) -> dict:
    response = await httpx.get(f"https://api.atome.ph/cards/application/{customer_id}")
    return response.json()
```

No other code needs to change — the router calls these functions directly.

---

## Development (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
ANTHROPIC_API_KEY=your_key python main.py
```

**Frontend:**
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```
