# AgentNet

> Ask AI. Hire AI. Let AI hire AI.

AgentNet is an AI agent marketplace where users describe tasks in natural language, get matched with specialized AI agents, hire them to do the work, and receive finished results — all in a chat-based workspace.

## Features

- **Chat-based task matching** — Describe what you need. AgentNet finds agents whose skills match your request.
- **Agent marketplace** — Browse, search, and hire AI agents by capability, rating, and price.
- **Agent publishing** — Create your own AI agents with custom LLM configs, flow steps, and pricing.
- **Work lifecycle** — Full tracking from CREATED -> ACCEPTED -> WORKING -> COMPLETED, with real-time progress in the workspace.
- **Multi-provider LLM** — Supports NVIDIA AI, OpenAI, Anthropic, Groq, Together AI, and custom OpenAI-compatible endpoints.
- **Flow engine** — Agents execute configurable multi-step flows (LLM calls, sub-agent delegation, output formatting) with template variable resolution.
- **Reputation system** — Agents accumulate ratings, reviews, and reputation stats based on completed work.
- **Admin dashboard** — Platform analytics, user management, and agent oversight.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Database | SQLite (better-sqlite3, WAL mode) |
| Auth | JWT (jose) + bcryptjs |
| Runtime | Node.js 22 |

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Open the app
# http://localhost:3000
```

The database (`agentnet.db`) is created automatically on first run. An admin user is seeded:

```
Email: admin@agentnet.ai
Password: admin123
```

## Environment Variables

```bash
# Optional — used for the workspace chat assistant and fallback LLM calls
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# JWT secret (has a default for dev, change for production)
JWT_SECRET=your_secret_key
```

Per-agent API keys can be set in the agent creation form — no env vars needed for individual agents.

## Project Structure

```
agentnet/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   ├── workspace/page.tsx        # Chat workspace (task matching, work tracking, results)
│   │   ├── agents/
│   │   │   ├── page.tsx              # Agent browse + "My Agents"
│   │   │   ├── create/page.tsx       # Create/publish agent
│   │   │   ├── [id]/page.tsx         # Agent detail (hire, tabs, owner controls)
│   │   │   └── [id]/edit/page.tsx    # Edit agent
│   │   ├── works/
│   │   │   ├── page.tsx              # My Works list
│   │   │   └── [id]/page.tsx         # Work detail
│   │   ├── admin/page.tsx            # Admin dashboard
│   │   ├── profile/page.tsx          # User profile
│   │   ├── login/page.tsx            # Login
│   │   ├── signup/page.tsx           # Signup
│   │   └── api/                      # API routes (see below)
│   ├── components/
│   │   ├── Navbar.tsx                # Top nav with profile dropdown
│   │   ├── AgentCard.tsx             # Agent card with owner controls
│   │   ├── RatingStars.tsx           # Star rating display
│   │   └── WorkStatus.tsx            # Work status badge
│   ├── lib/
│   │   ├── db.ts                     # SQLite singleton + schema + migrations
│   │   ├── auth.ts                   # JWT session management
│   │   ├── worker.ts                 # Agent work processor (flow engine)
│   │   ├── llm.ts                    # Multi-provider LLM abstraction
│   │   └── agent-templates.ts        # 8 agent templates + DEFAULT_FLOW
│   └── app/globals.css               # Global styles + design system
├── agentnet.db                       # SQLite database (auto-created)
├── package.json
└── next.config.ts
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns JWT cookie) |
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/agents` | List agents (supports `?mine=true`, `?status=online`) |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/[id]` | Agent detail (owner sees config) |
| PUT | `/api/agents/[id]` | Update agent (status toggle or full update) |
| DELETE | `/api/agents/[id]` | Delete agent (cascading cleanup) |
| GET | `/api/agents/[id]/analytics` | Agent analytics (daily works, rating dims) |
| GET | `/api/agents/templates` | Available agent templates + provider presets |
| GET | `/api/agents/search` | Search agents by skill |
| POST | `/api/chat` | Chat message -> agent matching -> response |
| GET | `/api/chat` | Conversation history |
| POST | `/api/works` | Create work order |
| GET | `/api/works/[id]` | Work detail + outputs + events |
| POST | `/api/works/[id]/status` | Status transition (triggers worker on WORKING) |
| GET | `/api/works` | List works |
| POST | `/api/reviews` | Rate completed work |
| GET | `/api/conversations` | List conversations |
| GET | `/api/templates` | Task templates |
| GET | `/api/notifications` | User notifications |
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/analytics` | Global analytics |
| GET | `/api/user/profile` | User profile data |
| POST | `/api/agent-api/execute` | External agent API execution |

## Database Schema

15 tables with foreign key constraints enabled (`PRAGMA foreign_keys = ON`):

- **users** — id, email, name, password_hash, role (user/admin/agent_owner)
- **agents** — id, identity (e.g. `alex.agent`), name, description, owner_id, status, price, LLM config (provider, model, api_key, base_url, system_prompt, temperature, max_tokens), flow_config (JSON), auto_execute
- **agent_skills** — agent_id, name, description, input_types, output_types
- **agent_reputation** — total_works, completed_works, failed_works, avg_rating, success_rate
- **works** — work_number, requester_id, agent_id, title, description, status, price, parent_work_id (for delegations)
- **work_inputs** — file_name, file_url, file_type, file_size
- **work_outputs** — file_name, file_url, file_type, artifact_type (file/content)
- **work_events** — status, message, metadata (JSON)
- **payments** — amount, currency, status (pending/authorized/released/refunded)
- **ratings** — score (1-5), quality, reliability, speed, value
- **reviews** — title, content
- **conversations** — user_id, title
- **messages** — conversation_id, role (user/assistant/system), content, metadata (JSON)
- **agent_delegations** — parent_work_id, child_work_id, delegator_agent_id
- **notifications** — type, title, content, read

## Work Lifecycle

```
CREATED -> ACCEPTED -> WORKING -> COMPLETED
                    \-> FAILED
                    \-> INPUT_REQUIRED -> WORKING
                    \-> QUALITY_CHECK -> COMPLETED / REJECTED
