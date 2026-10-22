// sink.fi API · Cloudflare Worker
// Name: sink-api   KV binding: SINK   Secret: EXPORT_KEY
// Default host: https://sink-api.ushouldcashout.workers.dev (or route api.sink.fi/* if sink.fi is on Cloudflare)
//
//   POST /join                 {contact, fables?}   -> {ok, position, already?}
//   GET  /count                -> {count, fables}   (people on the list, FABLES they said they hold)
//   GET  /facts                -> live Fables facts, cached 10 min (see FACTS below)
//   GET  /export?key=EXPORT_KEY -> CSV
//   DELETE /admin?key=..&contact=..   remove one entry
//
// contact = an X handle (@name) or an email. One entry per contact.
// fables = optional whole number of FABLES the person says they hold or will claim. Not verified; shown only in aggregate.

const ORIGINS = ['https://sink.fi', 'https://www.sink.fi', 'https://ushouldcashout.github.io'];
const FABLES = 'https://www.fables.fi';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const BLOCKSCOUT = 'https://robinhoodchain.blockscout.com';
const FABLES_TOKEN = '0xb63d07cef74be747231d601bb2faa6b252c68106';
const VE_ESCROW = '0xc1d5aDc963a57d24ADaf63aaE1bFbeCaB95f6EDD';
const FACTS_TTL = 600; // seconds

