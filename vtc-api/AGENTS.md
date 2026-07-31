# vtc-api Agent Guide

## Scope

These instructions apply to everything under `vtc-api/`.

`vtc-api` is a TypeScript workspace package for the VTC mobile and e-card APIs. Keep changes focused on the API client, response types, timetable helpers, and calendar generation exposed through `src/index.ts`.

## Repository layout

- `src/index.ts` defines the package's public exports.
- `src/core/` contains API and helper implementation.
- `src/types/` contains response shapes for upstream VTC endpoints.
- `data/` and the JSON files at the package root are captured or generated data, not source code.

## Workspace and dependencies

- Use Bun from the repository root.
- Run `bun install` only at the repository root.
- Keep the single root `bun.lock`; do not create a `vtc-api/bun.lock`.
- Never commit `node_modules` or generated install artifacts.
- Declare runtime dependencies in `vtc-api/package.json`. Do not rely on undeclared dependencies merely because another workspace installs them.

## Implementation rules

- Preserve the public API unless the requested change explicitly includes a breaking change.
- Export new public functionality through `src/index.ts`.
- Keep upstream response types in `src/types/`; avoid `any` when the response shape is known.
- Treat timetable lecture `id` values as random, upstream-generated UUID v4 values. The endpoint generates fresh IDs on every request, including for otherwise unchanged lectures. Do not use them as persistent identities, deduplication keys, or cache keys; derive identity from stable lecture fields such as course, time, room, and lesson type.
- Keep network behavior in `src/core/`. Encode query values and handle non-successful HTTP responses consistently.
- Never log, hard-code, or commit access tokens, refresh tokens, student details, or other credentials.
- Treat captured JSON as potentially sensitive. Do not add or refresh data files unless the task requires it and the contents have been checked for personal information.

## Anti-slop rules

- Make the smallest coherent change that solves the stated problem.
- Reuse existing types and helpers before adding abstractions.
- Do not add placeholder implementations, speculative compatibility layers, redundant wrappers, or commented-out code.
- Comments should explain constraints or surprising behavior, not narrate obvious code.
- Do not silently swallow errors. Preserve useful context without exposing secrets.
- Avoid unrelated formatting, renaming, and refactoring.
- Do not claim tests, type checks, or builds passed unless you ran the relevant command successfully.

## Validation

- Run the narrowest relevant check for the changed code.
- If a change affects the consuming web application, also run the appropriate root-level lint or build command.
- This package currently has no dedicated test script or local `tsconfig.json`; state that limitation clearly instead of implying full package validation.
