/* Frido Marketplace Intelligence — enterprise UI, Frido design language.
   Data model & scoring preserved; rendering rebuilt as reusable components. */
(async function () {
  // ================= utilities =================
  const $ = (s, el) => (el || document).querySelector(s);
  const app = $("#app");
  const num = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/,/g, ""));
    return isNaN(n) ? null : n;
  };
  const inr = (v) => (v == null ? "—" : "₹" + v.toLocaleString("en-IN"));
  const fmt = (v) => (v == null ? "—" : v.toLocaleString("en-IN"));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const I = (name, size) => `<span class="ic" ${size ? `style="--s:${size}px"` : ""}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${size ? `width="${size}" height="${size}"` : ""}>${window.LUCIDE[name] || ""}</svg></span>`;
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = I(el.dataset.icon); });

  const brandOf = (t) => {
    const m = String(t || "").match(/^[A-Za-z][\w.'()-]*(?:\s+[A-Z][\w.'()-]*)?/);
    return m ? m[0].replace(/\s+(Premium|Orthopedic|Memory|Seat|Coccyx|Ultimate|Car|Barefoot|Pregnancy|Nasal|Posture).*$/i, "") : "—";
  };
  const isFrido = (r) => {
    if (typeof r.isFrido === "boolean") return r.isFrido;
    const s = `${r.brand || ""} ${r.title || ""}`;
    return /frido/i.test(s) && !/copycat|copies|generic/i.test(s);
  };
  // Bestseller = Amazon's literal "Bestseller" badge, captured on-page. Flipkart's
  // mobile search state exposes no equivalent designation — never simulated.
  const isBestseller = (r) => r.badge === "Bestseller";
  const BestsellerBadge = () => `<span class="chip warn">${I("award")}Bestseller</span>`;
  const NoBestsellers = (scope) => `<div class="empty-state">${I("award")}No Bestseller Products Found${scope ? ` — ${scope}` : ""}.</div>`;

  // theme
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
  };

  // tooltip
  const tip = $("#tip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) {
      tip.textContent = t.dataset.tip; tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 330) + "px";
      tip.style.top = Math.min(e.clientY + 16, innerHeight - 60) + "px";
    } else tip.hidden = true;
  });

  // settings popover
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; };
  $("#settingsBtn").onclick = (e) => {
    e.stopPropagation();
    if (pop) return closePop();
    pop = document.createElement("div");
    pop.className = "pop";
    pop.innerHTML = `<h4>Data &amp; method</h4>
      <p>Live page-1 scrapes of amazon.in (desktop) and flipkart.com (mobile), one tracked keyword per product line. Organic ranks exclude ad slots.</p>
      <p><b>Confidence:</b> High for on-page facts (rank, price, rating, reviews, badges). Interpretations cite measured deltas only — unmeasured is shown as “—”.</p>
      <p><b>Limits:</b> single keyword per line · page 1 only · Flipkart hides prices/ad flags on mobile · trends need a second snapshot.</p>
      <p><b>Bestseller filter:</b> matches Amazon's literal on-page “Bestseller” badge only. Flipkart exposes no equivalent designation in this capture method, so Flipkart sections show “No Bestseller Products Found” rather than a fabricated status.</p>`;
    document.body.appendChild(pop);
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + "px";
    pop.style.right = Math.max(8, innerWidth - r.right) + "px";
  };
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target)) closePop(); });
  $("#refreshBtn").onclick = () => location.reload();

  // skeleton while loading
  app.innerHTML = `<div class="metrics section">${`<div class="skel"></div>`.repeat(8)}</div><div class="skel" style="min-height:340px"></div>`;

  // ================= data =================
  const tax = await (await fetch("data/taxonomy.json")).json();
  const dsIds = tax.categories.flatMap((c) => c.datasets.map((d) => d.id));
  const store = {};
  await Promise.all(dsIds.map(async (id) => {
    const g = async (mp) => { try { return await (await fetch(`data/${mp}/${id}.json`)).json(); } catch { return null; } };
    store[id] = { az: await g("amazon-in"), fk: await g("flipkart") };
  }));

  $("#tbMeta").innerHTML = `<b>Snapshot ${tax.asOf}</b> · last updated ${tax.asOf} · Amazon India + Flipkart · ${tax.categories.length} categories`;

  const azRows = (doc, key) => (doc && doc[key] ? doc[key].map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.reviews),
    brand: r.brand || brandOf(r.title), frido: isFrido(r),
  })) : []);
  const fkRows = (doc) => (doc && doc.results ? doc.results.map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.ratings),
    brand: r.brand || brandOf(r.title), frido: isFrido(r),
  })) : []);
  const dsInfo = (id, bestOnly) => {
    const { az, fk } = store[id] || {};
    let org = azRows(az, "organic"), sp = azRows(az, "sponsored"), fkr = fkRows(fk);
    const fkHadCapture = fkr.length > 0;
    if (bestOnly) {
      org = org.filter(isBestseller);
      sp = sp.filter(isBestseller);
      fkr = []; // no Flipkart bestseller signal is ever captured — never fabricated
    }
    return {
      az, fk, org, sp, fkr, fkHadCapture, bestOnly: !!bestOnly,
      fridoOrg: org.find((r) => r.frido) || null,
      fridoSp: sp.find((r) => r.frido) || null,
      fridoFk: fkr.find((r) => r.frido) || null,
      keyword: az?.keyword || fk?.keyword,
    };
  };
  const catInfos = (c, bestOnly) => c.datasets.map((d) => ({ meta: d, ...dsInfo(d.id, bestOnly) }));

  // ================= scoring (unchanged logic) =================
  function oppScore(rows, r) {
    const maxRev = Math.max(...rows.map((x) => x.reviews || 0), 1);
    const prices = rows.map((x) => x.price).filter((x) => x != null);
    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const parts = [];
    const rat = r.rating ? Math.max(0, Math.min(1, (r.rating - 3.5) / 1.0)) * 25 : 0;
    parts.push(["Rating quality", rat, r.rating ? `${r.rating}★` : "no rating"]);
    const rev = 25 * Math.log(1 + (r.reviews || 0)) / Math.log(1 + maxRev);
    parts.push(["Review volume", rev, `${fmt(r.reviews)} vs max ${fmt(maxRev)} (log)`]);
    const pr = r.price != null && pMax > pMin ? 20 * (1 - (r.price - pMin) / (pMax - pMin)) : 10;
    parts.push(["Price competitiveness", pr, r.price != null ? `${inr(r.price)} in ${inr(pMin)}–${inr(pMax)}` : "unknown → neutral 10"]);
    const bd = r.badge === "Amazon's Choice" ? 15 : r.badge === "Bestseller" ? 12 : 0;
    parts.push(["Badge", bd, r.badge || "none"]);
    const rk = r.rank ? ((11 - Math.min(r.rank, 10)) / 10) * 15 : 0;
    parts.push(["Organic rank", rk, r.rank ? `#${r.rank}` : "not ranked"]);
    return { total: Math.round(parts.reduce((a, p) => a + p[1], 0)), parts };
  }
  function threatScore(rows, r, frido) {
    const parts = [];
    const pos = frido ? (r.rank < frido.rank ? 30 : Math.max(0, 30 - (r.rank - frido.rank) * 6))
      : r.rank <= 3 ? 30 : r.rank <= 6 ? 20 : 10;
    parts.push(["Position pressure", pos, frido ? (r.rank < frido.rank ? `above Frido (#${r.rank} vs #${frido.rank})` : `#${r.rank}, below Frido`) : `#${r.rank}; Frido absent`]);
    const ratio = Math.min(3, (r.reviews || 0) / Math.max(frido?.reviews || 1, 1));
    const rev = frido ? (ratio / 3) * 25 : Math.min(25, 25 * Math.log(1 + (r.reviews || 0)) / Math.log(1 + 10000));
    parts.push(["Review muscle", rev, frido ? `${fmt(r.reviews)} vs Frido ${fmt(frido.reviews)}` : `${fmt(r.reviews)} reviews`]);
    let cut = 0;
    if (r.price != null && frido?.price != null && r.price < frido.price) cut = Math.min(25, (1 - r.price / frido.price) * 35);
    parts.push(["Price undercut", cut, frido && r.price != null ? `${inr(r.price)} vs Frido ${inr(frido.price)}` : "n/a"]);
    const bd = r.badge === "Amazon's Choice" ? 10 : r.badge === "Bestseller" ? 8 : 0;
    parts.push(["Badge", bd, r.badge || "none"]);
    const vel = /2K/.test(r.boughtPastMonth || "") ? 10 : /1K/.test(r.boughtPastMonth || "") ? 7 : r.boughtPastMonth ? 4 : 0;
    parts.push(["Sales velocity", vel, r.boughtPastMonth || "unknown"]);
    return { total: Math.round(parts.reduce((a, p) => a + p[1], 0)), parts };
  }
  function health(cat, bestOnly) {
    if (!cat.datasets.length) return null;
    const infos = catInfos(cat, bestOnly);
    const ranks = infos.map((i) => i.fridoOrg?.rank).filter(Boolean);
    const best = ranks.length ? Math.min(...ranks) : null;
    const rank40 = best ? Math.round(((11 - best) / 10) * 40) : 0;
    const fkRanks = infos.map((i) => i.fridoFk?.pos).filter(Boolean);
    const fk20 = fkRanks.length ? Math.round(((15 - Math.min(Math.min(...fkRanks), 14)) / 14) * 20) : 0;
    let rev20 = 0;
    const prim = infos[0];
    if (prim.fridoOrg) {
      const maxRev = Math.max(...prim.org.filter((r) => !r.frido).map((r) => r.reviews || 0), 1);
      rev20 = Math.round(Math.min(1, (prim.fridoOrg.reviews || 0) / maxRev) * 20);
    }
    const badge10 = infos.some((i) => i.fridoOrg?.badge === "Amazon's Choice") ? 10
      : infos.some((i) => i.fridoOrg?.badge) ? 8 : 0;
    const ads10 = infos.some((i) => i.fridoSp || i.az?.fridoSponsoredSlot) ? 10 : 0;
    return {
      total: rank40 + fk20 + rev20 + badge10 + ads10,
      parts: [["Best Amazon organic rank", rank40, best ? `#${best}` : "absent top-10"],
        ["Flipkart presence", fk20, fkRanks.length ? `#${Math.min(...fkRanks)}` : "absent page 1"],
        ["Review competitiveness", rev20, "vs strongest rival, primary keyword"],
        ["Badges", badge10, "on any Frido listing"],
        ["Sponsored backup", ads10, "Frido ads on tracked keywords"]],
    };
  }
  // Listing SEO score — computed only from captured fields
  function seoScore(r, keyword) {
    if (!r) return null;
    const parts = [];
    const len = (r.title || "").length;
    const lenPts = len >= 120 && len <= 200 ? 40 : len >= 80 ? 28 : len > 0 ? 14 : 0;
    parts.push(["Title length", lenPts, `${len} chars (120–200 ideal)`]);
    const kws = (keyword || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const hit = kws.filter((w) => (r.title || "").toLowerCase().includes(w)).length;
    const kwPts = kws.length ? Math.round((hit / kws.length) * 40) : 0;
    parts.push(["Keyword coverage", kwPts, `${hit}/${kws.length} keyword terms in title`]);
    const bPts = r.badge === "Amazon's Choice" ? 20 : r.badge === "Bestseller" ? 15 : 0;
    parts.push(["Search badge", bPts, r.badge || "none"]);
    return { total: parts.reduce((a, p) => a + p[1], 0), parts };
  }

  // ================= shared components =================
  const scoreTone = (v) => (v >= 60 ? "ok" : v >= 30 ? "warn" : "bad");
  function Ring(v, size = 92, label = "health") {
    if (v == null) return `<div class="ring"><span class="hint">—</span></div>`;
    const r = (size - 10) / 2, c = 2 * Math.PI * r;
    return `<div class="ring ${scoreTone(v)}" role="img" aria-label="${label} ${v} of 100">
      <svg width="${size}" height="${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="7"/>
      <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="7"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg>
      <div class="ring-label"><b data-count="${v}">0</b><span>${label}</span></div></div>`;
  }
  const RankChip = (r, tipTxt) => r == null
    ? `<span class="rank-pill none" ${tipTxt ? `data-tip="${esc(tipTxt)}"` : ""}>—</span>`
    : `<span class="rank-pill ${r === 1 ? "r1" : r <= 4 ? "top" : "mid"}" ${tipTxt ? `data-tip="${esc(tipTxt)}"` : ""}>#${r}</span>`;
  const MpBadge = (t) => `<span class="mp-badge">${t}</span>`;
  const PriorityBadge = (p) => `<span class="chip ${p === "P1" ? "bad" : p === "P2" ? "warn" : ""}" data-tip="Priority ${p}">${p}</span>`;
  const SignalChip = (sig) => ({
    leader: `<span class="chip ok">${I("crown")}Leader</span>`,
    contender: `<span class="chip info">${I("target")}Contender</span>`,
    attention: `<span class="chip warn">${I("triangle-alert")}Needs attention</span>`,
    absent: `<span class="chip bad">${I("circle-alert")}Absent</span>`,
    pending: `<span class="chip">${I("clock")}Pending</span>`,
    "no-bestsellers": `<span class="chip">${I("award")}No bestsellers</span>`,
  })[sig];
  const catSignal = (c, bestOnly) => {
    if (!c.datasets.length) return "pending";
    const infos = catInfos(c, bestOnly);
    if (bestOnly && infos.every((i) => !i.org.length && !i.sp.length)) return "no-bestsellers";
    const best = Math.min(...infos.map((i) => i.fridoOrg?.rank ?? 99));
    if (best === 1) return "leader";
    if (best <= 10) return "contender";
    if (infos.some((i) => i.fridoSp || i.az?.fridoSponsoredSlot || i.fridoFk)) return "attention";
    return "absent";
  };
  const Stars = (v) => {
    if (v == null) return "—";
    const full = Math.round(v);
    return `<span class="stars" data-tip="${v}★">${Array.from({ length: 5 }, (_, i) =>
      `<svg viewBox="0 0 24 24" class="${i < full ? "" : "empty"}"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`).join("")}</span>`;
  };
  const SectionHeader = (icon, title, right) =>
    `<div class="sec-head">${`<span class="ic">${I(icon)}</span>`.replace('class="ic"', 'class="ic"')}<h2>${title}</h2>${right ? `<span class="caption">${right}</span>` : ""}</div>`;
  const Collapse = (icon, title, body, open = true, count) => `
    <details class="sec" ${open ? "open" : ""}>
      <summary><span class="ic">${I(icon)}</span><h3>${title}</h3>${count != null ? `<span class="chip">${count}</span>` : ""}<span class="chev">${I("chevron-down")}</span></summary>
      <div class="sec-body">${body}</div>
    </details>`;
  const Breakdown = (s, label) => `
    <details class="brk"><summary>${I("info")} why ${label ?? "this score"}?</summary>
      <div class="why">${s.parts.map((p) => `<div><span>${p[0]}</span><b>+${Math.round(p[1])}</b><span class="hint">${esc(p[2])}</span></div>`).join("")}
      <div><span><b>Total</b></span><b>${s.total}</b><span></span></div></div></details>`;
  function Bars(rows, field, fmtV, note, max, bestOnly) {
    if (bestOnly && !rows.length) return NoBestsellers("nothing to chart for this keyword");
    const vals = rows.filter((r) => r[field] != null);
    if (!vals.length) return `<p class="hint">No ${field} data captured — shown as “—”, never guessed.</p>`;
    const mx = max || Math.max(...vals.map((r) => r[field]));
    return `<div class="bars">${rows.map((r) => {
      const v = r[field];
      const w = v == null ? 0 : Math.max(2, (v / mx) * 100);
      return `<div class="brow ${r.frido ? "frido" : ""}">
        <span class="bl" title="${esc(r.title)}">#${r.rank || r.pos} ${r.frido ? "Frido" : esc(r.brand)}</span>
        <span class="btrack"><span class="bfill" style="width:${w}%" data-tip="${esc((r.title || "").slice(0, 110))} — ${fmtV(v)}"></span></span>
        <span class="bv">${fmtV(v)}</span></div>`;
    }).join("")}</div><p class="kv-note">${note}</p>`;
  }
  function RankTable(rows, az, bestOnly) {
    if (!rows.length) return bestOnly ? NoBestsellers() : `<p class="hint">No results captured.</p>`;
    return `<div style="overflow-x:auto;margin:0 -20px"><table class="tbl" style="min-width:640px">
      <thead><tr><th style="top:0">#</th><th style="top:0">Product</th><th style="top:0" class="num">Price</th>
      <th style="top:0" class="num">Rating</th><th style="top:0" class="num">Reviews</th>${az ? '<th style="top:0">Badge</th>' : ""}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.frido ? "frido-row" : ""}">
        <td>${RankChip(r.rank || r.slot || r.pos)}</td>
        <td><div class="cell-title">${az && r.asin
          ? `<a class="plink" href="https://www.amazon.in/dp/${r.asin}" target="_blank" rel="noopener"><span class="t">${esc(r.brand)}${r.frido ? ` <span class="chip brand">Frido</span>` : ""}</span><span class="s clip" title="${esc(r.title)}">${esc(r.title)}</span></a>`
          : `<span class="t">${esc(r.brand)}${r.frido ? ` <span class="chip brand">Frido</span>` : ""}</span><span class="s clip" title="${esc(r.title)}">${esc(r.title)}</span>`}</div></td>
        <td class="num">${inr(r.price)}</td>
        <td class="num">${Stars(r.rating)}</td>
        <td class="num">${fmt(r.reviews)}</td>
        ${az ? `<td>${r.badge === "Bestseller" ? BestsellerBadge() : r.badge ? `<span class="chip info">${I("badge-check")}${r.badge}</span>` : '<span class="hint">—</span>'}</td>` : ""}
      </tr>`).join("")}</tbody></table></div>`;
  }
  function MetricCard({ icon, label, value, small, desc, trend, accent, tipTxt }) {
    return `<div class="metric" ${accent ? `style="--metric-accent:${accent}"` : ""} ${tipTxt ? `data-tip="${esc(tipTxt)}"` : ""}>
      <div class="m-top"><span class="m-ic">${I(icon)}</span><span class="m-label">${label}</span></div>
      <div class="m-value">${value}${small ? `<small> ${small}</small>` : ""}</div>
      ${desc ? `<div class="m-desc">${desc}</div>` : ""}
      <div class="m-trend">${I("activity")}${trend || "first snapshot — trend pending"}</div></div>`;
  }
  function animateCounters(scope) {
    (scope || document).querySelectorAll("[data-count]").forEach((el) => {
      const target = +el.dataset.count; const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 600);
        el.textContent = Math.round(target * (p * (2 - p)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // pros/cons vs Frido from measured deltas only
  function prosCons(r, frido) {
    const pros = [], cons = [];
    if (frido) {
      if (r.price != null && frido.price != null) {
        if (r.price < frido.price) pros.push(`${Math.round((1 - r.price / frido.price) * 100)}% cheaper than Frido`);
        else if (r.price > frido.price) cons.push(`${Math.round((r.price / frido.price - 1) * 100)}% pricier than Frido`);
      }
      if ((r.reviews || 0) > (frido.reviews || 0)) pros.push(`${(r.reviews / Math.max(frido.reviews, 1)).toFixed(1)}× Frido's reviews`);
      else if (r.reviews != null && frido.reviews) cons.push(`${Math.round((1 - r.reviews / frido.reviews) * 100)}% fewer reviews than Frido`);
      if ((r.rating || 0) > (frido.rating || 0)) pros.push(`Higher rating (${r.rating}★ vs ${frido.rating}★)`);
      else if (r.rating != null && frido.rating > r.rating) cons.push(`Lower rating (${r.rating}★ vs ${frido.rating}★)`);
    }
    if (r.badge) pros.push(`${r.badge} badge`);
    if (r.boughtPastMonth) pros.push(`${r.boughtPastMonth} bought past month`);
    if (!pros.length) pros.push("No measured advantage — likely relevance/CTR (unknown)");
    return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
  }

  // curated actions (unchanged content)
  const curated = {
    cushions: [
      ["HIGH", "Report the copycat listing", "Organic #6 for “coccyx seat cushion” (ASIN B0G59114Q3, ₹539) copies Frido's title verbatim incl. “Proprietary Hi-Per Foam”. Brand-registry takedown removes a cheap decoy directly below Frido."],
      ["HIGH", "Fix the coccyx price ladder", "Everything above Frido (#5) costs ₹449–999 vs ₹1,513. Frido wins wedge at ₹1,299 — premium works when the gap is narrower. Consider value variant / coupon."],
      ["MED", "Lumbar: ads without organic", "Sponsored slot 6 on “lumbar support for office chair” with no top-10 organic rank — review title/backend keywords for the backrest line."],
      ["HIGH", "Flipkart coccyx absence", "Frido is absent from Flipkart page 1 in its hero cushion category, which FOVERA/Tender Care/DEBIK own."]],
    pillows: [
      ["MED", "Sleep pillow: ads without organic", "Sponsored slot 2 on “memory foam pillow” but no top-10 organic rank; cervical pillow ranks #4. Keyword coverage on sleep-pillow listings needs work."],
      ["MED", "Cervical pillow badge chase", "#4 organic — velocity and review growth feed Amazon's Choice eligibility."]],
    "mobility-devices": [["MED", "Wheelchair cushion: ads without organic", "Sponsored slot 3 on “wheelchair cushion”, no top-10 organic. Dedicated listing or keyword optimization needed."]],
    insoles: [["MED", "Defend #2 in insoles", "Organic #2 with sponsored slot 4 backup — monitor the #1 and keep velocity."]],
    workspace: [["MED", "Footrest invisible on keyword", "No Frido presence in top-10 for “foot rest under desk” despite Frido selling footrests — verify the keyword the listing targets."]],
    chairs: [["LOW", "Ergonomic chair — no page-1 presence", "High-competition category; assess if chairs are a marketplace priority or D2C-only play."]],
    barefoot: [["MED", "Strong on Flipkart (#2), absent on Amazon", "Amazon “barefoot shoes” top-10 has no Frido; replicate the Flipkart listing strategy on Amazon."]],
    "maternity-baby-care": [["MED", "Pregnancy pillow #6 — review gap", "Leaders carry larger review bases. Velocity program + A+ refresh."]],
    footwear: [["MED", "Ortho slippers absent on Amazon keyword", "Flipkart #3 but no Amazon top-10 for “orthopedic slippers” — check Amazon listing keyword coverage."]],
    socks: [["LOW", "Socks not found on tracked keyword", "Confirm which sock keyword Frido targets (“cushioned socks” shows no Frido) before investing."]],
    "mattress-topper-protector": [["MED", "Topper #4 with slot 2 ads", "Solid position; watch price band and push for badge."]],
    orthotics: [["LOW", "Posture corrector: no page-1 presence", "Huge belt-brand-dominated category (TENACT owns Flipkart page 1). Assess marketplace push vs D2C."]],
    "personal-care": [["LOW", "Nasal strips: no page-1 presence", "Category led by established breathing brands; new line likely needs ads to seed visibility."]],
    accessories: [["MED", "Car neck rest: #8 organic + slot 8 ads", "#8 Amazon / #9 Flipkart — mid-pack. Review price band and hero image vs leaders."]],
  };
  const impactChip = (i) => i === "HIGH"
    ? `<span class="tagline" style="--i-accent:var(--bad-fg)">High impact</span>`
    : i === "MED" ? `<span class="tagline" style="--i-accent:var(--warn-fg)">Medium impact</span>`
    : `<span class="tagline" style="--i-accent:var(--muted)">Long-term</span>`;

  // header category selector
  const sel = $("#catSelect");
  sel.innerHTML = `<option value="">All categories</option>` +
    tax.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.onchange = () => { location.hash = sel.value ? "#/" + sel.value : "#/"; };
  let mpFocus = "all";
  $("#mpSelect").onchange = (e) => { mpFocus = e.target.value; route(); };

  // global bestseller filter — modular across home + every category page
  let bestOnly = localStorage.getItem("fmi-best") === "1";
  const bestToggle = $("#bestToggle");
  const syncBestToggle = () => bestToggle.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("on", (b.dataset.best === "1") === bestOnly));
  bestToggle.querySelectorAll("button").forEach((b) => b.onclick = () => {
    bestOnly = b.dataset.best === "1";
    localStorage.setItem("fmi-best", bestOnly ? "1" : "0");
    syncBestToggle();
    route();
  });
  syncBestToggle();
  const FilterBanner = () => `<div class="filter-banner">${I("award")}
    <span><b>Best sellers only</b> — every table, chart, score and metric below reflects Amazon Bestseller-badged products only. Flipkart has no captured bestseller signal, so its sections show “No Bestseller Products Found”.</span>
    <button id="clearBestBtn">Show all products</button></div>`;
  const wireFilterBanner = () => { $("#clearBestBtn")?.addEventListener("click", () => { bestOnly = false; localStorage.setItem("fmi-best", "0"); syncBestToggle(); route(); }); };

  // global bestseller landscape — always computed from full (unfiltered) data
  function bestsellerStats() {
    const azSeen = new Set(); let fridoCount = 0; const competitorSet = new Set();
    tax.categories.forEach((c) => c.datasets.forEach((d) => {
      const info = dsInfo(d.id, false);
      [...info.org, ...info.sp].forEach((r) => {
        if (r.badge !== "Bestseller") return;
        const key = r.asin || `${d.id}:${r.title}`;
        if (azSeen.has(key)) return;
        azSeen.add(key);
        if (r.frido) fridoCount++; else competitorSet.add(r.brand);
      });
    }));
    return { azCount: azSeen.size, fkCount: 0, fridoCount, competitorCount: competitorSet.size };
  }

  // export CSV (overview)
  $("#exportBtn").onclick = () => {
    const rows = [["Category", "Priority", "Keyword", "Amazon organic", "Amazon ad slot", "Flipkart", "Health", "Signal", "Filter"]];
    tax.categories.forEach((c) => {
      const infos = catInfos(c, bestOnly); const prim = infos[0]; const h = health(c, bestOnly);
      rows.push([c.name, c.priority, prim?.keyword || "", prim?.fridoOrg?.rank || "", prim?.fridoSp?.slot || prim?.az?.fridoSponsoredSlot || "", prim?.fridoFk?.pos || "", h?.total ?? "", catSignal(c, bestOnly), bestOnly ? "Bestsellers only" : "All products"]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `frido-marketplace-overview-${tax.asOf}${bestOnly ? "-bestsellers" : ""}.csv`; a.click();
  };

  // ================= HOME =================
  let view = localStorage.getItem("fmi-view") || "table";
  let query = "", filter = "all", sortKey = "health", sortDir = -1;

  function homeData(bestOnly) {
    return tax.categories.map((c) => {
      const infos = catInfos(c, bestOnly);
      const prim = infos[0];
      const h = health(c, bestOnly);
      const ranks = infos.map((i) => i.fridoOrg?.rank).filter(Boolean);
      const opp = prim?.org.length ? prim.org.map((r) => ({ r, s: oppScore(prim.org, r) })).sort((a, b) => b.s.total - a.s.total)[0] : null;
      return {
        c, infos, prim, h,
        signal: catSignal(c, bestOnly),
        azRank: ranks.length ? Math.min(...ranks) : null,
        avgRank: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
        fkRank: prim?.fridoFk?.pos ?? (infos.find((i) => i.fridoFk)?.fridoFk?.pos ?? null),
        adSlot: prim?.fridoSp?.slot || prim?.az?.fridoSponsoredSlot || null,
        leader: prim?.org[0] || null,
        opp,
        listings: infos.reduce((a, i) => a + i.org.length + i.sp.length + i.fkr.length, 0),
      };
    });
  }

  function renderHome() {
    document.title = "Frido Marketplace Intelligence";
    sel.value = "";
    const rows = homeData(bestOnly);
    const live = rows.filter((r) => r.c.datasets.length);
    const organicIn = live.filter((r) => r.azRank || r.fkRank);
    const leaders = live.filter((r) => r.azRank === 1);
    const ads = live.filter((r) => r.adSlot);
    const adsNoOrg = live.filter((r) => r.adSlot && !r.azRank);
    const avgRank = (() => { const a = live.map((r) => r.avgRank).filter(Boolean); return a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—"; })();
    const avgHealth = Math.round(live.reduce((a, r) => a + (r.h?.total || 0), 0) / live.length);
    const quickWins = Object.values(curated).flat().filter((x) => x[0] === "HIGH").length;
    const bs = bestsellerStats();

    const metrics = [
      MetricCard({ icon: "layers", label: "Categories tracked", value: tax.categories.length, small: `· ${live.length} live`, desc: `${tax.categories.length - live.length} pending keyword confirmation`, accent: "var(--accent)" }),
      MetricCard({ icon: "store", label: "Marketplace coverage", value: "2", small: "marketplaces", desc: "Amazon India + Flipkart · Myntra excluded", accent: "var(--accent)" }),
      MetricCard({ icon: "eye", label: "Organic visibility", value: organicIn.length, small: `/ ${live.length}`, desc: "categories with page-1 organic presence", accent: "var(--ok-fg)" }),
      MetricCard({ icon: "megaphone", label: "Sponsored presence", value: ads.length, small: "categories", desc: `${adsNoOrg.length} run ads with no organic top-10`, accent: "var(--warn-fg)" }),
      MetricCard({ icon: "gauge", label: "Average organic rank", value: avgRank, desc: "across categories where Frido ranks", accent: "var(--accent)" }),
      MetricCard({ icon: "crown", label: "Category leaders", value: leaders.length, desc: leaders.map((l) => l.c.name).join(", ") || "none yet", accent: "var(--ok-fg)" }),
      MetricCard({ icon: "target", label: "Avg health score", value: avgHealth, small: "/100", desc: "rank + coverage + reviews + badges + ads", accent: "var(--accent)" }),
      MetricCard({ icon: "wallet", label: "Revenue opportunity", value: "—", desc: "needs sales/volume data (Helium10 · Keepa export)", accent: "var(--muted)", tipTxt: "Not fabricated — plug in a keyword-tool export to light this up" }),
      MetricCard({ icon: "zap", label: "Quick wins", value: quickWins, desc: "high-impact actions ready in category pages", accent: "var(--frido-yellow)" }),
      MetricCard({ icon: "award", label: "Amazon Bestsellers", value: bs.azCount, desc: "distinct Bestseller-badged listings across tracked keywords", accent: "var(--warn-fg)" }),
      MetricCard({ icon: "store", label: "Flipkart Bestsellers", value: bs.fkCount, desc: "no bestseller signal captured for Flipkart", accent: "var(--muted)", tipTxt: "Flipkart's mobile search page exposes no bestseller/equivalent designation in this capture method — shown as 0, not fabricated." }),
      MetricCard({ icon: "crown", label: "Frido Bestseller products", value: bs.fridoCount, desc: "Frido listings carrying the Bestseller badge", accent: "var(--ok-fg)" }),
      MetricCard({ icon: "swords", label: "Competitors w/ Bestsellers", value: bs.competitorCount, desc: "distinct competitor brands holding a Bestseller badge", accent: "var(--bad-fg)" }),
    ].join("");

    const visible = rows
      .filter((r) => !query || r.c.name.toLowerCase().includes(query) || (r.prim?.keyword || "").includes(query))
      .filter((r) => filter === "all" ? true : r.signal === filter)
      .sort((a, b) => {
        const g = (r) => sortKey === "health" ? (r.h?.total ?? -1) : sortKey === "az" ? -(r.azRank ?? 99) : sortKey === "fk" ? -(r.fkRank ?? 99) : sortKey === "name" ? r.c.name : r.c.priority;
        const x = g(a), y = g(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
      }).sort((a, b) => {
        // pending categories always sink to the bottom
        const pa = a.c.datasets.length ? 0 : 1, pb = b.c.datasets.length ? 0 : 1;
        return pa - pb;
      });

    const th = (label, key, cls) => `<th class="${cls || ""}"><button aria-sort="${sortKey === key ? (sortDir === 1 ? "ascending" : "descending") : "none"}" data-sort="${key}">${label} ${sortKey === key ? (sortDir === 1 ? "↑" : "↓") : ""}</button></th>`;
    const showAz = mpFocus !== "fk", showFk = mpFocus !== "az";

    const tableView = `<div class="panel">
      <div class="toolbar">
        <span class="searchbox">${I("search")}<input id="q" placeholder="Search categories or keywords…" value="${esc(query)}" aria-label="Search"></span>
        <span class="seg" role="tablist">${[["all", "All"], ["leader", "Leaders"], ["contender", "Contenders"], ["attention", "Needs attention"], ["absent", "Absent"], ["pending", "Pending"], ...(bestOnly ? [["no-bestsellers", "No bestsellers"]] : [])].map(([k, l]) =>
          `<button class="${filter === k ? "on" : ""}" data-filter="${k}">${l}</button>`).join("")}</span>
        <span class="seg" style="margin-left:auto">
          <button class="${view === "table" ? "on" : ""}" data-view="table">${I("table-2")}Table</button>
          <button class="${view === "cards" ? "on" : ""}" data-view="cards">${I("layout-grid")}Cards</button></span>
      </div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr>${th("Category", "name")}<th>Status</th><th class="hide-m">Keyword</th>
        ${showAz ? th("Amazon", "az", "num") + '<th class="num hide-m">Ad slot</th>' : ""}
        ${showFk ? th("Flipkart", "fk", "num") : ""}
        <th class="hide-m">Leader</th>${th("Health", "health", "num")}</tr></thead>
        <tbody>${visible.map((r) => `<tr class="rowlink" data-go="${r.c.id}" tabindex="0">
          <td><div class="cell-title"><span class="t">${r.c.icon} ${esc(r.c.name)}</span><span class="s">${PriorityBadge(r.c.priority)} ${r.listings ? r.listings + " listings" : ""}</span></div></td>
          <td>${SignalChip(r.signal)}</td>
          <td class="hide-m caption">${esc(r.prim?.keyword || "—")}</td>
          ${showAz ? `<td class="num">${RankChip(r.azRank, r.avgRank && r.avgRank !== r.azRank ? `best rank · avg #${r.avgRank.toFixed(1)}` : "organic rank")}</td>
          <td class="num hide-m">${r.adSlot ? `<span class="chip warn">${I("megaphone")}${r.adSlot}</span>` : '<span class="hint">—</span>'}</td>` : ""}
          ${showFk ? `<td class="num">${RankChip(r.fkRank)}</td>` : ""}
          <td class="hide-m">${r.leader ? `${esc(r.leader.frido ? "Frido" : r.leader.brand)}${r.leader.badge === "Bestseller" ? " " + BestsellerBadge() : ""}` : bestOnly && r.c.datasets.length ? '<span class="hint">no bestsellers</span>' : "—"}</td>
          <td class="num"><b>${r.h ? r.h.total : "—"}</b></td>
        </tr>`).join("")}</tbody></table></div>
        ${!visible.length ? (bestOnly ? NoBestsellers("try clearing search or switching off the bestseller filter") : `<div class="empty-state">${I("search")}No categories match your search/filter.</div>`) : ""}</div>`;

    const cardsView = `<div class="cat-grid">${visible.map((r) => {
      const c = r.c;
      if (!c.datasets.length) return `<a class="cat-card pending" href="#/${c.id}">
        <div class="cc-top"><span class="cc-ic">${c.icon}</span><h3>${esc(c.name)}</h3>${SignalChip("pending")}</div>
        <p class="hint">${esc(c.pendingReason || "Awaiting keyword confirmation")}</p>
        <div class="cc-foot">${PriorityBadge(c.priority)}</div></a>`;
      return `<a class="cat-card" href="#/${c.id}">
        <div class="cc-top"><span class="cc-ic">${c.icon}</span><h3>${esc(c.name)}</h3>${Ring(r.h.total, 54, "")}</div>
        <div class="cc-stats">
          <div class="st"><b>${r.infos.some((i) => i.org.length) ? "AZ" : ""}${r.infos.some((i) => i.org.length) && r.infos.some((i) => i.fkr.length) ? " · " : ""}${r.infos.some((i) => i.fkr.length) ? "FK" : ""}</b><span>Coverage</span></div>
          <div class="st"><b>${r.listings}</b><span>Listings tracked</span></div>
          <div class="st"><b>${r.avgRank ? "#" + r.avgRank.toFixed(1) : "—"}</b><span>Avg organic rank</span></div>
          <div class="st"><b>${r.leader ? esc(r.leader.frido ? "Frido" : r.leader.brand) : (bestOnly ? "no bestsellers" : "—")}</b><span>Current leader</span></div>
          <div class="st"><b>${r.opp ? esc(r.opp.r.frido ? "Frido" : r.opp.r.brand) + " · " + r.opp.s.total : "—"}</b><span>Top opportunity</span></div>
          <div class="st"><b>—</b><span>Trend (first snapshot)</span></div>
        </div>
        <div class="cc-foot">${PriorityBadge(c.priority)}${SignalChip(r.signal)}${r.leader?.badge === "Bestseller" ? BestsellerBadge() : ""}</div></a>`;
    }).join("")}</div>`;

    app.innerHTML = `
      <section class="section">
        ${SectionHeader("gauge", "Executive summary", `snapshot ${tax.asOf}`)}
        <div class="metrics">${metrics}</div>
      </section>
      <section class="section">
        ${SectionHeader("layers", "Category intelligence", "Frido's official taxonomy — click any category")}
        ${bestOnly ? FilterBanner() : ""}
        ${view === "table" ? tableView : cardsView}
      </section>`;

    animateCounters(app);
    wireFilterBanner();
    $("#q")?.addEventListener("input", (e) => { query = e.target.value.toLowerCase(); renderHome(); $("#q").focus(); const v = $("#q").value; $("#q").setSelectionRange(v.length, v.length); });
    app.querySelectorAll("[data-filter]").forEach((b) => b.onclick = () => { filter = b.dataset.filter; renderHome(); });
    app.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => { view = b.dataset.view; localStorage.setItem("fmi-view", view); renderHome(); });
    app.querySelectorAll("[data-sort]").forEach((b) => b.onclick = () => {
      if (sortKey === b.dataset.sort) sortDir *= -1; else { sortKey = b.dataset.sort; sortDir = -1; }
      renderHome();
    });
    app.querySelectorAll("[data-go]").forEach((tr) => {
      const go = () => { location.hash = "#/" + tr.dataset.go; };
      tr.onclick = go;
      tr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
  }

  // ================= CATEGORY =================
  function renderCat(id) {
    const c = tax.categories.find((x) => x.id === id);
    if (!c) return renderHome();
    document.title = `${c.name} — Frido Intelligence`;
    sel.value = c.id;

    if (!c.datasets.length) {
      app.innerHTML = `<a class="crumb" href="#/">${I("arrow-left")} All categories</a>
        <div class="panel panel-pad">
          <div class="sec-head"><span class="cc-ic">${c.icon}</span><h2 class="h-l">${esc(c.name)}</h2>${SignalChip("pending")}</div>
          <p style="max-width:60ch">${esc(c.pendingReason || "Awaiting keyword confirmation.")}</p>
          <p class="kv-note">Give the analyst the search keyword that represents this Frido line and it will be captured in the next refresh. Nothing is invented for pending categories.</p>
        </div>`;
      return;
    }

    const infos = catInfos(c, bestOnly);
    const prim = infos[0];
    const h = health(c, bestOnly);

    // competitor aggregation
    const compMap = {};
    infos.forEach((i) => i.org.forEach((r) => {
      if (r.frido) return;
      const k = r.brand.toLowerCase();
      (compMap[k] ||= { brand: r.brand, bestRank: 99, entry: r, rows: i.org, frido: i.fridoOrg, mps: new Set(["AZ"]) });
      const m = compMap[k];
      if (r.rank < m.bestRank) { m.bestRank = r.rank; m.entry = r; m.rows = i.org; m.frido = i.fridoOrg; }
    }));
    infos.forEach((i) => i.fkr.forEach((r) => {
      const k = r.brand.toLowerCase();
      if (compMap[k]) compMap[k].mps.add("FK");
    }));
    const comps = Object.values(compMap).sort((a, b) => a.bestRank - b.bestRank).slice(0, 6)
      .map((m) => ({ ...m, threat: threatScore(m.rows, m.entry, m.frido), opp: oppScore(m.rows, m.entry) }))
      .sort((a, b) => b.threat.total - a.threat.total);

    // Frido scorecard
    const fr = prim.fridoOrg;
    const seo = seoScore(fr, prim.keyword);
    const frOpp = fr ? oppScore(prim.org, fr) : null;
    const sub = (label, v, why, icon) => v == null
      ? `<div class="prog"><span class="pl">${I(icon)}${label}</span><span class="track"></span><span class="pv hint" data-tip="${esc(why)}">—</span></div>`
      : `<div class="prog" data-tip="${esc(why)}"><span class="pl">${I(icon)}${label}</span><span class="track"><span class="fill" style="width:${v}%"></span></span><span class="pv">${v}</span></div>`;
    const pctFrom = (part, max) => part == null ? null : Math.round((part / max) * 100);
    const scorecard = `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        ${Ring(h.total, 116, "overall")}
        <div style="flex:1;min-width:260px;display:grid;gap:10px">
          ${sub("Opportunity", frOpp?.total ?? null, frOpp ? "Frido's opportunity score on the primary keyword" : "Frido not ranked on primary keyword", "sparkles")}
          ${sub("Listing SEO", seo?.total ?? null, seo ? seo.parts.map((p) => `${p[0]}: +${p[1]}`).join(" · ") : "no Frido listing captured", "file-search")}
          ${sub("Pricing", pctFrom(frOpp?.parts[2][1], 20), frOpp ? frOpp.parts[2][2] : "n/a", "tag")}
          ${sub("Reviews", pctFrom(frOpp?.parts[1][1], 25), frOpp ? frOpp.parts[1][2] : "n/a", "message-square")}
          ${sub("Rating", pctFrom(frOpp?.parts[0][1], 25), frOpp ? frOpp.parts[0][2] : "n/a", "star")}
          ${sub("Content", fr?.images != null ? Math.round(((Math.min(fr.images, 9) / 9) * 50) + (fr.aplus ? 25 : 0) + (fr.video ? 25 : 0)) : null, fr?.images != null ? `${fr.images} images · A+ ${fr.aplus ? "yes" : "no"} · video ${fr.video ? "yes" : "no"}` : "detail-page data not captured for this category yet", "image")}
        </div>
      </div>
      ${h ? Breakdown(h, "the overall score") : ""}`;

    // hero metric strip
    const strip = [
      MetricCard({ icon: "list-ordered", label: "Amazon organic", value: fr ? "#" + fr.rank : "—", desc: esc(prim.keyword || ""), accent: fr ? (fr.rank <= 3 ? "var(--ok-fg)" : "var(--accent)") : "var(--bad-fg)" }),
      MetricCard({ icon: "megaphone", label: "Sponsored slot", value: prim.fridoSp?.slot || prim.az?.fridoSponsoredSlot || "—", desc: prim.fridoSp || prim.az?.fridoSponsoredSlot ? "Frido runs ads on this keyword" : "no ad detected", accent: "var(--warn-fg)" }),
      MetricCard({ icon: "store", label: "Flipkart", value: prim.fridoFk ? "#" + prim.fridoFk.pos : "—", desc: prim.fkr.length ? (prim.fridoFk ? "page-1 presence" : "absent page 1") : "no capture", accent: prim.fridoFk ? "var(--accent)" : "var(--bad-fg)" }),
      MetricCard({ icon: "swords", label: "Top threat", value: comps[0] ? esc(comps[0].brand) : "—", desc: comps[0] ? `threat ${comps[0].threat.total}/100` : "", accent: "var(--bad-fg)" }),
    ].join("");

    // keyword analysis
    const kwTable = `<div style="overflow-x:auto"><table class="tbl" style="min-width:560px">
      <thead><tr><th style="top:0">Tracked keyword</th><th style="top:0" class="num">Amazon organic</th><th style="top:0" class="num">Ad slot</th><th style="top:0" class="num">Flipkart</th><th style="top:0">Keyword leader</th></tr></thead>
      <tbody>${infos.map((i) => `<tr>
        <td class="caption" style="font-weight:550;color:var(--ink)">${esc(i.keyword)}</td>
        <td class="num">${RankChip(i.fridoOrg?.rank ?? null)}</td>
        <td class="num">${(i.fridoSp?.slot || i.az?.fridoSponsoredSlot) ? `<span class="chip warn">${i.fridoSp?.slot || i.az.fridoSponsoredSlot}</span>` : '<span class="hint">—</span>'}</td>
        <td class="num">${RankChip(i.fridoFk?.pos ?? null)}</td>
        <td>${i.org[0] ? `${i.org[0].frido ? '<span class="chip brand">Frido</span>' : esc(i.org[0].brand)}${i.org[0].badge === "Bestseller" ? " " + BestsellerBadge() : ""}` : bestOnly ? '<span class="hint">no bestsellers</span>' : "—"}</td></tr>`).join("")}</tbody></table></div>
      <p class="kv-note">One keyword per product line so far — more can be added on request.</p>`;

    // competitor hero cards
    const compCards = comps.map((m) => {
      const pc = prosCons(m.entry, m.frido);
      return `<article class="comp-card">
        <div class="comp-head">
          <span class="avatar">${esc(m.brand.slice(0, 2).toUpperCase())}</span>
          <span class="ttl"><b>${esc(m.brand)}</b>
            ${m.entry.asin ? `<a href="https://www.amazon.in/dp/${m.entry.asin}" target="_blank" rel="noopener">View listing ${I("external-link")}</a>` : `<span class="caption">listing link n/a</span>`}</span>
          ${RankChip(m.bestRank, "best organic rank")}
          <span style="display:flex;gap:4px">${[...m.mps].map(MpBadge).join("")}${m.entry.badge === "Bestseller" ? BestsellerBadge() : ""}</span>
        </div>
        <div class="comp-nums">
          <div class="n"><b>${inr(m.entry.price)}</b><span>Price</span></div>
          <div class="n"><b>${m.entry.rating ?? "—"}★</b><span>Rating</span></div>
          <div class="n"><b>${fmt(m.entry.reviews)}</b><span>Reviews</span></div>
        </div>
        <ul class="pros-cons">
          ${pc.pros.map((p) => `<li class="pro"><span class="ic">${I("check")}</span>${esc(p)}</li>`).join("")}
          ${pc.cons.map((p) => `<li class="con"><span class="ic">${I("x")}</span>${esc(p)}</li>`).join("")}
        </ul>
        <div class="strength">
          <span class="sc s"><span class="overline">Strength ${m.threat.total}</span><span class="meter"><i style="width:${m.threat.total}%"></i></span></span>
          <span class="sc w"><span class="overline">Weakness ${100 - m.opp.total}</span><span class="meter"><i style="width:${100 - m.opp.total}%"></i></span></span>
        </div>
        ${Breakdown(m.threat, "this threat score")}
      </article>`;
    }).join("");

    // rankings per keyword (tabbed)
    const kwTabs = `<div class="seg" role="tablist" id="kwTabs" style="margin-bottom:14px">${infos.map((i, n) =>
      `<button class="${n === 0 ? "on" : ""}" data-kw="${n}">${esc(i.keyword)}</button>`).join("")}</div>`;
    const kwPanes = infos.map((i, n) => {
      const opp = i.org.map((r) => ({ r, s: oppScore(i.org, r) })).sort((a, b) => b.s.total - a.s.total);
      const fkBody = i.fkr.length ? RankTable(i.fkr, false)
        : bestOnly ? NoBestsellers("Flipkart exposes no bestseller signal in this capture method")
        : `<p class="hint">No Flipkart capture for this keyword.</p>` + (i.fk?.notes?.length ? `<p class="kv-note">${i.fk.notes.map(esc).join(" · ")}</p>` : "");
      return `<div class="kwpane" data-pane="${n}" ${n ? "hidden" : ""}>
        ${Collapse("list-ordered", "Organic rankings — Amazon", RankTable(i.org, true, bestOnly), true, i.org.length)}
        ${Collapse("megaphone", "Sponsored rankings — Amazon", RankTable(i.sp, true, bestOnly), false, i.sp.length)}
        ${Collapse("store", "Flipkart page 1", fkBody, false, i.fkr.length || null)}
        ${Collapse("tag", "Pricing comparison", Bars(i.org, "price", inr, "Organic top 10, listed price ₹ — Frido in blue.", null, bestOnly), false)}
        ${Collapse("message-square", "Review comparison", Bars(i.org, "reviews", fmt, "Rating counts — social proof gap at a glance.", null, bestOnly), false)}
        ${Collapse("star", "Rating comparison", Bars(i.org, "rating", (v) => v == null ? "—" : v + "★", "Average star rating (bar starts at 0 — differences are small, read the numbers).", 5, bestOnly), false)}
        ${Collapse("sparkles", "Opportunity scores", opp.length ? `<div style="display:grid;gap:8px">${opp.map(({ r, s }) => `
          <div class="prog"><span class="pl" title="${esc(r.title)}">#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}</span>
          <span class="track"><span class="fill" style="width:${s.total}%;${r.frido ? "" : "background:color-mix(in srgb,var(--ink-2) 45%,var(--line))"}"></span></span>
          <span class="pv">${s.total}</span></div>${Breakdown(s, `#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}`)}`).join("")}</div>
          <p class="kv-note">Rating /25 · reviews /25 (log vs category max) · price /20 · badge /15 · rank /15 — identical formula for every product.</p>` : NoBestsellers(), false)}
        ${(i.az?.notes || []).length ? Collapse("info", "Analyst notes", `<ul style="padding-left:18px;display:grid;gap:6px;font-size:12.5px;color:var(--ink-2)">${i.az.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`, false, i.az.notes.length) : ""}
      </div>`;
    }).join("");

    // feature comparison (only captured fields)
    const rich = prim.org.filter((r) => r.images != null || r.aplus != null || r.warranty);
    const featureBlock = rich.length ? `<div style="overflow-x:auto"><table class="tbl" style="min-width:640px">
      <thead><tr><th style="top:0">Product</th><th style="top:0" class="num">Images</th><th style="top:0">A+</th><th style="top:0">Video</th><th style="top:0">Prime</th><th style="top:0">Warranty</th></tr></thead>
      <tbody>${prim.org.map((r) => `<tr class="${r.frido ? "frido-row" : ""}">
        <td><span class="clip" title="${esc(r.title)}">#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}</span></td>
        <td class="num">${r.images ?? "?"}</td>
        <td>${r.aplus == null ? "?" : r.aplus ? `<span class="chip ok">${I("check")}</span>` : `<span class="chip bad">${I("x")}</span>`}</td>
        <td>${r.video == null ? "?" : r.video ? `<span class="chip ok">${I("check")}</span>` : `<span class="chip bad">${I("x")}</span>`}</td>
        <td>${r.prime == null ? "?" : r.prime ? `<span class="chip ok">${I("check")}</span>` : `<span class="chip bad">${I("x")}</span>`}</td>
        <td class="caption">${esc(r.warranty || "?")}</td></tr>`).join("")}</tbody></table></div>
      <p class="kv-note">“?” = not captured for that listing. Detail pages fetched for the deep-dive set only — nothing guessed.</p>`
      : bestOnly && !prim.org.length ? NoBestsellers("nothing to compare features for")
      : `<p class="hint">Detail-page features (images, A+, video, warranty) are captured only for deep-dive categories so far — currently Cushions. Ask to deep-dive this one.</p>`;

    const recos = (curated[c.id] || []).map(([imp, t, b]) => `
      <div class="insight" style="--i-accent:${imp === "HIGH" ? "var(--bad-fg)" : imp === "MED" ? "var(--warn-fg)" : "var(--muted)"}">
        ${impactChip(imp)}<h4>${I(imp === "HIGH" ? "zap" : imp === "MED" ? "target" : "clock")}${esc(t)}</h4><p>${esc(b)}</p></div>`).join("");

    app.innerHTML = `
      <a class="crumb" href="#/">${I("arrow-left")} All categories</a>
      <section class="section">
        <div class="sec-head" style="margin-bottom:20px">
          <span class="cc-ic" style="width:44px;height:44px;font-size:22px">${c.icon}</span>
          <div><h2 class="h-xl">${esc(c.name)}</h2>
          <p class="caption">${infos.map((i) => `“${esc(i.keyword)}”`).join(" · ")} · captured ${prim.az?.capturedAt || tax.asOf}</p></div>
          <span style="margin-left:auto;display:flex;gap:8px;align-items:center">${PriorityBadge(c.priority)}${SignalChip(catSignal(c, bestOnly))}</span>
        </div>
        ${bestOnly ? FilterBanner() : ""}
        <div class="metrics" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${strip}</div>
      </section>

      <section class="section">
        ${SectionHeader("gauge", "Frido scorecard", "every score explains itself — hover or expand")}
        <div class="panel panel-pad">${scorecard}</div>
      </section>

      <section class="section">
        ${SectionHeader("swords", "Competitive landscape", "ranked by threat to Frido")}
        <div class="comp-grid">${compCards || (bestOnly ? NoBestsellers("among competitors for this keyword") : '<p class="hint">No competitor rows captured.</p>')}</div>
      </section>

      <section class="section">
        ${SectionHeader("key-round", "Keyword analysis")}
        <div class="panel">${kwTable}</div>
      </section>

      <section class="section">
        ${SectionHeader("chart-bar", "Rankings & comparisons", "per tracked keyword")}
        ${kwTabs}${kwPanes}
      </section>

      <section class="section">
        ${SectionHeader("package", "Feature comparison")}
        <div class="panel panel-pad">${featureBlock}</div>
      </section>

      <section class="section">
        ${SectionHeader("lightbulb", "Recommended actions", "every action cites captured evidence")}
        <div class="insights">${recos || '<p class="hint">Actions will be added after stakeholder review.</p>'}</div>
      </section>

      <p class="caption" style="text-align:center">Marketplace coverage: Amazon India ✓ · Flipkart ✓ · Myntra not tracked. Rankings vary with time, geo and personalisation.</p>`;

    animateCounters(app);
    wireFilterBanner();
    $("#kwTabs")?.querySelectorAll("[data-kw]").forEach((b) => b.onclick = () => {
      $("#kwTabs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      app.querySelectorAll(".kwpane").forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.kw; });
    });
  }

  // ================= router =================
  function route() {
    closePop();
    const m = location.hash.match(/^#\/([\w-]+)/);
    if (m && m[1]) renderCat(m[1]); else renderHome();
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  route();
})();
