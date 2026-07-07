/* Frido Marketplace Intelligence — static snapshot dashboard */
(async function () {
  // ---------- helpers ----------
  const $ = (s, el) => (el || document).querySelector(s);
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
    return m ? m[0].replace(/\s+(Premium|Orthopedic|Memory|Seat|Coccyx|Ultimate|Car).*$/i, "") : "—";
  };
  const isFrido = (r) => {
    if (typeof r.isFrido === "boolean") return r.isFrido;
    const s = `${r.brand || ""} ${r.title || ""}`;
    return /frido/i.test(s) && !/copycat|copies|generic/i.test(s);
  };

  // theme
  const themeBtn = $("#themeBtn");
  themeBtn.onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
  };

  // tooltip
  const tip = $("#tip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) {
      tip.textContent = t.dataset.tip;
      tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 12, innerWidth - 330) + "px";
      tip.style.top = e.clientY + 14 + "px";
    } else tip.hidden = true;
  });

  // ---------- load data ----------
  const master = await (await fetch("data/categories.json")).json();
  $("#asof").textContent = master.asOf;
  const cats = master.categories;
  const load = async (mp, id) => {
    try { return await (await fetch(`data/${mp}/${id}.json`)).json(); } catch { return null; }
  };
  const data = {};
  await Promise.all(cats.map(async (c) => {
    data[c.id] = { az: await load("amazon-in", c.id), fk: await load("flipkart", c.id) };
  }));

  // normalize amazon rows
  const azRows = (doc, key) => (doc && doc[key] ? doc[key].map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.reviews),
    brand: r.brand || brandOf(r.title), frido: isFrido(r),
  })) : []);
  const fkRows = (doc) => (doc && doc.results ? doc.results.map((r) => ({
    ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.ratings), frido: isFrido(r),
    brand: r.brand || brandOf(r.title),
  })) : []);
  const fridoAzRank = (id) => { const d = data[id].az; return d ? d.fridoOrganicRank : null; };
  const fridoAzSp = (id) => { const d = data[id].az; return d ? (d.fridoSponsoredSlot ?? (d.sponsored || []).find(isFrido)?.slot ?? null) : null; };
  const fridoFkRank = (id) => { const d = data[id].fk; return d ? (d.fridoRank ?? d.fridoOrganicRank) : null; };

  // ---------- KPIs ----------
  const present = cats.filter((c) => fridoAzRank(c.id));
  const ranks = present.map((c) => fridoAzRank(c.id));
  const fkPresent = cats.filter((c) => fridoFkRank(c.id));
  const spActive = cats.filter((c) => fridoAzSp(c.id));
  const kpis = [
    { v: cats.length, l: "Categories tracked", d: "Amazon India + Flipkart, page 1" },
    { v: `${present.length}/${cats.length}`, l: "Amazon top-10 organic presence", d: present.map((c) => c.name.split("/")[0].trim()).join(" · ") },
    { v: ranks.filter((r) => r === 1).length, l: "#1 organic positions", d: "Car Wedge Seat Cushion (Amazon's Choice)" },
    { v: ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : "—", l: "Avg organic rank (where present)", d: `Ranks: ${ranks.join(", ")}` },
    { v: `${fkPresent.length}/${cats.length}`, l: "Flipkart page-1 presence", d: fkPresent.map((c) => `${c.name.split("/")[0].trim()} #${fridoFkRank(c.id)}`).join(" · ") || "None" },
    { v: spActive.length, l: "Categories with Frido ads", d: "Sponsored slots on tracked keyword" },
  ];
  $("#kpis").innerHTML = kpis.map((k) =>
    `<div class="kpi"><div class="v">${k.v}</div><div class="l">${k.l}</div><div class="d" title="${esc(k.d)}">${esc(k.d).slice(0, 90)}</div></div>`).join("");

  // ---------- overview table ----------
  $("#overviewTable").innerHTML = `
    <thead><tr><th>Category</th><th>Priority</th><th>Keyword</th>
    <th class="num">Amazon organic</th><th class="num">Amazon sponsored</th><th class="num">Flipkart</th><th>Signal</th></tr></thead>
    <tbody>${cats.map((c) => {
      const az = data[c.id].az, r = fridoAzRank(c.id), sp = fridoAzSp(c.id), fk = fridoFkRank(c.id);
      const sig = r === 1 ? "Leader" : r ? "Contender" : sp ? "Ads only — no organic top-10" : "Absent on keyword";
      return `<tr data-cat="${c.id}">
        <td><a href="#" data-go="${c.id}">${esc(c.name)}</a></td>
        <td><span class="chip ${c.priority.toLowerCase()}">${c.priority}</span></td>
        <td class="hint">${esc(az ? az.keyword : "—")}</td>
        <td class="num">${r ? "#" + r : "—"}</td>
        <td class="num">${sp ? "slot " + sp : "—"}</td>
        <td class="num">${fk ? "#" + fk : "—"}</td>
        <td class="hint">${sig}</td></tr>`;
    }).join("")}</tbody>`;
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-go]");
    if (a) { e.preventDefault(); sel.value = a.dataset.go; render(a.dataset.go); scrollTo({ top: $("#detail").offsetTop - 70, behavior: "smooth" }); }
  });

  // ---------- category selector ----------
  const sel = $("#catSelect");
  sel.innerHTML = cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.onchange = () => render(sel.value);

  // ---------- scoring (transparent) ----------
  // Components (max 100): Rating quality 25 · Review volume 25 (log-scaled vs category max)
  // Price competitiveness 20 (cheapest=full) · Badge 15/12 · Organic rank strength 15
  function score(rows, r) {
    const maxRev = Math.max(...rows.map((x) => x.reviews || 0), 1);
    const prices = rows.map((x) => x.price).filter((x) => x != null);
    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const parts = [];
    const rat = r.rating ? Math.max(0, Math.min(1, (r.rating - 3.5) / 1.0)) * 25 : 0;
    parts.push(["Rating quality", rat, r.rating ? `${r.rating}★ → ${(rat).toFixed(0)}/25` : "no rating"]);
    const rev = 25 * Math.log(1 + (r.reviews || 0)) / Math.log(1 + maxRev);
    parts.push(["Review volume", rev, `${fmt(r.reviews)} vs category max ${fmt(maxRev)} (log scale)`]);
    const pr = r.price != null && pMax > pMin ? 20 * (1 - (r.price - pMin) / (pMax - pMin)) : 10;
    parts.push(["Price competitiveness", pr, r.price != null ? `${inr(r.price)} in range ${inr(pMin)}–${inr(pMax)}` : "price unknown → neutral 10"]);
    const bd = r.badge === "Amazon's Choice" ? 15 : r.badge === "Bestseller" ? 12 : 0;
    parts.push(["Badge", bd, r.badge || "none"]);
    const rk = r.rank ? ((11 - Math.min(r.rank, 10)) / 10) * 15 : 0;
    parts.push(["Organic rank strength", rk, r.rank ? `#${r.rank} of 10` : "not ranked"]);
    return { total: Math.round(parts.reduce((a, p) => a + p[1], 0)), parts };
  }

  // ---------- render category detail ----------
  function bars(rows, field, fmtV, note) {
    const vals = rows.filter((r) => r[field] != null);
    if (!vals.length) return `<p class="hint">No ${field} data captured.</p>`;
    const max = Math.max(...vals.map((r) => r[field]));
    return `<div class="chart" role="img" aria-label="${field} comparison">${rows.map((r) => {
      const v = r[field];
      const w = v == null ? 0 : Math.max(2, (v / max) * 100);
      const label = r.frido ? "Frido" : esc(r.brand);
      return `<div class="crow ${r.frido ? "frido" : ""}">
        <span class="cl" title="${esc(r.title)}">#${r.rank || r.pos} ${label}</span>
        <span class="ctrack"><span class="cbar" style="width:${w}%" data-tip="${esc(r.title).slice(0, 120)} — ${fmtV(v)}"></span></span>
        <span class="cv">${fmtV(v)}</span></div>`;
    }).join("")}</div><div class="axis-note">${note}</div>`;
  }

  function whyCards(org, frido) {
    const above = org.filter((r) => r.rank < frido.rank);
    if (!above.length) return "";
    return `<h3>Why competitors rank above Frido</h3><div class="cards">${above.map((r) => {
      const reasons = [];
      if (r.price != null && frido.price != null && r.price < frido.price)
        reasons.push(`${Math.round((1 - r.price / frido.price) * 100)}% cheaper (${inr(r.price)} vs ${inr(frido.price)})`);
      if ((r.reviews || 0) > (frido.reviews || 0))
        reasons.push(`${(r.reviews / Math.max(frido.reviews, 1)).toFixed(1)}× more reviews (${fmt(r.reviews)})`);
      if ((r.rating || 0) > (frido.rating || 0)) reasons.push(`Higher rating (${r.rating}★ vs ${frido.rating}★)`);
      if (r.badge) reasons.push(`${r.badge} badge`);
      if (r.boughtPastMonth) reasons.push(`Velocity: ${r.boughtPastMonth} bought past month`);
      if (!reasons.length) reasons.push("No measurable advantage in captured data — likely keyword relevance / CTR (Unknown)");
      return `<div class="card"><h4>#${r.rank} ${esc(r.brand)}</h4>
        <ul>${reasons.map((x) => `<li>${x}</li>`).join("")}</ul>
        <div class="meta">${inr(r.price)} · ${r.rating ?? "—"}★ · ${fmt(r.reviews)} reviews · <a href="https://www.amazon.in/dp/${r.asin}" target="_blank" rel="noopener">ASIN ${r.asin}</a></div></div>`;
    }).join("")}</div>`;
  }

  function rankTable(rows, mp) {
    if (!rows.length) return `<p class="hint">No results captured.</p>`;
    const az = mp === "az";
    return `<div class="scroll"><table class="tbl">
      <thead><tr><th>#</th><th>Brand</th><th>Product</th><th class="num">Price</th>
      <th class="num">Rating</th><th class="num">Reviews</th>${az ? "<th>Badge</th><th>Type</th>" : ""}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.frido ? "frido" : ""}">
        <td class="num">${r.rank || r.slot || r.pos}</td>
        <td>${esc(r.brand)}${r.frido ? " ★" : ""}</td>
        <td>${az && r.asin ? `<a class="clip" title="${esc(r.title)}" href="https://www.amazon.in/dp/${r.asin}" target="_blank" rel="noopener">${esc(r.title)}</a>` : `<span class="clip" title="${esc(r.title)}">${esc(r.title)}</span>`}</td>
        <td class="num">${inr(r.price)}</td><td class="num">${r.rating ?? "—"}</td><td class="num">${fmt(r.reviews)}</td>
        ${az ? `<td>${r.badge ? `<span class="chip badge">${r.badge}</span>` : ""}</td>
        <td><span class="chip ${r.sponsored || r.slot ? "sp" : "org"}">${r.sponsored || r.slot ? "Sponsored" : "Organic"}</span></td>` : ""}
      </tr>`).join("")}</tbody></table></div>`;
  }

  function render(id) {
    const c = cats.find((x) => x.id === id);
    const az = data[id].az, fk = data[id].fk;
    const org = azRows(az, "organic"), sp = azRows(az, "sponsored");
    const fkr = fkRows(fk);
    const frido = org.find((r) => r.frido);
    const combined = (az?.combinedPageOrder || []);

    const scores = org.map((r) => ({ r, s: score(org, r) })).sort((a, b) => b.s.total - a.s.total);

    $("#detail").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>${esc(c.name)} <span class="chip ${c.priority.toLowerCase()}">${c.priority}</span></h2>
        <span class="hint">Keyword “${esc(az?.keyword)}” · captured ${az?.capturedAt} · ${esc(az?.confidence || "")}</span></div>

      ${frido
        ? `<p><strong>Frido organic rank: #${frido.rank}</strong> (${esc(frido.title.slice(0, 90))}…) ${fridoAzSp(id) ? `· also running <span class="chip sp">Sponsored slot ${fridoAzSp(id)}</span>` : ""}</p>`
        : `<p><strong>Frido is not in the top-10 organic results</strong> for this keyword on Amazon India.${fridoAzSp(id) ? ` It holds <span class="chip sp">Sponsored slot ${fridoAzSp(id)}</span> — paying for visibility without organic support.` : ""}</p>`}

      <div class="tabs" id="mpTabs">
        <button class="on" data-tab="org">Organic (Amazon)</button>
        <button data-tab="sp">Sponsored (Amazon)</button>
        <button data-tab="cmb">Combined page order</button>
        <button data-tab="fk">Flipkart</button>
      </div>
      <div id="tab-org">${rankTable(org, "az")}</div>
      <div id="tab-sp" hidden>${rankTable(sp, "az")}</div>
      <div id="tab-cmb" hidden>${combined.length ? `<div class="scroll"><table class="tbl">
        <thead><tr><th>Page pos</th><th>Type</th><th>Product</th></tr></thead>
        <tbody>${combined.map((r) => `<tr class="${r.isFrido ? "frido" : ""}"><td class="num">${r.pos}</td>
          <td><span class="chip ${r.type === "sponsored" ? "sp" : "org"}">${r.type}</span></td>
          <td><span class="clip" title="${esc(r.title || r.brand || r.asin)}">${esc(r.title || r.brand || r.asin)}</span></td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">Not captured.</p>`}</div>
      <div id="tab-fk" hidden>
        ${fk ? `<p class="hint">${esc(fk.method)} · ${esc(fk.confidence)}</p>` : ""}
        ${fkr.length ? rankTable(fkr, "fk") : `<p class="hint">No Flipkart capture for this category.</p>`}
        ${fk && !fkr.some((r) => r.frido) ? `<p><strong>Frido is absent from Flipkart page 1</strong> for this keyword.</p>` : ""}
      </div>

      <h3>Pricing comparison (organic top 10)</h3>
      ${bars(org, "price", inr, "Bar length = listed price (₹). Blue = Frido. Hover a bar for the product.")}
      <h3>Review count comparison</h3>
      ${bars(org, "reviews", fmt, "Bar length = rating count. Blue = Frido.")}

      ${frido ? whyCards(org, frido) : ""}

      <h3>Opportunity score <span class="hint">(computed from captured data — expand any row for the arithmetic)</span></h3>
      ${scores.map(({ r, s }) => `
        <div class="score-row ${r.frido ? "frido" : ""}">
          <span class="cl" title="${esc(r.title)}">#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}</span>
          <span class="meter"><i style="width:${s.total}%"></i></span><span class="sv">${s.total}</span>
        </div>
        <details class="brk"><summary>score breakdown</summary><table class="tbl">
          ${s.parts.map((p) => `<tr><td>${p[0]}</td><td class="num">+${p[1].toFixed(0)}</td><td class="hint">${esc(p[2])}</td></tr>`).join("")}
          <tr><td><strong>Total</strong></td><td class="num"><strong>${s.total}</strong></td><td></td></tr></table></details>`).join("")}
      <p class="hint">Formula: rating quality /25 · review volume /25 (log vs category max) · price competitiveness /20 · badge /15 · organic rank /15. Identical for every product — no editorial weighting.</p>

      ${(az?.notes || []).length ? `<h3>Analyst notes</h3><ul>${az.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${(fk?.notes || []).length ? `<ul>${fk.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="src">Source: live amazon.in &amp; flipkart.com page-1 scrape, ${az?.capturedAt}. Single tracked keyword per category; positions vary by keyword, time and personalisation.</p>
    </div>`;

    $("#mpTabs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#mpTabs button").forEach((x) => x.classList.toggle("on", x === b));
      ["org", "sp", "cmb", "fk"].forEach((t) => { $("#tab-" + t).hidden = t !== b.dataset.tab; });
    };
  }

  // ---------- action center ----------
  const recos = [
    ["HIGH", "Report the copycat listing hijacking Frido's coccyx title", "Organic #6 for “coccyx seat cushion” (ASIN B0G59114Q3, ₹539) copies Frido's title verbatim including “Proprietary Hi-Per Foam”. Brand-registry takedown is a quick win that removes a cheap decoy directly below Frido."],
    ["HIGH", "Close the Flipkart gap", "Frido is on Flipkart page 1 in only 3 of 12 tracked categories (wedge #4, sleep pillow #9, slippers #3) and absent in its hero coccyx category, which FOVERA/Tender Care/DEBIK own. Listing + ad investment on Flipkart mirrors proven Amazon demand."],
    ["HIGH", "Fix the coccyx price ladder", "Every listing above Frido (#5) costs ₹449–999 vs Frido ₹1,513 — a 1.5–3.4× gap. Options: a value variant, sharper deal price, or coupon. Frido already wins the wedge category at ₹1,299, so premium can win when the price gap is narrower."],
    ["MED", "Convert ads-only categories into organic rankings", "Frido buys sponsored slots in sleep pillow (slot 2), lumbar support (6), wheelchair cushion (3) yet has no top-10 organic rank on those keywords — ad spend without organic flywheel. Review keyword targeting in titles/backend terms for those listings."],
    ["MED", "Chase badges on the coccyx keyword", "Frido holds Amazon's Choice for “car wedge seat cushion” but no badge on “coccyx seat cushion”, where Dr Trust (Choice) and Voltonix/Eder (Bestseller) convert on trust. Price + velocity moves above feed directly into badge eligibility."],
    ["LOW", "Review-velocity program vs Dr Trust & FOVERA", "Dr Trust has 5,594 reviews and FOVERA 7,672 vs Frido 3,072 in coccyx. Long-term: post-purchase review prompts and insert cards to close the social-proof gap."],
    ["LOW", "Verify absent categories' keywords", "No top-10 presence found for footrest, ergonomic chair, ortho slippers (Amazon), socks and wheelchair cushion on the tracked keywords. Confirm the keywords Frido actually targets for these lines, then re-capture."],
  ];
  $("#actions").innerHTML = `<div class="panel-head"><h2>Action Center</h2><span class="hint">Every recommendation cites captured evidence — nothing speculative</span></div>
    <div class="reco">${recos.map(([i, t, b]) => `<div class="card">
      <span class="impact ${i === "HIGH" ? "high" : i === "MED" ? "med" : "low"}">${i === "HIGH" ? "HIGH IMPACT" : i === "MED" ? "MEDIUM IMPACT" : "LONG-TERM / LOW"}</span>
      <h4>${t}</h4><p class="hint">${b}</p></div>`).join("")}</div>`;

  // ---------- method ----------
  $("#method").innerHTML = `<div class="panel-head"><h2>Data &amp; Method</h2></div>
    <ul>
      <li><strong>Capture:</strong> live scrape of amazon.in search page 1 (desktop) and flipkart.com search page 1 (mobile state JSON), ${master.asOf}. One tracked keyword per category.</li>
      <li><strong>Views:</strong> organic ranks exclude ad slots; sponsored slots listed separately; combined tab shows the true page order a shopper sees.</li>
      <li><strong>Confidence:</strong> High for presence, order, price, rating, review count (read directly off the page). Medium for Flipkart (sponsored flags not exposed on mobile; some prices missing). Interpretive “why” reasons cite only measured deltas; anything unmeasured is marked Unknown.</li>
      <li><strong>Limitations:</strong> single keyword per category; page-1 only; rankings fluctuate with time, location and personalisation; Myntra out of scope per stakeholder decision.</li>
      <li><strong>Refresh:</strong> static snapshot — re-run the capture scripts, replace <code>data/*.json</code>, redeploy.</li>
    </ul>`;

  // initial render
  render(cats[0].id);
})();
