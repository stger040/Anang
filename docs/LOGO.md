# Logo assets for Anang (marketing + platform)

Source files for the live site live under each Next.js app’s **`public/`** folder (not `docs/images/`). Next.js serves `public/brand/...` at `https://your-domain/brand/...`.

## What to put where

| File | Used on | Purpose |
|------|---------|--------|
| `apps/marketing-site/public/brand/logo-trans-dark-bg.svg` | Marketing header & footer (navy backgrounds) | Wordmark + mark readable on **dark** (light-colored text) |
| `apps/marketing-site/public/brand/logo-trans-light-bg.svg` | Optional light sections (not wired by default) | Wordmark for **light** backgrounds (e.g. navy ink) |
| `apps/platform-app/public/brand/*.svg` | Product shell, login, admin (light surfaces) | **Replace** the same two filenames so deploys stay in sync |

Keep **identical** filenames in both apps when you update the brand (copy the SVGs into `apps/platform-app/public/brand/` after changing marketing).

## Designing in Canva

1. **Prefer SVG export** if Canva or your tool supports clean vectors. Otherwise use **PNG with transparent background**.
2. **Safe horizontal sizes** for the header:
   - **SVG:** `viewBox` roughly **200–280 × 36–48** for a compact wordmark; the marketing header uses **108px** height (3× the earlier 36px ribbon) with width `auto` (capped on small viewports).
   - **PNG @1x:** about **240–320px wide × 36–40px tall** for retina-friendly scaling use **@2x** (e.g. **480×72**).
3. **Two variants** (current filenames):
   - **Dark background** (navy `#13264C` / `#0B1428`): use **white or near-white** type and **coral `#E24E42`** accent so it matches the Cedar-adjacent theme.
   - **Light background** (`#F7F5F2` / white): use **navy `#13264C`** type and **coral** accent.
4. **Favicon / app icon** (optional next step): add `apps/marketing-site/src/app/icon.png` (e.g. **512×512** or **180×180**) per [Next.js metadata icons](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons).

## Replacing assets

1. Export your final **SVG** (or PNG).
2. Overwrite `logo-trans-dark-bg.svg` and/or `logo-trans-light-bg.svg` in **`apps/marketing-site/public/brand/`**.
3. Copy those files to **`apps/platform-app/public/brand/`** with the **same names**.
4. Commit and deploy both Vercel projects (or push once if both deploy from the same repo).

If you need to **swap** which variant appears on dark vs light UI, update the `src` paths in `site-header-logo.tsx`, `site-footer-logo.tsx`, `login/page.tsx`, `top-bar.tsx`, and `admin/layout.tsx` (or rename files and keep paths unchanged).

If your wordmark is **wide**, the header uses `max-h-[108px]` and `max-w-[min(92vw,540px)]`; extremely wide marks may need a simplified **icon-only** variant for mobile (future enhancement).

## Calendly URL

Booking CTAs use `getBookMeetingUrl()` from `@anang/config` (default [Calendly](https://calendly.com/nanaandawi/30min)). Override in Vercel with **`NEXT_PUBLIC_ANANG_CALENDLY`**.