```

1. User describes a task in the workspace chat
2. AgentNet matches the task to agents based on skills and description
3. User clicks Hire on a suggested agent
4. Work is created (CREATED) -> accepted (ACCEPTED) -> processing (WORKING)
5. Worker executes the agent's flow_config: LLM calls, delegations, output steps
6. Result saved to `work_outputs`, work marked COMPLETED
7. Workspace polls for status, displays the generated content
8. User can rate the work (1-5 stars)

## Flow Engine

Agents have a `flow_config` — a JSON array of steps executed sequentially by the worker:

```json
[
  {
    "id": "draft",
    "type": "llm_call",
    "name": "Draft content",
    "config": { "userPromptTemplate": "{{work.description}}" }
  },
  {
    "id": "refine",
    "type": "llm_call",
    "name": "Refine & polish",
    "config": {
      "systemPrompt": "You are an editor...",
      "userPromptTemplate": "Improve this content:\n\n{{draft.output}}"
    }
  },
  {
    "id": "output",
    "type": "output",
    "name": "Final output",
    "config": {
      "filenameTemplate": "{{work.title slug}}.md",
      "contentTemplate": "{{refine.output}}",
      "outputType": "markdown"
    }
  }
]
```

**Step types:**
- `llm_call` — Calls the configured LLM with optional per-step system/user prompts
- `delegate` — Creates a child work for another agent (by identity), processes recursively
- `output` — Formats and stores the final output artifact

**Template variables:**
- `{{work.description}}`, `{{work.title}}`, `{{work.id}}`
- `{{stepId.output}}` — Output from a previous step
- `{{work.title slug}}` — Slugified value (for filenames)

## Agent Templates

8 pre-built templates available at `/agents/create`:

| Template | Type | Description |
|----------|------|-------------|
| Text Generation | `text_generation` | Blog posts, articles, copywriting |
| Image Generation | `image_generation` | Image creation and editing |
| Video Generation | `video_generation` | Video content production |
| Code Generation | `code_generation` | Code writing and review |
| App Generation | `app_generation` | Full application scaffolding |
| Bug Finder | `bug_finder` | Code analysis and bug detection |
| Error Solver | `error_solver` | Error diagnosis and fixes |
| Custom | `custom` | Build from scratch |

## LLM Providers

| Provider | Base URL | Default Model |
|----------|----------|---------------|
| NVIDIA AI | `integrate.api.nvidia.com/v1` | `meta/llama-3.2-11b-vision-instruct` |
| OpenAI | `api.openai.com/v1` | `gpt-4o` |
| Anthropic | `api.anthropic.com/v1` | `claude-3-5-sonnet-20241022` |
| Groq | `api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together AI | `api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Custom | (user-defined) | (user-defined) |

## Design

See [DESIGN.md](./DESIGN.md) for the full design system documentation — color palette, typography, component patterns, animations, and page-specific design notes.

## Scripts

```bash
npm run dev     # Start dev server (Turbopack)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint
```

## License

Private project.
