# Self-hosting VTC Timetable

This stack runs the Vinext application and Redis with Docker Compose. The database is MongoDB Atlas (or another hosted MongoDB). Set `MONGODB_URI` in `.env`.

Supported calendar export is semester `.ics` downloads and Discord-linked live calendar subscription feeds. The attendance-hours grid is an HTML view, not an Excel export.

## 1. Requirements

- Docker Engine with the `docker compose` plugin
- A MongoDB Atlas cluster (or equivalent hosted MongoDB) and connection string
- A public URL if Discord OAuth is used
- Secrets generated on the host; do not commit them

## 2. Copy environment configuration

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` and fill in every required secret, including `MONGODB_URI`.

## 3. Generate a Better Auth secret

```bash
openssl rand -base64 32
```

Set the result as `AUTH_SECRET`. The application also accepts `BETTER_AUTH_SECRET` as a fallback.

## 4. Set the public application URL

Set both:

```env
APP_URL=https://timetable.example.com
BETTER_AUTH_URL=https://timetable.example.com
```

`BETTER_AUTH_URL` must be the URL users actually open. Discord OAuth and session cookies depend on it.

## 5. Configure Discord OAuth callback URLs

In the Discord developer portal, add:

```text
https://timetable.example.com/api/auth/callback/discord
```

Then set `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET`. Email/password login can work without Discord.

## 6. Start the stack

```bash
docker compose up -d --build
```

The application image runs `vinext start` against the Vinext `dist/` output (`bun run start`). Redis stays on the internal Compose network. MongoDB is reached over `MONGODB_URI`.

Services:

- `app` (published on `${PORT:-3000}`)
- `redis` (internal)

Allow the Compose host IP (or `0.0.0.0/0` only if you accept that risk) in the Atlas Network Access list so the app can connect.

## 7. Check container state

```bash
docker compose ps
```

`app` and `redis` should be healthy. `/api/health/ready` also confirms the Atlas connection.

## 8. Read application logs

```bash
docker compose logs -f app
```

Logs must not contain tokens, passwords, connection strings, or student records. If they do, treat that as a bug.

## 9. Verify health endpoints

```bash
curl -fsS http://localhost:3000/api/health/live
curl -fsS http://localhost:3000/api/health/ready
```

- `/api/health/live` returns `{ "status": "ok" }` while the process is running.
- `/api/health/ready` requires MongoDB (Atlas). Redis is optional: `redis: "disabled"` or `redis: "error"` makes the payload `degraded` but still HTTP 200.

## 10. Update the application

```bash
git pull
docker compose up -d --build app
```

The Redis volume is kept across image rebuilds.

## 11. Back up MongoDB

Use Atlas backups or `mongodump` against `MONGODB_URI` from a trusted machine. Do not put database credentials in shell history if you can avoid it.

```bash
mongodump --uri "$MONGODB_URI" --archive > vtc-timetable.dump
```

Store the dump file outside the containers.

## 12. Restore MongoDB

```bash
mongorestore --uri "$MONGODB_URI" --archive < vtc-timetable.dump
```

## 13. Redis persistence and backups

Redis uses AOF (`--appendonly yes`) on the `redis-data` volume. It is a cache:

- Attendance and timetable data live in MongoDB Atlas.
- Redis can be flushed or recreated; the app fails open to MongoDB.
- A Redis backup is not required for data recovery.

## 14. Stop containers without removing volumes

```bash
docker compose stop
```

or:

```bash
docker compose down
```

`docker compose down` without `--volumes` keeps `redis-data`.

## 15. Deleting volumes destroys Redis cache data

Do not run this unless you intend to erase the Redis volume. MongoDB Atlas data is not stored in Compose volumes.

```bash
docker compose down --volumes
```
