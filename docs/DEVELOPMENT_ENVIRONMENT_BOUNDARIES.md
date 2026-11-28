# Development and Production environment boundaries

This repository uses separate Supabase projects for Development and Production.

| Deployment context | Supabase project | Project ref |
| --- | --- | --- |
| Netlify branch deploys | Development / Testing | `avplvplzhaqpnclgzmel` |
| Netlify deploy previews | Development / Testing | `avplvplzhaqpnclgzmel` |
| Netlify `development` branch override | Development / Testing | `avplvplzhaqpnclgzmel` |
| Netlify Production | Production | `lcuheihzphekphgeszbt` |

The browser client is configured using the matching `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_PUBLISHABLE_KEY` values in each environment context. Never copy a Production key into a Development context or a Development key into Production.

## Operational rules

1. Develop and test using the Development Supabase project and Development/preview deployments.
2. Do not apply demo seeds or test-only legal documents to Production.
3. Keep production environment variables and production deployments unchanged during Development work.
4. Before using a branch deployment, confirm its Netlify deployment context resolves to the Development Supabase project.
5. Treat Production as read-only unless the user explicitly authorizes a separate production release.

## Screenshot demo workspace

The fictional `ClassBandhu Demo Academy (Sample Data Only)` workspace is seeded only in Development. The seed is at `supabase/seeds/development_classbandhu_demo_academy.sql` and must never be executed against Production.

No real user, student, parent, or payment data is part of this demo. The seed intentionally does not record legal acceptance or owner declarations.
