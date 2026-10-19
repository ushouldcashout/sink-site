/* sink.fi · the only moving thing: the epoch countdown.
   Edit the three dates below; everything on every page reads from them. */
(function () {
  var EPOCH_1_OPENS = Date.UTC(2026, 9, 20, 0, 0, 0);   // Tue 20 Oct 2026 00:00 UTC
  var CHOICE_LOCKS  = Date.UTC(2026, 9, 19, 2, 0, 0);   // points claim choice is final
  var WEEK = 7 * 24 * 3600 * 1000;

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function split(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  }
  function utcLabel(t) {
    var d = new Date(t);
    return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " +
      pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC";
  }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function set(sel, text) { all(sel).forEach(function (el) { if (el.textContent !== text) el.textContent = text; }); }

  function state(now) {
    if (now < EPOCH_1_OPENS) return { epoch: null, target: EPOCH_1_OPENS };
    var n = Math.floor((now - EPOCH_1_OPENS) / WEEK) + 1;
    return { epoch: n, target: EPOCH_1_OPENS + n * WEEK };
  }

  function tick() {
    var now = Date.now();
    var st = state(now);
    var t = split(st.target - now);

    set("[data-epoch]", st.epoch === null ? "—" : String(st.epoch));
    set("[data-countdown-label]", st.epoch === null ? "Epoch 1 opens in" : "Epoch closes in");
    set("[data-countdown]", pad(t.d) + "d " + pad(t.h) + "h " + pad(t.m) + "m " + pad(t.s) + "s");
    set("[data-chip]", st.epoch === null
      ? "epoch 1 · opens in " + pad(t.d) + "d " + pad(t.h) + "h " + pad(t.m) + "m"
      : "epoch " + st.epoch + " · closes in " + pad(t.d) + "d " + pad(t.h) + "h " + pad(t.m) + "m");

    var passed = now >= CHOICE_LOCKS;
    set("[data-choice]", (passed ? "choice locked " : "choice locks ") + utcLabel(CHOICE_LOCKS));
  }

  /* the deposit ledger mirrors what you type; nothing is sent anywhere */
  function mirror() {
    var input = document.querySelector("[data-amount]");
    if (!input) return;
    function upd() {
      var v = input.value.replace(/[^0-9.]/g, "");
      var shown = v === "" || isNaN(parseFloat(v)) ? "—" : v;
      set("[data-mirror]", shown);
    }
    input.addEventListener("input", upd);
    upd();
  }

  tick();
  mirror();
  setInterval(tick, 1000);
})();
