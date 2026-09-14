# AgentNet Design System

## Overview

AgentNet uses a dark-first design language built on a violet-to-fuchsia gradient accent system over deep charcoal backgrounds. The aesthetic combines glassmorphism, subtle mesh gradients, and smooth micro-interactions to create a premium, modern feel.

---

## Color Palette

### Base Colors (CSS Variables)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#09090b` | Page background |
| `--foreground` | `#fafafa` | Primary text |
| `--card` | `#18181b` | Card surfaces |
| `--secondary` | `#27272a` | Muted surfaces, inputs |
| `--muted-foreground` | `#a1a1aa` | Secondary text |
| `--border` | `#27272a` | Borders, dividers |
| `--primary` | `#6366f1` | Indigo accent (global) |
| `--success` | `#22c55e` | Success states |
| `--warning` | `#eab308` | Warning states |
| `--danger` | `#ef4444` | Error states |

### Workspace Gradient System

The workspace uses a violet-to-fuchsia gradient as its primary accent, distinct from the global indigo:

| Purpose | Value |
|---------|-------|
| Gradient start | `#8b5cf6` (violet) |
| Gradient mid | `#d946ef` (fuchsia) |
| Gradient end | `#ec4899` (pink) |
| Mesh background | `#0a0a0f` with radial overlays |
| Glass surface | `rgba(24, 24, 27, 0.6)` + `blur(16px)` |

### Work Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Created | Slate | `#94a3b8` |
| Accepted | Blue | `#60a5fa` |
| Working | Amber | `#fbbf24` |
| Completed | Green | `#34d399` |
| Failed | Red | `#f87171` |
| Cancelled | Slate | `#94a3b8` |

---

## Typography

- **Font Stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`
- **Antialiasing**: Enabled via `-webkit-font-smoothing: antialiased`

| Element | Size | Weight |
|---------|------|--------|
| Hero heading | `text-3xl` (30px) | `font-bold` (700) |
| Section heading | `text-lg` (18px) | `font-semibold` (600) |
| Card heading | `text-sm` (14px) | `font-medium` (500) |
| Body text | `text-sm` (14px) | `normal` (400) |
| Label/caption | `text-xs` (12px) | `font-medium` (500) |
| Micro label | `text-[10px]` (10px) | `font-medium` (500) |

---

## Component Patterns

### Glassmorphism Card (`.glass`)

Semi-transparent surface with backdrop blur. Used for chat message bubbles, work progress cards, and result displays.

```
background: rgba(24, 24, 27, 0.6)
backdrop-filter: blur(16px)
border: 1px solid rgba(255, 255, 255, 0.06)
border-radius: 1rem (16px)
```

### Gradient Border Card (`.gradient-border`)

A glassmorphism card with a subtle gradient border applied via pseudo-element masking. Used for agent suggestion cards in the workspace.

```
border gradient: 135deg, rgba(139, 92, 246, 0.4) -> rgba(217, 70, 239, 0.2) -> transparent
```

### Gradient Buttons

Primary action buttons use a violet-to-fuchsia gradient background with white text:

```
background: linear-gradient(135deg, #8b5cf6, #d946ef)
color: white
hover: opacity(0.9) + scale(1.02)
```

### Gradient Text (`.gradient-text`)

Used for emphasis in headings. Clips a gradient as text fill:

```
background: linear-gradient(135deg, #8b5cf6, #d946ef, #ec4899)
-webkit-background-clip: text
-webkit-text-fill-color: transparent
```

### Status Pills & Badges

Small rounded pills with colored dot indicator. Used for agent status (online/offline), work status, and skill tags.

- Online: green dot + green text
- Offline: muted dot + muted text
- Skill tags: `bg-white/5` + `text-muted-foreground`

---

## Animations

| Class | Duration | Description |
|-------|----------|-------------|
| `.animate-fade-in` | 0.3s | Opacity + translateY(8px) fade in |
| `.animate-slide-up` | 0.4s | Larger slide-up entrance |
| `.animate-msg-in` | 0.35s | Message bubble entrance with scale |
| `.animate-pulse-dot` | 1.5s | Pulsing opacity for status dots |
| `.orb-glow` | 3s | Pulsing scale + glow for hero orb |
| `.shimmer` | 2s linear | Progress bar shimmer effect |
| `.chip-hover` | 0.2s | Suggestion chip lift on hover |
| `.input-glow:focus-within` | instant | Ring + shadow on input focus |

### Easing

- Entrances: `cubic-bezier(0.22, 1, 0.36, 1)` (smooth decel)
- Hover: `ease` / `transition-all`
- Shimmer: `linear`

---

## Layout System

### Page Structure

```
┌───────────────────────────────────────────┐
│  Navbar (fixed, h-16, backdrop-blur)      │
├──────────┬────────────────────────────────┤
│          │                                │
│ Sidebar  │  Main content area              │
│ (w-64)   │  (max-w-3xl, centered)         │
│          │                                │
│ History  │  Messages / Empty state         │
│ Links    │                                │
│          │                                │
├──────────┤  Input bar (floating, glass)   │
└──────────┴────────────────────────────────┘
```

### Spacing Scale

| Token | Value |
|-------|-------|
| `gap-1` | 4px |
| `gap-2` | 8px |
| `gap-3` | 12px |
| `gap-4` | 16px |
| `gap-5` | 20px |
| `gap-6` | 24px |

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons / pills | `rounded-lg` (8px) or `rounded-xl` (12px) |
| Cards | `rounded-xl` (12px) or `rounded-2xl` (16px) |
| Avatars | `rounded-lg` (8px) or `rounded-full` |
| Input | `rounded-2xl` (16px) |

---

## Page-Specific Design

### Landing Page (`/`)

- Full-screen hero with gradient mesh background
- Agent showcase grid (3 columns)
- Provider CTA section with 3-step cards
- Final dual-CTA section

### Workspace (`/workspace`)

- Mesh background (`#0a0a0f` + radial gradients)
- Left sidebar: conversation history + quick links
- Center: chat messages or empty state
- Empty state: animated orb + gradient heading + 4 suggestion chips
- User messages: right-aligned gradient bubbles
- Assistant messages: left-aligned glassmorphism cards with gradient avatar
- Agent suggestions: gradient-border cards with skill pills + gradient Hire button
- Work progress: timeline card with shimmer bar (Queued -> Accepted -> Generating)
- Results: document card with green checkmark header, markdown content, download button, star rating
- Input: floating glassmorphism bar with gradient send button + focus glow

### Agent Browse (`/agents`)

- Search bar + grid of agent cards
- Agent cards: avatar, name, identity, rating stars, skills, price, Hire button
- My Agents mode (`?mine=true`): adds Edit, Activate/Deactivate, Delete buttons

### Agent Detail (`/agents/[id]`)

- Large header with avatar, name, status badge, rating, stats
- Three tabs: Overview, Analytics, Reviews
- Owner controls: Edit, Activate/Deactivate, Delete
- Hire button opens task input modal (textarea for task description)

### Agent Create (`/agents/create`)

- Template selector grid (8 templates with icons/colors)
- LLM config section (provider, model, API key, base URL, system prompt, temperature, max tokens)
- Flow builder (add/remove/reorder steps: llm_call, delegate, output)
- Skills + pricing + auto-execute toggle

---

## Icon System

All icons are inline SVG using `stroke="currentColor"` for theme-aware coloring. No icon library dependency. Common stroke widths: `2` (standard), `2.5` (emphasis).

---

## Scrollbar

Minimal 6px width, transparent track, themed thumb with hover state.
