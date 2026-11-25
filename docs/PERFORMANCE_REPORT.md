# Performance report

Measured on 25 November 2026 using the production static build in Chromium and a local Uvicorn process backed by an isolated SQLite file. The workspace contained 200 synthetic reviews. API figures use 30 sequential samples per route after one warm-up request. Browser values are single cold-context samples on loopback with no network throttling.

| Operation | p50 | p95 |
| --- | ---: | ---: |
| Inbox, first page of 15 | 12.8 ms | 16.1 ms |
| Inbox, page 14 with text search | 13.2 ms | 22.3 ms |
| Dashboard totals | 14.4 ms | 16.3 ms |
| Six months of activity | 11.6 ms | 16.5 ms |

- CSV import of 200 validated rows with their activity events took 823 ms.
- Landing page first contentful paint was 160 ms. Chromium reported 654 KiB of script resource bodies over the uncompressed local server.
- Dashboard first contentful paint was 60 ms. The first populated totals appeared 504 ms after navigation. Chromium reported 1,226 KiB of script resource bodies.
- The Windows Uvicorn process sampled at 116.3 MiB resident memory and 100.0 MiB private memory. This is a point-in-time measurement.

The original Next.js 14 build reported 88.5 kB first-load JavaScript for the landing page and 289 kB for the dashboard. Next.js 16 and the local Chromium resource measurements use different accounting. There was no comparable baseline browser capture.

The inbox now calls the canonical review path, eliminating its observed redirect and additional CORS preflight. Session setup avoids repeating the authenticated profile request after successful sign-in. Charts render without layout-delaying entry animations. PostgreSQL query plans, sustained memory, cloud cold starts and live AI latency were outside the measured environment.
