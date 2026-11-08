# Security Policy

## Core Architecture & Isolation
- MacroMeal isolates each tenant strictly through Postgres Row Level Security (RLS).
- Application-level authentication is handled by `@supabase/ssr` using `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- No authentication tokens are ever stored in `localStorage` or client-side storage.
- The `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to `/lib/server/food-cache.ts` and marked `server-only`. Any usage elsewhere triggers build failure.

## Content Security Policy & Headers
Security headers are enforced via `next.config.ts`:
- `Content-Security-Policy`: restricts origins to own domain and Supabase endpoints.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: disables camera, microphone, geolocation.

## Reporting a Vulnerability
Please report any security findings via standard private disclosure.
