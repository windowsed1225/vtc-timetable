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
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Calendar UI | react-big-calendar |
| Auth | NextAuth v5 (Discord + Email/Password) |
| Database | MongoDB via Mongoose |
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

Create a `.env.local` file at the project root:

```env
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=your_nextauth_secret
AUTH_DISCORD_ID=your_discord_client_id
AUTH_DISCORD_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_discord_bot_token   # for avatar refresh
```

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
└── auth.ts                # NextAuth configuration
messages/
├── en.json                # English translations
└── zh-HK.json             # Traditional Chinese translations
vtc-api/                   # VTC Moodle API integration
```

## Deployment

The project is deployed on [Vercel](https://vercel.com). Push to `master` to trigger a production deployment.

Set all environment variables listed above in your Vercel project settings under **Settings → Environment Variables**.
