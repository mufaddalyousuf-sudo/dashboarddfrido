/* Frido Marketplace Intelligence — simplified.
   One question per screen: where does Frido stand, and what should it do.
   No numeric scores. Status is rule-based and stated in plain language. */
(async function () {
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
  const I = (name) => `<span class="ic"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${window.LUCIDE[name] || ""}</svg></span>`;
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = I(el.dataset.icon); });

  const brandOf = (t) => {
    const m = String(t || "").match(/^[A-Za-z][\w.'()-]*(?:\s+[A-Z][\w.'()-]*)?/);
    return m ? m[0].replace(/\s+(Premium|Orthopedic|Memory|Seat|Coccyx|Ultimate|Car|Barefoot|Pregnancy|Nasal|Posture).*$/i, "") : "—";
  };
  const isFrido = (r) => {
    if (r.isFridoBrand === true) return true;
    if (typeof r.isFrido === "boolean") return r.isFrido;
    const s = `${r.brand || ""} ${r.title || ""}`;
    return /frido/i.test(s) && !/copycat|copies|generic/i.test(s);
  };
  const isBestseller = (r) => r.badge === "Bestseller";

  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
  };
  const tip = $("#tip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) { tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px"; tip.style.top = Math.min(e.clientY + 16, innerHeight - 60) + "px"; }
    else tip.hidden = true;
  });
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; };
  $("#settingsBtn").onclick = (e) => {
    e.stopPropagation();
    if (pop) return closePop();
    pop = document.createElement("div");
    pop.className = "pop";
    pop.style.cssText = "position:fixed;z-index:60;width:320px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;font-size:12.5px;color:var(--ink-2);display:grid;gap:8px;box-shadow:0 12px 32px rgba(0,0,0,.14)";
    pop.innerHTML = `<b style="color:var(--ink)">Data &amp; method</b>
      <p>Live page-1 scrapes of amazon.in and flipkart.com, one tracked keyword per product line. Compared only against Bestseller-badged competitors by default.</p>
      <p><b>Corrections applied 2026-07-07:</b> Masks and Covers were previously mislabeled "not found" from a generic-keyword search. Brand-qualified re-checks confirmed both are real Frido listings — Covers has a live Bestseller badge.</p>
      <p><b>Status labels</b> are rule-based, never a numeric score: Leading (#1 bestseller) · Ranked (badge or top-10) · Listed, Not Ranked (verified to exist, not competitive on this keyword) · No Matching Product (verified gap) · Needs Verification (evidence incomplete).</p>`;
    document.body.appendChild(pop);
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + "px"; pop.style.right = Math.max(8, innerWidth - r.right) + "px";
  };
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target)) closePop(); });

  app.innerHTML = `<div class="stat-row">${'<div class="skel" style="width:100px;height:50px;border-radius:8px;background:var(--line)"></div>'.repeat(4)}</div>`;

  const tax = await (await fetch("data/taxonomy.json")).json();
  const dsIds = tax.categories.flatMap((c) => c.datasets.map((d) => d.id));
  const store = {};
  await Promise.all(dsIds.map(async (id) => {
    const g = async (mp) => { try { return await (await fetch(`data/${mp}/${id}.json`)).json(); } catch { return null; } };
    store[id] = { az: await g("amazon-in"), fk: await g("flipkart") };
  }));
  $("#tbMeta").innerHTML = `Snapshot ${tax.asOf} · last updated ${tax.asOf}`;

  const azRows = (doc, key) => (doc && doc[key] ? doc[key].map((r) => ({ ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.reviews), brand: r.brand || brandOf(r.title), frido: isFrido(r) })) : []);
  const fkRows = (doc) => (doc && doc.results ? doc.results.map((r) => ({ ...r, price: num(r.price), rating: num(r.rating), reviews: num(r.ratings), brand: r.brand || brandOf(r.title), frido: isFrido(r) })) : []);

  const dsInfo = (id, bestOnly) => {
    const { az, fk } = store[id] || {};
    let org = azRows(az, "organic"), sp = azRows(az, "sponsored"), fkr = fkRows(fk);
    if (bestOnly) { org = org.filter(isBestseller); sp = sp.filter(isBestseller); fkr = []; }
    return {
      az, fk, org, sp, fkr, bestOnly: !!bestOnly,
      fridoOrg: org.find((r) => r.frido) || null,
      fridoSp: sp.find((r) => r.frido) || null,
      fridoFk: fkr.find((r) => r.frido) || null,
      keyword: az?.keyword || fk?.keyword,
      brandQualified: !!(az && /^frido /i.test(az.keyword || "")),
      verifiedAsin: az?.fridoVerifiedAsin || null,
      verifiedBadge: az?.fridoVerifiedBadge || null,
      verifiedPrice: num(az?.fridoVerifiedPrice), verifiedRating: num(az?.fridoVerifiedRating), verifiedReviews: num(az?.fridoVerifiedReviews),
      verifiedTitle: az?.fridoVerifiedTitle || null,
    };
  };
  const catInfos = (c, bestOnly) => c.datasets.map((d) => ({ meta: d, ...dsInfo(d.id, bestOnly) }));

  // ---------- status: deterministic rules, plain language ----------
  const STATUS_LABEL = { leading: "Leading", ranked: "Ranked", "listed-not-ranked": "Listed, Not Ranked", "no-match": "No Matching Product", "needs-verification": "Needs Verification", pending: "Pending Research" };
  function catStatus(c, bestOnly) {
    if (c.forcedStatus) return c.forcedStatus;
    if (c.manualVerification) return c.manualVerification.status;
    if (!c.datasets.length) return "pending";
    // strict view: only literal Bestseller-badged rows count as "ranked"/"leading"
    const infosBest = catInfos(c, true);
    const org1 = infosBest.find((i) => i.fridoOrg?.rank === 1);
    if (org1) return "leading";
    const ranked = infosBest.find((i) => i.fridoOrg || i.fridoSp);
    if (ranked) return "ranked";
    // full view: does Frido exist at all (organic top-10, Flipkart, or a verified brand-search hit)?
    const infosAll = catInfos(c, false);
    const existsOrganic = infosAll.find((i) => i.fridoOrg || i.fridoFk);
    if (existsOrganic) return "listed-not-ranked";
    const verified = infosAll.find((i) => i.verifiedAsin);
    if (verified) return "listed-not-ranked";
    const brandChecked = infosAll.find((i) => i.brandQualified);
    if (brandChecked) return "no-match"; // a brand-qualified search ran and found nothing at all
    return "needs-verification"; // never brand-verified, no organic hit — genuinely unclear
  }
  const Status = (s) => `<span class="status ${s}" data-tip="${esc(tax.statusLegend[s] || "")}"><i></i>${STATUS_LABEL[s]}</span>`;

  // opportunity: rule-based qualitative label, not a score
  function opportunity(status) {
    if (status === "leading") return "Low — defend position";
    if (status === "ranked") return "Medium — close the gap to #1";
    if (status === "listed-not-ranked" || status === "no-match") return "High — no bestseller visibility";
    return "Unclear — verify first";
  }

  // ---------- evidence-based "why" (max 3 lines, only measured deltas) ----------
  function whyAbove(r, frido) {
    const reasons = [];
    if (frido) {
      if (r.price != null && frido.price != null && r.price < frido.price) reasons.push(`${Math.round((1 - r.price / frido.price) * 100)}% cheaper (${inr(r.price)} vs Frido's ${inr(frido.price)})`);
      if ((r.reviews || 0) > (frido.reviews || 0)) reasons.push(`${(r.reviews / Math.max(frido.reviews || 1, 1)).toFixed(1)}× more reviews (${fmt(r.reviews)})`);
      if ((r.rating || 0) > (frido.rating || 0)) reasons.push(`Higher rating (${r.rating}★ vs Frido's ${frido.rating}★)`);
    } else {
      reasons.push("Frido has no ranked/bestseller listing to compare against on this keyword");
    }
    if (r.badge === "Bestseller") reasons.push("Carries the Bestseller badge");
    if (r.boughtPastMonth) reasons.push(`${r.boughtPastMonth} bought past month`);
    if (!reasons.length) reasons.push("No measured advantage found — likely keyword relevance (unknown)");
    return reasons.slice(0, 3);
  }

  // curated top-3 actions per category — imperative, evidence-cited
  const actions = {
    cushions: [
      ["Report the copycat listing", "Organic #6 for “coccyx seat cushion” copies Frido's title (incl. “Hi-Per Foam”) at ₹539. File a brand-registry takedown."],
      ["Undercut or bundle the coccyx price gap", "Every bestseller ranked above Frido (#5) sells at ₹449–999 vs Frido's ₹1,513. Add a value SKU or a limited coupon to close the gap."],
      ["Get a Bestseller/Amazon's Choice badge on coccyx", "Rivals ranked above Frido hold Bestseller or Amazon's Choice; Frido holds neither on this keyword — badges are a direct ranking lever."],
    ],
    pillows: [
      ["Fix sleep-pillow keyword targeting", "Frido runs a sponsored ad on “memory foam pillow” with zero organic top-10 — the listing's title/backend keywords likely don't match this search."],
      ["Push cervical pillow toward a badge", "Cervical pillow ranks #4 organically; sustained review velocity is the most direct path to Amazon's Choice."],
    ],
    "mattress-topper-protector": [["Chase a Bestseller badge at #4", "Frido already ranks #4 organic with an active ad — a badge here is the highest-leverage single move available."]],
    covers: [["Promote the badge-holding cover variant", "The Bestseller-badged Wedge Plus Cooling Cover (₹2,519) is outranked in visibility by Frido's own cheaper, badge-less variant (₹399, rank #1) — align ad spend to the badge holder."]],
    barefoot: [["Replicate the Flipkart listing on Amazon", "Frido ranks #2 on Flipkart for “barefoot shoes” but has no Amazon top-10 presence for the same keyword."]],
    footwear: [["Fix Amazon keyword coverage for slippers", "Flipkart #3 for “orthopedic slippers”, but no Amazon top-10 for the identical keyword — check the Amazon listing's title and backend search terms."]],
    accessories: [["Improve the car-neck-rest listing content", "Frido sits mid-pack (#8 Amazon, #9 Flipkart) — review price, hero image and title against the leaders on this keyword."]],
    "maternity-baby-care": [["Close the review gap on pregnancy pillow", "Frido ranks #6; leaders carry a larger review base. A post-purchase review prompt is the fastest lever."]],
    masks: [["Decide: invest or retire the mask line", "Frido has 3+ real mask/eye-mask listings, none with a Bestseller badge and all under 65 reviews — low velocity suggests either a keyword/content fix or deprioritizing the line."]],
    socks: [["Scale the Five Toe Socks ad", "The only Frido sock SKU carries a Bestseller badge via a sponsored ad, but has just 14 reviews and no generic-keyword visibility — increase ad spend and seed reviews before pulling back."]],
    workspace: [["Build a dedicated under-desk footrest SKU", "Verified gap: Frido has no product matching this category at all — the closest listing is a Leg Elevation Wedge Pillow, a different use case."]],
    chairs: [["Verify the chair's live Amazon rank", "Existence is confirmed (3D Posture Plus Ergonomic Chair, ~4.2★, 101 ratings) but a live rank check was blocked — re-run before deciding on ad spend here."]],
    orthotics: [["Assess marketplace fit for posture corrector", "No top-10 presence in a belt-brand-dominated category — decide whether this is a marketplace-push line or stays D2C-only."]],
    "personal-care": [["Seed visibility for nasal strips", "New line with no top-10 presence against established brands — needs an ad-led launch, not organic-only."]],
    insoles: [["Defend the #2 insoles position", "Frido already ranks #2 with ad backup — monitor the #1 and sustain review velocity."]],
    "mobility-devices": [["Fix wheelchair-cushion keyword targeting", "Ad runs with zero organic top-10 — align listing keywords to the search term being paid for."]],
  };

  const sel = $("#catSelect");
  sel.innerHTML = `<option value="">All categories</option>` + tax.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.onchange = () => { location.hash = sel.value ? "#/" + sel.value : "#/"; };

  let bestOnly = localStorage.getItem("fmi-best") !== "0"; // default ON — bestseller-only is the primary mode
  const bestToggle = $("#bestToggle");
  const syncBestToggle = () => bestToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b.dataset.best === "1") === bestOnly));
  bestToggle.querySelectorAll("button").forEach((b) => b.onclick = () => { bestOnly = b.dataset.best === "1"; localStorage.setItem("fmi-best", bestOnly ? "1" : "0"); syncBestToggle(); route(); });
  syncBestToggle();

  // ================= HOME =================
  function renderHome() {
    document.title = "Frido Marketplace Intelligence";
    sel.value = "";
    const rows = tax.categories.map((c) => {
      const infos = catInfos(c, bestOnly);
      const prim = infos[0];
      const status = catStatus(c, bestOnly);
      const leader = prim?.org[0];
      const azMp = infos.some((i) => i.org.length || i.verifiedAsin);
      const fkMp = infos.some((i) => i.fkr.length);
      return { c, infos, prim, status, leader, azMp, fkMp };
    });
    const live = rows.filter((r) => r.c.datasets.length);
    const leading = rows.filter((r) => r.status === "leading").length;
    const needsAction = rows.filter((r) => ["listed-not-ranked", "no-match", "needs-verification"].includes(r.status)).length;
    const bestsellerCoverage = live.length ? Math.round((rows.filter((r) => r.status === "leading" || r.status === "ranked").length / live.length) * 100) : 0;

    app.innerHTML = `
      <div class="stat-row">
        <div class="stat"><b>${leading}</b><span>Categories leading</span></div>
        <div class="stat"><b>${bestsellerCoverage}%</b><span>Bestseller coverage</span></div>
        <div class="stat"><b>${needsAction}</b><span>Need action</span></div>
        <div class="stat"><b>${tax.categories.length}</b><span>Categories tracked</span></div>
      </div>

      <div class="search-select">
        <input id="q" placeholder="Search categories…" aria-label="Search categories">
        <select id="statusFilter" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}
        </select>
      </div>

      <div class="cat-list-head t-label">
        <span>Category</span><span>Rank</span><span class="mp-h">Marketplace</span><span>Leader</span><span>Status</span>
      </div>
      <div class="cat-list" id="catList"></div>`;

    function paint() {
      const q = ($("#q").value || "").toLowerCase();
      const sf = $("#statusFilter").value;
      const visible = rows.filter((r) => (!q || r.c.name.toLowerCase().includes(q)) && (!sf || r.status === sf));
      $("#catList").innerHTML = visible.map((r) => {
        const c = r.c;
        if (!c.datasets.length) return `<a class="cat-row pending" href="#/${c.id}">
          <span class="name">${c.icon} ${esc(c.name)}</span><span class="rank">—</span><span class="mp"></span><span>—</span><span>${Status("pending")}</span></a>`;
        const rank = r.prim?.fridoOrg?.rank ? "#" + r.prim.fridoOrg.rank : (r.prim?.fridoSp ? "Ad only" : "—");
        return `<a class="cat-row" href="#/${c.id}">
          <span class="name">${c.icon} ${esc(c.name)}</span>
          <span class="rank">${rank}</span>
          <span class="mp">${r.azMp ? "Amazon" : ""}${r.azMp && r.fkMp ? " · " : ""}${r.fkMp ? "Flipkart" : ""}${!r.azMp && !r.fkMp ? "—" : ""}</span>
          <span>${r.leader ? esc(r.leader.frido ? "Frido" : r.leader.brand) : "—"}</span>
          <span>${Status(r.status)}</span></a>`;
      }).join("") || `<p class="t-muted" style="padding:20px 4px">No categories match.</p>`;
    }
    paint();
    $("#q").addEventListener("input", paint);
    $("#statusFilter").addEventListener("change", paint);
  }

  // ================= CATEGORY =================
  function renderCat(id) {
    const c = tax.categories.find((x) => x.id === id);
    if (!c) return renderHome();
    document.title = `${c.name} — Frido Intelligence`;
    sel.value = c.id;

    if (!c.datasets.length) {
      app.innerHTML = `<a class="crumb" href="#/">${I("arrow-left")} All categories</a>
        <h1 class="t-h1">${c.icon} ${esc(c.name)}</h1>
        <p class="t-ink2" style="margin-top:10px;max-width:56ch">${esc(c.pendingReason || "Not yet researched.")}</p>`;
      return;
    }

    const infosAll = catInfos(c, false);   // Frido's true facts — never hidden by the toggle
    const infosBest = catInfos(c, bestOnly); // competitor list — respects the Bestseller toggle
    const prim = infosAll[0];
    const primBest = infosBest[0];
    const status = catStatus(c, bestOnly);
    // Frido's own row: prefer a Bestseller-badged one if the toggle found one, else fall back to the true unfiltered row
    const fr = primBest.fridoOrg || prim.fridoOrg;
    const frSp = primBest.fridoSp || prim.fridoSp;

    // competitors, ranked by position, capped at 5 — drawn from the toggle-respecting list
    const compMap = {};
    infosBest.forEach((i) => i.org.forEach((r) => {
      if (r.frido) return;
      const k = r.brand.toLowerCase();
      (compMap[k] ||= { brand: r.brand, bestRank: 99, entry: r, mps: new Set(["Amazon"]) });
      if (r.rank < compMap[k].bestRank) { compMap[k].bestRank = r.rank; compMap[k].entry = r; }
    }));
    infosBest.forEach((i) => i.fkr.forEach((r) => { const k = r.brand.toLowerCase(); if (compMap[k]) compMap[k].mps.add("Flipkart"); }));
    const comps = Object.values(compMap).sort((a, b) => a.bestRank - b.bestRank).slice(0, 5);

    const correctionNote = c.correctionNote ? `<div class="correction-note">${I("info")}<span><b>Corrected:</b> ${esc(c.correctionNote)}</span></div>` : "";
    const manualNote = c.manualVerification ? `<div class="correction-note">${I("info")}<span><b>${STATUS_LABEL[c.manualVerification.status]}:</b> ${esc(c.manualVerification.note)}</span></div>` : "";

    // executive summary line — one sentence, states the fact plainly
    let summary;
    if (status === "leading") summary = `Frido is the #1 Bestseller on “${prim.keyword}.”`;
    else if (status === "ranked") summary = `Frido holds a Bestseller badge but isn't #1 on “${prim.keyword}.” ${comps[0] ? `${esc(comps[0].brand)} leads.` : ""}`;
    else if (status === "listed-not-ranked") summary = fr ? `Frido ranks #${fr.rank} organically on “${prim.keyword}” but doesn't carry the Bestseller badge.${comps[0] ? ` ${esc(comps[0].brand)} does.` : ""}` : `Frido has a real, verified listing but no Bestseller badge or top-10 rank on “${prim.keyword}.”`;
    else if (status === "no-match") summary = `Frido has no product that matches this category — a verified catalog gap.`;
    else summary = c.manualVerification ? esc(c.manualVerification.note) : `Evidence is incomplete for this category — treat as unverified, not absent.`;

    const posFacts = fr || frSp || prim.verifiedAsin ? [
      ["Rank", fr ? "#" + fr.rank : (frSp ? "Sponsored only" : "Not ranked")],
      ["Price", inr(fr?.price ?? frSp?.price ?? prim.verifiedPrice)],
      ["Rating", (fr?.rating ?? frSp?.rating ?? prim.verifiedRating) != null ? (fr?.rating ?? frSp?.rating ?? prim.verifiedRating) + "★" : "—"],
      ["Reviews", fmt(fr?.reviews ?? frSp?.reviews ?? prim.verifiedReviews)],
      ["Badge", (fr?.badge ?? frSp?.badge ?? prim.verifiedBadge) || "None"],
    ] : null;

    const compListRows = comps.map((m) => `
      <div class="comp-row">
        <span class="rk">#${m.bestRank}</span>
        <span class="nm"><b>${esc(m.brand)}</b><br>${m.entry.asin ? `<a href="https://www.amazon.in/dp/${m.entry.asin}" target="_blank" rel="noopener">View listing ↗</a>` : ""}</span>
        <span class="num">${inr(m.entry.price)}</span>
        <span class="num">${m.entry.rating ?? "—"}★</span>
        <span class="num">${fmt(m.entry.reviews)}</span>
        <span class="badge-y">${m.entry.badge === "Bestseller" ? "★ Bestseller" : m.entry.badge || "—"}</span>
      </div>`).join("");

    const whyRows = comps.length ? comps.map((m) => `
      <div class="row"><b>${esc(m.brand)}</b><span>— ${whyAbove(m.entry, fr).join(" · ")}</span></div>`).join("")
      : `<p class="t-muted">No bestseller competitors found on this keyword to compare against.</p>`;

    const actionRows = (actions[c.id] || []).slice(0, 3).map(([t, b], n) => `
      <div class="action"><span class="n">${n + 1}</span><div><h4>${esc(t)}</h4><p>${esc(b)}</p></div></div>`).join("")
      || `<p class="t-muted">No actions curated yet for this category.</p>`;

    // ---- secondary detail (collapsed): full rankings, keyword table, bars ----
    const kwTable = infosAll.map((i) => `
      <div class="comp-row" style="grid-template-columns:1.4fr .8fr .6fr .8fr">
        <span class="nm"><b>${esc(i.keyword)}</b></span>
        <span class="num">${i.fridoOrg ? "#" + i.fridoOrg.rank : "—"}</span>
        <span class="num">${i.fridoSp?.slot || i.az?.fridoSponsoredSlot || "—"}</span>
        <span class="num">${i.fridoFk ? "#" + i.fridoFk.pos : "—"}</span>
      </div>`).join("");

    function rankTable(rows, az) {
      if (!rows.length) return `<p class="t-muted">No results.</p>`;
      return `<table class="tbl"><thead><tr><th>#</th><th>Product</th><th class="num">Price</th><th class="num">Rating</th><th class="num">Reviews</th>${az ? "<th>Badge</th>" : ""}</tr></thead>
        <tbody>${rows.map((r) => `<tr class="${r.frido ? "frido-row" : ""}">
          <td>${r.rank || r.slot || r.pos}</td>
          <td>${az && r.asin ? `<a href="https://www.amazon.in/dp/${r.asin}" target="_blank" rel="noopener"><span class="clip" title="${esc(r.title)}">${esc(r.brand)}${r.frido ? " (Frido)" : ""} — ${esc(r.title)}</span></a>` : `<span class="clip" title="${esc(r.title)}">${esc(r.brand)} — ${esc(r.title)}</span>`}</td>
          <td class="num">${inr(r.price)}</td><td class="num">${r.rating ?? "—"}</td><td class="num">${fmt(r.reviews)}</td>
          ${az ? `<td>${r.badge || "—"}</td>` : ""}</tr>`).join("")}</tbody></table>`;
    }
    function bars(rows, field, fmtV) {
      const vals = rows.filter((r) => r[field] != null);
      if (!vals.length) return `<p class="t-muted">No data.</p>`;
      const mx = Math.max(...vals.map((r) => r[field]));
      return `<div class="bars">${rows.map((r) => `<div class="brow ${r.frido ? "frido" : ""}"><span class="bl">#${r.rank} ${r.frido ? "Frido" : esc(r.brand)}</span><span class="btrack"><span class="bfill" style="width:${Math.max(2, (r[field] / mx) * 100)}%"></span></span><span class="bv">${fmtV(r[field])}</span></div>`).join("")}</div>`;
    }
    const kwTabs = infosAll.length > 1 ? `<div class="kw-tabs">${infosAll.map((i, n) => `<button class="${n === 0 ? "on" : ""}" data-kw="${n}">${esc(i.keyword)}</button>`).join("")}</div>` : "";
    const kwPanes = infosAll.map((i, n) => `<div class="kwpane" data-pane="${n}" ${n ? "hidden" : ""}>
      <h4>Organic rankings — Amazon</h4>${rankTable(i.org, true)}
      <h4>Sponsored rankings — Amazon</h4>${rankTable(i.sp, true)}
      <h4>Flipkart page 1</h4>${i.fkr.length ? rankTable(i.fkr, false) : `<p class="t-muted">${bestOnly ? "No Bestseller signal captured for Flipkart — Needs Verification, not absent." : "No capture for this keyword."}</p>`}
      <h4>Pricing comparison</h4>${bars(i.org, "price", inr)}
      <h4>Review comparison</h4>${bars(i.org, "reviews", fmt)}
      ${(i.az?.notes || []).length ? `<h4>Analyst notes</h4><ul style="padding-left:18px;font-size:13px;color:var(--ink-2);display:grid;gap:6px">${i.az.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");

    app.innerHTML = `
      <a class="crumb" href="#/">${I("arrow-left")} All categories</a>
      ${correctionNote}${manualNote}

      <div class="section">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <h1 class="t-h1">${c.icon} ${esc(c.name)}</h1>${Status(status)}
        </div>
        <p class="t-ink2" style="margin-top:10px;max-width:64ch;font-size:15px">${summary}</p>
      </div>

      <div class="section">
        ${`<div class="t-label" style="margin-bottom:10px">Frido position</div>`}
        ${posFacts ? `<div class="pos-grid">${posFacts.map(([l, v]) => `<div><div class="k">${v}</div><div class="l">${l}</div></div>`).join("")}</div>`
          : `<p class="t-ink2">No verified Frido listing found for this keyword.</p>`}
        <p class="t-muted" style="margin-top:6px">Opportunity: ${opportunity(status)}</p>
      </div>

      <div class="section">
        <div class="t-label" style="margin-bottom:10px">${bestOnly ? "Top Bestseller competitors" : "Top competitors"}</div>
        ${comps.length ? `<div class="comp-list-head t-label"><span></span><span>Brand</span><span class="num">Price</span><span class="num">Rating</span><span class="num">Reviews</span><span class="bd-h">Badge</span></div><div class="comp-list">${compListRows}</div>` : `<p class="t-muted">None found — ${bestOnly ? "no Bestseller-badged competitors on this keyword." : "no competitors captured."}</p>`}
      </div>

      <div class="section">
        <div class="t-label" style="margin-bottom:10px">Why they rank higher</div>
        <div class="why-list">${whyRows}</div>
      </div>

      <div class="section">
        <div class="t-label" style="margin-bottom:10px">Top 3 actions</div>
        <div class="action-list">${actionRows}</div>
      </div>

      <details class="more">
        <summary>${I("chevron-down")}More data: keyword breakdown, full rankings, pricing<span class="chev">${I("chevron-down")}</span></summary>
        <div class="inner">
          <h4>Keyword breakdown</h4>
          <div class="comp-list-head t-label" style="grid-template-columns:1.4fr .8fr .6fr .8fr"><span>Keyword</span><span class="num">Amazon</span><span class="num">Ad slot</span><span class="num">Flipkart</span></div>
          ${kwTable}
          ${kwTabs}${kwPanes}
        </div>
      </details>
      <p class="t-muted" style="margin-top:24px">Source: live amazon.in / flipkart.com page-1 scrape, ${prim.az?.capturedAt || tax.asOf}. Confidence: high for on-page facts; “why” reasons cite only measured deltas.</p>`;

    $(".kw-tabs")?.querySelectorAll("[data-kw]").forEach((b) => b.onclick = () => {
      $(".kw-tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      app.querySelectorAll(".kwpane").forEach((p) => p.hidden = p.dataset.pane !== b.dataset.kw);
    });
  }

  function route() {
    closePop();
    const m = location.hash.match(/^#\/([\w-]+)/);
    if (m && m[1]) renderCat(m[1]); else renderHome();
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  route();
})();
