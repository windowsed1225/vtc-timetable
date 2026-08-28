# VTC Timetable

A personal class schedule and attendance tracker for Vocational Training Council (VTC) students. Sync your timetable from VTC's Moodle, track attendance rates per course, and export or subscribe to your calendar.

## Features

- **Timetable sync** — pulls your class schedule directly from VTC Moodle via your student credentials
- **Attendance tracking** — displays per-course attendance rates with pass/fail/recoverable status, updated each sync
- **Multi-semester view** — browse Fall / Spring / Summer semesters with collapsible course groups
- **Calendar export** — download a semester's schedule as an `.ics` file for Apple Calendar, Google Calendar, etc.
- **Calendar subscription** — subscribe via a live `.ics` URL that stays in sync (requires Discord login)
- **Discord OAuth login** — sign in with Discord; avatar is auto-refreshed daily via the Discord API
- **Bilingual UI** — English and Traditional Chinese (繁體中文) via `next-intl`
- **Dark / light theme** — system-aware with manual toggle via `next-themes`
- **Manage events** — add, edit, or remove custom calendar events per semester

## Tech Stack

| Layer | Library |
| --- | --- |
| Framework | Vinext (Vite) with React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Calendar UI | react-big-calendar |
| Auth | Better Auth (Discord + email/password) |
| Database | MongoDB via Mongoose |
| Cache | Redis (optional; reads fail open to MongoDB) |
| i18n | next-intl (en, zh-HK) |
| Theming | next-themes |
| Animations | Framer Motion |
| Calendar export | ics |
| Date handling | dayjs |

## Getting Started

### Prerequisites

- Bun 1.0+
- A MongoDB connection string
- A Discord OAuth application (Client ID + Secret)

### Environment variables

Copy `.env.example` to `.env.local` for development or `.env` for Docker Compose.

```env
MONGODB_URI=mongodb://127.0.0.1:27017/vtc-timetable
AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_URL=http://localhost:3000
AUTH_DISCORD_ID=your_discord_client_id
AUTH_DISCORD_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_discord_bot_token   # optional, daily Discord avatar refresh
OWNER_DISCORD_ID=your_discord_user_id      # optional, e-card playground for this Discord id
REDIS_URL=redis://127.0.0.1:6379          # optional cache
```

Self-host with Docker Compose: copy `.env.example` to `.env` and run `docker compose up -d --build`.

### Install and run

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
bun run build
bun start
```

## Project Structure

```text
src/
├── app/
│   ├── [locale]/          # Locale-scoped pages (home, settings)
│   ├── actions/           # Server actions (events, sync, export, attendance…)
│   └── globals.css        # Design tokens + component styles
├── components/            # React components (Sidebar, Calendar, Modals…)
├── lib/                   # Utility functions and helpers
├── types/                 # TypeScript type definitions
└── auth.ts                # Better Auth configuration
messages/
├── en.json                # English translations
└── zh-HK.json             # Traditional Chinese translations
vtc-api/                   # VTC Moodle API integration
```

## Deployment

The project is deployed on [Vercel](https://vercel.com). Push to `master` to trigger a production deployment.

Set all environment variables listed above in your Vercel project settings under **Settings → Environment Variables**.
