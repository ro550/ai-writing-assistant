# AI Writing Assistant

A full-stack web app that generates blog posts, emails and social media posts from a short brief. You choose the tone and length, refine the result through follow-up messages, regenerate it with different settings, and save drafts to a database.

## Project overview

The React frontend sends your brief to an Express API. The API builds a prompt for the chosen content type, tone and length, and calls an LLM provider through a single wrapper (`llm.js`). Every generation starts a conversation that is stored in SQLite, so follow-up messages ("make it shorter", "add a call to action") are answered with the full history. Drafts are saved to the same database and can be reopened later.

```text
React (Vite)  ──►  Express API  ──►  llm.js wrapper  ──►  Gemini / Anthropic / OpenAI
                        │
                    SQLite (drafts, conversations, messages)
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, plain CSS |
| Backend | Node.js, Express, CORS, dotenv |
| Database | SQLite through `better-sqlite3` (a single file, no server needed) |
| LLM providers | Google Gemini (`@google/genai`), Anthropic (`@anthropic-ai/sdk`), OpenAI (`openai`) |
| Tooling | nodemon (auto-restart in development), uuid (IDs) |

## Features

- **Content generation:** blog posts, emails and social media posts from a topic or brief.
- **Tone selection:** formal, casual or persuasive.
- **Length control:** short (about 150-250 words), medium (about 400-600) or long (about 800-1200).
- **Regenerate:** produce a new version with the same settings, or change the settings first.
- **Conversation history:** refine the content with follow-up messages. The server keeps the whole conversation, so each reply builds on the earlier ones.
- **Save drafts:** save generated content with its title, type, tone, topic, provider and token count. Browse, preview and delete drafts from the Saved Drafts tab.
- **Export and copy:** download the content as Markdown or copy it to the clipboard.
- **Resilient API calls:** temporary provider errors (429, 503, 529) are retried automatically with backoff. If the provider is still busy, the app shows a clear "AI service is busy" message instead of a generic failure.

## Project structure

```text
ai-writing-assistant/
├── client/                  React frontend (Vite)
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       └── components/
│           ├── GenerateForm.jsx
│           ├── ContentDisplay.jsx
│           ├── ChatPanel.jsx
│           └── DraftList.jsx
└── server/                  Express API
    ├── server.js            routes, validation, retry and error handling
    ├── llm.js               provider wrapper (Gemini, Anthropic, OpenAI)
    ├── prompts.js           prompt templates, tone and length settings
    ├── db.js                SQLite schema and prepared statements
    └── .env.example         environment variable template
```

## Setup

### Prerequisites

- Node.js 18 or newer (with npm)
- An API key for at least one provider: Gemini, Anthropic or OpenAI

### 1. Clone and install

```bash
git clone https://github.com/ro550/ai-writing-assistant
cd ai-writing-assistant

cd server
npm install

cd ../client
npm install
```

### 2. Configure the server

Copy the example file and add your key:

```bash
cd server
cp .env.example .env
```

Then edit `server/.env`:

```env
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
DEFAULT_LLM_PROVIDER=gemini
PORT=3001
```

- You only need the key for the provider you use. Leave the others empty.
- `DEFAULT_LLM_PROVIDER` is `gemini`, `anthropic` or `openai`.
- Never commit `.env`. It is listed in `.gitignore`.

The SQLite database file (`server/writing-assistant.db`) is created automatically the first time the server starts. It is not part of the repository.

## Run

Start the backend and the frontend in two separate terminals.

**Terminal 1: API (http://localhost:3001)**

```bash
cd server
npm run dev      # auto-restarts on changes
# or: npm start
```

**Terminal 2: frontend (http://localhost:5173)**

```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser. The server terminal prints each request (method, URL, status, time), which makes it easy to confirm the frontend is reaching the API.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/generate` | Generate content (also used to regenerate). Body: `topic`, `contentType` (`blog`, `email`, `social`), `tone` (`formal`, `casual`, `persuasive`), `length` (`short`, `medium`, `long`), optional `provider` |
| POST | `/api/chat` | Refine content. Body: `conversationId`, `message`, optional `contentType`, `tone`, `provider` |
| GET | `/api/drafts` | List saved drafts |
| GET | `/api/drafts/:id` | Get one draft and its linked conversation |
| POST | `/api/drafts` | Save a draft. Body: `title`, `content`, `contentType`, `tone`, `topic`, optional `provider`, `model`, `tokensUsed`, `conversationId` |
| PATCH | `/api/drafts/:id` | Update a draft's content |
| DELETE | `/api/drafts/:id` | Delete a draft |

Errors return JSON as `{ "error": "message" }`. A busy provider returns status 503 with `"retryable": true`.

## How to test

The project has no automated test suite, so testing is done by calling the API directly and then walking through the app.

### 1. Check the backend

With the server running:

```bash
# Health check: expect {"status":"ok"}
curl http://localhost:3001/api/health

# Validation: expect 400 and an "Invalid content type" error
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"SACCO benefits","contentType":"poem"}'

# Generate: expect 200 with content, conversationId, topic, contentType, tone and length
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"Benefits of joining a SACCO","contentType":"email","tone":"formal","length":"short"}'

# Refine: use the conversationId from the previous response
curl -s -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"<id>","message":"Make it shorter","contentType":"email","tone":"formal"}'

# Drafts: list them
curl http://localhost:3001/api/drafts
```

If generation returns 503, the provider is overloaded. The server retries three times before giving up, so wait a minute and try again.

### 2. Walk through the app against the requirements

| # | Requirement | What to do | Expected result |
|---|---|---|---|
| 1 | Content generation | Enter a topic, then generate once for each type: blog post, email, social post | Content matches the type: a blog has a headline and subheadings, an email has a subject line, a social post has hashtags |
| 2 | Tone selection | Generate the same topic as formal, casual and persuasive | The writing style visibly changes with each tone |
| 3 | Length control | Generate the same topic as short, medium and long | Output length increases from short to long |
| 4 | Regenerate | Click Regenerate with the same settings, then change the tone and regenerate | A new version appears each time, with the new settings applied |
| 5 | Conversation history | Send "make it shorter", then "now add a call to action" | The second reply keeps the shortened version and adds the call to action |
| 6 | Save drafts | Save a draft, open the Saved Drafts tab, select it, then reload the page | The draft is listed with the right type and tone, shows its content, and survives a reload |

Also check these:

- A saved draft shows the correct content type and tone, not the defaults.
- Deleting a draft removes it from the list, and it stays gone after a reload.
- With the topic field empty, the Generate button is disabled.
- Resize the browser to phone width: the layout stacks and nothing scrolls sideways.

### 3. Reset test data

Stop the server and delete `server/writing-assistant.db` (and any `-wal` and `-shm` files next to it). A fresh database is created on the next start.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| "Failed to generate content" | Check the server terminal for the real error. Common causes are a missing or invalid API key, an unsupported model name, or an account without credits. |
| "The AI service is busy right now" | The provider returned a temporary 503 or 429. Wait a moment and retry. |
| Frontend loads but nothing saves | The API is not running, or it is on a different port than the frontend expects. Check `http://localhost:3001/api/health`. |
| Port already in use | Change `PORT` in `server/.env` and update the API address in the client. |