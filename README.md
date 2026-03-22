# CEO Mission Control

Executive command center for portfolio optimization and focus management.

## Features

- **Priority Dashboard**: Live ranking of initiatives from INITIATIVES.md with scoring matrix
- **Financial Command Center**: Cash position, pipeline tracking, HELOC status, runway calculations
- **Focus Optimization**: Temporal hours tracking, scheduled blocks, daily priorities
- **OpenClaw Integration**: Direct access to workspace files when running locally

## Architecture

- **Local Mode**: Direct file system access to `/Users/nikolay/.openclaw/workspace`
- **Deployed Mode**: GitHub repository sync with webhook updates
- **Real-time Updates**: Automatic refresh of workspace data

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS + shadcn/ui components
- OpenClaw API integration
- Vercel deployment

## Local Development

```bash
npm run dev
```

Reads directly from OpenClaw workspace at `/Users/nikolay/.openclaw/workspace`.

## Deployment

Automatically deploys to Vercel on push to main branch.

## Data Sources

- `INITIATIVES.md` - Portfolio ranking and scoring
- `DAILY_SCORECARD.md` - Daily priorities and focus tracking
- OpenClaw API - Real-time workspace integration (local only)

## Environment Detection

The app automatically detects whether it's running locally (with OpenClaw access) or deployed (GitHub sync mode) and adjusts data access accordingly.