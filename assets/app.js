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

  // generic marketing/descriptor words are never a brand name — skip past them to find the real one
  const GENERIC_LEAD = /^(premium|ultimate|deluxe|adjustable|orthopedic|memory|foam|best|classic|new|original|multi-purpose|multipurpose|professional|pro|dual|advanced|super|the|sponsored|ad|luxury|comfort|soft|extra|large|portable|heavy|duty|ergonomic|posture|cushioned|breathable|waterproof)$/i;
  const brandOf = (t) => {
    const words = String(t || "").split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length - 1 && GENERIC_LEAD.test(words[i].replace(/[^\w-]/g, ""))) i++;
    const rest = words.slice(i).join(" ");
    const m = rest.match(/^[A-Za-z][\w.'()-]*(?:\s+[A-Z][\w.'()-]*)?/);
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
  app.innerHTML = `<div class="kpi-row">${'<div class="glass kpi" style="min-height:96px"></div>'.repeat(5)}</div>`;

  const tax = await (await fetch("data/taxonomy.json")).json();
  const dsIds = tax.categories.flatMap((c) => c.datasets.map((d) => d.id));
  const store = {};
  await Promise.all(dsIds.map(async (id) => {
    const g = async (mp) => { try { return await (await fetch(`data/${mp}/${id}.json`)).json(); } catch { return null; } };
    store[id] = { az: await g("amazon-in"), fk: await g("flipkart") };
  }));
  $("#tbMeta").innerHTML = `Snapshot <span class="yl">${tax.asOf}</span> · last updated ${tax.asOf}`;
  $("#sbUpdated").textContent = tax.asOf;

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

  // ---------- marketplace rank: always states which marketplace, never a bare "#N" ----------
  function mpRank(infosAll, mp) {
    const vals = infosAll.map((i) => (mp === "az" ? i.fridoOrg?.rank : i.fridoFk?.pos)).filter((v) => v != null);
    if (vals.length) return { kind: "rank", value: Math.min(...vals) };
    if (mp === "az") {
      if (infosAll.some((i) => i.fridoSp)) return { kind: "sponsored" };
      if (infosAll.some((i) => i.verifiedAsin)) return { kind: "listed" };
      if (infosAll.some((i) => i.brandQualified)) return { kind: "not-listed" };
    }
    return { kind: "needs-verification" }; // Flipkart has no brand-qualified check yet — never assumed absent
  }
  const mpRankLabel = (r, mp) => {
    if (r.kind === "rank") return `${mp === "az" ? "Amazon" : "Flipkart"} Rank #${r.value}`;
    if (r.kind === "sponsored") return "Amazon: Sponsored only";
    if (r.kind === "listed") return `${mp === "az" ? "Amazon" : "Flipkart"}: Listed`;
    if (r.kind === "not-listed") return `${mp === "az" ? "Amazon" : "Flipkart"}: Not Listed`;
    return `${mp === "az" ? "Amazon" : "Flipkart"}: Needs Verification`;
  };
  // a category-level verified "not-listed" override always wins — even if a brand-check turned up a different, non-matching product
  const catMpRank = (c, infosAll, mp) => (c.forcedStatus === "not-listed" ? { kind: "not-listed" } : mpRank(infosAll, mp));
  const mpRankShort = (r) => {
    if (r.kind === "rank") return "#" + r.value;
    if (r.kind === "sponsored") return "Sponsored";
    if (r.kind === "listed") return "Listed";
    if (r.kind === "not-listed") return "Not Listed";
    return "Needs Verification";
  };

  // ---------- status: exactly 3 values, deterministic rules, never assumes absence ----------
  const STATUS_LABEL = { listed: "Listed", "not-listed": "Not Listed", "needs-verification": "Needs Verification" };
  function catStatus(c) {
    if (c.forcedStatus) return c.forcedStatus;
    if (!c.datasets.length) return "needs-verification";
    const infosAll = catInfos(c, false); // true facts — never hidden by the Bestseller toggle
    if (infosAll.some((i) => i.fridoOrg || i.fridoSp || i.fridoFk || i.verifiedAsin)) return "listed";
    if (infosAll.some((i) => i.brandQualified)) return "not-listed"; // a brand-qualified search ran and found nothing at all
    return "needs-verification"; // never brand-verified, no organic hit — genuinely unclear, not absent
  }
  const Status = (s) => `<span class="status ${s}" data-tip="${esc(tax.statusLegend[s] || "")}"><i></i>${STATUS_LABEL[s]}</span>`;

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

  // curated top-3 actions per category — imperative, evidence-cited.
  // NOTE: entries here are written against a specific research snapshot and go stale
  // once a category is re-researched at full SKU depth (its facts/ranks/badges change).
  // Categories already rewired onto frido-product-catalog.json have their stale entry
  // removed rather than left showing an outdated claim; fresh ones are pending a
  // data-driven pass once all 16 categories are on the new research.
  const actions = {
    socks: [["Scale the Five Toe Socks ad", "The only Frido sock SKU carries a Bestseller badge via a sponsored ad, but has just 14 reviews and no generic-keyword visibility — increase ad spend and seed reviews before pulling back."]],
    orthotics: [["Assess marketplace fit for posture corrector", "No top-10 presence in a belt-brand-dominated category — decide whether this is a marketplace-push line or stays D2C-only."]],
    "personal-care": [["Seed visibility for nasal strips", "New line with no top-10 presence against established brands — needs an ad-led launch, not organic-only."]],
    "mobility-devices": [["Fix wheelchair-cushion keyword targeting", "Ad runs with zero organic top-10 — align listing keywords to the search term being paid for."]],
  };

  const sel = $("#catSelect");
  sel.innerHTML = `<option value="">All categories</option>` + tax.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.onchange = () => { location.hash = sel.value ? "#/" + sel.value : "#/"; };

  let bestOnly = localStorage.getItem("fmi-best") !== "0"; // default ON — bestseller-only is the primary mode
  const bestToggle = $("#bestToggle");
  const syncBestToggle = () => {
    bestToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b.dataset.best === "1") === bestOnly));
    $("#sbBestsellers").classList.toggle("on", bestOnly);
  };
  bestToggle.querySelectorAll("button").forEach((b) => b.onclick = () => { bestOnly = b.dataset.best === "1"; localStorage.setItem("fmi-best", bestOnly ? "1" : "0"); syncBestToggle(); route(); });
  syncBestToggle();
  $("#sbBestsellers").onclick = (e) => { e.preventDefault(); bestOnly = true; localStorage.setItem("fmi-best", "1"); syncBestToggle(); location.hash = "#/"; route(); };

  // sidebar: category flyout list (real nav, not decorative)
  const sbCats = $("#sbCats"), sbCatsToggle = $("#sbCatsToggle");
  sbCats.innerHTML = tax.categories.map((c) => `<a href="#/${c.id}" data-cat-link="${c.id}">${c.icon} ${esc(c.name)}</a>`).join("");
  sbCatsToggle.onclick = (e) => { e.preventDefault(); sbCats.hidden = !sbCats.hidden; };

  // sidebar: CSV export (real data, same shape as the overview table)
  $("#sbExport").onclick = (e) => {
    e.preventDefault();
    const rows = [["Category", "Priority", "SKUs", "Amazon Rank", "Flipkart Rank", "Status"]];
    tax.categories.forEach((c) => {
      const infosAll = catInfos(c, false);
      const azR = catMpRank(c, infosAll, "az"), fkR = catMpRank(c, infosAll, "fk");
      rows.push([c.name, c.priority, c.datasets.length, mpRankShort(azR), mpRankShort(fkR), STATUS_LABEL[catStatus(c)]]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `frido-marketplace-overview-${tax.asOf}.csv`; a.click();
  };

  function syncSidebarActive(catId) {
    document.querySelectorAll(".sb-item[data-nav]").forEach((el) => el.classList.remove("on"));
    document.querySelectorAll(".sb-cats a").forEach((el) => el.classList.toggle("on", el.dataset.catLink === catId));
    if (catId) { sbCatsToggle.classList.add("on"); sbCats.hidden = false; }
    else { $('.sb-item[data-nav="overview"]').classList.add("on"); }
    if (bestOnly) $("#sbBestsellers").classList.add("on");
  }

  // ================= HOME =================
  function renderHome() {
    document.title = "Frido Marketplace Intelligence";
    sel.value = "";
    syncSidebarActive(null);
    const rows = tax.categories.map((c) => {
      const infosAll = catInfos(c, false); // true facts — never hidden by the Bestseller toggle
      const infosBest = catInfos(c, true); // for the "has a Bestseller-badged rank" opportunity check
      const infos = catInfos(c, bestOnly); // competitor list respects the UI toggle
      const prim = infosAll[0];
      const status = catStatus(c);
      const leader = prim?.org[0];
      const azRank = catMpRank(c, infosAll, "az");
      const fkRank = catMpRank(c, infosAll, "fk");
      const hasBadgeRank = infosBest.some((i) => i.fridoOrg || i.fridoSp);
      return { c, infos, infosAll, prim, status, leader, azRank, fkRank, hasBadgeRank };
    });
    const live = rows.filter((r) => r.c.datasets.length);
    const needsAction = rows.filter((r) => r.status !== "listed" || !r.hasBadgeRank);

    const totalSkus = tax.categories.reduce((a, c) => a + c.datasets.length, 0);
    const rankedSkuCount = rows.reduce((a, r) => a + r.infosAll.filter((i) => i.fridoOrg || i.fridoFk).length, 0);
    const azRanks = rows.flatMap((r) => r.infosAll.map((i) => i.fridoOrg?.rank).filter((v) => v != null));
    const fkRanks = rows.flatMap((r) => r.infosAll.map((i) => i.fridoFk?.pos).filter((v) => v != null));
    const avgAz = azRanks.length ? (azRanks.reduce((a, b) => a + b, 0) / azRanks.length).toFixed(1) : "—";
    const avgFk = fkRanks.length ? (fkRanks.reduce((a, b) => a + b, 0) / fkRanks.length).toFixed(1) : "—";

    const kpis = [
      ["layers", "Categories Tracked", tax.categories.length, `${live.length} live`],
      ["package", "Total SKUs", totalSkus, "tracked SKUs/keywords"],
      ["award", "Ranked SKUs", rankedSkuCount, "ranked on Amazon or Flipkart"],
      ["trending-up", "Average Amazon Rank", avgAz, azRanks.length ? `across ${azRanks.length} SKUs` : "no ranked SKUs"],
      ["trending-up", "Average Flipkart Rank", avgFk, fkRanks.length ? `across ${fkRanks.length} SKUs` : "no ranked SKUs"],
    ];

    // Top Opportunities — real, computed from status + a measured review/price gap to the nearest bestseller rival, never an invented score
    const oppRows = needsAction.map((r) => {
      const primAll = r.infosAll[0];
      let gapText = "Evidence incomplete";
      if (primAll?.fridoOrg) {
        const rivalTop = (primAll.org || []).find((x) => !x.frido && x.badge === "Bestseller");
        if (rivalTop) gapText = `${esc(rivalTop.brand)} ${fmt(rivalTop.reviews)} rev vs Frido ${fmt(primAll.fridoOrg.reviews)}`;
        else gapText = `Ranks #${primAll.fridoOrg.rank}, no Bestseller badge`;
      } else if (primAll?.verifiedAsin) gapText = "Verified listing, no top-10 rank";
      else if (r.status === "not-listed") gapText = "Verified catalog gap";
      return { r, gapText, n: (actions[r.c.id] || []).length };
    }).sort((a, b) => (a.r.c.priority < b.r.c.priority ? -1 : 1)).slice(0, 5);

    const bestRows = rows.filter((r) => r.status === "listed" && r.hasBadgeRank)
      .sort((a, b) => (a.azRank.value ?? 99) - (b.azRank.value ?? 99)).slice(0, 5);

    app.innerHTML = `
      <div class="kpi-row">${kpis.map(([ic, l, v, t]) => `
        <div class="glass kpi"><span class="k-ic">${I(ic)}</span><span class="k-val">${v}</span><span class="k-lbl">${l}</span><span class="k-trend">${t} · first snapshot</span></div>`).join("")}</div>

      <div class="dash-layout">
        <div>
          <div class="panel-head"><span class="ic">${I("layout-grid")}</span><h2>Category Overview</h2><span class="cnt">${tax.categories.length} categories</span></div>
          <div class="search-select">
            <input id="q" placeholder="Search categories…" aria-label="Search categories">
            <select id="statusFilter" aria-label="Filter by status">
              <option value="">All statuses</option>
              ${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}
            </select>
          </div>
          <div class="cat-grid" id="catGrid"></div>
        </div>

        <div class="insight-panel">
          <div class="glass insight-card">
            <div class="panel-head" style="margin-bottom:10px"><span class="ic">${I("lightbulb")}</span><h2 style="font-size:13.5px">Top Opportunities</h2></div>
            ${oppRows.length ? oppRows.map(({ r, gapText, n }) => `
              <a class="insight-row" href="#/${r.c.id}"><span class="ic-sm">${r.c.icon}</span>
                <span class="txt"><b>${esc(r.c.name)}</b><span>${esc(gapText)}</span></span>
                <span class="tag">${n} action${n === 1 ? "" : "s"}</span></a>`).join("")
              : `<p class="t-muted">All live categories already hold a Bestseller-badged rank.</p>`}
          </div>

          <div class="glass insight-card">
            <div class="panel-head" style="margin-bottom:10px"><span class="ic">${I("crown")}</span><h2 style="font-size:13.5px">Best Performing</h2></div>
            ${bestRows.length ? bestRows.map((r) => `
              <a class="insight-row" href="#/${r.c.id}"><span class="ic-sm">${r.c.icon}</span>
                <span class="txt"><b>${esc(r.c.name)}</b><span>${mpRankLabel(r.azRank, "az")}</span></span>
                ${Status(r.status)}</a>`).join("")
              : `<p class="t-muted">No categories with a Bestseller-badged rank yet.</p>`}
          </div>

          <div class="glass insight-card">
            <div class="panel-head" style="margin-bottom:10px"><span class="ic">${I("zap")}</span><h2 style="font-size:13.5px">Quick Actions</h2></div>
            <div class="qa-grid">
              <button class="qa-btn" id="qaTop">${I("target")}Top Opportunity</button>
              <button class="qa-btn" id="qaCompetitors">${I("swords")}View Competitors</button>
              <button class="qa-btn" id="qaExport">${I("download")}Export Report</button>
              <button class="qa-btn" id="qaToggle">${I("award")}Toggle Bestsellers</button>
            </div>
          </div>
        </div>
      </div>`;

    function paint() {
      const q = ($("#q").value || "").toLowerCase();
      const sf = $("#statusFilter").value;
      const visible = rows.filter((r) => (!q || r.c.name.toLowerCase().includes(q)) && (!sf || r.status === sf));
      $("#catGrid").innerHTML = visible.map((r) => {
        const c = r.c;
        if (!c.datasets.length) return `<a class="glass cat-card pending" href="#/${c.id}">
          <div class="cc-top"><span class="cc-ic">${c.icon}</span><h3>${esc(c.name)}</h3></div>
          ${Status("needs-verification")}</a>`;
        const leaderName = r.leader ? (r.leader.frido ? "Frido" : esc(r.leader.brand.slice(0, 14))) : "—";
        return `<a class="glass cat-card" href="#/${c.id}">
          <div class="cc-top"><span class="cc-ic">${c.icon}</span><h3>${esc(c.name)}</h3></div>
          <div class="cc-stats">
            <div><b>${mpRankShort(r.azRank)}</b>Amazon Rank</div>
            <div><b>${mpRankShort(r.fkRank)}</b>Flipkart Rank</div>
            <div><b>${c.datasets.length}</b>SKUs</div>
            <div><b>${leaderName}</b>Leader</div>
          </div>
          ${Status(r.status)}</a>`;
      }).join("") || `<p class="t-muted" style="padding:20px 4px">No categories match.</p>`;
    }
    paint();
    $("#q").addEventListener("input", paint);
    $("#statusFilter").addEventListener("change", paint);

    $("#qaTop").onclick = () => { if (oppRows[0]) location.hash = "#/" + oppRows[0].r.c.id; };
    $("#qaCompetitors").onclick = () => { if (oppRows[0]) location.hash = "#/" + oppRows[0].r.c.id; else if (bestRows[0]) location.hash = "#/" + bestRows[0].c.id; };
    $("#qaExport").onclick = () => $("#sbExport").click();
    $("#qaToggle").onclick = () => bestToggle.querySelector(`button[data-best="${bestOnly ? 0 : 1}"]`).click();
  }

  // ================= CATEGORY =================
  function renderCat(id) {
    const c = tax.categories.find((x) => x.id === id);
    if (!c) return renderHome();
    document.title = `${c.name} — Frido Intelligence`;
    sel.value = c.id;
    syncSidebarActive(c.id);

    if (!c.datasets.length) {
      app.innerHTML = `<a class="crumb" href="#/">${I("arrow-left")} All categories</a>
        <div class="glass glass-block">
          <h1 class="t-h1">${c.icon} ${esc(c.name)}</h1>
          <p class="t-ink2" style="margin-top:10px;max-width:56ch">${esc(c.pendingReason || "Not yet researched.")}</p>
        </div>`;
      return;
    }

    const infosAll = catInfos(c, false);   // Frido's true facts — never hidden by the toggle
    const infosBest = catInfos(c, bestOnly); // competitor list — respects the Bestseller toggle
    const prim = infosAll[0];
    const primBest = infosBest[0];
    const status = catStatus(c);
    // Frido's own row: prefer a Bestseller-badged one if the toggle found one, else fall back to the true unfiltered row
    const fr = primBest.fridoOrg || prim.fridoOrg;
    const frSp = primBest.fridoSp || prim.fridoSp;
    const azR = catMpRank(c, infosAll, "az");
    const fkR = catMpRank(c, infosAll, "fk");

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

    // executive summary line — one sentence, states the fact plainly, always names the marketplace
    let summary;
    if (status === "listed") {
      const parts = [];
      if (azR.kind === "rank") parts.push(`Amazon Rank #${azR.value}${fr?.badge === "Bestseller" ? " (Bestseller badge)" : ""}`);
      else if (azR.kind === "sponsored") parts.push("sponsored-only on Amazon");
      else if (azR.kind === "listed") parts.push("a verified Amazon listing (rank unclear)");
      else parts.push("Amazon: Needs Verification");
      if (fkR.kind === "rank") parts.push(`Flipkart Rank #${fkR.value}`);
      else parts.push("Flipkart: Needs Verification");
      summary = `Frido is listed for “${prim.keyword}” — ${parts.join(" · ")}.${comps[0] && azR.kind === "rank" && azR.value > 1 ? ` ${esc(comps[0].brand)} ranks above Frido.` : ""}`;
    } else if (status === "not-listed") {
      summary = `Frido has no product that matches this category — a verified catalog gap.`;
    } else {
      summary = `Evidence is incomplete for this category — treat as unverified, not absent.`;
    }

    const posFacts = [
      ["Amazon Rank", mpRankShort(azR)],
      ["Flipkart Rank", mpRankShort(fkR)],
      ["Price", inr(fr?.price ?? frSp?.price ?? prim.verifiedPrice)],
      ["Rating", (fr?.rating ?? frSp?.rating ?? prim.verifiedRating) != null ? (fr?.rating ?? frSp?.rating ?? prim.verifiedRating) + "★" : "—"],
      ["Reviews", fmt(fr?.reviews ?? frSp?.reviews ?? prim.verifiedReviews)],
      ["Badge", (fr?.badge ?? frSp?.badge ?? prim.verifiedBadge) || "None"],
    ];

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
      ${correctionNote}

      <div class="section glass glass-block">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <h1 class="t-h1">${c.icon} ${esc(c.name)}</h1>${Status(status)}
        </div>
        <p class="t-ink2" style="margin-top:10px;max-width:64ch;font-size:15px">${summary}</p>
      </div>

      <div class="section glass glass-block">
        <div class="panel-head"><span class="ic">${I("target")}</span><h2 style="font-size:13.5px">Frido Position</h2></div>
        <div class="pos-grid">${posFacts.map(([l, v]) => `<div><div class="k">${v}</div><div class="l">${l}</div></div>`).join("")}</div>
      </div>

      <div class="section glass glass-block">
        <div class="panel-head"><span class="ic">${I("swords")}</span><h2 style="font-size:13.5px">${bestOnly ? "Top Bestseller Competitors" : "Top Competitors"}</h2></div>
        ${comps.length ? `<div class="comp-list-head t-label"><span></span><span>Brand</span><span class="num">Price</span><span class="num">Rating</span><span class="num">Reviews</span><span class="bd-h">Badge</span></div><div class="comp-list">${compListRows}</div>` : `<p class="t-muted">None found — ${bestOnly ? "no Bestseller-badged competitors on this keyword." : "no competitors captured."}</p>`}
      </div>

      <div class="section glass glass-block">
        <div class="panel-head"><span class="ic">${I("info")}</span><h2 style="font-size:13.5px">Why They Rank Higher</h2></div>
        <div class="why-list">${whyRows}</div>
      </div>

      <div class="section glass glass-block">
        <div class="panel-head"><span class="ic">${I("lightbulb")}</span><h2 style="font-size:13.5px">Top 3 Actions</h2></div>
        <div class="action-list">${actionRows}</div>
      </div>

      <details class="more glass glass-block">
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
    const m = location.hash.match(/^#\/([\w-]+)/);
    if (m && m[1]) renderCat(m[1]); else renderHome();
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  route();
})();