// poolId -> pair, taken from fables.fi/markets on 21 Oct 2026. Unknown ids fall back to a short id.
const POOL_NAMES = {
  '0xcce8dcf7c4dcfee6b6588db724240d9d6a22ee456f9387bb831c8fcea970869e': 'FABLES/USDG',
  '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551': 'ETH/USDG',
  '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a': 'GLD/USDG',
  '0x486435a1f76cd58193f854c6e6213cd05fd58d637865d02065ff558b387fa6ea': 'PONS/USDG',
  '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd': 'SPY/USDG',
  '0x31608601d541e868706aa557558a4d4f99c57e6dd13bd3362edcf05d00a16212': 'CASHCAT/USDG',
  '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd': 'NVDA/USDG',
  '0x592e3fb7ea947506b36481025abc15baada8e1839a50fded46ecf08b3182fa96': 'AI/USDG',
  '0xb81d873dfb2bb1aaf08804053f8940fd06bb30a2b5a0fafcdbcc7325544452b9': 'SPCX/USDG',
  '0x4aaa4f57bec2b6e67dac42909c8c4f9a6ddaf02bb63f8dcbbafb35316731d2a7': 'UBIK/USDG',
  '0xb59001413cb070e28433826f927b7265a0813213ba21f454d86896cee3cce674': 'ETH/PONS',
  '0xc761f7de760d2b73cc3e3cc3d729916a4ed2f7fc6b0aa3872e2ced4258961e92': 'ORBIO/USDG',
  '0xfed6a0bfe2390b71837220ce02cf736852aa1b3c37513f27c4c10f51e0f34b79': 'MCD/USDG',
  '0x4030f646babe7643c33ee0b9a5123e04ee97a8820a26d0d9dec8b0265f31170d': 'NET/USDG',
  '0x286f707c75266f4633638e557c6ada1bd4c58c3d533badb8c440a851f0940aa2': 'ETH/CASHCAT',
  '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e': 'TSLA/USDG',
  '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147': 'AAPL/USDG',
  '0x5619cb8420678b47997f20925eb01be8750c907d6226a0df5d7eafeff966346f': 'AMZN/USDG',
  '0x5e4c353496e4c82a406a38ca1eaad6d2d4cdb8d405d422faff84bcb6f548d97e': 'INTC/USDG',
  '0xdb9c34002d173981250969293af6f43f42a26f2110f19893bbe2ad373375e9e6': 'CRCL/USDG',
  '0xe1c3e133c917674bd51704e47c7dfe7f0d66375c89ceb30b083de95f9a1dc5ea': 'MSTR/USDG',
  '0x8e36bc9877b9383ae306dd937d40ab0e9df65811e7fdfb6bad25e7102bc398b2': 'MU/USDG',
  '0x8138ea2894ce8f825d830569df6faf33e55344290954ce22432ca4f11913bacc': 'COIN/USDG',
  '0xbe1a90db81cf52603ea9059a6fde2e5fa893a8750647ff189ee7618c61b4c4f9': 'PLTR/USDG',
  '0xbb15d6b62c893a86912b5d4b14599f9cc72111e5898327dcadefa0352f20ae11': 'GME/USDG',
  '0x6ef20273e821b24ca2b27861d700db239c5449f6446c91d13d9c2bc01c7b8bb9': 'AMC/USDG',
  '0x6948116f31d66206c10fc6aa6eff7e58842f2fb4dc32533f972a1cd50ed77e02': 'GLXY/USDG',
  '0x16dce5f6a91bd93c2f5f05866dbb780afbe47d2776ea8dcdbb758efff57248a7': 'HIMS/USDG',
  '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5': 'META/USDG',
  '0x8fb2273e40a44bd4b442bf7f24b953e46a7ecae7384038b266008ae44ebe62be': 'INDEX/USDG',
  '0xf50a897ae1b4dfdac5a8d573f0d0f59c75832b7832b7e631e1192d1e64019039': 'cbBTC/USDG',
  '0x7e42e835239ea7f2707b77b7672e4358aa2b799746274ab1254d8a576b5f56fb': 'frxUSD/USDG',
  '0x0f4d4d8a40ce635f1317f18b9fdf41fb5492bec9763abdacf3ea59a2c3bf5758': 'SFI/frxUSD',
  '0x3e6fd764d07df0f76cc6d33c4153f05b64705fbd1fb604bf6b5a4a1b4b158be6': 'SPY/frxUSD',
  '0x4f72cb3cdc8947b678a8b18a05b77862338b9e5635337e3450c2d46130c2df1c': 'ETH/frxUSD',
  '0xdc844c8cc27ad9a1d122c03adeadc8b3652d29008d88344823ad9d52555b926b': 'feUSD/frxUSD',
  '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f': 'SPY/GLD',
  '0x422ed2d698601ea2114b103501e305ae7e3164f87079c72c626d2df832d74a0e': 'SPY/QQQ',
  '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f': 'NVDA/SPY',
  '0x6c330014af1c9e8fd0c6b5e3407439af7bce820c53c72cff168c1b92d9f96ca2': 'ETH/SPY',
  '0x0bae6c92e5af1240e8728b77ff86139a5d90e6f63b14d67d606671b0fd9abaf5': 'ETH/STONKBROKER',
  '0x3078bf0a7a6b5a2eb4bc367516854ae93a9aae334e0067f2a2be5cb616bfec6f': 'ETH/PIPEDOG',
  '0x31f8624041c93e2abd0fb23540d259b069fa76c053eb7e3f5abc754d7194726b': 'ETH/AMC',
  '0x76d4e09a330a2f1b110a7ffba2c52804c8d4b64615254590e06822575ee9097e': 'ETH/CHUMP',
  '0xaf30b4c0110121efe3702cbead77d943d0765eb772fea5341d37b73364066ff9': 'ETH/INU',
  '0xb4f01c156256c361e938e1391421d1297db290f9a055c1ad4a33dd42e6a76b5e': 'ETH/VIRTUAL',
  '0xe85f633a1374ee279140fa997b547d6a2ccd94fc5eae0e98f7d15ce0e3ddfa93': 'ETH/AI',
  '0x3428910987af3506702305be9869f3320b55d7f280af90804bf376786f6082fe': 'THRONE/USDG',
  '0x8147584eacbfe717d34539da5a2e8227da28983e8f40ce39e94c8c166e45d221': 'GLDSTN/USDG',
  '0xcb69f1b3d627d84795f6ba157faa1051f6160919d7f3cd0e510ff6afcbe03961': 'SHROOM/USDG',
  '0xe1c6088c8a16517358f7696e5522df87a5370fb2b8dbc79d5b0d1bfcf77b0652': 'XBOW/USDG',
  '0xf7e180365aed9c463022976c37c615f483bfbe57717b665deff31922c877c8b3': 'SFI/USDG',
  '0xa1f381b8938b5a9dfb601e692958bc5eff9898f4468ab5e398a52a0d53575093': 'EARN/USDG',
  '0x22a4834bbb173adb82d9d4f3fef381928aa4488708e54260e8d24aa48daf8eb9': 'BUN/USDG',
  '0x806628a7d5dea7679c1947b14997643c72db0b867aa6250d2454728990414ed8': 'KSKD/USDG',
  '0xd40585db9c332f3dcd82a77546c9670e38f82f06f18460eb3c4fca2adeda863e': 'ROUTE/USDG',
  '0xd98f0f503d64cfe5e28db27054318c28cc7bf3d03b66932c41fb46e4ffba3107': 'WALLET/USDG',
  '0x46c24538a851e105a217d2b9b23e2f7f1cb47fbc136572c92d023e36bebd98fe': 'NOSH/USDG',
  '0x4e2a7c0057cec67170ee71641d23d0e835afb6f1deb6b4c6a182b4c16ec8f594': 'ZZZ/USDG',
  '0x6b187fad6ca2dcb913f2451c5d5e24d3d77b9d09ce272c2c99f64dac672bc485': 'MOO/USDG',
  '0x8660c1c24d58fdad98d9008be534240e5d79ece4d4d4ef16f215af001779ec1f': 'MEME/USDG',
  '0xcf0bd6587434f9f6b6e7745230f137a4a0e3910e42b60448e151e09d9361394e': 'BONER/USDG',
  '0x01b71670a61dd9175a3d1e08d4e0af00ce71e76d230c92649f3ce9857f7d4abd': 'DJT/USDG',
};

const HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;

// The pipeline as of 22 Oct 2026: 25 line items from the private pipeline sheet, anonymised. Only the aggregate
// (count and FABLES) is ever served; ids map to sheet rows in the sheet itself, never here. Written to KV once,
// the first time the Worker runs against an empty namespace. Edit the sheet, not this list, after launch.
const SEED = [
  ['seed-01', 1592], ['seed-02', 16160], ['seed-03', 8392], ['seed-04', 2163], ['seed-05', 1621],
  ['seed-06', 851], ['seed-07', 26], ['seed-08', 437], ['seed-09', 3047],
  ['seed-10', 176000], ['seed-11', 1512046], ['seed-12', 93933], ['seed-13', 430184], ['seed-14', 515911],
  ['seed-15', 1359200], ['seed-16', 753452], ['seed-17', 700000], ['seed-18', 2500], ['seed-19', 6538],
  ['seed-20', 0], ['seed-21', 0], ['seed-22', 0], ['seed-23', 0], ['seed-24', 0], ['seed-25', 0],
];

async function ensureSeeded(env) {
  if (await env.SINK.get('__seeded')) return;
  let count = 0, fables = 0;
  const ts = '2026-10-22T00:00:00.000Z';
  for (const [id, f] of SEED) {
    count += 1; fables += f;
    await env.SINK.put('c:' + id, JSON.stringify({ kind: 'seed', fables: f, ts, ip: '', pos: count }));
  }
  const t = await env.SINK.get('__totals', 'json');
  const base = t || { count: 0, fables: 0 };
  await env.SINK.put('__totals', JSON.stringify({ count: base.count + count, fables: base.fables + fables }));
  await env.SINK.put('__seeded', ts);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cors(req) {
  const o = req.headers.get('Origin') || '';
  const allow = ORIGINS.includes(o) ? o : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(req) });

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function normalise(raw) {
  const c = String(raw || '').trim();
  if (EMAIL.test(c)) return { kind: 'email', value: c.toLowerCase() };
  if (HANDLE.test(c)) return { kind: 'x', value: '@' + c.replace(/^@/, '').toLowerCase() };
  return null;
}

async function totals(env) {
  const t = await env.SINK.get('__totals', 'json');
  return t || { count: 0, fables: 0 };
}

