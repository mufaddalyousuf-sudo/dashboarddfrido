/* Frido Marketplace Intelligence — organized by Frido's official taxonomy */
(async function () {
  // ---------- helpers ----------
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
  const brandOf = (t) => {
    const m = String(t || "").match(/^[A-Za-z][\w.'()-]*(?:\s+[A-Z][\w.'()-]*)?/);
    return m ? m[0].replace(/\s+(Premium|Orthopedic|Memory|Seat|Coccyx|Ultimate|Car|Barefoot|Pregnancy).*$/i, "") : "—";
  };
  const isFrido = (r) => {
    if (typeof r.isFrido === "boolean") return r.isFrido;
    const s = `${r.brand || ""} ${r.title || ""}`;
    return /frido/i.test(s) && !/copycat|copies|generic/i.test(s);
  };

  // theme + tooltip
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
  };
  const tip = $("#tip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) {
      tip.textContent = t.dataset.tip; tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 12, innerWidth - 330) + "px";
      tip.style.top = e.clientY + 14 + "px";
    } else tip.hidden = true;
  });

  // ---------- load ----------
  const tax = await (await fetch("data/taxonomy.json")).json();
  $("#asof").textContent = tax.asOf;
  const dsIds = tax.categories.flatMap((c) => c.datasets.map((d) => d.id));
  const store = {};
  await Promise.all(dsIds.map(async (id) => {
    const g = async (mp) => { try { return await (await fetch(`data/${mp}/${id}.json`)).json(); } catch { return null; } };
    store[id] = { az: await g("amazon-in"), fk: await g("flipkart") };
  }));

  const azRows = (doc, key) => (doc && doc[key] ? doc[key].map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.reviews),
    brand: r.brand || brandOf(r.title), frido: isFrido(r),
  })) : []);
  const fkRows = (doc) => (doc && doc.results ? doc.results.map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.ratings),
    brand: r.brand || brandOf(r.title), frido: isFrido(r),
  })) : []);
  const dsInfo = (id) => {
    const { az, fk } = store[id] || {};
    const org = azRows(az, "organic"), sp = azRows(az, "sponsored"), fkr = fkRows(fk);
    const fridoOrg = org.find((r) => r.frido) || null;
    const fridoSp = sp.find((r) => r.frido) || null;
    const fridoFk = fkr.find((r) => r.frido) || null;
    return { az, fk, org, sp, fkr, fridoOrg, fridoSp, fridoFk, keyword: az?.keyword || fk?.keyword };
  };

  // ---------- scores (transparent formulas) ----------
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
    parts.push(["Organic rank strength", rk, r.rank ? `#${r.rank}` : "not ranked"]);
    return { total: Math.round(parts.reduce((a, p) => a + p[1], 0)), parts };
  }

  function threatScore(rows, r, frido) {
    const parts = [];
    const pos = frido ? (r.rank < frido.rank ? 30 : Math.max(0, 30 - (r.rank - frido.rank) * 6))
      : r.rank <= 3 ? 30 : r.rank <= 6 ? 20 : 10;
    parts.push(["Position pressure", pos, frido ? (r.rank < frido.rank ? `ranked above Frido (#${r.rank} vs #${frido.rank})` : `#${r.rank}, below Frido`) : `#${r.rank}; Frido absent`]);
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

  // Health: best AZ rank /40 · Flipkart presence /20 · review competitiveness /20 · badge /10 · ads backup /10
  function health(cat) {
    if (!cat.datasets.length) return null;
    const infos = cat.datasets.map((d) => dsInfo(d.id));
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
        ["Review competitiveness", rev20, "Frido vs strongest rival (primary keyword)"],
        ["Badges", badge10, "on any Frido listing"],
        ["Sponsored backup", ads10, "Frido ads on tracked keywords"]],
    };
  }

  // ---------- shared renderers ----------
  function bars(rows, field, fmtV, note, rankKey) {
    const vals = rows.filter((r) => r[field] != null);
    if (!vals.length) return `<p class="hint">No ${field} data captured.</p>`;
    const max = Math.max(...vals.map((r) => r[field]));
    return `<div class="chart">${rows.map((r) => {
      const v = r[field];
      const w = v == null ? 0 : Math.max(2, (v / max) * 100);
      return `<div class="crow ${r.frido ? "frido" : ""}">
        <span class="cl" title="${esc(r.title)}">#${r[rankKey] || r.rank || r.pos} ${r.frido ? "Frido" : esc(r.brand)}</span>
        <span class="ctrack"><span class="cbar" style="width:${w}%" data-tip="${esc((r.title || "").slice(0, 110))} — ${fmtV(v)}"></span></span>
        <span class="cv">${fmtV(v)}</span></div>`;
    }).join("")}</div><div class="axis-note">${note}</div>`;
  }

  function rankTable(rows, az) {
    if (!rows.length) return `<p class="hint">No results captured.</p>`;
    return `<div class="scroll"><table class="tbl">
      <thead><tr><th>#</th><th>Brand</th><th>Product</th><th class="num">Price</th>
      <th class="num">Rating</th><th class="num">Reviews</th>${az ? "<th>Badge</th>" : ""}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.frido ? "frido" : ""}">
        <td class="num">${r.rank || r.slot || r.pos}</td>
        <td>${esc(r.brand)}${r.frido ? " ★" : ""}</td>
        <td>${az && r.asin ? `<a class="clip" title="${esc(r.title)}" href="https://www.amazon.in/dp/${r.asin}" target="_blank" rel="noopener">${esc(r.title)}</a>` : `<span class="clip" title="${esc(r.title)}">${esc(r.title)}</span>`}</td>
        <td class="num">${inr(r.price)}</td><td class="num">${r.rating ?? "—"}</td><td class="num">${fmt(r.reviews)}</td>
        ${az ? `<td>${r.badge ? `<span class="chip badge">${r.badge}</span>` : ""}</td>` : ""}
      </tr>`).join("")}</tbody></table></div>`;
  }

  const scoreRows = (list, cls) => list.map(({ r, s }) => `
    <div class="score-row ${r.frido ? "frido" : ""} ${cls || ""}">
      <span class="cl" title="${esc(r.title)}">#${r.rank || r.pos} ${r.frido ? "Frido" : esc(r.brand)}</span>
      <span class="meter"><i style="width:${s.total}%"></i></span><span class="sv">${s.total}</span>
    </div>
    <details class="brk"><summary>breakdown</summary><table class="tbl">
      ${s.parts.map((p) => `<tr><td>${p[0]}</td><td class="num">+${p[1].toFixed(0)}</td><td class="hint">${esc(p[2])}</td></tr>`).join("")}
      <tr><td><strong>Total</strong></td><td class="num"><strong>${s.total}</strong></td><td></td></tr></table></details>`).join("");

  // curated, evidence-cited actions per category
  const curated = {
    cushions: [
      ["HIGH", "Report the copycat listing", "Organic #6 for “coccyx seat cushion” (ASIN B0G59114Q3, ₹539) copies Frido's title verbatim incl. “Proprietary Hi-Per Foam”. Brand-registry takedown removes a cheap decoy directly below Frido."],
      ["HIGH", "Fix the coccyx price ladder", "Everything above Frido (#5) costs ₹449–999 vs ₹1,513. Frido wins wedge at ₹1,299 — premium works when the gap is narrower. Consider value variant / coupon."],
      ["MED", "Lumbar: ads without organic", "Frido buys sponsored slot 6 on “lumbar support for office chair” with no top-10 organic rank — review title/backend keywords for the backrest line."],
      ["HIGH", "Flipkart coccyx absence", "Frido is absent from Flipkart page 1 in its hero cushion category, which FOVERA/Tender Care/DEBIK own."]],
    pillows: [
      ["MED", "Sleep pillow: ads without organic", "Sponsored slot 2 on “memory foam pillow” but no top-10 organic rank; cervical pillow ranks #4. Keyword coverage on sleep-pillow listings needs work."],
      ["MED", "Cervical pillow badge chase", "#4 organic — velocity and review growth feed Amazon's Choice eligibility."]],
    "mobility-devices": [
      ["MED", "Wheelchair cushion: ads without organic", "Sponsored slot 3 on “wheelchair cushion”, no top-10 organic. Dedicated wheelchair-cushion listing or keyword optimization needed."]],
    insoles: [["MED", "Defend #2 in insoles", "Frido is organic #2 with sponsored slot 4 backup — monitor the #1 and keep velocity."]],
    workspace: [["MED", "Footrest invisible on keyword", "No Frido presence in top-10 for “foot rest under desk” despite Frido selling footrests — verify the keyword actually targeted by the listing."]],
    chairs: [["LOW", "Ergonomic chair — no page-1 presence", "High-competition category; assess if chairs are a marketplace priority or D2C-only play."]],
    barefoot: [["MED", "Barefoot: strong on Flipkart (#2), absent on Amazon", "Amazon “barefoot shoes” top-10 has no Frido; replicate the Flipkart listing strategy on Amazon."]],
    "maternity-baby-care": [["MED", "Pregnancy pillow #6 — review gap", "Frido ranks #6 organic; leaders carry larger review bases. Velocity program + A+ refresh."]],
    footwear: [["MED", "Ortho slippers absent on Amazon keyword", "Flipkart #3 but no Amazon top-10 for “orthopedic slippers” — check Amazon listing keyword coverage."]],
    socks: [["LOW", "Socks not found on tracked keyword", "Confirm which sock keyword Frido targets (“cushioned socks” shows no Frido) before investing."]],
    "mattress-topper-protector": [["MED", "Topper #4 with slot 2 ads", "Solid position; watch price band and push for badge."]],
  };

  // ---------- home ----------
  function renderHome() {
    document.title = "Frido Marketplace Intelligence";
    app.innerHTML = `
      <section class="kpi-row" style="margin-bottom:18px">${(() => {
        const live = tax.categories.filter((c) => c.datasets.length);
        const hs = live.map((c) => ({ c, h: health(c) })).filter((x) => x.h);
        const leaders = hs.filter((x) => x.h.parts[0][2] === "#1").length;
        return [
          { v: tax.categories.length, l: "Frido categories (official taxonomy)", d: `${live.length} researched · ${tax.categories.length - live.length} pending keyword confirmation` },
          { v: hs.length ? Math.round(hs.reduce((a, x) => a + x.h.total, 0) / hs.length) : "—", l: "Avg category health score", d: "See per-category breakdown" },
          { v: leaders, l: "Categories where Frido is #1", d: "Best Amazon organic rank = #1" },
          { v: "AZ + FK", l: "Marketplaces tracked", d: "Myntra excluded by stakeholder decision" },
        ].map((k) => `<div class="kpi"><div class="v">${k.v}</div><div class="l">${k.l}</div><div class="d">${esc(k.d)}</div></div>`).join("");
      })()}</section>
      <div class="cat-grid">${tax.categories.map((c) => {
        const live = c.datasets.length > 0;
        if (!live) return `<a class="cat-card pending" href="#/${c.id}">
          <div class="cc-head"><span class="cc-icon">${c.icon}</span><h3>${esc(c.name)}</h3></div>
          <p class="hint">Not yet researched — ${esc(c.pendingReason || "keyword pending")}.</p>
          <div class="cc-foot"><span class="chip">awaiting keyword</span><span class="chip ${c.priority.toLowerCase()}">${c.priority}</span></div></a>`;
        const infos = c.datasets.map((d) => dsInfo(d.id));
        const h = health(c);
        const ranks = infos.map((i) => i.fridoOrg?.rank).filter(Boolean);
        const avgRank = ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : null;
        const prim = infos[0];
        const leader = prim.org[0];
        const products = infos.reduce((a, i) => a + i.org.length + i.sp.length + i.fkr.length, 0);
        const azP = infos.some((i) => i.org.length), fkP = infos.some((i) => i.fkr.length);
        const opp = prim.org.length ? prim.org.map((r) => ({ r, s: oppScore(prim.org, r) })).sort((a, b) => b.s.total - a.s.total)[0] : null;
        return `<a class="cat-card" href="#/${c.id}">
          <div class="cc-head"><span class="cc-icon">${c.icon}</span><h3>${esc(c.name)}</h3>
            <span class="cc-health ${h.total >= 60 ? "hi" : h.total >= 30 ? "mid" : "lo"}" data-tip="Health score /100 — formula on category page">${h.total}</span></div>
          <div class="cc-grid">
            <div><b>${azP ? "Amazon" : ""}${azP && fkP ? " · " : ""}${fkP ? "Flipkart" : ""}</b><span>Coverage</span></div>
            <div><b>${products}</b><span>Listings tracked</span></div>
            <div><b>${avgRank ? "#" + avgRank : "—"}</b><span>Avg organic rank</span></div>
            <div><b>${leader ? esc(leader.frido ? "Frido" : leader.brand) : "—"}</b><span>Current leader</span></div>
            <div><b>${opp ? esc(opp.r.frido ? "Frido" : opp.r.brand) + " " + opp.s.total : "—"}</b><span>Top opportunity</span></div>
            <div><b>n/a</b><span>Trend (first snapshot)</span></div>
          </div>
          <div class="cc-foot"><span class="chip ${c.priority.toLowerCase()}">${c.priority}</span>
            ${infos.some((i) => i.fridoOrg?.rank === 1) ? `<span class="chip badge">#1 position</span>` : ""}
            ${infos.some((i) => !i.fridoOrg && (i.fridoSp || i.az?.fridoSponsoredSlot)) ? `<span class="chip sp">ads w/o organic</span>` : ""}
          </div></a>`;
      }).join("")}</div>
      <p class="src">Card metrics computed from captured page-1 data only. “Trend” requires a second snapshot — not fabricated. Category images: Frido's official assets can be dropped into <code>assets/img/&lt;category-id&gt;.jpg</code>; emoji used until provided.</p>`;
  }

  // ---------- category page ----------
  function renderCat(id) {
    const c = tax.categories.find((x) => x.id === id);
    if (!c) { renderHome(); return; }
    document.title = `${c.name} — Frido Intelligence`;
    if (!c.datasets.length) {
      app.innerHTML = `<a class="crumb" href="#/">← All categories</a>
        <div class="panel"><h2>${c.icon} ${esc(c.name)}</h2>
        <p>Not yet researched. ${esc(c.pendingReason || "")}</p>
        <p class="hint">Tell the analyst which search keyword represents this Frido line on Amazon/Flipkart and it will be captured in the next data refresh. No data has been invented for this category.</p></div>`;
      return;
    }
    const infos = c.datasets.map((d) => ({ meta: d, ...dsInfo(d.id) }));
    const h = health(c);
    const prim = infos[0];

    // competitor aggregation across keywords (amazon organic)
    const compMap = {};
    infos.forEach((i) => i.org.forEach((r) => {
      if (r.frido) return;
      const k = r.brand.toLowerCase();
      (compMap[k] ||= { brand: r.brand, appearances: 0, bestRank: 99, reviews: 0, entry: r, rows: i.org, frido: i.fridoOrg });
      const m = compMap[k];
      m.appearances++;
      if (r.rank < m.bestRank) { m.bestRank = r.rank; m.entry = r; m.rows = i.org; m.frido = i.fridoOrg; }
      m.reviews = Math.max(m.reviews, r.reviews || 0);
    }));
    const comps = Object.values(compMap).sort((a, b) => a.bestRank - b.bestRank).slice(0, 8)
      .map((m) => ({ ...m, threat: threatScore(m.rows, m.entry, m.frido) }))
      .sort((a, b) => b.threat.total - a.threat.total);

    const kwTabs = infos.map((i, n) => `<button class="${n === 0 ? "on" : ""}" data-kw="${n}">${esc(i.keyword)}</button>`).join("");
    const kwPanes = infos.map((i, n) => {
      const opp = i.org.map((r) => ({ r, s: oppScore(i.org, r) })).sort((a, b) => b.s.total - a.s.total);
      return `<div class="kwpane" data-pane="${n}" ${n ? "hidden" : ""}>
        <p>${i.fridoOrg
          ? `<strong>Frido organic #${i.fridoOrg.rank}</strong> on Amazon${i.fridoOrg.badge ? ` · <span class="chip badge">${i.fridoOrg.badge}</span>` : ""}`
          : `<strong>Frido absent from Amazon top-10 organic</strong>`}
          ${(i.fridoSp || i.az?.fridoSponsoredSlot) ? ` · <span class="chip sp">Sponsored slot ${i.fridoSp?.slot || i.az.fridoSponsoredSlot}</span>` : ""}
          ${i.fridoFk ? ` · Flipkart #${i.fridoFk.pos}` : i.fkr.length ? " · absent Flipkart page 1" : ""}</p>

        <h3>Organic rankings (Amazon)</h3>${rankTable(i.org, true)}
        <h3>Sponsored rankings (Amazon)</h3>${rankTable(i.sp, true)}
        <h3>Flipkart page 1</h3>${i.fkr.length ? rankTable(i.fkr, false) : `<p class="hint">No Flipkart capture.</p>`}
        <h3>Pricing comparison</h3>${bars(i.org, "price", inr, "Organic top 10, listed price ₹. Blue = Frido.")}
        <h3>Review comparison</h3>${bars(i.org, "reviews", fmt, "Rating counts. Blue = Frido.")}
        <h3>Rating comparison</h3>${bars(i.org, "rating", (v) => (v == null ? "—" : v + "★"), "Average star rating (scale starts at 0 — differences are small; read the numbers).")}
        <h3>Opportunity score</h3>${scoreRows(opp)}
        ${(i.az?.notes || []).length ? `<h3>Analyst notes</h3><ul>${i.az.notes.map((n2) => `<li>${esc(n2)}</li>`).join("")}</ul>` : ""}
        ${(i.fk?.notes || []).length ? `<ul>${i.fk.notes.map((n2) => `<li>${esc(n2)}</li>`).join("")}</ul>` : ""}
      </div>`;
    }).join("");

    // feature comparison: only fields actually captured
    const rich = prim.org.filter((r) => r.images != null || r.aplus != null || r.warranty);
    const featureBlock = rich.length ? `<div class="scroll"><table class="tbl">
      <thead><tr><th>Product</th><th class="num">Images</th><th>A+</th><th>Video</th><th>Prime</th><th>Warranty</th><th>BSR</th></tr></thead>
      <tbody>${prim.org.map((r) => `<tr class="${r.frido ? "frido" : ""}">
        <td><span class="clip" title="${esc(r.title)}">#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}</span></td>
        <td class="num">${r.images ?? "?"}</td><td>${r.aplus == null ? "?" : r.aplus ? "✓" : "✗"}</td>
        <td>${r.video == null ? "?" : r.video ? "✓" : "✗"}</td><td>${r.prime == null ? "?" : r.prime ? "✓" : "✗"}</td>
        <td>${esc(r.warranty || "?")}</td><td class="hint">${esc(r.bsr || "?")}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">“?” = not captured for that listing (detail pages fetched only for the deep-dive set). Nothing is guessed.</p>`
      : `<p class="hint">Detail-page features (images, A+, video, warranty, BSR) captured only for deep-dive categories so far — currently the Cushions coccyx set. Other categories show search-page data only. Say the word to deep-dive this one.</p>`;

    app.innerHTML = `
      <a class="crumb" href="#/">← All categories</a>
      <div class="panel">
        <div class="panel-head"><h2>${c.icon} ${esc(c.name)} <span class="chip ${c.priority.toLowerCase()}">${c.priority}</span></h2>
          <span class="hint">Captured ${prim.az?.capturedAt || tax.asOf} · live page-1 scrape</span></div>

        <h3>Executive summary</h3>
        <div class="kpi-row">
          <div class="kpi"><div class="v">${h.total}<span class="hint">/100</span></div><div class="l">Health score</div>
            <div class="d">${h.parts.map((p) => `${p[0]}: +${p[1]}`).join(" · ")}</div></div>
          <div class="kpi"><div class="v">${prim.fridoOrg ? "#" + prim.fridoOrg.rank : "—"}</div><div class="l">Amazon organic (primary keyword)</div><div class="d">${esc(prim.keyword || "")}</div></div>
          <div class="kpi"><div class="v">${prim.fridoFk ? "#" + prim.fridoFk.pos : "—"}</div><div class="l">Flipkart rank</div><div class="d">${prim.fkr.length ? "page-1 capture" : "no capture"}</div></div>
          <div class="kpi"><div class="v">${comps[0] ? esc(comps[0].brand) : "—"}</div><div class="l">Top threat</div><div class="d">${comps[0] ? "threat score " + comps[0].threat.total + "/100" : ""}</div></div>
        </div>

        <h3>Marketplace coverage</h3>
        <div class="scroll"><table class="tbl"><thead><tr><th>Marketplace</th><th>Status</th><th>Frido position</th></tr></thead><tbody>
          <tr><td>Amazon India</td><td>${prim.org.length ? "✓ tracked" : "no capture"}</td><td>${infos.map((i) => `${esc(i.keyword)}: ${i.fridoOrg ? "#" + i.fridoOrg.rank : "absent"}${(i.fridoSp || i.az?.fridoSponsoredSlot) ? " (+ad)" : ""}`).join(" · ")}</td></tr>
          <tr><td>Flipkart</td><td>${infos.some((i) => i.fkr.length) ? "✓ tracked" : "no capture"}</td><td>${infos.map((i) => `${esc(i.keyword)}: ${i.fridoFk ? "#" + i.fridoFk.pos : "absent"}`).join(" · ")}</td></tr>
          <tr><td>Myntra</td><td>not tracked</td><td class="hint">excluded by stakeholder decision</td></tr>
        </tbody></table></div>

        <h3>Keyword analysis</h3>
        <div class="scroll"><table class="tbl"><thead><tr><th>Tracked keyword</th><th class="num">Amazon organic</th><th class="num">Amazon ad slot</th><th class="num">Flipkart</th><th>Leader on keyword</th></tr></thead>
        <tbody>${infos.map((i) => `<tr><td>${esc(i.keyword)}</td>
          <td class="num">${i.fridoOrg ? "#" + i.fridoOrg.rank : "—"}</td>
          <td class="num">${i.fridoSp?.slot || i.az?.fridoSponsoredSlot || "—"}</td>
          <td class="num">${i.fridoFk ? "#" + i.fridoFk.pos : "—"}</td>
          <td>${i.org[0] ? esc(i.org[0].frido ? "Frido" : i.org[0].brand) : "—"}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint">One keyword per product line so far — additional keywords can be added to any category on request.</p>

        <div class="tabs" style="margin-top:16px">${kwTabs}</div>
        ${kwPanes}

        <h3>Top competitors &amp; threat score</h3>
        ${comps.length ? scoreRows(comps.map((m) => ({ r: { ...m.entry, frido: false }, s: m.threat })), "threat") : `<p class="hint">No competitor rows captured.</p>`}
        <p class="hint">Threat = position pressure /30 · review muscle /25 · price undercut /25 · badge /10 · velocity /10 — computed identically for every brand.</p>

        <h3>Feature comparison</h3>
        ${featureBlock}

        <h3>Recommended actions</h3>
        <div class="reco">${(curated[c.id] || [["LOW", "No curated actions yet", "Data captured; actions will be added after stakeholder review."]]).map(([i2, t, b]) => `<div class="card">
          <span class="impact ${i2 === "HIGH" ? "high" : i2 === "MED" ? "med" : "low"}">${i2 === "HIGH" ? "HIGH IMPACT" : i2 === "MED" ? "MEDIUM IMPACT" : "LONG-TERM / LOW"}</span>
          <h4>${t}</h4><p class="hint">${b}</p></div>`).join("")}</div>

        <p class="src">Source: live amazon.in &amp; flipkart.com page-1 scrapes, ${prim.az?.capturedAt || tax.asOf}. Confidence: High for on-page facts; interpretations cite measured deltas only; unmeasured = “?”/Unknown. Rankings vary with time, geo and personalisation.</p>
      </div>`;

    app.querySelectorAll(".tabs [data-kw]").forEach((b) => b.onclick = () => {
      app.querySelectorAll(".tabs [data-kw]").forEach((x) => x.classList.toggle("on", x === b));
      app.querySelectorAll(".kwpane").forEach((p) => p.hidden = p.dataset.pane !== b.dataset.kw);
    });
  }

  // ---------- router ----------
  function route() {
    const m = location.hash.match(/^#\/([\w-]+)/);
    if (m && m[1]) renderCat(m[1]); else renderHome();
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  route();
})();
