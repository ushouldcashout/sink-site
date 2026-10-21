/* sink.fi · one script. The epoch countdown is the only thing that moves.
   Everything else here fills numbers in once (live Fables facts, the list count) or wires the one form. */
(function () {
  var C = window.SINK || {};
  var WEEK = 7 * 24 * 3600 * 1000;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function set(sel, text) { all(sel).forEach(function (el) { if (el.textContent !== text) el.textContent = text; }); }
  function split(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  }
  function dateLabel(t) { var d = new Date(t); return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]; }

  /* ---------- numbers ---------- */
  function usd(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (n >= 1e4) return "$" + Math.round(n / 1e3) + "K";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function big(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  }
  function pct(x) { return x == null || isNaN(x) ? "—" : (x * 100).toFixed(1) + "%"; }

  /* ---------- countdown ---------- */
  function state(now) {
    var open = C.EPOCH_1_OPENS;
    if (now < open) return { epoch: null, target: open };
    var n = Math.floor((now - open) / WEEK) + 1;
    return { epoch: n, target: open + n * WEEK };
  }
  function tick() {
    var now = Date.now();
    var st = state(now);
    var t = split(st.target - now);
    set("[data-epoch]", st.epoch === null ? "—" : String(st.epoch));
    set("[data-countdown-label]", st.epoch === null ? "Epoch 1 opens in" : "Epoch closes in");
    set("[data-countdown]", pad(t.d) + "d " + pad(t.h) + "h " + pad(t.m) + "m " + pad(t.s) + "s");
    set("[data-chip]", (st.epoch === null ? "epoch 1 · opens in " : "epoch " + st.epoch + " · closes in ") + pad(t.d) + "d " + pad(t.h) + "h " + pad(t.m) + "m");
    var claim = now < C.CLAIM_OPENS ? "claim window opens " + dateLabel(C.CLAIM_OPENS)
      : now < C.CLAIM_CLOSES ? "claim window open until " + dateLabel(C.CLAIM_CLOSES) + ", deposits open inside it"
      : "claim window closed " + dateLabel(C.CLAIM_CLOSES);
    set("[data-claim]", claim);
  }

  /* ---------- live Fables facts ---------- */
  function facts() {
    if (!C.API || !document.querySelector("[data-fact]")) return;
    fetch(C.API + "/facts").then(function (r) { return r.json(); }).then(function (f) {
      if (!f || f.error) return;
      set("[data-fact=locked]", big(f.fablesLocked));
      set("[data-fact=lockedpct]", f.lockedPct != null ? pct(f.lockedPct) + " of supply" : "");
      set("[data-fact=voters7d]", usd(f.voterFees7dUsd));
      set("[data-fact=fees24h]", usd(f.fees24hUsd));
      set("[data-fact=tvl]", usd(f.tvlUsd));
      set("[data-fact=pools]", f.pools != null ? String(f.pools) : "—");
      set("[data-fact=gauges]", f.incentivisedGauges != null ? String(f.incentivisedGauges) : "—");
      if (f.at) { var d = new Date(f.at); set("[data-fact=at]", "Fables data as of " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC, " + dateLabel(f.at) + ". Refreshes every 10 minutes."); }
      var tb = document.querySelector("[data-pools]");
      if (tb && f.topByVoterFees && f.topByVoterFees.length) {
        var byFees = {}; (f.topByFees || []).forEach(function (p) { byFees[p.id] = p; });
        tb.innerHTML = f.topByVoterFees.map(function (p) {
          return "<tr><td>" + p.name + "</td><td class=\"num\">" + usd(p.usd) + "</td></tr>";
        }).join("");
      }
    }).catch(function () { /* dashes stay */ });
  }

  /* ---------- the list ---------- */
  function list() {
    var form = document.querySelector("[data-join]");
    if (!form || !C.API) return;
    function count() {
      fetch(C.API + "/count").then(function (r) { return r.json(); }).then(function (t) {
        if (!t) return;
        set("[data-list=count]", t.count != null ? String(t.count) : "—");
        set("[data-list=fables]", t.fables ? big(t.fables) : (t.count ? "0" : "—"));
      }).catch(function () {});
    }
    count();
    var msg = form.querySelector("[data-join-msg]");
    var btn = form.querySelector("button");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var contact = form.querySelector("[name=contact]").value.trim();
      var fables = form.querySelector("[name=fables]").value.trim();
      if (!contact) { msg.textContent = "Enter an X handle or an email."; return; }
      btn.disabled = true; msg.textContent = "…";
      fetch(C.API + "/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: contact, fables: fables }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok) { msg.textContent = res.j && res.j.error ? res.j.error : "Something failed. Try again."; return; }
          msg.textContent = res.j.already ? "Already on the list, number " + res.j.position + "." : "On the list, number " + res.j.position + ". One message when deposits open, nothing else.";
          form.querySelector("[name=contact]").value = ""; form.querySelector("[name=fables]").value = "";
          count();
        })
        .catch(function () { btn.disabled = false; msg.textContent = "Could not reach the list. Try again in a minute."; });
    });
  }

  /* ---------- people, footer X ---------- */
  function people() {
    var host = document.querySelector("[data-people]");
    if (host && C.PEOPLE) {
      host.innerHTML = C.PEOPLE.map(function (p) {
        var name = p.x ? "<a href=\"https://x.com/" + p.x + "\" rel=\"noopener\">" + p.name + "</a>" : p.name;
        return "<div><dt>" + name + "</dt><dd>" + (p.role || "") + "</dd></div>";
      }).join("");
    }
    all("[data-x]").forEach(function (a) {
      if (C.X) { a.href = "https://x.com/" + C.X; a.hidden = false; } else { a.hidden = true; }
    });
  }

  tick();
  setInterval(tick, 1000);
  facts();
  list();
  people();
})();
