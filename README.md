# Remotely — Remote Control for Your Laptop

A focused remote control layer for your own laptop, powered by OpenClaw (Claude computer use).

Open the web app from your phone or any device, give your laptop a command, and watch it execute in real time — with approval gates before any dangerous action.

---

## Architecture

```
[Phone / Browser]
      │
      │  HTTP + SSE
      ▼
[Next.js :3000]          ← runs anywhere (laptop, local network)
      │
      │  HTTP polling + long-poll approval
      ▼
[agent-bridge (Python)]  ← runs on your laptop
      │
      │  Anthropic API (computer_use + bash + text_editor)
      ▼
[Your laptop's browser, filesystem, terminal]
```

**Frontend** (`apps/web/src/app/page.tsx`)
- Task input + quick-action forms
- Live log stream via SSE
- Approval modal (blocks until you tap Approve or Deny)
- Task history

**Backend** (`apps/web/src/app/api/`)
- `POST /api/tasks` — submit a new task
- `GET /api/tasks/:id/stream` — SSE stream of task updates
- `POST /api/tasks/:id/approve` / `deny` — resolve approval gate
- Bridge routes under `/api/bridge/` — bridge polls these

**Agent Bridge** (`services/agent-bridge/bridge.py`)
- Polls backend for queued tasks every 2 seconds
- Executes them using Claude API (computer_use, bash, text_editor)
- Streams log entries back to backend
- Long-polls for approval before dangerous actions
- Supports `USE_MOCK=true` for demo without API keys

---

## Setup

### 1. Frontend + Backend (Next.js)

```bash
cd apps/web
npm install
npm run dev
# Opens at http://localhost:3000
```

### 2. Agent Bridge (Python)

```bash
cd services/agent-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
# Set USE_MOCK=true for demo without real API calls

python bridge.py
```

### 3. Optional: computer use dependencies

For real browser/GUI automation:
```bash
pip install pyautogui pillow
# On Linux you may also need:
sudo apt-get install python3-tk python3-dev scrot
```

---

## How to Run a Demo

### With mock mode (no API key needed)

```bash
# Terminal 1:
cd apps/web && npm run dev

# Terminal 2:
cd services/agent-bridge
USE_MOCK=true python bridge.py
```

Open `http://localhost:3000` in your browser (or on your phone on the same network).

### Workflow A: Gradescope Submission

1. Click **Submit Gradescope** quick action
2. Fill in: Course = `CS 101`, Assignment = `Homework 3`, File = `/home/jerry/hw3.py`
3. Click **Run Task**
4. Watch the log stream in real time
5. When the approval modal appears: **Approve** to submit, or **Deny** to cancel

### Workflow B: Code Edit + Test

1. Click **Edit Code & Test**
2. Fill in: File = `src/main.py`, Change = `Fix the off-by-one error in parse_csv()`, Test = `pytest tests/`
3. Click **Run Task**
4. Review the diff in the approval modal, then Approve or Deny

### Free-text command

Type anything in the text box:
> "Open my terminal and run the lint check on src/"

---

## Task States

| State | Meaning |
|-------|---------|
| `queued` | Waiting for the bridge to pick up |
| `running` | Bridge is executing |
| `waiting_approval` | Paused — action requires your approval |
| `completed` | Finished successfully |
| `failed` | Execution error |
| `denied` | You denied an action |

---

## What Is Mocked vs Real

| Feature | Mock mode | Real mode |
|---------|-----------|-----------|
| Step delays | Simulated | Real execution time |
| Browser control | Fake logs | Claude computer_use |
| File editing | Fake diff | str_replace_editor |
| Shell commands | Fake output | Real bash subprocess |
| Approval gate | Real (always triggers) | Real (triggers on dangerous ops) |
| Test runner | Real subprocess (if file exists) | Real subprocess |

---

## Limitations

- No auth — whoever has the URL controls the laptop. Run on localhost or a trusted network only.
- In-memory state — restarting Next.js clears all task history.
- Computer use requires a display (`DISPLAY` env var on Linux).
- Only two structured workflows are implemented (Gradescope, code edit). Raw prompts work but are less reliable.
- One task runs at a time per bridge instance (by design — prevents race conditions on your laptop).

---

## Next Steps for a Reliable Demo

1. **Test the full Gradescope flow** end-to-end with a real file and real login session in Chrome.
2. **Tune the Gradescope prompt** to match the actual Gradescope UI (button labels, layout).
3. **Add a demo seed task** button that pre-fills realistic params so a demo can start in under 10 seconds.
4. **Add task cancellation** (POST /api/tasks/:id/cancel) so you can kill stuck tasks.
5. **Expose on local network** by binding Next.js to `0.0.0.0` and accessing from a phone: `HOST=0.0.0.0 npm run dev`.
6. **Screenshot attachment** — stream the current screenshot from the bridge into the log panel.

---

## Project Structure

```
hackathon/
├── apps/web/                       # Next.js frontend + API
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Main UI (single page)
│       │   └── api/
│       │       ├── tasks/          # User-facing task API
│       │       └── bridge/         # Bridge-facing internal API
│       └── lib/
│           ├── types.ts            # Shared TypeScript types
│           └── store.ts            # In-memory task store + EventEmitter
└── services/agent-bridge/
    ├── bridge.py                   # Main bridge loop (polling + dispatch)
    ├── executor.py                 # MockExecutor + RealExecutor (Claude API)
    ├── workflows/
    │   ├── gradescope.py           # Gradescope submit workflow
    │   └── code_edit.py            # Code edit + test workflow
    └── prompts/
        ├── gradescope.md           # System prompt for Gradescope agent
        └── code_edit.md            # System prompt for code edit agent
```
