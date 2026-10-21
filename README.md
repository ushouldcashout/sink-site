# sink.fi

Static site. No framework, no build step.

- index.html: home
- docs.html (and docs/index.html, a redirect): docs
- app/: redirects while the app is hidden; *.hidden.html are the mockups
- spec.html: type, colour, grid, waterline and logo spec
- logo/: mark, wordmark and lockups as SVG, plus favicon
- js/config.js: the things that change by hand (API host, X handle, epoch and claim dates, the people list)
- js/sink.js: the one script (countdown, live Fables facts, the list form, people, footer X)
- worker/sink-api.js: the Cloudflare Worker behind the list and the live facts

## The Worker

Cloudflare dashboard > Workers > Create > name it `sink-api`, paste worker/sink-api.js.
Settings > Bindings > KV namespace: variable `SINK`, create a namespace called `sink`.
Settings > Variables > Secret: `EXPORT_KEY` = any long random string (only you know it).
Deploy. The site calls https://sink-api.ushouldcashout.workers.dev by default (js/config.js, `API`).
If sink.fi is on Cloudflare, add a route `api.sink.fi/*` and change `API` to https://api.sink.fi.

- GET  /facts   live Fables numbers, cached 10 min
- GET  /count   {count, fables}
- POST /join    {contact, fables}
- GET  /export?key=EXPORT_KEY   CSV of the list
- DELETE /admin?key=EXPORT_KEY&contact=@name   remove one entry

## Before launch

Set `X` in js/config.js to Sink's handle (the X links are hidden until it is set). Add Tyler's handle to `PEOPLE`.
