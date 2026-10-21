/* sink.fi · the few things that change by hand */
window.SINK = {
  API: "https://sink-api.ushouldcashout.workers.dev",   // the sink-api Worker (worker/sink-api.js)
  X: "",                                                 // Sink's X handle, e.g. "sinkfi". Empty hides the link.
  EPOCH_1_OPENS: Date.UTC(2026, 9, 20, 0, 0, 0),         // Tue 20 Oct 2026 00:00 UTC
  CLAIM_OPENS: Date.UTC(2026, 9, 20, 0, 0, 0),           // Fables points claim window
  CLAIM_CLOSES: Date.UTC(2026, 10, 20, 0, 0, 0),
  PEOPLE: [                                              // name, one line, X handle (empty = no link)
    { name: "ushouldcashout", role: "Also runs Throne, the yield vault on Robinhood Chain.", x: "ushouldcashout" },
    { name: "Tyler", role: "Sink.", x: "" }
  ]
};
