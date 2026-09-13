# InnJourney.UI.Web

The Angular client. Standalone components and signals, no state-management library.

```bash
npm install
npm start        # http://localhost:4200
npm run build
```

`npm start` proxies `/api` and `/uploads` to the API on `http://localhost:8080` (see `proxy.conf.json`), so the browser only ever sees one origin and no CORS preflight is involved. In the container, nginx does the same job.

## Layout

```
src/app/
  core/      API client, auth, interceptor, guards, date and money helpers
  shared/    ribbon, stars, status chip, toasts
  pages/     one component per route, lazily loaded
```

`core/models.ts` mirrors the API's contracts by hand. It is the one place the two halves can drift: renaming a field on the server breaks nothing at build time here.

## Design

Light theme only. Tokens live in `src/styles.scss` — five colours, of which `--lamp` is semantic: it marks an occupied night on the occupancy ribbon and is used nowhere else, which is what keeps a month of nights readable at a glance.

`RibbonComponent` is reused at every scale, from a strip on a search result to the rooms-by-nights board on the owner's dashboard. A stay occupies `[checkIn, checkOut)`, so a bar ending where the next begins renders as a turnover rather than an overlap.