// ---------- facts ----------
async function rpcCall(to, data) {
  try {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result && j.result !== '0x' ? Number(BigInt(j.result)) : null;
  } catch (e) { return null; }
}
const getJson = async (u) => { const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': 'sink.fi facts' } }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };

async function computeFacts() {
  const out = { at: new Date().toISOString(), epoch: Math.floor(Date.now() / 604800000), errors: [] };
  // 1. pools: total value, swap fees 24h, top pools by fees
  try {
    const ps = await getJson(FABLES + '/api/gw/PoolStats');
    const pools = Object.entries(ps.pools || {});
    out.pools = pools.length;
    out.tvlUsd = pools.reduce((a, [, p]) => a + (p.tvlUsd || 0), 0);
    out.fees24hUsd = pools.reduce((a, [, p]) => a + (p.feesUsd || 0), 0);
    out.topByFees = pools.map(([id, p]) => ({ id, name: POOL_NAMES[id] || id.slice(0, 10), feesUsd: p.feesUsd || 0, tvlUsd: p.tvlUsd || 0 }))
      .sort((a, b) => b.feesUsd - a.feesUsd).slice(0, 5);
    // 2. paid to voters, last 7 full days, in USD at today's marks
    try {
      const ids = pools.map(([id]) => id);
      const today = Math.floor(Date.now() / 86400000);
      const vf = await getJson(FABLES + '/api/indexer?op=voterfees&ids=' + ids.join('%2C') + '&fromDay=' + (today - 7));
      const marks = await getJson(FABLES + '/api/indexer?op=marks');
      const px = {}; for (const p of (marks.data && marks.data.Pool) || []) px[p.id] = p;
      let usd = 0; const perPool = {};
      for (const r of (vf.data && vf.data.PoolFeeDay) || []) {
        if (r.day >= today) continue; // today is partial
        const p = px[r.pool_id]; if (!p) continue;
        const v = Number(r.claimCut0) * Number(p.usd0) + Number(r.claimCut1) * Number(p.usd1) + Number(r.stakedCut0) * Number(p.usd0) + Number(r.stakedCut1) * Number(p.usd1);
        if (isFinite(v)) { usd += v; perPool[r.pool_id] = (perPool[r.pool_id] || 0) + v; }
      }
      out.voterFees7dUsd = usd;
      out.topByVoterFees = Object.entries(perPool).map(([id, v]) => ({ id, name: POOL_NAMES[id] || id.slice(0, 10), usd: v }))
        .sort((a, b) => b.usd - a.usd).slice(0, 5);
    } catch (e) { out.errors.push('voterfees: ' + e.message); }
  } catch (e) { out.errors.push('poolstats: ' + e.message); }
  // 3. FABLES locked in the escrow, and total supply. The public RPC refuses Workers' egress, so read the
  //    explorer's indexed balances instead and fall back to the RPC only if that fails.
  try {
    let locked = null, supply = null;
    try {
      const tok = await getJson(BLOCKSCOUT + '/api/v2/tokens/' + FABLES_TOKEN);
      if (tok && tok.total_supply) supply = Number(BigInt(tok.total_supply));
      const bal = await getJson(BLOCKSCOUT + '/api/v2/addresses/' + VE_ESCROW + '/tokens?type=ERC-20');
      const row = ((bal && bal.items) || []).find(i => i.token && i.token.address && i.token.address.toLowerCase() === FABLES_TOKEN);
      if (row && row.value) locked = Number(BigInt(row.value));
    } catch (e) { out.errors.push('blockscout: ' + e.message); }
    if (locked == null) locked = await rpcCall(FABLES_TOKEN, '0x70a08231' + VE_ESCROW.slice(2).toLowerCase().padStart(64, '0'));
    if (supply == null) supply = await rpcCall(FABLES_TOKEN, '0x18160ddd');
    if (locked != null) out.fablesLocked = locked / 1e18;
    if (supply != null) out.fablesSupply = supply / 1e18;
    if (locked != null && supply) out.lockedPct = locked / supply;
  } catch (e) { out.errors.push('locked: ' + e.message); }
  // 4. gauges with incentives posted this epoch
  try {
    const inc = await getJson(FABLES + '/api/indexer?op=incentives&epoch=' + out.epoch + '&off=0');
    const rows = (inc.data && inc.data.Incentive) || [];
    out.incentivisedGauges = new Set(rows.map(r => r.poolId)).size;
  } catch (e) { out.errors.push('incentives: ' + e.message); }
  return out;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    await ensureSeeded(env);

    if (path === '/facts' && req.method === 'GET') {
      const cached = await env.SINK.get('__facts', 'json');
      if (cached && Date.now() - Date.parse(cached.at) < FACTS_TTL * 1000) return json(req, cached);
      try {
        const facts = await computeFacts();
        ctx.waitUntil(env.SINK.put('__facts', JSON.stringify(facts)));
        return json(req, facts);
      } catch (e) {
        if (cached) return json(req, cached);
        return json(req, { error: 'facts unavailable', detail: e.message }, 502);
      }
    }

    if (path === '/count' && req.method === 'GET') return json(req, await totals(env));

    if (path === '/export' && req.method === 'GET') {
      if (!env.EXPORT_KEY || url.searchParams.get('key') !== env.EXPORT_KEY) return json(req, { error: 'nope' }, 403);
      let cursor; const rows = ['contact,kind,fables,ts,ipHash'];
      do {
        const l = await env.SINK.list({ prefix: 'c:', cursor, limit: 1000 });
        for (const k of l.keys) { const v = await env.SINK.get(k.name, 'json'); if (v) rows.push([k.name.slice(2), v.kind, v.fables || 0, v.ts, v.ip || ''].join(',')); }
        cursor = l.list_complete ? null : l.cursor;
      } while (cursor);
      return new Response(rows.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="sink-list.csv"' } });
    }

    if (path === '/admin' && req.method === 'DELETE') {
      if (!env.EXPORT_KEY || url.searchParams.get('key') !== env.EXPORT_KEY) return json(req, { error: 'nope' }, 403);
      const n = normalise(url.searchParams.get('contact'));
      if (!n) return json(req, { error: 'invalid contact' }, 400);
      const key = 'c:' + n.value; const had = await env.SINK.get(key, 'json');
      if (had) { await env.SINK.delete(key); const t = await totals(env); t.count = Math.max(0, t.count - 1); t.fables = Math.max(0, t.fables - (had.fables || 0)); await env.SINK.put('__totals', JSON.stringify(t)); }
      return json(req, { ok: true, removed: !!had });
    }

    if (path === '/join' && req.method === 'POST') {
      let body; try { body = await req.json(); } catch { return json(req, { error: 'bad json' }, 400); }
      const n = normalise(body.contact);
      if (!n) return json(req, { error: 'enter an X handle or an email' }, 400);
      let fables = Math.floor(Number(String(body.fables || '0').replace(/[^0-9.]/g, '')) || 0);
      if (fables < 0 || fables > 2e8) fables = 0; // more than the supply is a typo
      const key = 'c:' + n.value;
      const existing = await env.SINK.get(key, 'json');
      if (existing) return json(req, { ok: true, position: existing.pos, already: true });
      const ip = req.headers.get('CF-Connecting-IP') || '';
      const ipHash = (await sha('sink|' + ip)).slice(0, 16);
      const ipKey = 'ip:' + ipHash;
      const ipCount = parseInt((await env.SINK.get(ipKey)) || '0', 10);
      if (ipCount >= 10) return json(req, { error: 'too many from this network' }, 429);
      const t = await totals(env);
      t.count += 1; t.fables += fables;
      await env.SINK.put(key, JSON.stringify({ kind: n.kind, fables, ts: new Date().toISOString(), ip: ipHash, pos: t.count }));
      await env.SINK.put('__totals', JSON.stringify(t));
      await env.SINK.put(ipKey, String(ipCount + 1), { expirationTtl: 172800 });
      return json(req, { ok: true, position: t.count });
    }

    return json(req, { error: 'not found' }, 404);
  }
};
