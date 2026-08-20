# NestMetric

NestMetric is a spatial planning application built around one canonical Room Model. The product supports three continuous modes—Organize, Arrange, and Build—without creating separate representations of the same physical room.

## Development workflow

This repository is the canonical source of truth. Do not reconstruct application source from Vercel deployment artifacts.

1. Create a `parallax/...` branch from `main`.
2. Make changes in the canonical source tree.
3. Run change-appropriate validation:
   - CSS/presentation-only: `npm run validate:ui`
   - Room Model/planning logic: `npm run validate:domain`, then `npm run build`
   - Persistence/auth/schema: `npm run validate:full` plus Supabase migration/advisor checks
4. Deploy one Vercel preview from the branch.
5. Run live/browser acceptance checks appropriate to the change.
6. Merge/promote only after the preview is validated.

`npm run classify:change -- <paths...>` reports the minimum validation tier for a set of changed files.

## Configuration

Copy `.env.example` to `.env.local`. Do not commit environment-specific files or secret keys.

Production persistence is Supabase PostgreSQL + private Storage. The Vercel filesystem is not an authoritative data store.
